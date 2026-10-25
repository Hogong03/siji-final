/**
 * SijiChart 绘图引擎
 *
 * 从 SijiChart.vue 拆出 — 纯 Canvas 2D 绘图函数，无 Vue 依赖
 * 支持：ring(环形) / bar(柱状) / line(折线) / gauge(仪表盘)
 *
 * 深色模式（4.48.3）：
 *  - 非数据色（轴 / 文字 / 空态 / 填充）统一走 chartPalette()，深色值按 WCAG 核过；
 *  - 数据系列色（props.colors / item.color）统一过 seriesColor()，深色下低于 3:1 自动提亮，
 *    调用方传错色（例如把浅色 #18181B 传进来）也不会画出隐形柱；
 *  - 画布先铺一层 surface 底色再画内容：App 端原生画布底色不受控（白底/透明随版本变），
 *    不铺底就会出现「深色卡片上一块白」或「白底上白柱」。
 */
import { chartPalette, seriesColor, CHART_SURFACE } from './chart-theme.js'

/** 系列色取值：colors 为空时退回浅色主色，再交给 seriesColor 归一 */
function pickSeries(props, i) {
	const list = (props.colors && props.colors.length) ? props.colors : ['#18181B']
	return seriesColor(list[i % list.length], !!props.dark)
}

/**
 * @param {Object} ctx       uni.createCanvasContext 返回的上下文
 * @param {string} type      图表类型 ring|bar|line|gauge
 * @param {Object} props     组件 props（data, colors, dark, label, value, showAxis, barWidth, groupMode, height）
 * @param {number} canvasW   画布宽度 px
 * @param {number} canvasH   画布高度 px
 * @param {Function} rpx2px  rpx→px 转换函数
 */
export function renderChart(ctx, type, props, canvasW, canvasH, rpx2px) {
	const padding = { top: 16, right: 16, bottom: 28, left: 16 }
	const P = chartPalette(!!props.dark)
	// 入场动画进度 0→1；未传时按 1（一次性绘制，天然降级）
	const progress = (props.progress === undefined || props.progress === null) ? 1 : Math.max(0, Math.min(1, props.progress))
	ctx.clearRect(0, 0, canvasW + 32, canvasH + 32)
	// 铺底：canvas 底色跟卡片一致，不依赖画布本身的透明/白色行为
	ctx.setFillStyle(P.surface || CHART_SURFACE.light)
	ctx.fillRect(0, 0, canvasW, canvasH)

	switch (type) {
		case 'ring': drawRing(ctx, canvasW, canvasH, padding, props, rpx2px, P, progress); break
		case 'bar': drawBar(ctx, canvasW, canvasH, padding, props, rpx2px, P, progress); break
		case 'line': drawLine(ctx, canvasW, canvasH, padding, props, rpx2px, P, progress); break
		case 'gauge': drawGauge(ctx, canvasW, canvasH, padding, props, rpx2px, P, progress); break
	}

	ctx.draw()
}

/** easeOutCubic：入场减速 */
function easeOut(p) {
	return 1 - Math.pow(1 - p, 3)
}

/** 限制到 0~1 */
function clamp01(v) {
	return v < 0 ? 0 : (v > 1 ? 1 : v)
}

