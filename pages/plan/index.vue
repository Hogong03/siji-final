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

	/** 格式化完整时间显示（精确到秒） */
	function formatDateTime(str) {
		if (!str) return null
		// 纯日期格式
		if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
			return {
				date: str,
				time: '',
				full: str
			}
		}
		// 完整日期时间格式
		const m = str.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(:\d{2})?)?/)
		if (m) {
			return {
				date: m[1],
				time: m[2] || '',
				full: str
			}
		}
		return {
			date: str,
			time: '',
			full: str
		}
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

	/** 子任务进度 */
	function subProgress(item) {
		if (!item.subtasks || item.subtasks.length === 0) return null
		const done = item.subtasks.filter(s => s.done).length
		return {
			done,
			total: item.subtasks.length,
			pct: Math.round(done / item.subtasks.length * 100)
		}
	}

	function formatDue(ds) {
		if (!ds) return null
		const dt = formatDateTime(ds)
		const now = new Date()
		const due = new Date(dt.full.replace(/-/g, '/')) // iOS 兼容
		const diff = Math.ceil((due - now) / (1000 * 60 * 60 * 24))
		let text
		if (diff < 0) text = '已过期'
		else if (diff === 0) text = '今天截止'
		else if (diff === 1) text = '明天截止'
		else if (diff <= 7) text = `${diff}天后截止`
		else text = dt.date
		// 如果有具体时间，附加
		if (dt.time && diff >= 0 && diff <= 1) {
			text += ` ${dt.time.substring(0, 5)}`
		}
		return {
			text,
			danger: diff < 0 || diff === 0,
			raw: ds
		}
	}

	function formatEst(ds) {
		if (!ds) return null
		const dt = formatDateTime(ds)
		const now = new Date()
		const est = new Date(dt.full.replace(/-/g, '/')) // iOS 兼容
		const diff = Math.ceil((est - now) / (1000 * 60 * 60 * 24))
		let text
		if (diff < 0) text = '应已开始'
		else if (diff === 0) text = '今天'
		else if (diff === 1) text = '明天'
		else if (diff <= 7) text = `${diff}天后`
		else text = dt.date
		// 如果有具体时间且在近期，附加时间
		if (dt.time && diff >= 0 && diff <= 1) {
			text += ` ${dt.time.substring(0, 5)}`
		}
		return {
			text,
			danger: false
		}
	}
</script>

