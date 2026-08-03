<script setup>
const props = defineProps({
	filterStatus: { type: Number, default: -1 },
	filterPriority: { type: Number, default: -1 },
	filterTag: { type: String, default: '' },
	filterTags: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:filterStatus', 'update:filterPriority', 'update:filterTag'])
</script>

<template>
	<view class="filter-bar">
		<view class="filter-row">
			<view class="ftag" :class="{ active: filterStatus === -1 }" @tap="emit('update:filterStatus', -1)">全部</view>
			<view class="ftag" :class="{ active: filterStatus === 1 }" @tap="emit('update:filterStatus', 1)">进行中</view>
			<view class="ftag" :class="{ active: filterStatus === 0 }" @tap="emit('update:filterStatus', 0)">待开始</view>
			<view class="ftag" :class="{ active: filterStatus === 2 }" @tap="emit('update:filterStatus', 2)">已完成</view>
		</view>
		<view class="filter-row">
			<view class="ftag sm" :class="{ active: filterPriority === -1 }" @tap="emit('update:filterPriority', -1)">全部优先级</view>
			<view class="ftag sm danger" :class="{ active: filterPriority === 2 }" @tap="emit('update:filterPriority', 2)">🔥 紧急</view>
			<view class="ftag sm warn" :class="{ active: filterPriority === 1 }" @tap="emit('update:filterPriority', 1)">⭐ 重要</view>
			<view class="ftag sm" :class="{ active: filterPriority === 0 }" @tap="emit('update:filterPriority', 0)">普通</view>
		</view>
		<view class="filter-row" v-if="filterTags.length > 0">
			<view class="ftag sm" :class="{ active: filterTag === '' }" @tap="emit('update:filterTag', '')">全部标签</view>
			<view v-for="t in filterTags" :key="t.name" class="ftag sm" :class="{ active: filterTag === t.name }"
				@tap="emit('update:filterTag', filterTag === t.name ? '' : t.name)">
				{{ t.name }} {{ t.count }}
			</view>
		</view>
	</view>
</template>

<style scoped lang="scss">
.filter-bar {
	padding: 10rpx 20rpx 12rpx;
	background: #FFFFFF;
	border-bottom: 1rpx solid #E4E4E7;
}

.filter-row {
	display: flex;
	gap: 8rpx;
	margin-bottom: 8rpx;
	overflow-x: auto;
	-webkit-overflow-scrolling: touch;
}

.ftag {
	flex-shrink: 0;
	padding: 8rpx 20rpx;
	border-radius: 20rpx;
	font-size: 22rpx;
	background: #F4F4F5;
	color: #52525B;
	white-space: nowrap;
	transition: all 0.15s ease;

	&.sm {
		padding: 6rpx 16rpx;
		font-size: 20rpx;
	}

	&.active {
		background: #18181B;
		color: #FFFFFF;
		font-weight: 600;
	}

	/* 紧急 — 红色系 */
	&.danger.active {
		background: #EF4444;
		color: #FFFFFF;
	}

	/* 重要 — 琥珀色系 */
	&.warn.active {
		background: #E8A838;
		color: #FFFFFF;
	}
}

@media (prefers-color-scheme: dark) {
	.filter-bar { background: #27272A; border-bottom-color: #3F3F46; }
	.ftag { background: #3F3F46; color: #D4D4D8; }
	.ftag.active { background: #FAFAFA; color: #18181B; }
	.ftag.danger.active { background: #EF4444; color: #FFFFFF; }
	.ftag.warn.active { background: #E8A838; color: #FFFFFF; }
}
</style>
