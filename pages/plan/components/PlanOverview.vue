<script setup>
import SijiIcon from '@/components/common/SijiIcon.vue'

defineProps({
	stats: { type: Object, required: true },
	priorityBar: { type: Array, default: () => [] }
})
const emit = defineEmits(['go-templates', 'go-stats'])
</script>

<template>
	<view class="overview-card">
		<view class="ov-header">
			<view class="ov-left">
				<text class="ov-title">计划总览</text>
				<text class="ov-sub">{{ stats.active }} 进行中 · {{ stats.overdue }} 过期</text>
			</view>
			<view class="ov-right">
				<view class="ov-rate-box">
					<text class="ov-rate">{{ stats.rate }}%</text>
					<text class="ov-rate-label">完成率</text>
				</view>
				<view class="ov-actions">
					<view class="ov-action" @tap="emit('go-stats')">
						<SijiIcon name="stats" size="sm" />
					</view>
					<view class="ov-action" @tap="emit('go-templates')">
						<SijiIcon name="plan" size="sm" />
					</view>
				</view>
			</view>
		</view>

		<view class="ov-stats-row">
			<text class="os-item"><text class="os-num">{{ stats.total }}</text> 总计</text>
			<text class="os-sep">·</text>
			<text class="os-item"><text class="os-num">{{ stats.completed }}</text> 完成</text>
			<text class="os-sep">·</text>
			<text v-if="stats.weekCheckins > 0" class="os-item">
				<text class="os-num">{{ stats.weekCheckins }}</text> 本周打卡<text v-if="stats.weekDays > 1" class="os-sub">（{{ stats.weekDays }} 天）</text>
			</text>
			<text v-if="stats.weekCheckins > 0 && stats.subTotal > 0" class="os-sep">·</text>
			<text class="os-item" v-if="stats.subTotal > 0">
				<text class="os-num">{{ stats.subDone }}/{{ stats.subTotal }}</text> 子计划
			</text>
		</view>

		<view v-if="priorityBar.length > 0" class="priority-bar">
			<view v-for="p in priorityBar" :key="p.label" class="pb-segment"
				:style="{ width: p.pct + '%', background: p.color }" />
		</view>
		<view v-if="priorityBar.length > 0" class="pb-labels">
			<text v-for="p in priorityBar" :key="p.label" class="pb-label" :style="{ color: p.color }">
				{{ p.label }} {{ p.count }}
			</text>
		</view>
	</view>
</template>

<style scoped lang="scss">
.overview-card {
	margin: 12rpx 20rpx;
	padding: 20rpx;
	background: #FFFFFF;
	border-radius: 16rpx;
}

.ov-header {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	margin-bottom: 12rpx;
}

.ov-left {
	flex: 1;
}

.ov-title {
	font-size: 28rpx;
	font-weight: 700;
	color: #18181B;
	padding-left: 12rpx;
	border-left: 4rpx solid #18181B;
}

.ov-sub {
	font-size: 22rpx;
	color: #71717A;
	margin-top: 4rpx;
	padding-left: 16rpx;
}

.ov-right {
	display: flex;
	align-items: center;
	gap: 16rpx;
}

.ov-rate-box {
	text-align: right;
}

.ov-rate {
	font-size: 40rpx;
	font-weight: 800;
	line-height: 1;
	color: #18181B;
	letter-spacing: -1rpx;
	font-variant-numeric: tabular-nums;
}

.ov-rate-label {
	font-size: 20rpx;
	color: #71717A;
}

.ov-actions {
	display: flex;
	gap: 8rpx;
}

.ov-action {
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

.ov-stats-row {
	display: flex;
	align-items: center;
	gap: 8rpx;
	margin-bottom: 10rpx;
}

.os-item {
	font-size: 22rpx;
	color: #71717A;
}

.os-num {
	font-size: 26rpx;
	font-weight: 700;
	color: #18181B;
	font-variant-numeric: tabular-nums;
}

.os-sub {
	font-size: 18rpx;
	color: #A1A1AA;
}

.os-sep {
	color: #F4F4F5;
}

.priority-bar {
	display: flex;
	height: 6rpx;
	border-radius: 3rpx;
	overflow: hidden;
	margin-bottom: 4rpx;
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

@media (prefers-color-scheme: dark) {
	.overview-card { background: #27272A; }
	.ov-title { color: #FAFAFA; border-left-color: #FAFAFA; }
	.ov-sub { color: #71717A; }
	.ov-rate { color: #FAFAFA; }
	.ov-rate-label { color: #71717A; }
	.ov-action { background: #3F3F46; &:active { background: #52525B; } }
	.os-item { color: #71717A; }
	.os-num { color: #FAFAFA; }
	.os-sub { color: #52525B; }
	.os-sep { color: #3F3F46; }
	.priority-bar { background: #3F3F46; }
}
</style>
