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
				<view class="empty-btn primary" @tap="emit('go-templates')">从模板创建</view>
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

<style scoped lang="scss">
.plan-scroll {
	flex: 1;
	padding: 8rpx 20rpx 0;
}

.empty-actions {
	display: flex;
	gap: 12rpx;
	margin-top: 16rpx;
}

.empty-btn {
	padding: 14rpx 32rpx;
	border-radius: 12rpx;
	font-size: 26rpx;
	font-weight: 600;

	&.primary {
		background: #18181B;
		color: #FFFFFF;
	}

	&.outline {
		background: transparent;
		border: 2rpx solid #18181B;
		color: #18181B;
	}
}

@media (prefers-color-scheme: dark) {
	.empty-btn {
		&.primary { background: #FAFAFA; color: #18181B; }
		&.outline { border-color: #FAFAFA; color: #FAFAFA; }
	}
}
</style>
