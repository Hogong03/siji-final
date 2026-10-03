<script setup>
/**
 * 月度报告长图（4.11.0）— 自定义导航传播物料页
 * 选月（默认当月，可前后翻）→ buildMonthlyReport → canvas 2d 绘 750x1100 分享长图
 * 深浅两套配色（watch isDark 重绘）；保存三端分流：
 *  - App：uni.canvasToTempFilePath → plus.gallery.save
 *  - MP-WEIXIN：uni.canvasToTempFilePath → uni.saveImageToPhotosAlbum
 *  - H5：canvas node.toDataURL → <a download> 触发下载
 * 数据全部来自本机存储（utils/report-data.js），不联网。
 */
import { ref, computed, watch } from 'vue'
import { onReady } from '@dcloudio/uni-app'
import { getCurrentInstance } from 'vue'
import { buildMonthlyReport } from '@/utils/report-data.js'
import { useTheme } from '@/composables/useTheme.js'

const { isDark } = useTheme()

const statusBarHeight = ref(20)
try {
  const sys = uni.getSystemInfoSync()
  if (sys && sys.statusBarHeight) statusBarHeight.value = sys.statusBarHeight
} catch (e) { /* 默认 20 */ }

// ─── 选月 ───
const now = new Date()
const year = ref(now.getFullYear())
const month = ref(now.getMonth() + 1)
const report = ref(null)

const monthLabel = computed(() => `${year.value} 年 ${month.value} 月`)
const titleText = computed(() => `思迹 · ${month.value} 月报告`)

function pad2(n) { return String(n).padStart(2, '0') }

function stepMonth(d) {
  let m = month.value + d
  let y = year.value
  if (m < 1) { m = 12; y-- } else if (m > 12) { m = 1; y++ }
  year.value = y
  month.value = m
  refresh()
}
function prevMonth() { stepMonth(-1) }
function nextMonth() { stepMonth(1) }

function refresh() {
  report.value = buildMonthlyReport(year.value, month.value)
  drawReport()
}

// ─── Canvas 2d 绘制 ───
const CANVAS_W = 750
const CANVAS_H = 1100

let canvasNode = null
let drawRetried = false

function getCanvasNode() {
  if (canvasNode) return Promise.resolve(canvasNode)
  return new Promise((resolve) => {
    try {
      const instance = getCurrentInstance()
      const query = uni.createSelectorQuery()
      if (instance && instance.proxy) query.in(instance.proxy)
      query.select('#report-canvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          const node = res && res[0] ? res[0].node : null
          if (node) canvasNode = node
          resolve(node)
        })
    } catch (e) {
      resolve(null)
    }
  })
}

function palette(dark) {
  return dark
    ? { bg: '#1E1E20', ink: '#FAFAFA', sub: '#A1A1AA', faint: '#71717A', line: '#3F3F46', track: '#3F3F46', bar: '#FAFAFA' }
    : { bg: '#FFFFFF', ink: '#18181B', sub: '#71717A', faint: '#A1A1AA', line: '#E4E4E7', track: '#F4F4F5', bar: '#18181B' }
}

async function drawReport() {
  const node = await getCanvasNode()
  if (!node) {
    // H5 首帧 canvas 节点偶尔还没挂上：只补一次，不无限重试
    if (!drawRetried) {
      drawRetried = true
      setTimeout(() => { drawReport() }, 300)
    }
    return
  }
  let dpr = 1
  try { dpr = Number(uni.getSystemInfoSync().pixelRatio) || 1 } catch (e) { dpr = 1 }
  if (dpr > 2) dpr = 2
  node.width = CANVAS_W * dpr
  node.height = CANVAS_H * dpr
  const ctx = node.getContext('2d')
  if (!ctx) return
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.scale(dpr, dpr)
  paintReport(ctx, report.value, palette(isDark.value))
}

function setText(ctx, text, x, y, size, color, weight, align) {
  ctx.font = `${weight || 'normal'} ${size}px sans-serif`
  ctx.fillStyle = color
  ctx.textAlign = align || 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(text, x, y)
}

function drawBar(ctx, x, y, w, h, color) {
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
}

