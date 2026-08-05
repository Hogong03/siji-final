<script setup>
/**
 * 骨架屏组件 — 数据加载占位
 *
 * 用法：
 *   <Skeleton :rows="3" />
 *   <Skeleton type="card" />
 *   <Skeleton type="list" :rows="5" />
 */
const props = defineProps({
  type: { type: String, default: 'list' }, // list | card | chart | circle
  rows: { type: Number, default: 3 },
  animate: { type: Boolean, default: true }
})
</script>

<template>
  <view class="skeleton-wrap" :class="{ animated: animate }">
    <!-- 列表型 -->
    <template v-if="type === 'list'">
      <view v-for="i in rows" :key="i" class="sk-list-item">
        <view class="sk-circle" />
        <view class="sk-lines">
          <view class="sk-line sk-line-wide" />
          <view class="sk-line sk-line-narrow" />
        </view>
      </view>
    </template>

    <!-- 卡片型 -->
    <template v-else-if="type === 'card'">
      <view class="sk-card">
        <view class="sk-line sk-line-wide" />
        <view class="sk-line" />
        <view class="sk-line sk-line-narrow" />
      </view>
    </template>

    <!-- 图表型 -->
    <template v-else-if="type === 'chart'">
      <view class="sk-chart">
        <view class="sk-chart-bar" v-for="i in 5" :key="i" :style="{ height: (30 + i * 15) + 'rpx' }" />
      </view>
    </template>

    <!-- 圆形（头像/图标占位） -->
    <template v-else-if="type === 'circle'">
      <view class="sk-circle sk-circle-lg" />
    </template>
  </view>
</template>

<style lang="scss" scoped>
.skeleton-wrap {
  width: 100%;
}

/* 闪烁动画 */
.animated ::v-deep .sk-line,
.animated ::v-deep .sk-circle,
.animated ::v-deep .sk-card,
.animated ::v-deep .sk-chart-bar {
  background: #F4F4F5;
  animation: skeletonPulse 1.5s infinite ease-in-out;
}

@keyframes skeletonPulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

/* 基础占位样式 */
.sk-line {
  height: 24rpx;
  border-radius: $radius-sm;
  margin-bottom: $spacing-xs;
}

.sk-line-wide { width: 80%; }
.sk-line-narrow { width: 50%; }

.sk-circle {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  flex-shrink: 0;
}

.sk-circle-lg {
  width: 120rpx;
  height: 120rpx;
}

/* 列表型 */
.sk-list-item {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-md;
  border-bottom: 1rpx solid #E4E4E7);
}

.sk-lines {
  flex: 1;
}

/* 卡片型 */
.sk-card {
  padding: $spacing-md;
  border-radius: $radius-md;
  background: rgba(0, 0, 0, 0.02);
}

/* 图表型 */
.sk-chart {
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  height: 200rpx;
  padding: $spacing-md;
}

.sk-chart-bar {
  width: 60rpx;
  border-radius: $radius-sm $radius-sm 0 0;
}
</style>
