<script setup>
const props = defineProps({
	item: { type: Object, required: true },
	statusMap: { type: Object, required: true },
	priorityColors: { type: Object, required: true }
})

const emit = defineEmits(['go-detail'])

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
	<view class="plan-card"
		:class="{ 'card-done': item.status === 2, 'card-urg': item.priority === 2, 'card-imp': item.priority === 1 }"
		@tap="emit('go-detail', item.client_id)">
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
</template>

<style lang="scss" scoped>
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
</style>
