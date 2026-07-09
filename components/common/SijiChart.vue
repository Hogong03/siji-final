<script setup>
/**
 * SijiChart — 思迹轻量图表组件
 * 零第三方依赖，基于 Canvas 2D API 自绘
 *
 * 支持图表类型：
 *  ① ring    — 环形图（分类占比）
 *  ② bar     — 柱状图（趋势/对比）
 *  ③ line    — 折线图（趋势）
 *  ④ gauge   — 仪表盘（完成率）
 *
 * 跨端兼容：H5 / App / 小程序（使用 uni.createCanvasContext）
 *
 * 用法：
 *  <SijiChart type="ring" :data="ringData" />
 *  <SijiChart type="bar" :data="barData" :height="160" />
 */

import { ref, watch, onMounted, nextTick, getCurrentInstance } from 'vue'

const props = defineProps({
  type: { type: String, default: 'bar' },     // ring | bar | line | gauge
  data: { type: Array, default: () => [] },   // 数据数组
  height: { type: Number, default: 200 },      // 画布高度 (rpx)
  colors: {                                    // 自定义颜色序列
    type: Array,
    default: () => ['#000000', '#10B981', '#F59E0B', '#EF4444', '#0EA5E9', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6B7280']
  },
  // ring/gauge 专用
  label: { type: String, default: '' },        // 中心标签
  value: { type: Number, default: 0 },         // gauge 当前值 (0-100)
  // bar/line 专用
  showAxis: { type: Boolean, default: true },   // 是否显示坐标轴
  barWidth: { type: Number, default: 0 },       // 柱子宽度 (0=自动)
  groupMode: { type: Boolean, default: false }, // 柱状图分组模式（多组柱子并排）
})

const canvasId = 'siji_chart_' + Math.random().toString(36).substr(2, 9)
const instance = getCurrentInstance()

// rpx → px 转换
function rpx2px(rpx) {
  try {
    const sysInfo = uni.getSystemInfoSync()
    return rpx * (sysInfo.windowWidth / 750)
  } catch {
    return rpx * 0.5
  }
}

onMounted(() => {
  nextTick(() => {
    setTimeout(() => draw(), 50)
  })
})

watch(() => props.data, () => {
  nextTick(() => setTimeout(() => draw(), 50))
}, { deep: true })

watch(() => props.value, () => {
  nextTick(() => setTimeout(() => draw(), 50))
})

watch(() => props.type, () => {
  nextTick(() => setTimeout(() => draw(), 50))
})

function draw() {
  const ctx = uni.createCanvasContext(canvasId, instance?.proxy)
  if (!ctx) return

  const w = rpx2px(680) // 画布宽度（近似全宽减 padding）
  const h = rpx2px(props.height)
  const padding = { top: 16, right: 16, bottom: 28, left: 16 }

  // 清空
  ctx.clearRect(0, 0, w + 32, h + 32)

  switch (props.type) {
    case 'ring': drawRing(ctx, w, h, padding); break
    case 'bar': drawBar(ctx, w, h, padding); break
    case 'line': drawLine(ctx, w, h, padding); break
    case 'gauge': drawGauge(ctx, w, h, padding); break
  }

  ctx.draw()
}

// ==================== 环形图 ====================
function drawRing(ctx, w, h, pad) {
  const cx = w / 2
  const cy = h / 2
  const radius = Math.min(w, h) / 2 - pad.top - 10
  const innerRadius = radius * 0.62

  const data = props.data.filter(d => d.value > 0)
  const total = data.reduce((s, d) => s + d.value, 0)

  if (total === 0) {
    // 空状态
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.setStrokeStyle('#E4E4E7')
    ctx.setLineWidth(rpx2px(28))
    ctx.stroke()
    ctx.setFillStyle('#A1A1AA')
    ctx.setFontSize(rpx2px(26))
    ctx.setTextAlign('center')
    ctx.setTextBaseline('middle')
    ctx.fillText('暂无数据', cx, cy)
    return
  }

  // 绘制扇形
  let startAngle = -Math.PI / 2
  data.forEach((item, i) => {
    const angle = (item.value / total) * Math.PI * 2
    const color = item.color || props.colors[i % props.colors.length]

    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, radius, startAngle, startAngle + angle)
    ctx.closePath()
    ctx.setFillStyle(color)
    ctx.fill()

    startAngle += angle
  })

  // 内圆遮罩（创建环形效果）
  ctx.beginPath()
  ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2)
  ctx.setFillStyle('#FFFFFF')
  ctx.fill()

  // 中心文字
  ctx.setFillStyle('#18181B')
  ctx.setFontSize(rpx2px(36))
  ctx.setTextAlign('center')
  ctx.setTextBaseline('middle')
  ctx.fillText(props.label || '', cx, cy - rpx2px(10))

  // 副标题（总数）
  ctx.setFillStyle('#71717A')
  ctx.setFontSize(rpx2px(22))
  ctx.fillText(data.length + ' 项', cx, cy + rpx2px(20))
}

