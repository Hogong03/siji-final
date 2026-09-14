<script setup>
	/**
	 * 计划列表页 — 完整版
	 *
	 * 功能：概览仪表盘 + 搜索 + 状态/优先级/标签三维筛选 + 左滑操作 + 快捷状态切换
	 * 布局：概览卡 → 工具栏(搜索+筛选+回收站) → 列表 → FAB
	 */
	import { onMounted, ref, computed } from 'vue'
	import { onShow } from '@dcloudio/uni-app'
	import SijiIcon from '@/components/common/SijiIcon.vue'
	import { logPlanCheckIn } from '@/utils/storage.js'
	import { checkinFeedback, streakOfPlanRecord } from '@/utils/checkin-feedback.js'
	import { usePlanList } from './composables/usePlanList.js'
	import { usePlanSwipe } from './composables/usePlanSwipe.js'
	import PlanOverview from './components/PlanOverview.vue'
	import PlanDailyStrip from '@/components/plan/PlanDailyStrip.vue'
	import PlanFilter from './components/PlanFilter.vue'
	import PlanList from './components/PlanList.vue'

	const statusMap = { 0: '待开始', 1: '进行中', 2: '已完成' }
	const priorityColors = { 0: '#A1A1AA', 1: '#E8A838', 2: '#EF4444' }

	const viewMode = ref('list') // list / board

	// 看板视图分组
	const boardColumns = computed(() => [
		{ title: '待开始', status: 0, plans: filteredPlans.value.filter(p => p.status === 0) },
		{ title: '进行中', status: 1, plans: filteredPlans.value.filter(p => p.status === 1) },
		{ title: '已完成', status: 2, plans: filteredPlans.value.filter(p => p.status === 2) }
	])

	function changeStatus(plan, newStatus) {
		quickToggleStatus(plan, newStatus)
	}

	const {
		searchKeyword, filterStatus, filterPriority, filterTag, filterTags,
		filteredPlans, hasActiveFilter, stats, priorityBar, dailyItems, allPlans,
		loadPlans, loadTags, resetFilters, quickToggleStatus, removePlan
	} = usePlanList()

	const {
		swipeItem, onTouchStart, onTouchMove, onTouchEnd,
		getSwipeOffset, closeSwipe, handleTap, handleComplete, handleEdit, handleDelete
	} = usePlanSwipe(quickToggleStatus, goDetail, removePlan)

	onMounted(() => { loadPlans(); loadTags() })
	onShow(() => { loadPlans(); loadTags() })

	function goDetail(clientId) {
		if (clientId) uni.navigateTo({ url: `/pages/plan/detail?clientId=${clientId}` })
	}

	function goNew() {
		uni.navigateTo({ url: '/pages/plan/detail?id=new' })
	}

	function goTemplates() {
		uni.navigateTo({ url: '/pages/plan/templates' })
	}

	function goStats() {
		uni.navigateTo({ url: '/pages/plan/stats' })
	}

	function goRecords() {
		uni.navigateTo({ url: '/pages/plan/records' })
	}

	function goTrash() {
		uni.navigateTo({ url: '/pages/plan/trash' })
	}

	function onCardTap(plan) {
		handleTap(plan, (p) => goDetail(p.client_id))
	}

	function planById(clientId) {
		return (allPlans.value || []).find(p => p.client_id === clientId) || null
	}

	/** 打卡前取该任务当前连续值（weekly 看周，其余看天） */
	function streakOfPlan(clientId) {
		return streakOfPlanRecord(planById(clientId))
	}

	/** 打卡后回执：跨过里程碑才说一句，其余回原文案 */
	function feedbackAfter(rec, beforeStreak, fallback) {
		checkinFeedback(streakOfPlanRecord(rec), beforeStreak, fallback, rec && rec.recur_type === 'weekly' ? 'week' : 'day')
	}

	/** 3.5.0：今日行动条循环任务快捷打卡（轻记录，不置完成） */
	function quickCheckIn(item) {
		if (!item || !item.recurType) return
		const before = streakOfPlan(item.client_id)
		const rec = logPlanCheckIn(item.client_id, '')
		if (!rec) {
			uni.showToast({ title: '当前状态暂不能打卡', icon: 'none' })
			return
		}
		feedbackAfter(rec, before, '已打卡，今天完成')
		setTimeout(() => loadPlans(), 60)
	}

	/** 3.5.2：今日行动条长按补写描述后打卡（描述为空等价于普通打卡） */
	function checkinWithNote(payload) {
		if (!payload || !payload.clientId) return
		const before = streakOfPlan(payload.clientId)
		const rec = logPlanCheckIn(payload.clientId, payload.note || '')
		if (!rec) {
			uni.showToast({ title: '当前状态暂不能打卡', icon: 'none' })
			return
		}
		feedbackAfter(rec, before, payload.note ? '已记录' : '已打卡，今天完成')
		setTimeout(() => loadPlans(), 60)
	}
</script>