<template>
	<view class="plan-page">
		<!-- 顶部概览 -->
		<view class="overview-card">
			<view class="ov-header">
				<text class="ov-title">计划总览</text>
				<view class="ov-stats">
					<text class="ov-rate">{{ stats.rate }}%</text>
					<text class="ov-rate-label">完成率</text>
				</view>
			</view>

			<!-- 四宫格 -->
			<view class="ov-grid">
				<view class="ov-item">
					<text class="ov-num">{{ stats.total }}</text>
					<text class="ov-label">总计划</text>
				</view>
				<view class="ov-item">
					<text class="ov-num ov-num-active">{{ stats.active }}</text>
					<text class="ov-label">进行中</text>
				</view>
				<view class="ov-item">
					<text class="ov-num ov-num-done">{{ stats.completed }}</text>
					<text class="ov-label">已完成</text>
				</view>
				<view class="ov-item">
					<text class="ov-num" :class="{ 'ov-num-danger': stats.overdue > 0 }">{{ stats.overdue }}</text>
					<text class="ov-label">已过期</text>
				</view>
			</view>

			<!-- 优先级分布条 -->
			<view v-if="priorityBar.length > 0" class="priority-bar">
				<view v-for="p in priorityBar" :key="p.label" class="pb-segment"
					:style="{ width: p.pct + '%', background: p.color }" />
			</view>
			<view v-if="priorityBar.length > 0" class="pb-labels">
				<text v-for="p in priorityBar" :key="p.label" class="pb-label" :style="{ color: p.color }">
					{{ p.label }} {{ p.count }}
				</text>
			</view>

			<!-- 子任务进度 -->
			<view v-if="stats.subTotal > 0" class="subtask-summary">
				<text class="st-text">子任务进度</text>
				<view class="st-bar-wrap">
					<view class="st-bar"
						:style="{ width: (stats.subTotal > 0 ? stats.subDone / stats.subTotal * 100 : 0) + '%' }" />
				</view>
				<text class="st-count">{{ stats.subDone }}/{{ stats.subTotal }}</text>
			</view>
		</view>

		<!-- 快捷入口 -->
		<view class="quick-row">
			<view class="quick-btn" @tap="goTemplates">
				<SijiIcon name="plan" size="md" class="qb-icon" />
				<text class="qb-text">模板</text>
			</view>
			<view class="quick-btn" @tap="goStats">
				<SijiIcon name="stats" size="md" class="qb-icon" />
				<text class="qb-text">统计</text>
			</view>
			<view class="quick-btn" @tap="goNew">
				<SijiIcon name="sparkle" size="md" class="qb-icon" />
				<text class="qb-text">新建</text>
			</view>
		</view>

		<!-- 筛选栏 -->
		<view class="filter-bar">
			<view class="filter-row">
				<view class="ftag" :class="{ active: filterStatus === -1 }" @tap="filterStatus = -1">全部</view>
				<view class="ftag" :class="{ active: filterStatus === 1 }" @tap="filterStatus = 1">进行中</view>
				<view class="ftag" :class="{ active: filterStatus === 0 }" @tap="filterStatus = 0">待开始</view>
				<view class="ftag" :class="{ active: filterStatus === 2 }" @tap="filterStatus = 2">已完成</view>
			</view>
			<view class="filter-row">
				<view class="ftag sm" :class="{ active: filterPriority === -1 }" @tap="filterPriority = -1">全部优先级</view>
				<view class="ftag sm" :class="{ active: filterPriority === 2, 'ftag-danger': true }"
					@tap="filterPriority = 2">
					<SijiIcon name="fire" size="xs" class="ftag-icon" /><text>紧急</text>
				</view>
				<view class="ftag sm" :class="{ active: filterPriority === 1, 'ftag-warn': true }"
					@tap="filterPriority = 1">
					<SijiIcon name="star" size="xs" class="ftag-icon" /><text>重要</text>
				</view>
				<view class="ftag sm" :class="{ active: filterPriority === 0 }" @tap="filterPriority = 0">普通</view>
			</view>

			<!-- 标签筛选 -->
			<view class="filter-row" v-if="filterTags.length > 0">
				<view class="ftag sm" :class="{ active: filterTag === '' }" @tap="filterTag = ''">
					<SijiIcon name="tag" size="xs" class="ftag-icon" />
					<text>全部</text>
				</view>
				<view v-for="t in filterTags" :key="t.name" class="ftag sm" :class="{ active: filterTag === t.name }"
					:style="filterTag === t.name ? { background: t.color, borderColor: t.color, color: '#fff' } : {}"
					@tap="filterTag = filterTag === t.name ? '' : t.name">
					{{ t.name }} {{ t.count }}
				</view>
			</view>
		</view>

		<!-- 计划列表 -->
		<scroll-view class="plan-scroll" scroll-y>
			<EmptyState v-if="filteredPlans.length === 0" icon="plan" title="暂无计划" description="使用模板快速创建，或让 AI 帮你规划">
				<view class="empty-actions">
					<view class="empty-btn" @tap="goTemplates">从模板创建</view>
					<view class="empty-btn outline" @tap="goNew">自定义计划</view>
				</view>
			</EmptyState>

			<view v-else class="plan-list">
				<view v-for="item in filteredPlans" :key="item.client_id" class="plan-card"
					:class="{ 'card-done': item.status === 2, 'card-urg': item.priority === 2, 'card-imp': item.priority === 1 }"
					@tap="goDetail(item.client_id)">
					<view class="card-top">
						<view class="card-left">
							<view class="title-row">
								<view class="priority-dot"
									:style="{ background: priorityColors[item.priority] || '#999' }" />
								<text class="card-title">{{ item.title }}</text>
							</view>
							<text class="card-desc" v-if="item.description">
								{{ item.description.substring(0, 80) }}
							</text>
						</view>
						<text class="status-tag"
							:class="`status-${item.status}`">{{ statusMap[item.status] || '未知' }}</text>
					</view>

					<!-- 子计划/子任务进度 -->
					<view v-if="subProgress(item)" class="subtask-row">
						<view class="st-progress-bar">
							<view class="st-progress-fill" :style="{ width: subProgress(item).pct + '%' }" />
						</view>
						<text class="st-progress-text">{{ subProgress(item).done }}/{{ subProgress(item).total }}</text>
					</view>

					<!-- 嵌套子计划标识 -->
					<view v-if="item.parent_id" class="nested-badge">
						<text class="nb-icon">↳</text>
						<text class="nb-text">子计划</text>
					</view>

					<view class="card-bottom">
						<view class="date-info">
							<view v-if="item.estimated_time" class="date-chip est">
								<text class="dc-label">预计</text>
								<text class="dc-value">{{ formatEst(item.estimated_time)?.text }}</text>
							</view>
							<view v-if="item.due_date" class="date-chip due"
								:class="{ danger: formatDue(item.due_date)?.danger }">
								<text class="dc-label">截止</text>
								<text class="dc-value">{{ formatDue(item.due_date)?.text }}</text>
							</view>
							<text v-if="!item.estimated_time && !item.due_date" class="due-text muted">无日期</text>
						</view>
						<text class="card-time">{{ new Date(item.created_at).toLocaleDateString() }}</text>
					</view>
				</view>
			</view>

			<view style="height: 140rpx" />
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
		background: $bg-page;
	}

	/* 概览卡片 — 白底层次 */
	.overview-card {
		margin: $spacing-md;
		padding: $spacing-lg $spacing-md;
		background: var(--bg-card);
		border-radius: $radius-lg;
		color: var(--text-primary);
		box-shadow: $shadow-sm;
	}

	.ov-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: $spacing-md;
	}

	.ov-title {
		font-size: $font-lg;
		font-weight: 700;
		color: var(--text-primary);
	}

	.ov-stats {
		text-align: right;
	}

	.ov-rate {
		font-size: 48rpx;
		font-weight: 800;
		line-height: 1;
		color: var(--text-primary);
		letter-spacing: -1rpx;
	}

	.ov-rate-label {
		font-size: $font-xs;
		color: var(--text-hint);
	}

	.ov-grid {
		display: flex;
		justify-content: space-between;
		margin-bottom: $spacing-md;
		padding-top: $spacing-sm;
		border-top: 1rpx solid var(--border-color);
	}

	.ov-item {
		flex: 1;
		text-align: center;
	}

	.ov-num {
		font-size: $font-xl;
		font-weight: 800;
		display: block;
		color: var(--text-primary);
	}

	.ov-num-active {
		color: var(--color-amber);
	}

	.ov-num-done {
		color: var(--color-plan);
	}

	.ov-num-danger {
		color: var(--color-red);
	}

	.ov-label {
		font-size: $font-xs;
		color: var(--text-hint);
	}

	/* 优先级分布条 */
	.priority-bar {
		display: flex;
		height: 8rpx;
		border-radius: 4rpx;
		overflow: hidden;
		margin-bottom: 6rpx;
		background: var(--bg-input);
	}

	.pb-segment {
		transition: width 0.3s;
	}

	.pb-labels {
		display: flex;
		justify-content: space-between;
	}

	.pb-label {
		font-size: 20rpx;
		color: var(--text-hint);
	}

	/* 子任务进度摘要 */
	.subtask-summary {
		display: flex;
		align-items: center;
		gap: $spacing-sm;
		margin-top: $spacing-sm;
		padding-top: $spacing-sm;
		border-top: 1rpx solid var(--border-color);
	}

	.st-text {
		font-size: $font-xs;
		color: var(--text-hint);
	}

	.st-bar-wrap {
		flex: 1;
		height: 6rpx;
		background: var(--bg-input);
		border-radius: 3rpx;
		overflow: hidden;
	}

	.st-bar {
		height: 100%;
		background: var(--color-plan);
		border-radius: 3rpx;
		transition: width 0.3s;
	}

	.st-count {
		font-size: $font-xs;
		font-weight: 600;
		color: var(--text-secondary);
	}

	/* 快捷入口 */
	.quick-row {
		display: flex;
		gap: $spacing-sm;
		padding: 0 $spacing-md;
		margin-bottom: $spacing-sm;
	}

	.quick-btn {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: $spacing-sm 0;
		background: $bg-card;
		border-radius: $radius-md;
		box-shadow: $shadow-sm;
	}

	.qb-icon {
		font-size: 36rpx;
	}

	.qb-text {
		font-size: $font-xs;
		color: $text-secondary;
		margin-top: 4rpx;
	}

	/* 筛选栏 */
	.filter-bar {
		padding: $spacing-sm $spacing-md;
		background: $bg-card;
		border-bottom: 1rpx solid rgba(0, 0, 0, 0.05);
	}

	.filter-row {
		display: flex;
		gap: $spacing-xs;
		margin-bottom: $spacing-xs;
	}

	.ftag {
		padding: 6rpx 20rpx;
		border-radius: 24rpx;
		font-size: $font-xs;
		background: $bg-input;
		color: $text-secondary;
		transition: all $transition-fast;

		&.sm {
			padding: 4rpx 16rpx;
			font-size: 20rpx;
		}

		&.active {
			background: $accent;
			color: var(--text-on-ai);
			font-weight: 600;
		}

		&.ftag-danger.active {
			background: var(--color-red);
		}

		&.ftag-warn.active {
			background: var(--color-amber);
		}
	}

	/* 列表 */
	.plan-scroll {
		flex: 1;
		padding: $spacing-md;
	}

	.plan-card {
		background: $bg-card;
		border-radius: $radius-md;
		padding: $spacing-md;
		margin-bottom: $spacing-md;
		box-shadow: $shadow-sm;
		transition: all $transition-fast;
		border-left: 6rpx solid transparent;

		&:active {
			transform: scale(0.98);
		}

		&.card-done {
			opacity: 0.5;
			border-left-color: var(--border-color);

			.card-title {
				text-decoration: line-through;
				color: var(--text-hint);
			}
		}

		&.card-urg {
			border-left-color: var(--color-red);
		}

		&.card-imp {
			border-left-color: var(--color-amber);
		}
	}

	.card-top {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: $spacing-sm;
	}

	.card-left {
		flex: 1;
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: 8rpx;
	}

	.priority-dot {
		width: 16rpx;
		height: 16rpx;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.card-title {
		font-size: $font-lg;
		font-weight: 700;
		color: $text-primary;
	}

	.card-desc {
		font-size: $font-sm;
		color: $text-secondary;
		margin-top: 6rpx;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.status-tag {
		font-size: $font-xs;
		padding: 4rpx 16rpx;
		border-radius: 20rpx;
		font-weight: 600;
		flex-shrink: 0;
		margin-left: $spacing-sm;

		&.status-0 {
			background: rgba(0, 0, 0, 0.05);
			color: $text-secondary;
		}

		&.status-1 {
			background: rgba(0, 0, 0, 0.06);
			color: var(--text-primary);
		}

		&.status-2 {
			background: rgba(16, 185, 129, 0.1);
			color: var(--color-plan);
		}
	}

	/* 子任务进度 */
	.subtask-row {
		display: flex;
		align-items: center;
		gap: $spacing-sm;
		margin-bottom: $spacing-sm;
	}

	.st-progress-bar {
		flex: 1;
		height: 8rpx;
		background: $bg-input;
		border-radius: 4rpx;
		overflow: hidden;
	}

	.st-progress-fill {
		height: 100%;
		background: var(--color-ai);
		border-radius: 4rpx;
		transition: width 0.3s;
	}

	.st-progress-text {
		font-size: $font-xs;
		color: $text-secondary;
		font-weight: 600;
		min-width: 60rpx;
		text-align: right;
	}

	/* 嵌套子计划标识 */
	.nested-badge {
		display: inline-flex;
		align-items: center;
		gap: 4rpx;
		padding: 2rpx 12rpx;
		background: rgba(0, 0, 0, 0.04);
		border-radius: 12rpx;
		margin-top: $spacing-xs;
		align-self: flex-start;
	}

	.nb-icon {
		font-size: 20rpx;
		color: $text-hint;
	}

	.nb-text {
		font-size: 20rpx;
		color: $text-hint;
	}

	.card-bottom {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.date-info {
		display: flex;
		gap: 12rpx;
		flex-wrap: wrap;
	}

	.date-chip {
		display: flex;
		align-items: center;
		gap: 4rpx;
		padding: 4rpx 12rpx;
		border-radius: 8rpx;
		font-size: $font-xs;
		background: var(--bg-input, #F5F5F5);

		&.est .dc-label {
			color: $text-hint;
		}

		&.est .dc-value {
			color: $text-primary;
		}

		&.due {
			background: var(--bg-input, #F5F5F5);

			.dc-label {
				color: $text-hint;
			}

			.dc-value {
				color: $text-primary;
				font-weight: 600;
			}
		}

		&.due.danger {
			background: rgba(211, 93, 93, 0.1);

			.dc-value {
				color: var(--color-danger);
			}

			.dc-label {
				color: var(--color-danger);
			}
		}
	}

	.dc-label {
		font-size: 20rpx;
	}

	.dc-value {
		font-size: 22rpx;
	}

	.due-text {
		font-size: $font-xs;
		color: $text-hint;

		&.danger {
			color: var(--color-red);
			font-weight: 600;
		}

		&.muted {
			color: $text-hint;
		}
	}

	.card-time {
		font-size: $font-xs;
		color: $text-hint;
	}

	/* 空状态 */
	.empty-actions {
		display: flex;
		gap: $spacing-sm;
		margin-top: $spacing-md;
	}

	.empty-btn {
		padding: 16rpx 36rpx;
		background: $accent;
		color: var(--text-on-ai);
		border-radius: $radius-lg;
		font-size: $font-md;

		&.outline {
			background: transparent;
			border: 2rpx solid $accent;
			color: $accent;
		}
	}

	/* 新建浮动按钮 — 极简 + 入场动画 */
	.fab {
		position: fixed;
		right: $spacing-lg;
		bottom: $spacing-lg;
		width: 112rpx;
		height: 112rpx;
		border-radius: $radius-round;
		background: var(--color-ai);
		box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.12);
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
			color: var(--text-on-ai);
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
</style>