// ==================== 柱状图 ====================
function drawBar(ctx, w, h, pad) {
  const chartW = w - pad.left - pad.right
  const chartH = h - pad.top - pad.bottom
  const data = props.data

  if (!data || data.length === 0) {
    drawEmpty(ctx, w, h)
    return
  }

  // 计算最大值
  const maxVal = Math.max(...data.flatMap(d => {
    if (props.groupMode && Array.isArray(d.values)) return d.values
    return [d.value || 0]
  }), 1)

  // 坐标轴
  if (props.showAxis) {
    ctx.setStrokeStyle('#E4E4E7')
    ctx.setLineWidth(1)
    ctx.beginPath()
    ctx.moveTo(pad.left, h - pad.bottom)
    ctx.lineTo(w - pad.right, h - pad.bottom)
    ctx.stroke()
  }

  const groupCount = data.length
  const groupWidth = chartW / groupCount
  const barGap = 3

  data.forEach((item, i) => {
    const x = pad.left + i * groupWidth

    if (props.groupMode && Array.isArray(item.values)) {
      // 分组模式：多根柱子并排
      const subCount = item.values.length
      const totalBarWidth = groupWidth - barGap * 2
      const barW = (totalBarWidth - barGap * (subCount - 1)) / subCount

      item.values.forEach((val, j) => {
        const barH = (val / maxVal) * chartH
        const bx = x + barGap + j * (barW + barGap)
        const by = h - pad.bottom - barH
        ctx.setFillStyle(props.colors[j % props.colors.length])
        drawRoundRect(ctx, bx, by, barW, barH, 2)
        ctx.fill()
      })
    } else {
      // 单柱模式
      const val = item.value || 0
      const barH = (val / maxVal) * chartH
      const barW = props.barWidth > 0 ? rpx2px(props.barWidth) : groupWidth * 0.5
      const bx = x + (groupWidth - barW) / 2
      const by = h - pad.bottom - barH
      ctx.setFillStyle(item.color || props.colors[0])
      drawRoundRect(ctx, bx, by, barW, barH, 2)
      ctx.fill()
    }

    // X 轴标签
    if (props.showAxis && item.label) {
      ctx.setFillStyle('#A1A1AA')
      ctx.setFontSize(rpx2px(18))
      ctx.setTextAlign('center')
      ctx.fillText(item.label, x + groupWidth / 2, h - pad.bottom + rpx2px(20))
    }
  })
}

