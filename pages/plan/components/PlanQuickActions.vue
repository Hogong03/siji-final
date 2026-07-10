<script setup>
import SijiIcon from '@/components/common/SijiIcon.vue'

const emit = defineEmits(['go-templates', 'go-stats', 'go-new'])
</script>

<template>
	<view class="quick-row">
		<view class="quick-btn" @tap="emit('go-templates')">
			<SijiIcon name="plan" size="md" class="qb-icon" />
			<text class="qb-text">模板</text>
		</view>
		<view class="quick-btn" @tap="emit('go-stats')">
			<SijiIcon name="stats" size="md" class="qb-icon" />
			<text class="qb-text">统计</text>
		</view>
		<view class="quick-btn" @tap="emit('go-new')">
			<SijiIcon name="sparkle" size="md" class="qb-icon" />
			<text class="qb-text">新建</text>
		</view>
	</view>
</template>

<style lang="scss" scoped>
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
</style>
