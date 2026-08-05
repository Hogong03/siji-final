<script setup>
/**
 * 子计划列表组件
 * 显示嵌套子计划卡片列表，支持点击跳转和添加新子计划
 */
defineProps({
  childPlans: { type: Array, default: () => [] },
  priorityColors: { type: Array, default: () => ['#999', '#E8A838', '#D35D5D'] },
  statusMap: { type: Array, default: () => ['待开始', '进行中', '已完成'] }
})

const emit = defineEmits(['go-child-plan', 'add-child-plan'])

function goChildPlan(clientId) {
  emit('go-child-plan', clientId)
}

function goAddChildPlan() {
  emit('add-child-plan')
}
</script>

<template>
  <view class="section">
    <view class="subtask-header">
      <text class="section-label">子计划</text>
      <view class="add-subplan-btn" @tap="goAddChildPlan">
        <text>+ 添加子计划</text>
      </view>
    </view>
    <view v-if="childPlans.length === 0" class="empty-subplan">
      <text class="empty-subplan-text">暂无子计划。你可以为这个计划创建嵌套的子计划，实现更精细的管理。</text>
    </view>
    <view v-else class="child-plan-list">
      <view
        v-for="child in childPlans" :key="child.client_id"
        class="child-plan-card"
        @tap="goChildPlan(child.client_id)"
      >
        <view class="cp-top">
          <view class="cp-dot" :style="{ background: priorityColors[child.priority] || '#999' }" />
          <text class="cp-title">{{ child.title }}</text>
          <text class="cp-status" :class="'cp-status-' + child.status">{{ statusMap[child.status] }}</text>
        </view>
        <view v-if="child.due_date" class="cp-due">
          <text class="cp-due-text">截止: {{ child.due_date }}</text>
        </view>
        <view v-if="child.subtasks && child.subtasks.length > 0" class="cp-sub">
          <text class="cp-sub-text">{{ child.subtasks.filter(s => s.done).length }}/{{ child.subtasks.length }} 子任务</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.subtask-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $spacing-sm;
}

.add-subplan-btn {
  padding: 6rpx 20rpx;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 20rpx;
  font-size: $font-xs;
  color: $accent;
}

.empty-subplan {
  padding: $spacing-md 0;
  text-align: center;
}

.empty-subplan-text {
  font-size: $font-xs;
  color: $text-hint;
  line-height: 1.6;
}

.child-plan-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.child-plan-card {
  padding: $spacing-sm $spacing-md;
  background: rgba(0, 0, 0, 0.02);
  border-radius: $radius-sm;
  border-left: 4rpx solid $accent;
  transition: all $transition-fast;

  &:active { transform: scale(0.98); }
}

.cp-top {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.cp-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  flex-shrink: 0;
}

.cp-title {
  flex: 1;
  font-size: $font-sm;
  font-weight: 600;
  color: $text-primary;
}

.cp-status {
  font-size: 20rpx;
  padding: 2rpx 12rpx;
  border-radius: 16rpx;
  font-weight: 600;

  &.cp-status-0 { background: rgba(0,0,0,0.05); color: $text-secondary; }
  &.cp-status-1 { background: rgba(0,0,0,0.06); color: $text-primary; }
  &.cp-status-2 { background: rgba(16, 185, 129, 0.1); color: #059669; }
}

.cp-due, .cp-sub {
  margin-top: 4rpx;
  padding-left: 20rpx;
}

.cp-due-text, .cp-sub-text {
  font-size: 20rpx;
  color: $text-hint;
}
</style>
