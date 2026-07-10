<script setup>
/**
 * 子任务区域组件
 * 展示子任务列表、进度条、AI 拆解按钮
 */
import SijiIcon from '@/components/common/SijiIcon.vue'

defineProps({
  subtasks: { type: Array, default: () => [] },
  aiLoading: { type: Boolean, default: false },
  subtaskProgress: { type: Object, default: null },
  aiBreakdownText: { type: String, default: '' }
})

const emit = defineEmits([
  'toggle-subtask',
  'remove-subtask',
  'add-subtask',
  'ai-breakdown'
])
</script>

<template>
  <view class="section">
    <view class="subtask-header">
      <text class="section-label">子任务</text>
      <view
        class="ai-breakdown-btn"
        :class="{ loading: aiLoading }"
        @tap="!aiLoading && emit('ai-breakdown')"
      >
        <SijiIcon name="sparkle" size="sm" class="ab-icon" />
        <text class="ab-text">{{ aiLoading ? '拆解中...' : 'AI拆解' }}</text>
      </view>
    </view>

    <!-- 进度条 -->
    <view v-if="subtaskProgress" class="subtask-progress">
      <view class="sp-bar">
        <view class="sp-fill" :style="{ width: subtaskProgress.pct + '%' }" />
      </view>
      <text class="sp-text">{{ subtaskProgress.done }}/{{ subtaskProgress.total }} ({{ subtaskProgress.pct }}%)</text>
    </view>

    <!-- 子任务列表 -->
    <view class="subtask-list">
      <view
        v-for="(s, i) in subtasks" :key="i"
        class="subtask-item"
        :class="{ done: s.done }"
      >
        <view class="si-check" @tap="emit('toggle-subtask', i)">
          <text class="si-check-icon">{{ s.done ? '✓' : '○' }}</text>
        </view>
        <input
          v-model="s.title"
          class="si-input"
          placeholder="子任务内容"
          maxlength="50"
        />
        <text class="si-del" @tap="emit('remove-subtask', i)">✕</text>
      </view>
      <view class="add-subtask" @tap="emit('add-subtask')">+ 添加子任务</view>
    </view>

    <!-- AI 拆解结果 -->
    <view v-if="aiBreakdownText" class="ai-section">
      <view class="section-label"><SijiIcon name="sparkle" size="sm" class="section-icon" /><text>AI 拆解</text></view>
      <text class="ai-text">{{ aiBreakdownText }}</text>
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

.ai-breakdown-btn {
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 6rpx 20rpx;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 20rpx;

  &.loading { opacity: 0.6; }

  .ab-icon { font-size: 24rpx; }
  .ab-text { font-size: $font-xs; color: $accent; }
}

.subtask-progress {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  margin-bottom: $spacing-md;
}

.sp-bar {
  flex: 1;
  height: 10rpx;
  background: $bg-input;
  border-radius: 5rpx;
  overflow: hidden;
}

.sp-fill {
  height: 100%;
  background: var(--color-ai);
  border-radius: 5rpx;
  transition: width 0.3s;
}

.sp-text {
  font-size: $font-xs;
  color: $text-secondary;
  font-weight: 600;
  min-width: 120rpx;
  text-align: right;
}

.subtask-list { display: flex; flex-direction: column; gap: $spacing-xs; }

.subtask-item {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: 12rpx 0;

  &.done {
    .si-check-icon { color: var(--color-plan); font-weight: 700; }
    .si-input { text-decoration: line-through; color: $text-hint; }
  }
}

.si-check {
  width: 48rpx; height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.si-check-icon {
  font-size: 36rpx;
  color: $text-hint;
}

.si-input {
  flex: 1;
  font-size: $font-sm;
  padding: 8rpx 0;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.04);
}

.si-del {
  font-size: 24rpx;
  color: $danger;
  padding: 8rpx;
  flex-shrink: 0;
}

.add-subtask {
  font-size: $font-sm;
  color: $accent;
  padding: 12rpx 0;
  text-align: center;
  border: 2rpx dashed rgba(0, 0, 0, 0.1);
  border-radius: $radius-sm;
  margin-top: $spacing-xs;
}

/* AI 区域 */
.ai-section {
  background: rgba(0, 0, 0, 0.02);
  border: 1rpx solid rgba(0, 0, 0, 0.06);
  border-radius: $radius-md;
  padding: $spacing-md;
  margin-top: $spacing-md;

  .ai-text {
    font-size: $font-sm;
    color: $text-primary;
    line-height: 1.7;
    white-space: pre-wrap;
  }
}

.section-icon {
  margin-right: 6rpx;
}
</style>
