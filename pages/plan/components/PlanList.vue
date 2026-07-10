<script setup>
import EmptyState from '@/components/common/EmptyState.vue'
import PlanCard from './PlanCard.vue'

defineProps({
	filteredPlans: { type: Array, required: true },
	statusMap: { type: Object, required: true },
	priorityColors: { type: Object, required: true }
})

const emit = defineEmits(['go-detail', 'go-templates', 'go-new'])
</script>

<template>
	<scroll-view class="plan-scroll" scroll-y>
		<EmptyState v-if="filteredPlans.length === 0" icon="plan" title="暂无计划" description="使用模板快速创建，或让 AI 帮你规划">
			<view class="empty-actions">
				<view class="empty-btn" @tap="emit('go-templates')">从模板创建</view>
				<view class="empty-btn outline" @tap="emit('go-new')">自定义计划</view>
			</view>
		</EmptyState>

		<view v-else class="plan-list">
			<PlanCard v-for="item in filteredPlans" :key="item.client_id"
				:item="item" :statusMap="statusMap" :priorityColors="priorityColors"
				@go-detail="emit('go-detail', $event)" />
		</view>

		<view style="height: 140rpx" />
	</scroll-view>
</template>

<style lang="scss" scoped>
.plan-scroll {
	flex: 1;
	padding: $spacing-md;
}

.plan-list {
	/* container only; card styles in PlanCard */
}

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
</style>