function paintReport(ctx, data, c) {
  const d = data || {}
  const bills = d.bills || emptyB()
  const diary = d.diary || emptyD()
  const checkins = d.checkins == null ? '--' : String(d.checkins)

  // 背景
  ctx.fillStyle = c.bg
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  // 头部
  setText(ctx, titleText.value, 60, 100, 46, c.ink, '600')
  setText(ctx, `${monthLabel.value} · 数据存于本机`, 60, 144, 24, c.sub, 'normal')
  drawBar(ctx, 60, 180, 630, 1, c.line)

  // 大数字 2x2：支出 / 收入 / 记录 / 打卡
  setText(ctx, '支出', 60, 236, 24, c.sub, 'normal')
  setText(ctx, `¥${fmt(bills.expense)}`, 60, 296, 52, c.ink, '600')
  setText(ctx, '收入', 415, 236, 24, c.sub, 'normal')
  setText(ctx, `¥${fmt(bills.income)}`, 415, 296, 52, c.ink, '600')
  drawBar(ctx, 60, 336, 630, 1, c.line)
  setText(ctx, '记录', 60, 392, 24, c.sub, 'normal')
  setText(ctx, `${diary.count} 篇`, 60, 452, 52, c.ink, '600')
  setText(ctx, '打卡', 415, 392, 24, c.sub, 'normal')
  setText(ctx, `${checkins} 次`, 415, 452, 52, c.ink, '600')
  drawBar(ctx, 60, 496, 630, 1, c.line)

  // 支出分类 TOP3
  setText(ctx, '支出分类 TOP3', 60, 552, 26, c.ink, '600')
  const tops = bills.topCategories || []
  if (tops.length === 0) {
    setText(ctx, '本月暂无支出记录', 60, 604, 24, c.faint, 'normal')
  } else {
    const max = tops[0].total || 1
    tops.forEach((t, i) => {
      const y = 596 + i * 76
      setText(ctx, t.category, 60, y, 24, c.ink, 'normal')
      setText(ctx, `¥${fmt(t.total)}`, 690, y, 24, c.sub, 'normal', 'right')
      drawBar(ctx, 60, y + 14, 630, 12, c.track)
      const w = Math.max(4, Math.round((t.total / max) * 630))
      drawBar(ctx, 60, y + 14, w, 12, c.bar)
    })
  }

  // 心情均值
  drawBar(ctx, 60, 836, 630, 1, c.line)
  setText(ctx, '心情均值', 60, 892, 26, c.ink, '600')
  if (diary.moodAvg == null) {
    setText(ctx, '本月未打分', 60, 950, 40, c.faint, '600')
  } else {
    setText(ctx, `${diary.moodAvg}`, 60, 952, 48, c.ink, '600')
    setText(ctx, '/ 5', 60 + `${diary.moodAvg}`.length * 30 + 12, 950, 24, c.sub, 'normal')
  }
  for (let i = 0; i < 5; i++) {
    const cx = 420 + i * 56
    const cy = 936
    ctx.beginPath()
    ctx.arc(cx, cy, 14, 0, Math.PI * 2)
    if (diary.moodAvg != null && i + 1 <= Math.round(diary.moodAvg)) {
      ctx.fillStyle = c.bar
      ctx.fill()
    } else {
      ctx.strokeStyle = c.line
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }

  // 底部
  setText(ctx, '数据来自思迹 · 本地记录', 375, 1058, 22, c.faint, 'normal', 'center')
}

function emptyB() { return { expense: 0, income: 0, count: 0, topCategories: [] } }
function emptyD() { return { count: 0, words: 0, moodAvg: null } }

/** 金额显示：两位小数，去尾零（150.00 -> 150 / 12.50 -> 12.5） */
function fmt(n) {
  const v = Number(n) || 0
  return String(parseFloat(v.toFixed(2)))
}

// 深浅切换重绘
watch(isDark, () => { drawReport() })

onReady(() => { refresh() })

// ─── 保存 ───
const saving = ref(false)

function saveTempFile(path) {
  // #ifdef APP-PLUS
  plus.gallery.save(path, () => {
    uni.showToast({ title: '已保存到相册', icon: 'success' })
  }, () => {
    uni.showToast({ title: '保存失败，请检查相册权限', icon: 'none' })
  })
  // #endif
  // #ifdef MP-WEIXIN
  uni.saveImageToPhotosAlbum({
    filePath: path,
    success: () => uni.showToast({ title: '已保存到相册', icon: 'success' }),
    fail: () => uni.showToast({ title: '未授权相册，保存失败', icon: 'none' })
  })
  // #endif
  // #ifndef APP-PLUS || MP-WEIXIN
  void path
  // #endif
}

async function saveImage() {
  if (saving.value) return
  saving.value = true
  try {
    const node = await getCanvasNode()
    if (!node) { uni.showToast({ title: '生成失败，请重试', icon: 'none' }); return }
    // #ifdef H5
    try {
      const dataURL = node.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = dataURL
      a.download = `siji-report-${year.value}-${pad2(month.value)}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      uni.showToast({ title: '已开始下载', icon: 'none' })
    } catch (e) {
      uni.showToast({ title: '保存失败', icon: 'none' })
    }
    // #endif
    // #ifndef H5
    uni.canvasToTempFilePath({
      canvas: node,
      fileType: 'png',
      success: (r) => saveTempFile(r.tempFilePath),
      fail: () => uni.showToast({ title: '生成图片失败', icon: 'none' })
    })
    // #endif
  } finally {
    saving.value = false
  }
}

function goBack() {
  uni.navigateBack({ delta: 1, fail: () => uni.redirectTo({ url: '/pages/diary/list' }) })
}
</script>

<template>
  <view class="report-page">
    <!-- 自定义导航栏 -->
    <view class="custom-nav" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content">
        <view class="nav-back" @tap="goBack">
          <text class="nav-back-icon">‹</text>
        </view>
        <text class="nav-title">月度报告</text>
        <view class="nav-placeholder"></view>
      </view>
    </view>

    <!-- 选月 -->
    <view class="month-bar">
      <view class="month-btn" @tap="prevMonth"><text>‹</text></view>
      <text class="month-label">{{ monthLabel }}</text>
      <view class="month-btn" @tap="nextMonth"><text>›</text></view>
    </view>

    <!-- 长图画布（750x1100 逻辑尺寸，按屏宽缩放显示） -->
    <view class="canvas-wrap">
      <canvas
        id="report-canvas"
        type="2d"
        class="report-canvas"
        :style="{ width: '690rpx', height: '1012rpx' }"
      ></canvas>
    </view>

    <!-- 保存 -->
    <view class="save-area safe-area-bottom">
      <view class="save-btn" @tap="saveImage"><text>{{ saving ? '生成中…' : '保存图片' }}</text></view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.report-page {
	min-height: 100vh;
	background: #F4F4F5;
	display: flex;
	flex-direction: column;
	box-sizing: border-box;
}

/* 自定义导航（App 端 fixed 定位组件变量不稳定 → 全硬编码） */
.custom-nav {
	background: #F4F4F5;
}
.nav-content {
	height: 44px;
	display: flex;
	align-items: center;
	padding: 0 20rpx;
}
.nav-back {
	width: 64rpx;
	height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}
.nav-back-icon {
	font-size: 48rpx;
	color: #18181B;
	line-height: 1;
}
.nav-title {
	flex: 1;
	text-align: center;
	font-size: 32rpx;
	font-weight: 600;
	color: #18181B;
}
.nav-placeholder {
	width: 64rpx;
}

/* 选月 */
.month-bar {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 32rpx;
	padding: 16rpx 0;
}
.month-btn {
	width: 64rpx;
	height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	background: #FFFFFF;
	border: 1rpx solid #E4E4E7;
	border-radius: 32rpx;

	text {
		font-size: 36rpx;
		color: #18181B;
		line-height: 1;
	}
}
.month-label {
	font-size: 30rpx;
	font-weight: 600;
	color: #18181B;
}

/* 画布 */
.canvas-wrap {
	flex: 1;
	display: flex;
	justify-content: center;
	padding-bottom: 24rpx;
}
.report-canvas {
	display: block;
	border: 1rpx solid #E4E4E7;
	border-radius: 16rpx;
}

/* 保存 */
.save-area {
	padding: 16rpx 30rpx calc(24rpx + env(safe-area-inset-bottom));
}
.save-btn {
	padding: 24rpx;
	background: #18181B;
	border-radius: 16rpx;
	text-align: center;

	text {
		font-size: 30rpx;
		font-weight: 600;
		color: #FFFFFF;
	}
}

/* 深色（H5/App 路径：html.theme-dark 嵌套；MP 路径：@media 包在条件编译内） */
/* #ifndef MP-WEIXIN */
html.theme-dark {
	.report-page { background: #18181B; }
	.custom-nav { background: #18181B; }
	.nav-back-icon { color: #FAFAFA; }
	.nav-title { color: #FAFAFA; }
	.month-btn {
		background: #27272A;
		border-color: #3F3F46;

		text { color: #FAFAFA; }
	}
	.month-label { color: #FAFAFA; }
	.report-canvas { border-color: #3F3F46; }
	.save-btn {
		background: #FAFAFA;

		text { color: #18181B; }
	}
}
/* #endif */
/* #ifdef MP-WEIXIN */
@media (prefers-color-scheme: dark) {
	.report-page { background: #18181B; }
	.custom-nav { background: #18181B; }
	.nav-back-icon { color: #FAFAFA; }
	.nav-title { color: #FAFAFA; }
	.month-btn {
		background: #27272A;
		border-color: #3F3F46;

		text { color: #FAFAFA; }
	}
	.month-label { color: #FAFAFA; }
	.report-canvas { border-color: #3F3F46; }
	.save-btn {
		background: #FAFAFA;

		text { color: #18181B; }
	}
}
/* #endif */
</style>
