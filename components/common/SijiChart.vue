<script setup>
/**
 * SijiChart — 思迹轻量图表组件
 * 零第三方依赖，基于 Canvas 2D API 自绘
 *
 * 支持图表类型：ring(环形) / bar(柱状) / line(折线) / gauge(仪表盘)
 * 绘图逻辑见 utils/chart-renderer.js
 * 4.47：入场 / 切数据时用 rAF 做一次生长/描绘动画（progress 0→1）；
 *      不支持 rAF 的环境（部分小程序）自动退回 setTimeout，再不行直接绘制。
 * 4.48.3：dark 不传时自动跟随 theme.js 单例，避免页面漏传把浅色画到深色卡片上。
 */

import { computed, watch, onMounted, onBeforeUnmount, nextTick, getCurrentInstance } from 'vue'
import { renderChart } from '@/utils/chart-renderer.js'
import { isDark as themeIsDark } from '@/utils/theme.js'

const props = defineProps({
  type: { type: String, default: 'bar' },
  data: { type: Array, default: () => [] },
  height: { type: Number, default: 200 },
  colors: {
    type: Array,
    default: () => ['#000000', '#059669', '#F59E0B', '#DC2626', '#0EA5E9', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6B7280']
  },
  label: { type: String, default: '' },
  value: { type: Number, default: 0 },
  showAxis: { type: Boolean, default: true },
  barWidth: { type: Number, default: 0 },
  groupMode: { type: Boolean, default: false },
  dark: { type: Boolean, default: undefined },
  animate: { type: Boolean, default: true } // 关闭动画则一次性绘制（如长图导出）
})

/** 主题裁决：显式传 dark 以调用方为准；不传则跟随全局主题（漏传不再出错） */
const chartDark = computed(() => (props.dark === undefined || props.dark === null) ? themeIsDark.value : props.dark)

const canvasId = 'siji_chart_' + Math.random().toString(36).substr(2, 9)
const instance = getCurrentInstance()

let ctx = null
let timer = null
let curProgress = 1

function rpx2px(rpx) {
  try {
    const sysInfo = uni.getSystemInfoSync()
    return rpx * (sysInfo.windowWidth / 750)
  } catch {
    return rpx * 0.5
  }
}

function nextFrame(cb) {
  // #ifdef H5 || APP-PLUS
  if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(cb)
  // #endif
  return setTimeout(() => cb(Date.now()), 16)
}
function cancelFrame(id) {
  // #ifdef H5 || APP-PLUS
  if (typeof cancelAnimationFrame === 'function') return cancelAnimationFrame(id)
  // #endif
  return clearTimeout(id)
}

function draw(progress) {
  if (!ctx) return
  curProgress = progress
  const w = rpx2px(680)
  const h = rpx2px(props.height)
  renderChart(ctx, props.type, { ...props, dark: chartDark.value, progress }, w, h, rpx2px)
}

/** 入场 / 数据变化重放（750ms） */
function play() {
  if (!ctx) return
  if (timer) { cancelFrame(timer); timer = null }
  if (!props.animate) { draw(1); return }
  const dur = 750
  const start = Date.now()
  const tick = () => {
    const p = Math.min(1, (Date.now() - start) / dur)
    draw(p)
    if (p < 1) timer = nextFrame(tick)
    else timer = null
  }
  timer = nextFrame(tick)
}

function ensureCtx() {
  if (!ctx) ctx = uni.createCanvasContext(canvasId, instance?.proxy)
  return ctx
}

onMounted(() => {
  nextTick(() => setTimeout(() => {
    if (ensureCtx()) play()
  }, 50))
})

onBeforeUnmount(() => {
  if (timer) { cancelFrame(timer); timer = null }
})

// 数据 / 类型 / 数值变化：重放入场
watch(() => props.data, () => nextTick(() => { if (ensureCtx()) play() }), { deep: true })
watch(() => props.value, () => nextTick(() => { if (ensureCtx()) play() }))
watch(() => props.type, () => nextTick(() => { if (ensureCtx()) play() }))
// 主题 / 配色变化：不重播，按当前进度重绘
watch(chartDark, () => nextTick(() => { if (ensureCtx()) draw(curProgress) }))
watch(() => props.colors, () => nextTick(() => { if (ensureCtx()) draw(curProgress) }), { deep: true })
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