// ==================== 环形图 ====================
function drawRing(ctx, w, h, pad, props, rpx2px, P, progress) {
	const cx = w / 2
	const cy = h / 2
	const radius = Math.min(w, h) / 2 - pad.top - 10
	const innerRadius = radius * 0.62

	const data = props.data.filter(d => d.value > 0)
	const total = data.reduce((s, d) => s + d.value, 0)

	if (total === 0) {
		ctx.beginPath()
		ctx.arc(cx, cy, radius, 0, Math.PI * 2)
		ctx.setStrokeStyle(P.axis)
		ctx.stroke()
		ctx.setFillStyle(P.empty)
		ctx.setFontSize(rpx2px(26))
		ctx.setTextAlign('center')
		ctx.setTextBaseline('middle')
		ctx.fillText('暂无数据', cx, cy)
		return
	}

	// 入场：各扇形沿圆周顺序扫过（progress 0→1 扫满一圈）
	const eased = easeOut(progress)
	const baseStart = -Math.PI / 2
	const drawEnd = baseStart + Math.PI * 2 * eased

	let startAngle = baseStart
	data.forEach((item, i) => {
		const angle = (item.value / total) * Math.PI * 2
		const segEnd = startAngle + angle
		const end = Math.min(segEnd, drawEnd)
		if (end > startAngle) {
			const color = item.color ? seriesColor(item.color, !!props.dark) : pickSeries(props, i)
			ctx.beginPath()
			ctx.moveTo(cx, cy)
			ctx.arc(cx, cy, radius, startAngle, end)
			ctx.closePath()
			ctx.setFillStyle(color)
			ctx.fill()
		}
		startAngle = segEnd
	})

	// 中心圆始终完整（遮住未完成扇形的径向边缘）
	ctx.beginPath()
	ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2)
	ctx.setFillStyle(P.surface)
	ctx.fill()

	// 中心文字随进度收尾淡入
	const textAlpha = clamp01((progress - 0.55) / 0.45)
	if (textAlpha > 0) {
		ctx.setGlobalAlpha(textAlpha)
		ctx.setFillStyle(P.text)
		ctx.setFontSize(rpx2px(36))
		ctx.setTextAlign('center')
		ctx.setTextBaseline('middle')
		ctx.fillText(props.label || '', cx, cy - rpx2px(10))

		ctx.setFillStyle(P.subText)
		ctx.setFontSize(rpx2px(22))
		ctx.fillText(data.length + ' 项', cx, cy + rpx2px(20))
		ctx.setGlobalAlpha(1)
	}
}

// ==================== 柱状图 ====================
function drawBar(ctx, w, h, pad, props, rpx2px, P, progress) {
	const chartW = w - pad.left - pad.right
	const chartH = h - pad.top - pad.bottom
	const data = props.data

	if (!data || data.length === 0) {
		drawEmpty(ctx, w, h, rpx2px, P)
		return
	}

	const maxVal = Math.max(...data.flatMap(d => {
		if (props.groupMode && Array.isArray(d.values)) return d.values
		return [d.value || 0]
	}), 1)

	if (props.showAxis) {
		ctx.setStrokeStyle(P.axis)
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
		// 入场：每根（组）依次从基线生长，前 8 根有级联，easeOut 减速
		const groupLocal = easeOut(clamp01((progress - i * 0.05) / 0.7))

		if (props.groupMode && Array.isArray(item.values)) {
			const subCount = item.values.length
			const totalBarWidth = groupWidth - barGap * 2
			const barW = (totalBarWidth - barGap * (subCount - 1)) / subCount

			if (groupLocal > 0) {
				item.values.forEach((val, j) => {
					const barH = (val / maxVal) * chartH * groupLocal
					const bx = x + barGap + j * (barW + barGap)
					const by = h - pad.bottom - barH
					ctx.setFillStyle(pickSeries(props, j))
					drawRoundRect(ctx, bx, by, barW, barH, 2)
					ctx.fill()
				})
			}
		} else {
			const val = item.value || 0
			if (groupLocal > 0) {
				const barH = (val / maxVal) * chartH * groupLocal
				const barW = props.barWidth > 0 ? rpx2px(props.barWidth) : groupWidth * 0.5
				const bx = x + (groupWidth - barW) / 2
				const by = h - pad.bottom - barH
				ctx.setFillStyle(item.color ? seriesColor(item.color, !!props.dark) : pickSeries(props, 0))
				drawRoundRect(ctx, bx, by, barW, barH, 2)
				ctx.fill()
			}
		}

		if (props.showAxis && item.label) {
			ctx.setFillStyle(P.label)
			ctx.setFontSize(rpx2px(18))
			ctx.setTextAlign('center')
			ctx.fillText(item.label, x + groupWidth / 2, h - pad.bottom + rpx2px(20))
		}
	})
}

