<script setup>
import EmptyState from '@/components/common/EmptyState.vue'
import PlanCard from './PlanCard.vue'

const props = defineProps({
	filteredPlans: { type: Array, required: true },
	statusMap: { type: Object, required: true },
	priorityColors: { type: Object, required: true },
	swipeItem: { type: String, default: null },
	getSwipeOffset: { type: Function, default: () => '0px' }
})

const emit = defineEmits([
	'go-detail', 'go-templates', 'go-new',
	'touch-start', 'touch-move', 'touch-end',
	'card-tap', 'quick-complete', 'quick-edit', 'quick-delete'
])
</script>

<template>
	<scroll-view class="plan-scroll" scroll-y @scroll="emit('touch-end', {})" :scroll-with-animation="false">
		<EmptyState v-if="filteredPlans.length === 0" icon="plan" title="暂无计划" description="使用模板快速创建，或让 AI 帮你规划">
			<view class="empty-actions">
				<view class="empty-btn primary" @tap="emit('go-templates')">从模板创建</view>
				<view class="empty-btn outline" @tap="emit('go-new')">自定义计划</view>
			</view>
		</EmptyState>

		<view v-else class="plan-list">
			<view
				v-for="item in filteredPlans"
				:key="item.client_id"
				class="card-wrapper"
			>
				<!-- 左滑操作按钮 -->
				<view class="swipe-actions" v-if="swipeItem === item.client_id">
					<view class="swipe-action complete" @tap.stop="emit('quick-complete', item)">
						<text class="sa-icon">✓</text>
						<text class="sa-label">{{ item.status === 2 ? '重开' : '完成' }}</text>
					</view>
					<view class="swipe-action edit" @tap.stop="emit('quick-edit', item)">
						<text class="sa-icon">✎</text>
						<text class="sa-label">编辑</text>
					</view>
					<view class="swipe-action delete" @tap.stop="emit('quick-delete', item)">
						<text class="sa-icon">✕</text>
						<text class="sa-label">删除</text>
					</view>
				</view>

				<!-- 卡片本体（可滑动） -->
				<view
					class="card-slide"
					:style="{ transform: `translateX(${getSwipeOffset(item)})` }"
					@touchstart="emit('touch-start', $event, item)"
					@touchmove="emit('touch-move', $event, item)"
					@touchend="emit('touch-end', item)"
					@tap="emit('card-tap', item)"
				>
					<PlanCard
						:item="item"
						:statusMap="statusMap"
						:priorityColors="priorityColors"
						@go-detail="emit('go-detail', $event)"
					/>
				</view>
			</view>
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

/* 左滑卡片容器 */
.card-wrapper {
	position: relative;
	overflow: hidden;
	margin-bottom: 10rpx;
}

.card-slide {
	transition: transform 0.2s ease;
	will-change: transform;
}

/* 左滑操作按钮 — fixed 风格定位，硬编码颜色 */
.swipe-actions {
	position: absolute;
	right: 0;
	top: 0;
	bottom: 0;
	display: flex;
	align-items: stretch;
	z-index: 1;
}

.swipe-action {
	width: 70rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 4rpx;

	&.complete {
		background: #18181B;
		.sa-icon, .sa-label { color: #FFFFFF; }
	}

	&.edit {
		background: #E4E4E7;
		.sa-icon, .sa-label { color: #18181B; }
	}

	&.delete {
		background: #D35D5D;
		.sa-icon, .sa-label { color: #FFFFFF; }
	}

	.sa-icon {
		font-size: 28rpx;
		font-weight: 700;
	}

	.sa-label {
		font-size: 18rpx;
	}
}

@media (prefers-color-scheme: dark) {
	.empty-btn {
		&.primary { background: #FAFAFA; color: #18181B; }
		&.outline { border-color: #FAFAFA; color: #FAFAFA; }
	}
	.swipe-action {
		&.complete { background: #FAFAFA; .sa-icon, .sa-label { color: #18181B; } }
		&.edit { background: #3F3F46; .sa-icon, .sa-label { color: #FAFAFA; } }
		&.delete { background: #D35D5D; .sa-icon, .sa-label { color: #FFFFFF; } }
	}
}
</style>
