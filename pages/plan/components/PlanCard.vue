<script setup>
const props = defineProps({
	item: { type: Object, required: true },
	statusMap: { type: Object, required: true },
	priorityColors: { type: Object, required: true }
})

const emit = defineEmits(['go-detail'])

function formatDateTime(str) {
	if (!str) return null
	if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return { date: str, time: '', full: str }
	const m = str.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(:\d{2})?)?/)
	if (m) return { date: m[1], time: m[2] || '', full: str }
	return { date: str, time: '', full: str }
}

function subProgress(item) {
	// 子计划进度（优先）；历史子任务兜底
	if (item._childStats && item._childStats.total > 0) {
		return {
			done: item._childStats.done,
			total: item._childStats.total,
			pct: Math.round(item._childStats.done / item._childStats.total * 100),
			kind: 'child'
		}
	}
	if (!item.subtasks || item.subtasks.length === 0) return null
	const done = item.subtasks.filter(s => s.done).length
	return {
		done,
		total: item.subtasks.length,
		pct: Math.round(done / item.subtasks.length * 100),
		kind: 'sub'
	}
}

function formatDue(ds) {
	if (!ds) return null
	const dt = formatDateTime(ds)
	const now = new Date()
	const due = new Date(dt.full.replace(/-/g, '/'))
	const diff = Math.ceil((due - now) / (1000 * 60 * 60 * 24))
	let text
	if (diff < 0) text = '已过期'
	else if (diff === 0) text = '今天'
	else if (diff === 1) text = '明天'
	else if (diff <= 7) text = `${diff}天`
	else text = dt.date
	if (dt.time && diff >= 0 && diff <= 1) text += ` ${dt.time.substring(0, 5)}`
	return { text, danger: diff < 0 || diff === 0 }
}

function formatEst(ds) {
	if (!ds) return null
	const dt = formatDateTime(ds)
	const now = new Date()
	const est = new Date(dt.full.replace(/-/g, '/'))
	const diff = Math.ceil((est - now) / (1000 * 60 * 60 * 24))
	let text
	if (diff < 0) text = '应开始'
	else if (diff === 0) text = '今天'
	else if (diff === 1) text = '明天'
	else if (diff <= 7) text = `${diff}天`
	else text = dt.date
	if (dt.time && diff >= 0 && diff <= 1) text += ` ${dt.time.substring(0, 5)}`
	return { text }
}
</script>

<template>
	<view class="plan-card"
		:class="{ 'card-done': item.status === 2, 'card-urg': item.priority === 2, 'card-imp': item.priority === 1, 'card-frozen': !!item.frozen_at }"
		@tap="emit('go-detail', item.client_id)">
		<!-- 标题行 -->
		<view class="card-top">
			<view class="priority-dot" :style="{ background: priorityColors[item.priority] || '#999' }" />
			<text class="card-title">{{ item.title }}</text>
			<text class="status-tag" :class="`status-${item.status}`">{{ statusMap[item.status] || '未知' }}</text>
			<text v-if="item.frozen_at" class="frozen-tag">冷藏中</text>
		</view>

		<!-- 描述 -->
		<text class="card-desc" v-if="item.description">{{ item.description.substring(0, 80) }}</text>

		<!-- 子任务进度 -->
		<view v-if="subProgress(item)" class="subtask-row">
			<text class="st-kind">{{ subProgress(item).kind === 'child' ? '子计划' : '子任务' }}</text>
			<view class="st-bar">
				<view class="st-fill" :style="{ width: subProgress(item).pct + '%' }" />
			</view>
			<text class="st-text">{{ subProgress(item).done }}/{{ subProgress(item).total }}</text>
		</view>

		<!-- 底部：日期 -->
		<view class="card-bottom">
			<view class="date-info">
				<text v-if="item.estimated_time" class="date-text est">📅 {{ formatEst(item.estimated_time)?.text }}</text>
				<text v-if="item.due_date" class="date-text due" :class="{ danger: formatDue(item.due_date)?.danger }">⏰ {{ formatDue(item.due_date)?.text }}</text>
				<text v-if="!item.estimated_time && !item.due_date" class="date-text muted">无日期</text>
			</view>
			<text v-if="item.parent_id" class="nested-badge">↳ 子计划</text>
		</view>
	</view>