// ==================== 折线图 ====================
function drawLine(ctx, w, h, pad) {
  const chartW = w - pad.left - pad.right
  const chartH = h - pad.top - pad.bottom
  const data = props.data

  if (!data || data.length < 2) {
    drawEmpty(ctx, w, h)
    return
  }

  const maxVal = Math.max(...data.map(d => d.value || 0), 1)
  const stepX = chartW / (data.length - 1)

  // 坐标轴
  if (props.showAxis) {
    ctx.setStrokeStyle('#E4E4E7')
    ctx.setLineWidth(1)
    ctx.beginPath()
    ctx.moveTo(pad.left, h - pad.bottom)
    ctx.lineTo(w - pad.right, h - pad.bottom)
    ctx.stroke()
  }

  // 填充区域
  ctx.beginPath()
  ctx.moveTo(pad.left, h - pad.bottom)
  data.forEach((d, i) => {
    const x = pad.left + i * stepX
    const y = h - pad.bottom - ((d.value || 0) / maxVal) * chartH
    ctx.lineTo(x, y)
  })
  ctx.lineTo(pad.left + (data.length - 1) * stepX, h - pad.bottom)
  ctx.closePath()
  ctx.setFillStyle('rgba(0, 0, 0, 0.06)')
  ctx.fill()

  // 折线
  ctx.beginPath()
  ctx.setStrokeStyle(props.colors[0])
  ctx.setLineWidth(2)
  data.forEach((d, i) => {
    const x = pad.left + i * stepX
    const y = h - pad.bottom - ((d.value || 0) / maxVal) * chartH
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.stroke()

  // 数据点
  data.forEach((d, i) => {
    const x = pad.left + i * stepX
    const y = h - pad.bottom - ((d.value || 0) / maxVal) * chartH
    ctx.beginPath()
    ctx.arc(x, y, 3, 0, Math.PI * 2)
    ctx.setFillStyle('#FFFFFF')
    ctx.fill()
    ctx.setStrokeStyle(props.colors[0])
    ctx.setLineWidth(2)
    ctx.stroke()
  })

  // X 轴标签（间隔显示）
  if (props.showAxis) {
    const labelInterval = Math.ceil(data.length / 6)
    data.forEach((d, i) => {
      if (i % labelInterval !== 0 && i !== data.length - 1) return
      const x = pad.left + i * stepX
      ctx.setFillStyle('#A1A1AA')
      ctx.setFontSize(rpx2px(18))
      ctx.setTextAlign('center')
      ctx.fillText(d.label || '', x, h - pad.bottom + rpx2px(20))
    })
  }
}

// ==================== 仪表盘 ====================
function drawGauge(ctx, w, h, pad) {
  const cx = w / 2
  const cy = h / 2 + rpx2px(10)
  const radius = Math.min(w, h * 1.5) / 2 - pad.top - 10
  const lineWidth = rpx2px(20)
  const val = Math.max(0, Math.min(100, props.value))

  // 背景弧（270°，从 -225° 到 45°）
  const startAngle = Math.PI * 0.75  // -135° → 135° in standard
  const endAngle = Math.PI * 2.25    // +135°

  ctx.beginPath()
  ctx.arc(cx, cy, radius, startAngle, endAngle)
  ctx.setStrokeStyle('#E4E4E7')
  ctx.setLineWidth(lineWidth)
  ctx.setLineCap('round')
  ctx.stroke()

  // 值弧
  const valAngle = startAngle + (val / 100) * (endAngle - startAngle)
  ctx.beginPath()
  ctx.arc(cx, cy, radius, startAngle, valAngle)
  ctx.setStrokeStyle(props.colors[0])
  ctx.setLineWidth(lineWidth)
  ctx.stroke()

  // 中心数值
  ctx.setFillStyle('#18181B')
  ctx.setFontSize(rpx2px(40))
  ctx.setTextAlign('center')
  ctx.setTextBaseline('middle')
  ctx.fillText(val + '%', cx, cy - rpx2px(10))

  // 标签
  if (props.label) {
    ctx.setFillStyle('#71717A')
    ctx.setFontSize(rpx2px(22))
    ctx.fillText(props.label, cx, cy + rpx2px(24))
  }
}

// ==================== 工具函数 ====================
function drawRoundRect(ctx, x, y, w, h, r) {
  if (h < 1) h = 1
  r = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function drawEmpty(ctx, w, h) {
  ctx.setFillStyle('#A1A1AA')
  ctx.setFontSize(rpx2px(24))
  ctx.setTextAlign('center')
  ctx.setTextBaseline('middle')
  ctx.fillText('暂无数据', w / 2, h / 2)
}
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
