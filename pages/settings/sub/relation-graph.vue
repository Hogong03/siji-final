<template>
  <view class="page">
    <!-- 自定义导航栏 -->
    <view class="custom-nav" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content">
        <view class="nav-back" @tap="goBack">
          <text class="nav-back-icon">‹</text>
        </view>
        <text class="nav-title">人物关系图</text>
        <view class="nav-actions">
          <view class="nav-btn" @tap="redraw"><text class="nav-btn-text">刷新</text></view>
        </view>
      </view>
    </view>

    <scroll-view scroll-y class="graph-scroll">
      <!-- 图例 -->
      <view class="legend">
        <view class="legend-item"><view class="legend-dot self"></view><text>自己</text></view>
        <view class="legend-item"><view class="legend-dot high"></view><text>亲密度 ≥ 8</text></view>
        <view class="legend-item"><view class="legend-dot mid"></view><text>5-7</text></view>
        <view class="legend-item"><view class="legend-dot low"></view><text>&lt; 5</text></view>
      </view>

      <!-- 关系图 Canvas -->
      <view class="graph-wrap">
        <canvas
          type="2d"
          id="relationGraph"
          class="graph-canvas"
          :style="{ width: canvasW + 'px', height: canvasH + 'px' }"
        ></canvas>
        <view v-if="nodes.length === 0" class="graph-empty">暂无关系数据</view>
      </view>

      <!-- 亲密度排序列表 -->
      <view class="rank-section">
        <text class="rank-title">亲密度排行</text>
        <view v-for="r in sortedRelations" :key="r.id" class="rank-row" @tap="goDetail(r.id)">
          <view class="rank-left">
            <view class="rank-avatar">{{ r.name.charAt(0) }}</view>
            <view class="rank-info">
              <text class="rank-name">{{ r.name }}</text>
              <text class="rank-role">{{ r.role }}</text>
            </view>
          </view>
          <view class="rank-score">{{ r.relationship_score }}</view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed, getCurrentInstance } from 'vue'
import { onReady, onShow } from '@dcloudio/uni-app'
import { getAllRelations } from '@/utils/relations.js'
import { safeNavigateBack } from '@/utils/nav-helper.js'

const statusBarHeight = ref(20)
try {
  const sys = uni.getSystemInfoSync()
  if (sys && sys.statusBarHeight) statusBarHeight.value = sys.statusBarHeight
} catch (e) {}

const canvasW = ref(0)
const canvasH = ref(360)
const nodes = ref([])

// 自己（内置）
const SELF = { id: 'builtin_gengge', name: '庚哥', relationship_score: 10 }

onShow(() => {
  const win = uni.getSystemInfoSync()
  canvasW.value = win.windowWidth || 375
})

onReady(() => {
  setTimeout(drawGraph, 100)
})

const relations = ref([])
const canvasReady = ref(false)

function loadRelations() {
  relations.value = getAllRelations()
}

const sortedRelations = computed(() =>
  [...relations.value].sort((a, b) => (b.relationship_score || 0) - (a.relationship_score || 0))
)

function getCanvasNode() {
  return new Promise((resolve) => {
    uni.createSelectorQuery()
      .in(getCurrentInstance())
      .select('#relationGraph')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (res && res[0] && res[0].node) {
          resolve(res[0])
        } else {
          resolve(null)
        }
      })
  })
}

async function drawGraph() {
  loadRelations()
  const info = await getCanvasNode()
  if (!info) {
    // canvas 未就绪，稍后重试
    setTimeout(() => { if (!canvasReady.value) drawGraph() }, 200)
    return
  }
  const canvas = info.node
  const dpr = uni.getSystemInfoSync().pixelRatio || 1
  // 设置画布实际尺寸（物理像素）
  canvas.width = info.width * dpr
  canvas.height = info.height * dpr
  const ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)

  const w = info.width
  const h = info.height
  const cx = w / 2
  const cy = 150

  ctx.clearRect(0, 0, w, h)

  // 全部节点（自己 + 所有关系）
  const all = relations.value
  const nodeList = all.length > 0 ? all : []
  nodes.value = nodeList

  if (nodeList.length === 0) {
    return
  }

  // 中心「自己」
  drawSelf(ctx, cx, cy)

  // 环绕布局
  const radius = Math.min(cx, 170)
  nodeList.forEach((r, i) => {
    const angle = (Math.PI * 2 * i) / nodeList.length - Math.PI / 2
    const nx = cx + radius * Math.cos(angle)
    const ny = cy + radius * Math.sin(angle)
    const score = r.relationship_score || 0
    // 连线（颜色按亲密度）
    const lineColor = score >= 8 ? '#18181B' : (score >= 5 ? '#A1A1AA' : '#E4E4E7')
    const lineWidth = 1 + (score / 10) * 2
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(nx, ny)
    ctx.strokeStyle = lineColor
    ctx.lineWidth = lineWidth
    ctx.stroke()

    // 节点
    ctx.beginPath()
    ctx.arc(nx, ny, 22, 0, Math.PI * 2)
    ctx.fillStyle = score >= 8 ? '#18181B' : (score >= 5 ? '#71717A' : '#D4D4D8')
    ctx.fill()

    // 名字
    ctx.fillStyle = '#18181B'
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(r.name, nx, ny + 42)
  })
  canvasReady.value = true
}

function drawSelf(ctx, cx, cy) {
  ctx.beginPath()
  ctx.arc(cx, cy, 30, 0, Math.PI * 2)
  ctx.fillStyle = '#000000'
  ctx.fill()
  ctx.fillStyle = '#FFFFFF'
  ctx.font = '14px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(SELF.name.charAt(0), cx, cy + 5)
}

function redraw() {
  canvasReady.value = false
  drawGraph()
}

function goDetail(id) {
  uni.navigateTo({ url: `/pages/settings/sub/relation-detail?id=${id}` })
}

function goBack() {
  safeNavigateBack()
}
</script>

<style scoped lang="scss">
@import './relation-graph.scss';
</style>