</template>

<style scoped lang="scss">
.plan-card {
	background: #FFFFFF;
	border-radius: 12rpx;
	padding: 16rpx 20rpx;
	margin-bottom: 10rpx;
	border-left: 6rpx solid transparent;

	&:active { transform: scale(0.98); }

	&.card-done {
		opacity: 0.5;
		border-left-color: #E4E4E7;
		.card-title { text-decoration: line-through; color: #A1A1AA; }
	}
	&.card-urg { border-left-color: #EF4444; }
	&.card-imp { border-left-color: #E8A838; }
}

.card-top {
	display: flex;
	align-items: center;
	gap: 8rpx;
}

.priority-dot {
	width: 12rpx;
	height: 12rpx;
	border-radius: 50%;
	flex-shrink: 0;
}

.card-title {
	font-size: 30rpx;
	font-weight: 700;
	color: #18181B;
	flex: 1;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.status-tag {
	font-size: 20rpx;
	padding: 4rpx 14rpx;
	border-radius: 16rpx;
	font-weight: 600;
	flex-shrink: 0;

	&.status-0 { background: #F4F4F5; color: #71717A; }
	&.status-1 { background: #18181B; color: #FFFFFF; }
	&.status-2 { background: rgba(16, 185, 129, 0.12); color: #059669; }
}

.card-desc {
	font-size: 24rpx;
	color: #71717A;
	margin-top: 4rpx;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
}

.subtask-row {
	display: flex;
	align-items: center;
	gap: 12rpx;
	margin-top: 8rpx;
}

.st-kind {
	font-size: 18rpx;
	color: #A1A1AA;
	flex-shrink: 0;
}

.st-bar {
	flex: 1;
	height: 6rpx;
	background: #E4E4E7;
	border-radius: 3rpx;
	overflow: hidden;
}

.st-fill {
	height: 100%;
	background: #18181B;
	border-radius: 3rpx;
	transition: width 0.3s;
}

.st-text {
	font-size: 20rpx;
	color: #52525B;
	font-weight: 600;
	min-width: 50rpx;
	text-align: right;
	font-variant-numeric: tabular-nums;
}

.card-bottom {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-top: 8rpx;
}

.date-info {
	display: flex;
	gap: 12rpx;
	flex-wrap: wrap;
}

.date-text {
	font-size: 20rpx;
	color: #71717A;

	&.due { color: #18181B; font-weight: 600; }
	&.danger { color: #EF4444; font-weight: 700; }
	&.muted { color: #A1A1AA; }
}

.nested-badge {
	font-size: 18rpx;
	color: #A1A1AA;
	background: #F4F4F5;
	padding: 2rpx 10rpx;
	border-radius: 10rpx;
}

@media (prefers-color-scheme: dark) {
	.plan-card { background: #27272A; }
	.plan-card.card-done { border-left-color: #52525B; .card-title { color: #52525B; } }
	.card-title { color: #FAFAFA; }
	.card-desc { color: #A1A1AA; }
	.status-tag {
		&.status-0 { background: #3F3F46; color: #A1A1AA; }
		&.status-1 { background: #FAFAFA; color: #18181B; }
		&.status-2 { background: rgba(16, 185, 129, 0.15); color: #34D399; }
	}
	.st-kind { color: #71717A; }
	.st-bar { background: #3F3F46; }
	.st-fill { background: #FAFAFA; }
	.st-text { color: #F4F4F5; }
	.date-text { color: #71717A; &.due { color: #FAFAFA; } &.danger { color: #F87171; } }
	.nested-badge { background: #3F3F46; color: #71717A; }
}

.frozen-tag {
	font-size: 20rpx;
	color: #B45309;
	background: #F5F5F4;
	padding: 2rpx 12rpx;
	border-radius: 8rpx;
	margin-left: 10rpx;
	flex-shrink: 0;
}

.card-frozen {
	opacity: 0.72;
}

@media (prefers-color-scheme: dark) {
	.frozen-tag {
		background: #3F3F46;
		color: #D97706;
	}
}
</style>
