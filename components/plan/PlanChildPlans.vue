<script setup>
/**
 * 子计划列表组件
 * 新模型：计划直接包含子计划；点击子计划查看其完整情况
 */
defineProps({
  childPlans: { type: Array, default: () => [] },
  priorityColors: { type: Array, default: () => ['#999', '#E8A838', '#D35D5D'] },
  statusMap: { type: Array, default: () => ['待开始', '进行中', '已完成'] },
  progress: { type: Object, default: () => ({ total: 0, done: 0, pct: 0 }) },
  aiLoading: { type: Boolean, default: false },
  canAdd: { type: Boolean, default: true }
})

const emit = defineEmits(['go-child-plan', 'add-child-plan', 'ai-breakdown'])

function goChildPlan(clientId) {
  emit('go-child-plan', clientId)
}

function goAddChildPlan() {
  emit('add-child-plan')
}

function goAiBreakdown() {
  emit('ai-breakdown')
}

function childExtra(child) {
  // 孙计划数量（loadPlan 时注入 _subCount）
  const sub = child._subCount || 0
  if (sub > 0) return sub + ' 个子计划'
  // 历史数据兜底：子任务计数
  if (Array.isArray(child.subtasks) && child.subtasks.length > 0) {
    return child.subtasks.filter(s => s.done).length + '/' + child.subtasks.length + ' 子任务'
  }
  return ''
}
</script>

<template>
  <view class="section">
    <view class="subplan-header">
      <view class="subplan-title-row">
        <text class="section-label">子计划</text>
        <text v-if="progress.total > 0" class="subplan-progress">{{ progress.done }}/{{ progress.total }}</text>
      </view>
      <view class="subplan-actions">
        <view class="subplan-btn ai-btn" :class="{ loading: aiLoading }" @tap="goAiBreakdown">
          <text>{{ aiLoading ? '拆解中...' : 'AI 拆解' }}</text>
        </view>
        <view v-if="canAdd" class="subplan-btn" @tap="goAddChildPlan">
          <text>+ 添加子计划</text>
        </view>
      </view>
    </view>

    <!-- 进度条 -->
    <view v-if="progress.total > 0" class="subplan-bar-row">
      <view class="subplan-bar">
        <view class="subplan-bar-fill" :style="{ width: progress.pct + '%' }" />
      </view>
      <text class="subplan-bar-text">{{ progress.pct }}%</text>
    </view>

    <view v-if="childPlans.length === 0" class="empty-subplan">
      <text class="empty-subplan-text">暂无子计划。添加子计划后，点击即可查看该子计划的完整情况。</text>
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
          <text class="cp-status" :class="'cp-status-' + child.status">{{ statusMap[child.status] || '未知' }}</text>
        </view>
        <view v-if="child.due_date" class="cp-due">
          <text class="cp-due-text">截止: {{ child.due_date }}</text>
        </view>
        <view v-if="childExtra(child)" class="cp-sub">
          <text class="cp-sub-text">{{ childExtra(child) }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.subplan-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4rpx;
}

.subplan-title-row {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
}

.subplan-progress {
  font-size: 22rpx;
  color: $text-secondary;
  font-weight: 600;
}

.subplan-actions {
  display: flex;
  gap: 8rpx;
  align-items: center;
}

.subplan-btn {
  padding: 6rpx 20rpx;
  border-radius: 20rpx;
  font-size: $font-xs;
  color: $accent;

  &.ai-btn {
    background: rgba(0, 0, 0, 0.04);
  }

  &:active { transform: scale(0.95); }
}

.subplan-bar-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin: 4rpx 0 12rpx;
}

.subplan-bar {
  flex: 1;
  height: 8rpx;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 4rpx;
  overflow: hidden;
}

.subplan-bar-fill {
  height: 100%;
  background: $accent;
  border-radius: 4rpx;
  transition: width 0.3s;
}

.subplan-bar-text {
  font-size: 20rpx;
  color: $text-hint;
  min-width: 56rpx;
  text-align: right;
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
