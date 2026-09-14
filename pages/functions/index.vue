<script setup>
	/**
	 * 功能中心 v6 — Tab 内嵌分区（Segmented Control）
	 *
	 * 顶部 segmented control 切换「生活记录 / AI 面板」
	 * 同屏只显示一个分区，空间翻倍
	 */
	import {
		ref,
		computed
	} from 'vue'
	import {
		onShow
	} from '@dcloudio/uni-app'
	import SijiIcon from '@/components/common/SijiIcon.vue'
	import {
		useFunctionsData
	} from '@/composables/useFunctionsData.js'
	import {
		getProfile
	} from '@/utils/profile.js'

	// ─── Tab 切换 ───
	const activeTab = ref('life') // 'life' | 'ai'

	// ─── 我的画像 ───
	const profileData = ref({ cards: [] })
	const profileName = computed(() => {
		const c = profileData.value.cards.find(c => c.id === 'basic')
		return c?.fields?.nickname || '我'
	})

	const {
		dashboard,
		weekTrend,
		memoryEnabled,
		profileEnabled,
		profileFilled,
		relationsStats,
		decisionStats,
		simStats,
		weekTotal,
		weekCompare,
		loadAll,
		loadAIStats
	} = useFunctionsData()

	// ─── 生活记录统计行 ───
	const lifeStats = computed(() => [
		{ label: '记录', value: `${dashboard.value.diaryCount} 篇` },
		{ label: '支出', value: `¥${formatAmount(dashboard.value.monthExpense)}` },
		{ label: '计划', value: `${dashboard.value.planActive} 进行` },
	])

	// ─── AI 面板统计行 ───
	const aiStats = computed(() => {
		const stats = []
		if (profileEnabled.value) {
			stats.push({ label: '信息', value: `${profileFilled.value} 项` })
			stats.push({ label: '人物', value: `${relationsStats.value.total} 人` })
		}
		if (memoryEnabled.value) {
			stats.push({ label: '决策', value: `${decisionStats.value.total} 条` })
		}
		stats.push({ label: '演练', value: `${simStats.value.total} 次` })
		return stats
	})

	// ─── 生活记录入口 ───
	const funcEntries = computed(() => [{
			id: 'diary',
			iconName: 'diary',
			title: '记录',
			desc: `${dashboard.value.diaryCount} 篇本月`,
			listPage: '/pages/diary/list',
			newPage: '/pages/diary/detail?id=new'
		},
		{
			id: 'bill',
			iconName: 'bill',
			title: '记账',
			desc: `¥${formatAmount(dashboard.value.monthExpense)} 本月`,
			listPage: '/pages/bill/index',
			newPage: '/pages/bill/edit?type=expense'
		},
		{
			id: 'plan',
			iconName: 'plan',
			title: '计划',
			desc: `${dashboard.value.planActive} 个进行中`,
			listPage: '/pages/plan/index',
			newPage: '/pages/plan/templates'
		},
	])

	onShow(() => {
		loadAll()
		loadAIStats()
		try { profileData.value = getProfile() } catch { profileData.value = { cards: [] } }
	})

	// ─── AI 面板入口 ───
	const aiEntries = computed(() => {
		const list = [{
			id: 'profile',
			iconName: 'user',
			title: '我的信息',
			desc: profileEnabled.value
				? `${profileFilled.value} 项 · ${relationsStats.value.total} 人`
				: '点击开启',
			route: '/pages/settings/sub/profile'
		}]

		list.push({
			id: 'glimmer',
			iconName: 'sun',
			title: '微光本',
			desc: 'AI 收着的小事',
			route: '/pages/settings/sub/glimmer'
		})

		list.push({
			id: 'memory',
			iconName: 'brain',
			title: '记忆管理',
			desc: memoryEnabled.value ? '已开启' : '已关闭',
			route: '/pages/settings/sub/memory'
		})

		list.push({
			id: 'decisions',
			iconName: 'target',
			title: '决策日志',
			desc: `${decisionStats.value.total} 条`,
			route: '/pages/settings/sub/decisions'
		})

		list.push({
			id: 'simulation',
			iconName: 'chat-bubble',
			title: '情景模拟',
			desc: simStats.value.total > 0 ? `${simStats.value.total} 次演练` : '对话演练',
			route: '/pages/settings/sub/simulation'
		})

		return list
	})

	// ─── 跳转 ───
	function goSub(url) { uni.navigateTo({ url }) }
	function goPage(url) { uni.navigateTo({ url }) }
	function goStats() { uni.navigateTo({ url: '/pages/bill/stats' }) }

	// ─── 搜索（跳转独立页）───
	function goSearch() {
		uni.navigateTo({ url: '/pages/search/result' })
	}

	// ─── Tab 切换动画 ───
	function switchTab(tab) {
		if (activeTab.value === tab) return
		activeTab.value = tab
	}

	function formatAmount(val) {
		if (val >= 10000) return (val / 10000).toFixed(1) + 'w'
		return val.toFixed(0)
	}
