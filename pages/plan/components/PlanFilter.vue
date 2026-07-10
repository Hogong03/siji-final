<script setup>
import SijiIcon from '@/components/common/SijiIcon.vue'

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
			<view class="ftag sm" :class="{ active: filterPriority === 2, 'ftag-danger': true }"
				@tap="emit('update:filterPriority', 2)">
				<SijiIcon name="fire" size="xs" class="ftag-icon" /><text>紧急</text>
			</view>
			<view class="ftag sm" :class="{ active: filterPriority === 1, 'ftag-warn': true }"
				@tap="emit('update:filterPriority', 1)">
				<SijiIcon name="star" size="xs" class="ftag-icon" /><text>重要</text>
			</view>
			<view class="ftag sm" :class="{ active: filterPriority === 0 }" @tap="emit('update:filterPriority', 0)">普通</view>
		</view>

		<!-- 标签筛选 -->
		<view class="filter-row" v-if="filterTags.length > 0">
			<view class="ftag sm" :class="{ active: filterTag === '' }" @tap="emit('update:filterTag', '')">
				<SijiIcon name="tag" size="xs" class="ftag-icon" />
				<text>全部</text>
			</view>
			<view v-for="t in filterTags" :key="t.name" class="ftag sm" :class="{ active: filterTag === t.name }"
				:style="filterTag === t.name ? { background: t.color, borderColor: t.color, color: '#fff' } : {}"
				@tap="emit('update:filterTag', filterTag === t.name ? '' : t.name)">
				{{ t.name }} {{ t.count }}
			</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
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
</style>
