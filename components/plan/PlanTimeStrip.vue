<script setup>
/**
 * PlanTimeStrip.vue — 计划时间只读刻度条（3.2 M4）
 * 纯展示：一条灰线 + 节点圆点（主计划端点黑点、子计划灰点、今天空心圈）+ 首尾日期小字。
 * 无事件绑定，不做滑动/缩放/跳转。
 */
defineProps({
  strip: { type: Object, default: null }
})
</script>

<template>
  <view v-if="strip" class="plan-strip">
    <view class="strip-track">
      <view class="strip-line" />
      <view
        v-for="node in strip.nodes"
        :key="node.key"
        class="strip-dot"
        :class="{
          'dot-main': node.kind === 'start' || node.kind === 'end',
          'dot-child': node.kind === 'child',
          'dot-today': node.kind === 'today'
        }"
        :style="{ left: node.offsetPct + '%' }"
      />
    </view>
    <view class="strip-caption">
      <text class="strip-date strip-date-start">{{ strip.startLabel }}</text>
      <text class="strip-date strip-date-end">{{ strip.endLabel }}</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.plan-strip {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
}

.strip-track {
  position: relative;
  height: 32rpx;
  display: flex;
  align-items: center;
}

.strip-line {
  position: absolute;
  left: 8rpx;
  right: 8rpx;
  height: 4rpx;
  background: #E4E4E7;
  border-radius: 2rpx;
}

.strip-dot {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background: #000000;
  box-sizing: border-box;
}

.dot-child {
  background: #A1A1AA;
}

.dot-today {
  width: 18rpx;
  height: 18rpx;
  background: #FFFFFF;
  border: 3rpx solid #000000;
}

.strip-caption {
  display: flex;
  justify-content: space-between;
  margin-top: 4rpx;
}

.strip-date {
  font-size: 18rpx;
  color: #71717A;
}

@media (prefers-color-scheme: dark) {
  .strip-line {
    background: #27272A;
  }

  .dot-today {
    background: #18181B;
  }

  .strip-date {
    color: #A1A1AA;
  }
}
</style>
