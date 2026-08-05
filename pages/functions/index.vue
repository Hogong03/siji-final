<script setup>
	/**
	 * 功能中心 v4 — 方案 E
	 *
	 * 三分区清晰职责：
	 *  1. 生活记录（概览看板 + 消费分析）
	 *  2. AI 面板（当前 Agent + 数据层 + 执行层）
	 *  3. 搜索（全局入口）
	 *
	 * 聊天页保留 UnifiedSwitcher 负责快速切换，此页负责详细配置入口
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
		useAppStore
	} from '@/store/index.js'
	import {
		searchConversations
	} from '@/utils/conversation-search.js'
	import {
		useFunctionsData
	} from '@/composables/useFunctionsData.js'

	const store = useAppStore()

	const {
		dashboard,
		weekTrend,
		categoryRanking,
		trendMax,
		weekTotal,
		weekCompare,
		loadAll
	} = useFunctionsData()

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
	})

	// ─── 跳转 ───
	function goPage(url) {
		uni.navigateTo({
			url
		})
	}

	function goStats() {
		uni.navigateTo({
			url: '/pages/bill/stats'
		})
	}

	// ─── 搜索 ───
	const searchKeyword = ref('')

	const allFuncEntries = computed(() => [
		...funcEntries.value.map(e => ({
			...e,
			category: 'life'
		})),
		{
			id: 'stats',
			iconName: 'trend',
			title: '消费分析',
			desc: '账单统计与趋势',
			category: 'life',
			listPage: '/pages/bill/stats'
		}
	])

	const filteredFuncEntries = computed(() => {
		const kw = searchKeyword.value.trim().toLowerCase()
		if (!kw) return []
		return allFuncEntries.value.filter(e => {
			return e.title.toLowerCase().includes(kw) ||
				e.desc.toLowerCase().includes(kw) ||
				e.id.toLowerCase().includes(kw)
		})
	})

	const conversationResults = computed(() => {
		const kw = searchKeyword.value.trim()
		if (!kw || kw.length < 1) return []
		return searchConversations(kw, {
			limit: 10
		})
	})

	function onSearchInput(e) {
		searchKeyword.value = e.detail.value || ''
	}

	function onSearchConfirm() {
		const kw = searchKeyword.value.trim()
		if (!kw) return
		if (filteredFuncEntries.value.length === 0 && conversationResults.value.length === 0) {
			uni.navigateTo({
				url: '/pages/search/result?keyword=' + kw
			})
		}
	}

	function clearSearch() {
		searchKeyword.value = ''
	}

	function goToEntry(entry) {
		const url = entry.listPage || entry.route
		if (url) goPage(url)
	}

	function goToConversation(convId) {
		store.switchConversation(convId)
		uni.switchTab({
			url: '/pages/chat/index'
		})
	}

	function formatAmount(val) {
		if (val >= 10000) return (val / 10000).toFixed(1) + 'w'
		return val.toFixed(0)
	}
</script>

<template>
	<view class="functions-page">
		<scroll-view class="func-scroll" scroll-y>

			<!-- 搜索栏（紧凑） -->
			<view class="search-box">
				<SijiIcon name="search" size="sm" color="#A1A1AA" />
				<input class="search-input" v-model="searchKeyword" placeholder="搜索功能、记录、账单、计划..." confirm-type="search"
					@input="onSearchInput" @confirm="onSearchConfirm" />
				<text v-if="searchKeyword" class="search-clear" @tap="clearSearch">✕</text>
			</view>

			<!-- 功能搜索结果 -->
			<view v-if="searchKeyword && filteredFuncEntries.length > 0" class="search-results">
				<text class="section-label">功能匹配</text>
				<view class="card-list card-list-stagger">
					<view v-for="entry in filteredFuncEntries" :key="entry.id" class="entry-card card-press"
						@tap="goToEntry(entry)">
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

			<!-- 对话搜索结果 -->
			<view v-if="searchKeyword && conversationResults.length > 0" class="search-results">
				<text class="section-label">对话内容 · {{ conversationResults.length }} 条</text>
				<view class="card-list">
					<view v-for="msg in conversationResults" :key="msg.convId + '-' + msg.messageIndex"
						class="conv-result-card card-press" @tap="goToConversation(msg.convId)">
						<view class="conv-result-top">
							<text class="conv-role-tag" :class="msg.role">{{ msg.role === 'user' ? '你' : 'AI' }}</text>
							<text class="conv-title">{{ msg.convTitle }}</text>
							<SijiIcon name="chevron-right" size="sm" class="conv-arrow" />
						</view>
						<text class="conv-preview">{{ msg.preview }}</text>
					</view>
				</view>
			</view>

			<!-- ============================== -->
			<!-- 生活记录分区 -->
			<!-- ============================== -->
			<text class="section-label">生活记录</text>
			<view class="card-list card-list-stagger">
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

			<!-- 消费分析（生活记录的延伸看板） -->
			<view class="analysis-card" v-if="categoryRanking.length > 0 || weekTrend.length > 0">
				<view class="ac-header">
					<text class="ac-title">消费分析</text>
					<view class="ac-link" @tap="goStats">
						<text>详细</text>
						<SijiIcon name="chevron-right" size="xs" color="#000000" />
					</view>
				</view>

				<view class="trend-section" v-if="weekTrend.length > 0">
					<view class="trend-meta">
						<text class="trend-label">近 7 天</text>
						<text class="trend-total">¥{{ weekTotal.toFixed(0) }}</text>
						<text class="trend-compare" v-if="weekCompare !== 0" :class="weekCompare > 0 ? 'up' : 'down'">
							{{ weekCompare > 0 ? '↑' : '↓' }}{{ Math.abs(weekCompare) }}%
						</text>
					</view>
					<view class="trend-chart">
						<view v-for="(d, i) in weekTrend" :key="i" class="trend-col">
							<text v-if="d.amount > 0" class="trend-amount">{{ d.amount.toFixed(0) }}</text>
							<view class="trend-bar-bg">
								<view class="trend-bar" :style="{
                  height: Math.max(6, (d.amount / trendMax) * 100) + '%',
                  background: d.amount > 0 ? '#000000' : '#F4F4F5'
                }" />
							</view>
							<text class="trend-day">{{ d.label }}</text>
						</view>
					</view>
				</view>

				<view class="ac-divider" v-if="categoryRanking.length > 0 && weekTrend.length > 0" />

				<view class="rank-section" v-if="categoryRanking.length > 0">
					<text class="rank-title">分类 TOP{{ categoryRanking.length }}</text>
					<view v-for="item in categoryRanking" :key="item.name" class="rank-row">
						<text class="rank-name">{{ item.name }}</text>
						<view class="rank-bar-wrap">
							<view class="rank-bar" :style="{ width: item.percent + '%' }" />
						</view>
						<text class="rank-amount">¥{{ item.amount.toFixed(0) }}</text>
						<text class="rank-pct">{{ item.percent }}%</text>
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
