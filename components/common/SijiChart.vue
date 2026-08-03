<script setup>
/**
 * SijiChart — 思迹轻量图表组件
 * 零第三方依赖，基于 Canvas 2D API 自绘
 *
 * 支持图表类型：ring(环形) / bar(柱状) / line(折线) / gauge(仪表盘)
 * 绘图逻辑见 utils/chart-renderer.js
 */

import { watch, onMounted, nextTick, getCurrentInstance } from 'vue'
import { renderChart } from '@/utils/chart-renderer.js'

const props = defineProps({
  type: { type: String, default: 'bar' },
  data: { type: Array, default: () => [] },
  height: { type: Number, default: 200 },
  colors: {
    type: Array,
    default: () => ['var(--color-ai)', 'var(--color-plan)', 'var(--color-bill)', 'var(--color-danger)', 'var(--color-info)', '#8B5CF6', 'var(--color-pink)', '#14B8A6', '#F97316', '#6B7280']
  },
  label: { type: String, default: '' },
  value: { type: Number, default: 0 },
  showAxis: { type: Boolean, default: true },
  barWidth: { type: Number, default: 0 },
  groupMode: { type: Boolean, default: false },
})

const canvasId = 'siji_chart_' + Math.random().toString(36).substr(2, 9)
const instance = getCurrentInstance()

function rpx2px(rpx) {
  try {
    const sysInfo = uni.getSystemInfoSync()
    return rpx * (sysInfo.windowWidth / 750)
  } catch {
    return rpx * 0.5
  }
}

function draw() {
  const ctx = uni.createCanvasContext(canvasId, instance?.proxy)
  if (!ctx) return
  const w = rpx2px(680)
  const h = rpx2px(props.height)
  renderChart(ctx, props.type, props, w, h, rpx2px)
}

onMounted(() => {
  nextTick(() => setTimeout(() => draw(), 50))
})

watch(() => props.data, () => nextTick(() => setTimeout(() => draw(), 50)), { deep: true })
watch(() => props.value, () => nextTick(() => setTimeout(() => draw(), 50)))
watch(() => props.type, () => nextTick(() => setTimeout(() => draw(), 50)))
</script>

<template>
  <view class="siji-chart-wrap">
    <canvas
      :canvas-id="canvasId"
      :id="canvasId"
      class="siji-chart-canvas"
      :style="{ height: height + 'rpx' }"
    />
  </view>
</template>

<style lang="scss" scoped>
.siji-chart-wrap {
  width: 100%;
  position: relative;
}

.siji-chart-canvas {
  width: 100%;
}
</style>