</script>

<template>
	<view class="functions-page">
		<scroll-view class="func-scroll" scroll-y>

			<!-- 搜索栏（点击跳转独立搜索页） -->
			<view class="search-box" @tap="goSearch">
				<SijiIcon name="search" size="sm" color="#A1A1AA" />
				<text class="search-placeholder">搜索记录、账单、计划、对话...</text>
			</view>

			<!-- ============================== -->
			<!-- Segmented Control              -->
			<!-- ============================== -->
			<view class="seg-control">
				<view
					class="seg-item"
					:class="{ active: activeTab === 'life' }"
					@tap="switchTab('life')"
				>
					<text class="seg-text">生活记录</text>
				</view>
				<view
					class="seg-item"
					:class="{ active: activeTab === 'ai' }"
					@tap="switchTab('ai')"
				>
					<text class="seg-text">AI 面板</text>
				</view>
				<!-- 滑块指示器 -->
				<view class="seg-slider" :class="{ right: activeTab === 'ai' }" />
			</view>

			<!-- ============================== -->
			<!-- 生活记录 Tab                    -->
			<!-- ============================== -->
			<view v-if="activeTab === 'life'" class="tab-panel">
				<!-- 统计行 -->
				<view class="stats-bar">
					<view v-for="s in lifeStats" :key="s.label" class="stats-item">
						<text class="stats-val">{{ s.value }}</text>
						<text class="stats-lbl">{{ s.label }}</text>
					</view>
				</view>

				<!-- 功能入口列表 -->
				<view class="card-list">
					<view v-for="card in funcEntries" :key="card.id" class="entry-card card-press"
						@tap="goPage(card.listPage)">
						<view class="entry-left">
							<view class="entry-icon-circle">
								<SijiIcon :name="card.iconName" size="md" color="#18181B" />
							</view>
							<view class="entry-info">
								<text class="entry-title">{{ card.title }}</text>
								<text class="entry-desc">{{ card.desc }}</text>
							</view>
						</view>
						<view class="entry-right">
							<view class="entry-new-btn btn-tactile" @tap.stop="goPage(card.newPage)">
								<text class="entry-new-text">+</text>
							</view>
							<text class="entry-arrow">›</text>
						</view>
					</view>
				</view>

				<!-- 消费分析入口 -->
				<view class="analysis-link" v-if="weekTrend.length > 0" @tap="goStats">
					<text class="analysis-link-text">消费分析 · 近7天 ¥{{ weekTotal.toFixed(0) }}</text>
					<text class="analysis-link-arrow" v-if="weekCompare !== 0" :class="weekCompare > 0 ? 'up' : 'down'">{{ weekCompare > 0 ? '↑' : '↓' }}{{ Math.abs(weekCompare) }}%</text>
					<SijiIcon name="chevron-right" size="xs" color="#A1A1AA" />
				</view>
			</view>

			<!-- ============================== -->
			<!-- AI 面板 Tab                     -->
			<!-- ============================== -->
			<view v-else class="tab-panel">
				<!-- 统计行 -->
				<view class="stats-bar">
					<view v-for="s in aiStats" :key="s.label" class="stats-item">
						<text class="stats-val">{{ s.value }}</text>
						<text class="stats-lbl">{{ s.label }}</text>
					</view>
					<!-- 未开启时引导 -->
					<view v-if="!profileEnabled && !memoryEnabled" class="stats-item stats-guide">
						<text class="stats-val">点击开启</text>
						<text class="stats-lbl">AI 记忆</text>
					</view>
				</view>

				<!-- AI 入口列表 -->
				<view class="card-list">
					<view v-for="entry in aiEntries" :key="entry.id" class="entry-card card-press"
						@tap="goSub(entry.route)">
						<view class="entry-left">
							<view class="entry-icon-circle">
								<SijiIcon :name="entry.iconName" size="md" color="#18181B" />
							</view>
							<view class="entry-info">
								<text class="entry-title">{{ entry.title }}</text>
								<text class="entry-desc">{{ entry.desc }}</text>
							</view>
						</view>
						<text class="entry-arrow">›</text>
					</view>
				</view>
			</view>

			<view style="height: 40rpx" />
		</scroll-view>
	</view>
</template>

<style lang="scss" scoped>
	@import './functions.scss';
</style>