// ==================== 折线图 ====================
function drawLine(ctx, w, h, pad, props, rpx2px, P, progress) {
	const chartW = w - pad.left - pad.right
	const chartH = h - pad.top - pad.bottom
	const data = props.data

	if (!data || data.length < 2) {
		drawEmpty(ctx, w, h, rpx2px, P)
		return
	}

	const maxVal = Math.max(...data.map(d => d.value || 0), 1)
	const stepX = chartW / (data.length - 1)
	const px = (i) => pad.left + i * stepX
	const py = (i) => h - pad.bottom - ((data[i].value || 0) / maxVal) * chartH

	if (props.showAxis) {
		ctx.setStrokeStyle(P.axis)
		ctx.setLineWidth(1)
		ctx.beginPath()
		ctx.moveTo(pad.left, h - pad.bottom)
		ctx.lineTo(w - pad.right, h - pad.bottom)
		ctx.stroke()
	}

	// 入场：折线从左到右「描绘」，数据点逐个出现
	const eased = easeOut(progress)
	const seg = data.length - 1
	const drawSeg = seg * eased
	const full = Math.floor(drawSeg)
	const frac = drawSeg - full
	const tailX = full >= seg ? px(seg) : px(full) + (px(full + 1) - px(full)) * frac
	const tailY = full >= seg ? py(seg) : py(full) + (py(full + 1) - py(full)) * frac

	// 填充区域（只填到当前描绘末端）
	ctx.beginPath()
	ctx.moveTo(px(0), h - pad.bottom)
	for (let i = 0; i <= Math.min(full, seg); i++) {
		ctx.lineTo(px(i), py(i))
	}
	if (full < seg) ctx.lineTo(tailX, tailY)
	ctx.lineTo(tailX, h - pad.bottom)
	ctx.closePath()
	ctx.setFillStyle(P.areaFill)
	ctx.fill()

	// 折线
	ctx.beginPath()
	ctx.setStrokeStyle(pickSeries(props, 0))
	ctx.setLineWidth(2)
	ctx.moveTo(px(0), py(0))
	for (let i = 1; i <= Math.min(full, seg); i++) {
		ctx.lineTo(px(i), py(i))
	}
	if (full < seg) ctx.lineTo(tailX, tailY)
	ctx.stroke()

	// 数据点（只画已描绘到的整数点）
	for (let i = 0; i <= Math.min(full, seg); i++) {
		ctx.beginPath()
		ctx.arc(px(i), py(i), 3, 0, Math.PI * 2)
		ctx.setFillStyle(P.dot)
		ctx.fill()
		ctx.setStrokeStyle(pickSeries(props, 0))
		ctx.setLineWidth(2)
		ctx.stroke()
	}

	// X 轴标签
	if (props.showAxis) {
		const labelInterval = Math.ceil(data.length / 6)
		data.forEach((d, i) => {
			if (i % labelInterval !== 0 && i !== data.length - 1) return
			const x = pad.left + i * stepX
			ctx.setFillStyle(P.label)
			ctx.setFontSize(rpx2px(18))
			ctx.setTextAlign('center')
			ctx.fillText(d.label || '', x, h - pad.bottom + rpx2px(20))
		})
	}
}

// ==================== 仪表盘 ====================
function drawGauge(ctx, w, h, pad, props, rpx2px, P, progress) {
	const cx = w / 2
	const cy = h / 2 + rpx2px(10)
	const radius = Math.min(w, h * 1.5) / 2 - pad.top - 10
	const lineWidth = rpx2px(20)
	const val = Math.max(0, Math.min(100, props.value))

	const startAngle = Math.PI * 0.75
	const endAngle = Math.PI * 2.25

	// 轨道始终完整
	ctx.beginPath()
	ctx.arc(cx, cy, radius, startAngle, endAngle)
	ctx.setStrokeStyle(P.axis)
	ctx.setLineWidth(lineWidth)
	ctx.setLineCap('round')
	ctx.stroke()

	// 入场：值弧随进度扫过
	const eased = easeOut(progress)
	const curVal = val * eased
	const valAngle = startAngle + (curVal / 100) * (endAngle - startAngle)
	ctx.beginPath()
	ctx.arc(cx, cy, radius, startAngle, valAngle)
	ctx.setStrokeStyle(pickSeries(props, 0))
	ctx.setLineWidth(lineWidth)
	ctx.stroke()

	ctx.setFillStyle(P.text)
	ctx.setFontSize(rpx2px(40))
	ctx.setTextAlign('center')
	ctx.setTextBaseline('middle')
	ctx.fillText(Math.round(curVal) + '%', cx, cy - rpx2px(10))

	if (props.label) {
		ctx.setFillStyle(P.subText)
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

function drawEmpty(ctx, w, h, rpx2px, P) {
	ctx.setFillStyle(P.empty)
	ctx.setFontSize(rpx2px(24))
	ctx.setTextAlign('center')
	ctx.setTextBaseline('middle')
	ctx.fillText('暂无数据', w / 2, h / 2)
}
