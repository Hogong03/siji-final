/**
 * SijiChart 绘图引擎
 *
 * 从 SijiChart.vue 拆出 — 纯 Canvas 2D 绘图函数，无 Vue 依赖
 * 支持：ring(环形) / bar(柱状) / line(折线) / gauge(仪表盘)
 */

/**
 * @param {Object} ctx       uni.createCanvasContext 返回的上下文
 * @param {string} type      图表类型 ring|bar|line|gauge
 * @param {Object} props     组件 props（data, colors, label, value, showAxis, barWidth, groupMode, height）
 * @param {number} canvasW   画布宽度 px
 * @param {number} canvasH   画布高度 px
 * @param {Function} rpx2px  rpx→px 转换函数
 */
export function renderChart(ctx, type, props, canvasW, canvasH, rpx2px) {
  const padding = { top: 16, right: 16, bottom: 28, left: 16 }
  ctx.clearRect(0, 0, canvasW + 32, canvasH + 32)

  switch (type) {
    case 'ring': drawRing(ctx, canvasW, canvasH, padding, props, rpx2px); break
    case 'bar': drawBar(ctx, canvasW, canvasH, padding, props, rpx2px); break
    case 'line': drawLine(ctx, canvasW, canvasH, padding, props, rpx2px); break
    case 'gauge': drawGauge(ctx, canvasW, canvasH, padding, props, rpx2px); break
  }

  ctx.draw()
}

// ==================== 环形图 ====================
function drawRing(ctx, w, h, pad, props, rpx2px) {
  const cx = w / 2
  const cy = h / 2
  const radius = Math.min(w, h) / 2 - pad.top - 10
  const innerRadius = radius * 0.62

  const data = props.data.filter(d => d.value > 0)
  const total = data.reduce((s, d) => s + d.value, 0)

  if (total === 0) {
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.setStrokeStyle('#E4E4E7')
    ctx.stroke()
    ctx.setFillStyle('#A1A1AA')
    ctx.setFontSize(rpx2px(26))
    ctx.setTextAlign('center')
    ctx.setTextBaseline('middle')
    ctx.fillText('暂无数据', cx, cy)
    return
  }

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

  ctx.beginPath()
  ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2)
  ctx.setFillStyle('#FFFFFF')
  ctx.fill()

  ctx.setFillStyle('#18181B')
  ctx.setFontSize(rpx2px(36))
  ctx.setTextAlign('center')
  ctx.setTextBaseline('middle')
  ctx.fillText(props.label || '', cx, cy - rpx2px(10))

  ctx.setFillStyle('#71717A')
  ctx.setFontSize(rpx2px(22))
  ctx.fillText(data.length + ' 项', cx, cy + rpx2px(20))
}

// ==================== 柱状图 ====================
function drawBar(ctx, w, h, pad, props, rpx2px) {
  const chartW = w - pad.left - pad.right
  const chartH = h - pad.top - pad.bottom
  const data = props.data

  if (!data || data.length === 0) {
    drawEmpty(ctx, w, h, rpx2px)
    return
  }

  const maxVal = Math.max(...data.flatMap(d => {
    if (props.groupMode && Array.isArray(d.values)) return d.values
    return [d.value || 0]
  }), 1)

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
      const val = item.value || 0
      const barH = (val / maxVal) * chartH
      const barW = props.barWidth > 0 ? rpx2px(props.barWidth) : groupWidth * 0.5
      const bx = x + (groupWidth - barW) / 2
      const by = h - pad.bottom - barH
      ctx.setFillStyle(item.color || props.colors[0])
      drawRoundRect(ctx, bx, by, barW, barH, 2)
      ctx.fill()
    }

    if (props.showAxis && item.label) {
      ctx.setFillStyle('#A1A1AA')
      ctx.setFontSize(rpx2px(18))
      ctx.setTextAlign('center')
      ctx.fillText(item.label, x + groupWidth / 2, h - pad.bottom + rpx2px(20))
    }
  })
}

// ==================== 折线图 ====================
function drawLine(ctx, w, h, pad, props, rpx2px) {
  const chartW = w - pad.left - pad.right
  const chartH = h - pad.top - pad.bottom
  const data = props.data

  if (!data || data.length < 2) {
    drawEmpty(ctx, w, h, rpx2px)
    return
  }

  const maxVal = Math.max(...data.map(d => d.value || 0), 1)
  const stepX = chartW / (data.length - 1)

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

  // X 轴标签
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
function drawGauge(ctx, w, h, pad, props, rpx2px) {
  const cx = w / 2
  const cy = h / 2 + rpx2px(10)
  const radius = Math.min(w, h * 1.5) / 2 - pad.top - 10
  const lineWidth = rpx2px(20)
  const val = Math.max(0, Math.min(100, props.value))

  const startAngle = Math.PI * 0.75
  const endAngle = Math.PI * 2.25

  ctx.beginPath()
  ctx.arc(cx, cy, radius, startAngle, endAngle)
  ctx.setStrokeStyle('#E4E4E7')
  ctx.setLineWidth(lineWidth)
  ctx.setLineCap('round')
  ctx.stroke()

  const valAngle = startAngle + (val / 100) * (endAngle - startAngle)
  ctx.beginPath()
  ctx.arc(cx, cy, radius, startAngle, valAngle)
  ctx.setStrokeStyle(props.colors[0])
  ctx.setLineWidth(lineWidth)
  ctx.stroke()

  ctx.setFillStyle('#18181B')
  ctx.setFontSize(rpx2px(40))
  ctx.setTextAlign('center')
  ctx.setTextBaseline('middle')
  ctx.fillText(val + '%', cx, cy - rpx2px(10))

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

function drawEmpty(ctx, w, h, rpx2px) {
  ctx.setFillStyle('#A1A1AA')
  ctx.setFontSize(rpx2px(24))
  ctx.setTextAlign('center')
  ctx.setTextBaseline('middle')
  ctx.fillText('暂无数据', w / 2, h / 2)
}
