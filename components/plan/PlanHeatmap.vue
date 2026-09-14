<script setup>
/**
 * 打卡热力月视图（3.5.3）
 * 展示某个月的打卡强度（0/1/2/3+ 四档），支持翻月；数据由 utils/plan-heatmap.js 计算
 */
const props = defineProps({
  year: { type: Number, required: true },
  month: { type: Number, required: true },
  weeks: { type: Array, default: () => [] },
  totals: { type: Object, default: () => ({ days: 0, times: 0 }) },
  canNext: { type: Boolean, default: false },
  selectedDate: { type: String, default: '' },
  hideNav: { type: Boolean, default: false },
  // 可补记的日子 { 'YYYY-MM-DD': true }：有值才长按可补并显示小点
  backfillMap: { type: Object, default: () => ({}) },
  flat: { type: Boolean, default: false }
})

const emit = defineEmits(['prev', 'next', 'select-day', 'backfill-day'])
const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']

// 长按抬手后 App/H5 还会补一次 tap，会把刚展开的当天明细又翻掉，这里加 400ms 抑制窗
const LONG_PRESS_GUARD_MS = 400
let longPressAt = 0

function onDotTap(cell) {
  if (!cell || cell.isFuture) return
  if (Date.now() - longPressAt < LONG_PRESS_GUARD_MS) return
  emit('select-day', cell.date)
}

function onDotLongPress(cell) {
  if (!cell || cell.isFuture) return
  longPressAt = Date.now()
  emit('backfill-day', cell.date)
}

/** 有补记入口的日子才带点：空白格不再靠盲试长按 */
function canBackfill(cell) {
  if (!cell || cell.isFuture || cell.level !== 0) return false
  return !!(props.backfillMap && props.backfillMap[cell.date])
}
</script>

<template>
  <view class="heatmap" :class="{ flat }">
    <view class="hm-head">
      <view v-if="!hideNav" class="hm-nav" @tap="emit('prev')">
        <text>‹ 上月</text>
      </view>
      <text class="hm-title">{{ year }} 年 {{ month + 1 }} 月</text>
      <view v-if="!hideNav" class="hm-nav" :class="{ disabled: !canNext }" @tap="canNext && emit('next')">
        <text>下月 ›</text>
      </view>
    </view>

    <view class="hm-weekdays">
      <text v-for="w in WEEK_LABELS" :key="w" class="hm-weekday">{{ w }}</text>
    </view>

    <view v-for="(week, wi) in weeks" :key="wi" class="hm-week">
      <view
        v-for="(cell, ci) in week" :key="ci"
        class="hm-cell"
      >
        <view
          v-if="cell"
          class="hm-dot"
          :class="['lv-' + cell.level, { today: cell.isToday, future: cell.isFuture, selected: selectedDate === cell.date }]"
          @tap="onDotTap(cell)"
          @longpress.stop="onDotLongPress(cell)"
        >
          <text class="hm-day">{{ cell.day }}</text>
          <view v-if="canBackfill(cell)" class="hm-mark" />
        </view>
      </view>
    </view>

    <view class="hm-foot">
      <text class="hm-total">本月 {{ totals.days }} 天 · {{ totals.times }} 次</text>
      <view class="hm-legend">
        <text class="hm-legend-text">少</text>
        <view v-for="lv in [0, 1, 2, 3]" :key="lv" class="hm-dot hm-legend-dot" :class="'lv-' + lv" />
        <text class="hm-legend-text">多</text>
      </view>
    </view>
    <text v-if="selectedDate" class="hm-hint">已选 {{ selectedDate }}，再点一次收起 · 长按带点的日子可补记</text>
    <text v-else-if="!hideNav" class="hm-hint">点某天看明细 · 长按带点的日子补记</text>
  </view>
</template>

<style lang="scss" scoped>
.heatmap {
  margin: 16rpx 20rpx 0;
  padding: 16rpx;
  background: #FFFFFF;
  border-radius: 16rpx;
}

.hm-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.hm-title {
  font-size: 26rpx;
  font-weight: 700;
  color: #18181B;
  font-variant-numeric: tabular-nums;
}

.hm-nav {
  font-size: 22rpx;
  color: #71717A;
  padding: 4rpx 12rpx;
  border-radius: 12rpx;
  background: #F4F4F5;

  &:active { background: #E4E4E7; }

  &.disabled {
    color: #D4D4D8;
    background: transparent;
  }
}

.hm-weekdays {
  display: flex;
  margin-bottom: 6rpx;
}

.hm-weekday {
  flex: 1;
  text-align: center;
  font-size: 18rpx;
  color: #A1A1AA;
}

.hm-week {
  display: flex;
  margin-bottom: 6rpx;
}

.hm-cell {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rpx 0;
}

.hm-dot {
  position: relative;
  width: 54rpx;
  height: 54rpx;
  border-radius: 10rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #F4F4F5;

  &.lv-1 { background: rgba(16, 185, 129, 0.25); }
  &.lv-2 { background: rgba(16, 185, 129, 0.55); }
  &.lv-3 { background: #10B981; }

  &.today {
    border: 2rpx solid #18181B;
  }

  // 未来：还没有发生，不可点也不可补
  &.future {
    background: transparent;
    border: 1rpx dashed #E4E4E7;

    .hm-day { color: #D4D4D8; }
  }
}

// 可补记标记：灰点右下角一个小点，长按有反应的日子一眼可辨
.hm-mark {
  position: absolute;
  bottom: 5rpx;
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: #71717A;
}

.hm-day {
  font-size: 18rpx;
  color: #A1A1AA;
  font-variant-numeric: tabular-nums;
}

.hm-dot.lv-2 .hm-day,
.hm-dot.lv-3 .hm-day {
  color: #FFFFFF;
}

.hm-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10rpx;
}

.hm-total {
  font-size: 20rpx;
  color: #71717A;
  font-variant-numeric: tabular-nums;
}

.hm-legend {
  display: flex;
  align-items: center;
  gap: 6rpx;
}

.hm-legend-dot {
  width: 22rpx;
  height: 22rpx;
  border-radius: 4rpx;
}

.hm-legend-text {
  font-size: 18rpx;
  color: #A1A1AA;
}

.heatmap.flat {
  margin: 0;
  padding: 0;
  background: transparent;
  border-radius: 0;
}

@media (prefers-color-scheme: dark) {
  .heatmap { background: #27272A; }
  .hm-dot.future { border-color: #3F3F46; }
  .hm-dot.future .hm-day { color: #52525B; }
  .hm-mark { background: #A1A1AA; }
  .heatmap.flat { background: transparent; }
  .hm-title { color: #FAFAFA; }
  .hm-nav { background: #3F3F46; color: #A1A1AA; &.disabled { color: #52525B; } }
  .hm-dot { background: #3F3F46; &.today { border-color: #FAFAFA; } }
  .hm-dot.lv-2 .hm-day, .hm-dot.lv-3 .hm-day { color: #18181B; }
  .hm-total { color: #A1A1AA; }
}
</style>
