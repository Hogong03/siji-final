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
</template>

<style lang="scss" scoped>
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
</style>
