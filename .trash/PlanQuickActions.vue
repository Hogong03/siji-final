<script setup>
const emit = defineEmits(['go-templates', 'go-stats'])
</script>

<template>
	<view class="quick-row">
		<view class="quick-btn" @tap="emit('go-templates')">
			<text class="qb-icon">📋</text>
			<text class="qb-text">模板</text>
		</view>
		<view class="quick-btn" @tap="emit('go-stats')">
			<text class="qb-icon">📊</text>
			<text class="qb-text">统计</text>
		</view>
	</view>
</template>

<style scoped lang="scss">
.quick-row {
	display: flex;
	gap: 12rpx;
	padding: 0 20rpx;
	margin-bottom: 8rpx;
}

.quick-btn {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 12rpx 0;
	background: #FFFFFF;
	border-radius: 12rpx;

	&:active {
		background: #F4F4F5;
		transform: scale(0.97);
	}
}

.qb-icon {
	font-size: 30rpx;
	line-height: 1;
}

.qb-text {
	font-size: 22rpx;
	color: #52525B;
	margin-top: 6rpx;
	font-weight: 500;
}

@media (prefers-color-scheme: dark) {
	.quick-btn { background: #27272A; &:active { background: #3F3F46; } }
	.qb-text { color: #D4D4D8; }
}
</style>