<template>
	<view class="plan-page" @tap="closeSwipe">
		<!-- 概览卡（含模板/统计入口） -->
		<PlanOverview :stats="stats" :priorityBar="priorityBar"
			@go-templates="goTemplates" @go-stats="goStats" />

		<!-- 今日行动条（3.4.3） -->
		<PlanDailyStrip :items="dailyItems" @go-detail="goDetail" @quick-checkin="quickCheckIn" @checkin-note="checkinWithNote" />
		<!-- 3.5.2：长按循环任务可补写描述 -->

		<!-- 工具栏：搜索 + 回收站入口 -->
		<view class="toolbar" @tap.stop>
			<view class="search-box">
				<SijiIcon name="search" size="sm" class="search-icon" />
				<input
					v-model="searchKeyword"
					class="search-input"
					placeholder="搜索计划标题、描述、子任务..."
					:placeholder-style="'color: #A1A1AA'"
					confirm-type="search"
				/>
				<text v-if="searchKeyword" class="search-clear" @tap="searchKeyword = ''">✕</text>
			</view>
			<view class="tool-actions">
				<view class="tool-btn" @tap="goRecords">
					<SijiIcon name="clock" size="sm" />
				</view>
				<view class="tool-btn" @tap="goTrash">
					<SijiIcon name="trash" size="sm" />
				</view>
			</view>
		</view>

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

		<!-- 视图切换 -->
		<view class="view-switcher" @tap.stop>
			<view class="vs-item" :class="{ active: viewMode === 'list' }" @tap="viewMode = 'list'">列表</view>
			<view class="vs-item" :class="{ active: viewMode === 'board' }" @tap="viewMode = 'board'">看板</view>
		</view>

		<!-- 重置筛选 -->
		<view v-if="hasActiveFilter && filteredPlans.length === 0" class="empty-filter">
			<text class="ef-text">没有匹配的计划</text>
			<view class="ef-btn" @tap="resetFilters">重置筛选</view>
		</view>

		<!-- 列表视图 -->
		<PlanList
			v-if="viewMode === 'list'"
			:filteredPlans="filteredPlans"
			:statusMap="statusMap"
			:priorityColors="priorityColors"
			:swipeItem="swipeItem"
			:getSwipeOffset="getSwipeOffset"
			@go-detail="goDetail"
			@go-templates="goTemplates"
			@go-new="goNew"
			@touch-start="onTouchStart"
			@touch-move="onTouchMove"
			@touch-end="onTouchEnd"
			@card-tap="onCardTap"
			@quick-complete="handleComplete"
			@quick-edit="handleEdit"
			@quick-delete="handleDelete"
		/>

		<!-- 看板视图 -->
		<scroll-view v-if="viewMode === 'board'" class="board-scroll" scroll-x :show-scrollbar="false">
			<view class="board-row">
				<view v-for="col in boardColumns" :key="col.status" class="board-col">
					<view class="bc-header">
						<text class="bc-title">{{ col.title }}</text>
						<text class="bc-count">{{ col.plans.length }}</text>
					</view>
					<scroll-view class="bc-body" scroll-y>
						<view v-for="item in col.plans" :key="item.client_id" class="board-card" @tap="goDetail(item.client_id)">
							<view class="bc-priority" :style="{ background: priorityColors[item.priority] || '#999' }" />
							<text class="bc-name">{{ item.title }}</text>
							<text v-if="item.description" class="bc-desc">{{ item.description.substring(0, 40) }}</text>
							<view v-if="item.subtasks?.length" class="bc-subtasks">
								<text class="bc-st-text">{{ item.subtasks.filter(s => s.done).length }}/{{ item.subtasks.length }} 子任务</text>
							</view>
							<view class="bc-actions">
								<view v-if="col.status < 2" class="bc-arrow" @tap.stop="changeStatus(item, col.status + 1)">→</view>
								<view v-if="col.status > 0" class="bc-arrow" @tap.stop="changeStatus(item, col.status - 1)">←</view>
							</view>
						</view>
						<view v-if="col.plans.length === 0" class="bc-empty">无</view>
						<view style="height: 20rpx" />
					</scroll-view>
				</view>
			</view>
		</scroll-view>

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

	/* 工具栏 */
	.toolbar {
		display: flex;
		align-items: center;
		gap: 8rpx;
		padding: 8rpx 20rpx;
		background: #FFFFFF;
		border-bottom: 1rpx solid #E4E4E7;
	}

	.search-box {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 8rpx;
		background: #F4F4F5;
		border-radius: 20rpx;
		padding: 8rpx 16rpx;
	}

	.search-icon {
		flex-shrink: 0;
	}

	.search-input {
		flex: 1;
		font-size: 26rpx;
		color: #18181B;
		padding: 4rpx 0;
	}

	.search-clear {
		font-size: 24rpx;
		color: #A1A1AA;
		padding: 4rpx 8rpx;
	}

	.tool-actions {
		display: flex;
		gap: 4rpx;
	}

	.tool-btn {
		width: 56rpx;
		height: 56rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 12rpx;
		background: #F4F4F5;

		&:active {
			background: #E4E4E7;
			transform: scale(0.92);
		}
	}

	/* 重置筛选 */
	.empty-filter {
		text-align: center;
		padding: 40rpx 0;

		.ef-text {
			font-size: 26rpx;
			color: #71717A;
			display: block;
			margin-bottom: 12rpx;
		}

		.ef-btn {
			display: inline-block;
			padding: 12rpx 32rpx;
			border-radius: 12rpx;
			background: #18181B;
			color: #FFFFFF;
			font-size: 24rpx;
			font-weight: 600;
		}
	}

	/* 视图切换 */
	.view-switcher {
		display: flex;
		gap: 4rpx;
		padding: 4rpx 20rpx 8rpx;
		background: #FFFFFF;
		border-bottom: 1rpx solid #E4E4E7;
	}

	.vs-item {
		padding: 6rpx 24rpx;
		border-radius: 8rpx;
		font-size: 22rpx;
		color: #71717A;
		background: #F4F4F5;

		&.active {
			background: #18181B;
			color: #FFFFFF;
			font-weight: 600;
		}
	}

	/* 看板视图 */
	.board-scroll {
		flex: 1;
		white-space: nowrap;
	}

	.board-row {
		display: inline-flex;
		gap: 12rpx;
		padding: 12rpx 20rpx;
	}

	.board-col {
		width: 580rpx;
		display: flex;
		flex-direction: column;
		vertical-align: top;
	}

	.bc-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8rpx 12rpx;
		background: #FFFFFF;
		border-radius: 8rpx 8rpx 0 0;
		border-bottom: 2rpx solid #18181B;
	}

	.bc-title { font-size: 26rpx; font-weight: 700; color: #18181B; }
	.bc-count { font-size: 22rpx; color: #71717A; font-variant-numeric: tabular-nums; }

	.bc-body {
		flex: 1;
		background: #F4F4F5;
		border-radius: 0 0 8rpx 8rpx;
		padding: 8rpx;
		height: calc(100vh - 400rpx);
	}

	.board-card {
		background: #FFFFFF;
		border-radius: 8rpx;
		padding: 12rpx;
		margin-bottom: 8rpx;
		position: relative;
		padding-left: 20rpx;
	}

	.bc-priority {
		position: absolute;
		left: 8rpx;
		top: 12rpx;
		bottom: 12rpx;
		width: 4rpx;
		border-radius: 2rpx;
	}

	.bc-name { font-size: 26rpx; font-weight: 600; color: #18181B; display: block; }
	.bc-desc { font-size: 22rpx; color: #71717A; margin-top: 4rpx; display: block; }
	.bc-subtasks { margin-top: 6rpx; }
	.bc-st-text { font-size: 20rpx; color: #A1A1AA; }
	.bc-actions { display: flex; gap: 8rpx; margin-top: 8rpx; }
	.bc-arrow {
		padding: 4rpx 12rpx;
		background: #F4F4F5;
		border-radius: 6rpx;
		font-size: 24rpx;
		color: #18181B;
	}
	.bc-empty { text-align: center; padding: 40rpx 0; font-size: 22rpx; color: #A1A1AA; }

	/* 新建浮动按钮 — fixed 定位，硬编码颜色 */
	.fab {
		position: fixed;
		right: 30rpx;
		bottom: 30rpx;
		width: 112rpx;
		height: 112rpx;
		border-radius: 50%;
		background: #000000;
		box-shadow: none;
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
		.view-switcher { background: #27272A; border-bottom-color: #3F3F46; }
		.vs-item { background: #3F3F46; color: #A1A1AA; &.active { background: #FAFAFA; color: #18181B; } }
		.bc-header { background: #27272A; border-bottom-color: #FAFAFA; }
		.bc-title { color: #FAFAFA; }
		.bc-count { color: #71717A; }
		.bc-body { background: #18181B; }
		.board-card { background: #27272A; }
		.bc-name { color: #FAFAFA; }
		.bc-desc { color: #A1A1AA; }
		.bc-st-text { color: #52525B; }
		.bc-arrow { background: #3F3F46; color: #FAFAFA; }
		.bc-empty { color: #52525B; }
		.fab {
			background: #FAFAFA;
			box-shadow: none;
		}
		.fab .fab-icon {
			color: #18181B;
		}
		.toolbar {
			background: #27272A;
			border-bottom-color: #3F3F46;
		}
		.search-box {
			background: #3F3F46;
		}
		.search-input {
			color: #FAFAFA;
		}
		.search-clear {
			color: #52525B;
		}
		.tool-btn {
			background: #3F3F46;
			&:active { background: #52525B; }
		}
		.empty-filter .ef-text { color: #71717A; }
		.empty-filter .ef-btn { background: #FAFAFA; color: #18181B; }
	}
</style>
