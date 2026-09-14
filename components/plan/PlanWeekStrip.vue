<script setup>
/**
 * 周任务周历条（3.5.2）
 * 展示本周七天（周一 → 周日）的打卡情况：已打卡 / 今天 / 未来
 * 纯展示组件，格子数据由 weekDayCells 计算（utils/plan-recur.js）
 */
defineProps({
  cells: { type: Array, default: () => [] },
  target: { type: Number, default: 1 },
  done: { type: Number, default: 0 },
  compact: { type: Boolean, default: false }
})
</script>

<template>
  <view class="week-strip">
    <view v-if="!compact" class="ws-head">
      <text class="ws-title">本周进度</text>
      <text class="ws-count" :class="{ full: done >= target }">{{ done }}/{{ target }}</text>
    </view>
    <view class="ws-days">
      <view
        v-for="c in cells" :key="c.date"
        class="ws-day"
      >
        <text class="ws-label">{{ c.label }}</text>
        <view class="ws-dot" :class="{ done: c.done, today: c.isToday, future: c.isFuture }" />
        <text class="ws-num" :class="{ today: c.isToday }">{{ c.day }}</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.week-strip {
  margin-top: 12rpx;
}

.ws-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 8rpx;
}

.ws-title {
  font-size: 20rpx;
  color: $text-hint;
}

.ws-count {
  font-size: 22rpx;
  font-weight: 700;
  color: $text-secondary;
  font-variant-numeric: tabular-nums;

  &.full { color: #059669; }
}

.ws-days {
  display: flex;
  justify-content: space-between;
  gap: 4rpx;
}

.ws-day {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;
}

.ws-label {
  font-size: 18rpx;
  color: $text-hint;
}

.ws-dot {
  width: 28rpx;
  height: 28rpx;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.06);
  border: 2rpx solid transparent;

  &.done { background: #10B981; }
  &.today { border-color: $text-primary; }
  &.future { background: rgba(0, 0, 0, 0.03); }
}

.ws-num {
  font-size: 18rpx;
  color: $text-hint;
  font-variant-numeric: tabular-nums;

  &.today {
    color: $text-primary;
    font-weight: 700;
  }
}

@media (prefers-color-scheme: dark) {
  .ws-dot { background: #3F3F46; &.future { background: #27272A; } &.today { border-color: #FAFAFA; } }
  .ws-num.today { color: #FAFAFA; }
}
</style>
