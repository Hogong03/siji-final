<script setup>
/**
 * 记录阅读页（3.9.0 引入；4.1.0 版式重做）
 *
 * 版式（本项目阅读模式的设计基线）：
 *   一屏只有三层信息：标题 → 章节 → 正文
 *   - 封面头部：小字元信息（字数 / 小节数 / 标签）+ 大标题 + 编辑入口
 *   - 章节标题：两位编号（01 / 02）压住视觉，标题本身加粗；不用竖线（长文里竖线太吵）
 *   - 正文：28rpx / 行高 1.85 / 段间距，MarkdownRenderer 负责行内样式
 *   阅读辅助：
 *   - 顶部右侧常驻「当前章节 n/N」，滚动时跟着变
 *   - 底部 3rpx 进度条（读了百分之多少）
 *   - 左侧目录尺：点 / 拖跳小节，拖动时浮出小节名，视口指示跟随
 *   - 滚过一屏出现「回到顶部」
 *
 * 入口：记录详情右上「阅读」。
 */
import { ref, computed, onMounted } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import MarkdownRenderer from '@/components/chat/MarkdownRenderer.vue'
import { useOutlineRuler } from '@/composables/useOutlineRuler.js'
import { splitSections, extractOutline, shouldShowOutline } from '@/utils/text-outline.js'
import { getDiaryList } from '@/utils/storage.js'

const clientId = ref('')
const month = ref('')
const record = ref(null)
const loading = ref(true)
const showTopBtn = ref(false)

const title = computed(() => (record.value && record.value.title) || '未命名记录')
const content = computed(() => (record.value && record.value.content) || '')
const tags = computed(() => {
	const t = record.value && record.value.tags
	return Array.isArray(t) ? t : []
})

const sections = computed(() => splitSections(content.value))
const outline = computed(() => extractOutline(content.value))
const hasOutline = computed(() => shouldShowOutline(outline.value.length))
const wordCount = computed(() => content.value.replace(/\s+/g, '').length)

/** 章节序号：只给有标题的节编号（01 / 02 …） */
const sectionNumbers = computed(() => {
	const map = {}
	let n = 0
	sections.value.forEach(s => {
		if (s.title) {
			n += 1
			map[s.key] = String(n).padStart(2, '0')
		}
	})
	return map
})

const scrollIntoView = ref('')
const scrollWithAnim = ref(false)
const {
	readProgress, activeSection,
	rulerVisible, rulerTicks, rulerActiveKey,
	rulerViewportStyle, rulerPreview, rulerPreviewStyle,
	syncScroll, resetRuler, measureSoon,
	handleTouchStart, handleTouchMove, handleTouchEnd, handleTap
} = useOutlineRuler({
	sections,
	outline,
	scrollIntoView,
	scrollWithAnim,
	scrollId: '#read-scroll',
	trackId: '#read-ruler-track'
})

function handleScroll(e) {
	syncScroll(e)
	const detail = e && e.detail
	if (detail) showTopBtn.value = (detail.scrollTop || 0) > 600
}

function backToTop() {
	scrollIntoView.value = ''
	scrollWithAnim.value = true
	setTimeout(() => { scrollIntoView.value = 'sec-view-0' }, 20)
	showTopBtn.value = false
}

function loadRecord() {
	loading.value = true
	try {
		const list = getDiaryList(month.value)
		record.value = list.find(item => item && item.client_id === clientId.value) || null
	} catch (e) {
		record.value = null
	} finally {
		loading.value = false
	}
}

function goEdit() {
	uni.navigateTo({ url: `/pages/diary/detail?clientId=${clientId.value}&month=${month.value}` })
}

onLoad((options) => {
	clientId.value = (options && options.clientId) || ''
	month.value = (options && options.month) || ''
})

onMounted(() => {
	loadRecord()
	setTimeout(measureSoon, 300)
})

onShow(() => {
	if (clientId.value) loadRecord()
	resetRuler()
})
</script>

<template>
	<view class="read-page">
		<!-- 封面头部 -->
		<view class="read-head">
			<view class="head-meta">
				<text class="meta-text">{{ wordCount }} 字<text v-if="hasOutline"> · {{ outline.length }} 小节</text></text>
				<text v-for="t in tags" :key="t" class="meta-tag">#{{ t }}</text>
				<text v-if="activeSection" class="meta-section">{{ activeSection.index }}/{{ activeSection.total }} {{ activeSection.title }}</text>
				<view class="head-edit" @tap="goEdit"><text>编辑</text></view>
			</view>
			<text class="head-title">{{ title }}</text>
		</view>

		<!-- 正文 + 目录尺 -->
		<view class="read-body" :class="{ 'has-ruler': rulerVisible }">
			<scroll-view
				id="read-scroll"
				class="read-scroll"
				scroll-y
				:show-scrollbar="false"
				:scroll-into-view="scrollIntoView"
				:scroll-with-animation="scrollWithAnim"
				@scroll="handleScroll"
			>
				<view class="read-content">
					<view
						v-for="sec in sections"
						:key="sec.key"
						:id="'sec-view-' + sec.index"
						class="read-section"
						:class="{ 'is-chapter': !!sec.title }"
					>
						<view v-if="sec.title" class="chapter-head">
							<text class="chapter-no">{{ sectionNumbers[sec.key] }}</text>
							<text class="chapter-title">{{ sec.title }}</text>
						</view>
						<MarkdownRenderer v-if="sec.body" :content="sec.body" />
					</view>

					<view v-if="!loading && !content" class="read-empty">
						<text class="read-empty-text">这条记录还没有内容</text>
					</view>

					<!-- 读完提示：给一个自然的收尾 -->
					<view v-if="content" class="read-end">
						<text class="read-end-text">— 读完 —</text>
					</view>
					<view class="read-bottom-space" />
				</view>
			</scroll-view>

			<!-- 目录尺 -->
			<view
				v-if="rulerVisible"
				id="read-ruler"
				class="read-ruler"
				@touchstart="handleTouchStart"
				@touchmove="handleTouchMove"
				@touchend="handleTouchEnd"
				@touchcancel="handleTouchEnd"
				@tap="handleTap"
			>
				<view id="read-ruler-track" class="ruler-track">
					<!-- 脊柱：一条极浅的竖线，刻度挂在它右侧，读起来是「尺子」而不是滚动条 -->
					<view class="ruler-spine" />
					<view class="ruler-viewport" :style="rulerViewportStyle" />
					<view
						v-for="t in rulerTicks"
						:key="t.key"
						class="ruler-tick"
						:class="{ 'tick-active': t.key === rulerActiveKey }"
						:style="{ top: t.percent + '%' }"
					>
						<view class="ruler-bar" />
					</view>
					<view v-if="rulerPreview" class="ruler-preview" :style="rulerPreviewStyle">
						<text class="ruler-preview-text">{{ rulerPreview.label }}</text>
					</view>
				</view>
			</view>
		</view>

		<!-- 回到顶部 -->
		<view v-if="showTopBtn" class="to-top" @tap="backToTop">
			<text class="to-top-text">↑</text>
		</view>

		<!-- 底部进度条 -->
		<view class="read-progress">
			<view class="read-progress-fill" :style="{ width: readProgress + '%' }" />
		</view>
	</view>
</template>

<style lang="scss" scoped>
@import './read.scss';
</style>