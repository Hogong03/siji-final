<script setup>
/**
 * 月份横滑切换栏
 */
defineProps({
  months:      { type: Array, default: () => [] },
  currentMonth: { type: String, default: '' }
})

const emit = defineEmits(['switchMonth', 'loadMore'])

function onMonthTap(key) {
  emit('switchMonth', key)
}
</script>

<template>
  <scroll-view class="month-bar" scroll-x>
    <view class="month-list">
      <view
        v-for="m in months" :key="m.key"
        class="month-item" :class="{ active: currentMonth === m.key }"
        @tap="onMonthTap(m.key)"
      >
        {{ m.label }}
      </view>
      <view class="month-item more-btn" @tap="$emit('loadMore')">
        ···
      </view>
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
.month-bar {
  flex-shrink: 0;
  padding: 12rpx 24rpx;
  border-bottom: 1rpx solid var(--border-color);
  background: var(--bg-card);

  .month-list {
    display: flex;
    gap: $spacing-xs;
  }

  .month-item {
    flex-shrink: 0;
    padding: 10rpx 28rpx;
    border-radius: 32rpx;
    font-size: 26rpx;
    background: var(--bg-input);
    color: var(--text-secondary);

    &.active {
      background: var(--color-ai);
      color: var(--text-on-ai);
      font-weight: 600;
    }

    &.more-btn {
      color: var(--text-hint);
      letter-spacing: 2rpx;
      font-weight: 700;
    }
  }
}
</style>
