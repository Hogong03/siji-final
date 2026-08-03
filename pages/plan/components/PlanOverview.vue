<script setup>
defineProps({
	stats: { type: Object, required: true },
	priorityBar: { type: Array, default: () => [] }
})
</script>

<template>
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
				<text class="ov-num active">{{ stats.active }}</text>
				<text class="ov-label">进行中</text>
			</view>
			<view class="ov-item">
				<text class="ov-num done">{{ stats.completed }}</text>
				<text class="ov-label">已完成</text>
			</view>
			<view class="ov-item">
				<text class="ov-num" :class="{ danger: stats.overdue > 0 }">{{ stats.overdue }}</text>
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
</template>

<style scoped lang="scss">
.overview-card {
	margin: 12rpx 20rpx;
	padding: 24rpx 20rpx;
	background: #FFFFFF;
	border-radius: 16rpx;
}

.ov-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 16rpx;
}

.ov-title {
	font-size: 28rpx;
	font-weight: 700;
	color: #18181B;
	padding-left: 12rpx;
	border-left: 4rpx solid #18181B;
}

.ov-stats {
	text-align: right;
}

.ov-rate {
	font-size: 48rpx;
	font-weight: 800;
	line-height: 1;
	color: #18181B;
	letter-spacing: -1rpx;
	font-variant-numeric: tabular-nums;
}

.ov-rate-label {
	font-size: 22rpx;
	color: #71717A;
}

.ov-grid {
	display: flex;
	justify-content: space-between;
	margin-bottom: 16rpx;
	padding-top: 12rpx;
	border-top: 1rpx solid #E4E4E7;
}

.ov-item {
	flex: 1;
	text-align: center;
}

.ov-num {
	font-size: 36rpx;
	font-weight: 800;
	display: block;
	color: #18181B;
	font-variant-numeric: tabular-nums;

	&.active { color: #18181B; }
	&.done { color: #52525B; }
	&.danger { color: #EF4444; }
}

.ov-label {
	font-size: 20rpx;
	color: #71717A;
}

/* 优先级分布条 */
.priority-bar {
	display: flex;
	height: 8rpx;
	border-radius: 4rpx;
	overflow: hidden;
	margin-bottom: 6rpx;
	background: #E4E4E7;
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
}

/* 子任务进度摘要 */
.subtask-summary {
	display: flex;
	align-items: center;
	gap: 12rpx;
	margin-top: 12rpx;
	padding-top: 12rpx;
	border-top: 1rpx solid #E4E4E7;
}

.st-text {
	font-size: 22rpx;
	color: #71717A;
}

.st-bar-wrap {
	flex: 1;
	height: 6rpx;
	background: #E4E4E7;
	border-radius: 3rpx;
	overflow: hidden;
}

.st-bar {
	height: 100%;
	background: #18181B;
	border-radius: 3rpx;
	transition: width 0.3s;
}

.st-count {
	font-size: 22rpx;
	font-weight: 600;
	color: #52525B;
	font-variant-numeric: tabular-nums;
}

@media (prefers-color-scheme: dark) {
	.overview-card { background: #27272A; }
	.ov-title { color: #FAFAFA; border-left-color: #FAFAFA; }
	.ov-rate { color: #FAFAFA; }
	.ov-rate-label { color: #71717A; }
	.ov-grid { border-top-color: #3F3F46; }
	.ov-num { color: #FAFAFA; &.done { color: #A1A1AA; } &.danger { color: #EF4444; } }
	.ov-label { color: #71717A; }
	.priority-bar { background: #3F3F46; }
	.subtask-summary { border-top-color: #3F3F46; }
	.st-text { color: #71717A; }
	.st-bar-wrap { background: #3F3F46; }
	.st-bar { background: #FAFAFA; }
	.st-count { color: #D4D4D8; }
}
</style>
