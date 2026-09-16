<script setup>
/**
 * 记录阅读页（3.9.0）
 *
 * 为什么单独一页：记录详情页是「编辑器」（textarea），长文在里面既读不出层次、
 * 也没法做章节跳转。这里给长记录一个只读阅读视图：
 *   - 正文按章节切开，每节用 MarkdownRenderer 渲染（标题/列表/加粗都正常显示）
 *   - 左侧目录尺（与聊天页对话尺同一手感）：点 / 拖刻度跳小节，拖动时显示小节名，
 *     滚动时视口指示跟随、当前小节高亮
 *   - 章节少于 3 节时不显示尺子（短记录没必要）
 *
 * 入口：记录详情页右上「阅读」；记录列表点进详情再进来。
 * 参数：clientId + month（与详情页一致，按月分片取记录）
 */
import { ref, computed, onMounted } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import MarkdownRenderer from '@/components/chat/MarkdownRenderer.vue'
import { useOutlineRuler } from '@/composables/useOutlineRuler.js'
import { splitSections, shouldShowOutline } from '@/utils/text-outline.js'
import { getDiaryList } from '@/utils/storage.js'

const clientId = ref('')
const month = ref('')
const record = ref(null)
const loading = ref(true)

const title = computed(() => (record.value && record.value.title) || '未命名记录')
const content = computed(() => (record.value && record.value.content) || '')
const tags = computed(() => {
	const t = record.value && record.value.tags
	return Array.isArray(t) ? t : []
})

/** 切好的小节：有标题的走锚点，没有标题的开头段照常渲染 */
const sections = computed(() => splitSections(content.value))
const hasOutline = computed(() => shouldShowOutline(sections.value.filter(s => s.title).length))
const wordCount = computed(() => content.value.replace(/\s+/g, '').length)

// 目录尺：所有小节都在 DOM 里，跳转用锚点精确到位
const scrollIntoView = ref('')
const scrollWithAnim = ref(false)
const {
	rulerVisible, rulerTicks, rulerActiveKey,
	rulerViewportStyle, rulerPreview, rulerPreviewStyle,
	syncScroll, resetRuler, measureSoon,
	handleTouchStart, handleTouchMove, handleTouchEnd, handleTap
} = useOutlineRuler({
	sections,
	scrollIntoView,
	scrollWithAnim,
	scrollId: '#read-scroll',
	trackId: '#read-ruler-track'
})

function handleScroll(e) { syncScroll(e) }

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
	// 首屏布局完成后再量一次尺子与滚动区尺寸
	setTimeout(measureSoon, 300)
})

onShow(() => {
	// 从编辑页返回时内容可能变了，重新取一次；尺子位置复位
	if (clientId.value) loadRecord()
	resetRuler()
})
</script>

<template>
	<view class="read-page">
		<!-- 头部：标题 + 元信息 + 编辑入口 -->
		<view class="read-head">
			<text class="read-title">{{ title }}</text>
			<view class="read-meta">
				<text class="read-meta-text">{{ wordCount }} 字<text v-if="hasOutline"> · {{ rulerTicks.length }} 个小节</text></text>
				<view v-for="t in tags" :key="t" class="read-tag"><text>#{{ t }}</text></view>
				<view class="read-edit" @tap="goEdit"><text>编辑</text></view>
			</view>
		</view>

		<!-- 正文：滚动区 + 左侧目录尺 -->
		<view class="read-body" :class="{ 'has-ruler': rulerVisible }">
			<scroll-view
				id="read-scroll"
				class="read-scroll"
				scroll-y
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
					>
						<text v-if="sec.title" class="read-section-title">{{ sec.title }}</text>
						<MarkdownRenderer v-if="sec.body" :content="sec.body" />
					</view>
					<view v-if="!loading && !content" class="read-empty">
						<text class="read-empty-text">这条记录还没有内容</text>
					</view>
					<view class="read-bottom-space" />
				</view>
			</scroll-view>

			<!-- 目录尺：与对话尺同一套交互（点 / 拖 / 预览 / 视口指示） -->
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
	</view>
</template>

<style lang="scss" scoped>
@import './read.scss';
</style>