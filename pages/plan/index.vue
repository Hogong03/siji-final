<script setup>
	/**
	 * 计划列表页 — 增强版
	 *
	 * 功能：
	 *  ① 概览仪表盘（总计划/进行中/已完成/完成率）
	 *  ② 优先级分布条
	 *  ③ 状态+优先级双维筛选
	 *  ④ 计划卡片：子任务进度条、截止倒计时
	 *  ⑤ 模板入口 & 统计入口
	 *  ⑥ 快速创建浮动按钮
	 */
import {
		ref,
		computed,
		onMounted
	} from 'vue'
	import SijiIcon from '@/components/common/SijiIcon.vue'
	import { onShow } from '@dcloudio/uni-app'
	import {
		getPlanList,
		getUsedTags
	} from '@/utils/storage.js'
	import EmptyState from '@/components/common/EmptyState.vue'
	import PlanOverview from './components/PlanOverview.vue'
	import PlanQuickActions from './components/PlanQuickActions.vue'
	import PlanFilter from './components/PlanFilter.vue'
	import PlanList from './components/PlanList.vue'

	const plans = ref([])
	const filterStatus = ref(-1)
	const filterPriority = ref(-1)
	const filterTag = ref('') // 选中标签名，空 = 全部
	const filterTags = ref([]) // 可用标签列表

	const statusMap = {
		0: '待开始',
		1: '进行中',
		2: '已完成'
	}
	const priorityMap = {
		0: '普通',
		1: '重要',
		2: '紧急'
	}
	const priorityColors = {
		0: '#A1A1AA',
		1: '#F59E0B',
		2: '#EF4444'
	}

	// ==================== 统计概览 ====================
	const stats = computed(() => {
		const all = plans.value
		const total = all.length
		const active = all.filter(p => p.status === 1).length
		const completed = all.filter(p => p.status === 2).length
		const pending = all.filter(p => p.status === 0).length
		const rate = total > 0 ? Math.round(completed / total * 100) : 0

		// 优先级分布
		const pHigh = all.filter(p => p.priority === 2).length
		const pMid = all.filter(p => p.priority === 1).length
		const pLow = all.filter(p => p.priority === 0).length

		// 今日截止/已过期
		const today = new Date()
		const todayStr =
			`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
		const overdue = all.filter(p => p.status !== 2 && p.due_date && p.due_date < todayStr).length

		// 子任务完成统计
		let subTotal = 0,
			subDone = 0
		all.forEach(p => {
			if (Array.isArray(p.subtasks)) {
				subTotal += p.subtasks.length
				subDone += p.subtasks.filter(s => s.done).length
			}
		})

		return {
			total,
			active,
			completed,
			pending,
			rate,
			pHigh,
			pMid,
			pLow,
			overdue,
			subTotal,
			subDone
		}
	})

	const priorityBar = computed(() => {
		const s = stats.value
		const total = s.pHigh + s.pMid + s.pLow
		if (total === 0) return []
		return [{
				label: '紧急',
				count: s.pHigh,
				pct: (s.pHigh / total * 100).toFixed(0),
				color: '#D35D5D'
			},
			{
				label: '重要',
				count: s.pMid,
				pct: (s.pMid / total * 100).toFixed(0),
				color: '#E8A838'
			},
			{
				label: '普通',
				count: s.pLow,
				pct: (s.pLow / total * 100).toFixed(0),
				color: '#999'
			}
		]
	})

	// ==================== 筛选 ====================
	const filteredPlans = computed(() => {
		let list = plans.value
		if (filterStatus.value !== -1) list = list.filter(p => p.status === filterStatus.value)
		if (filterPriority.value !== -1) list = list.filter(p => p.priority === filterPriority.value)
		if (filterTag.value) list = list.filter(p => {
			const tags = Array.isArray(p.tags) ? p.tags : []
			return tags.includes(filterTag.value)
		})
		// 排序：优先级高→低，同优先级按截止日期近→远
		return list.sort((a, b) => {
			if (b.priority !== a.priority) return b.priority - a.priority
			if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
			if (a.due_date) return -1
			if (b.due_date) return 1
			return 0
		})
	})

	onMounted(() => {
		loadPlans();
		loadTags()
	})
	onShow(() => {
		loadPlans();
		loadTags()
	})

	function loadPlans() {
		plans.value = getPlanList()
	}

	function loadTags() {
		filterTags.value = getUsedTags('plan')
	}

	function goDetail(clientId) {
		if (clientId) uni.navigateTo({
			url: `/pages/plan/detail?clientId=${clientId}`
		})
	}

	function goNew() {
		uni.navigateTo({
			url: '/pages/plan/detail?id=new'
		})
	}

	function goTemplates() {
		uni.navigateTo({
			url: '/pages/plan/templates'
		})
	}

	function goStats() {
		uni.navigateTo({
			url: '/pages/plan/stats'
		})
	}

</script>

<template>
	<view class="plan-page">
		<!-- 顶部概览 -->
		<PlanOverview :stats="stats" :priorityBar="priorityBar" />

		<!-- 快捷入口 -->
		<PlanQuickActions @go-templates="goTemplates" @go-stats="goStats" @go-new="goNew" />

		<!-- 筛选栏 -->
		<PlanFilter
			:filterStatus="filterStatus"
			:filterPriority="filterPriority"
			:filterTag="filterTag"
			:filterTags="filterTags"
			@update:filterStatus="filterStatus = $event"
			@update:filterPriority="filterPriority = $event"
			@update:filterTag="filterTag = $event"
		/>

		<!-- 计划列表 -->
		<PlanList
			:filteredPlans="filteredPlans"
			:statusMap="statusMap"
			:priorityColors="priorityColors"
			@go-detail="goDetail"
			@go-templates="goTemplates"
			@go-new="goNew"
		/>

		<!-- 新建浮动按钮 -->
		<view class="fab" @tap="goNew">
			<text class="fab-icon">+</text>
		</view>
	</view>
</template>

<style lang="scss" scoped>
	.plan-page {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background: #F4F4F5;
	}

	/* 新建浮动按钮 — fixed 定位，硬编码颜色 */
	.fab {
		position: fixed;
		right: $spacing-lg;
		bottom: $spacing-lg;
		width: 112rpx;
		height: 112rpx;
		border-radius: $radius-round;
		background: #000000;
		box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.2);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		animation: fabIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both;

		&:active {
			transform: scale(0.9);
		}

		.fab-icon {
			font-size: 52rpx;
			color: #FFFFFF;
			font-weight: 300;
		}
	}

	@keyframes fabIn {
		from {
			opacity: 0;
			transform: scale(0);
		}

		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	@media (prefers-color-scheme: dark) {
		.fab {
			background: #FAFAFA;
			box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.4);
		}
		.fab .fab-icon {
			color: #18181B;
		}
	}

</style>