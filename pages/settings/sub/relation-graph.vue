<template>
  <view class="page">
    <!-- 自定义导航栏 -->
    <view class="custom-nav" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content">
        <view class="nav-back" @click="goBack">
          <text class="nav-back-icon">‹</text>
        </view>
        <text class="nav-title">人物关系图</text>
        <view class="nav-actions">
          <view class="nav-btn" @click="goRelationList"><text class="nav-btn-text">管理</text></view>
        </view>
      </view>
    </view>

    <scroll-view scroll-y class="graph-scroll">
      <!-- ECharts 力导向关系图 -->
      <view class="graph-section">
        <view class="graph-container">
          <RelationGraphECharts
            :chartOption="echartsOption"
            width="100%"
            height="420px"
            containerId="relationGraphECharts"
          />
        </view>
        <view v-if="graphNodes.length === 0" class="graph-empty">
          <text class="empty-text">暂无关系数据，去添加人物吧</text>
        </view>
      </view>

      <!-- 人物列表（按关系分类，可折叠） -->
      <view class="rank-section">
        <view class="rank-header" @click="listExpanded = !listExpanded">
          <text class="rank-title">人物列表 · {{ relations.length }} 人</text>
          <text class="rank-toggle">{{ listExpanded ? '收起' : '展开' }}</text>
        </view>

        <template v-if="listExpanded">
          <view v-for="group in groupedRelations" :key="group.role" class="group-block">
            <view class="group-header">
              <text class="group-name">{{ group.role }}</text>
              <text class="group-count">{{ group.list.length }}</text>
            </view>
            <view v-for="r in group.list" :key="r.id" class="rank-row" @click="goDetail(r.id)">
              <view class="rank-left">
                <view class="rank-avatar">{{ r.name.charAt(0) }}</view>
                <view class="rank-info">
                  <text class="rank-name">{{ r.name }}</text>
                  <text class="rank-role">{{ r.context || r.role }}</text>
                </view>
              </view>
              <view class="rank-score">{{ r.relationship_score }}</view>
            </view>
          </view>
        </template>
      </view>

      <view style="height: 40rpx" />
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import RelationGraphECharts from '@/components/RelationGraphECharts.vue'
import { getAllRelations } from '@/utils/relations.js'
import { getProfile } from '@/utils/profile.js'
import { safeNavigateBack } from '@/utils/nav-helper.js'

const statusBarHeight = ref(20)
try {
  const sys = uni.getSystemInfoSync()
  if (sys && sys.statusBarHeight) statusBarHeight.value = sys.statusBarHeight
} catch (e) {}

// ─── 数据 ───
const relations = ref([])
const listExpanded = ref(false)

function loadData() {
  relations.value = getAllRelations()
}

onShow(() => { loadData() })

// ─── 画像名称（从 profile 取，用于图节点）───
const selfName = computed(() => {
  try {
    const p = getProfile()
    const c = p.cards.find(c => c.id === 'basic')
    return c?.fields?.nickname || '我'
  } catch { return '我' }
})

// ─── ECharts 力导向图数据构建 ───
// 按人物关系角色分类（同事/朋友/家人/伴侣等）
const SELF_NODE_ID = '__self__'

// 动态构建分类列表（自己 + 按角色去重）
const graphCategories = computed(() => {
  const cats = [{ name: '自己' }]
  const roleSet = new Set()
  for (const r of relations.value) {
    if (r.role && !roleSet.has(r.role)) {
      roleSet.add(r.role)
      cats.push({ name: r.role })
    }
  }
  return cats
})

// 角色颜色映射（灰阶系）
const ROLE_COLORS = {
  '家人': '#18181B',
  '伴侣': '#27272A',
  '朋友': '#52525B',
  '同事': '#71717A',
  '领导': '#71717A',
  '客户': '#A1A1AA',
  '老师': '#A1A1AA',
  '其他': '#D4D4D8'
}

function getRoleColor(role) {
  return ROLE_COLORS[role] || '#A1A1AA'
}

function getRoleCategoryIndex(role) {
  const cats = graphCategories.value
  for (let i = 1; i < cats.length; i++) {
    if (cats[i].name === role) return i
  }
  return cats.length - 1 // fallback 到最后一项
}

const graphNodes = computed(() => {
  const nodes = [{
    id: SELF_NODE_ID,
    name: selfName.value,
    symbolSize: 60,
    category: 0,
    value: 10,
    itemStyle: { color: '#000000', borderColor: '#FFFFFF', borderWidth: 2 },
    label: { show: true, position: 'bottom', fontSize: 14, color: '#18181B', fontWeight: 700 }
  }]
  for (const r of relations.value) {
    const score = r.relationship_score || 5
    const catIdx = getRoleCategoryIndex(r.role || '其他')
    nodes.push({
      id: r.id,
      name: r.name,
      symbolSize: 20 + score * 4,
      category: catIdx,
      value: score,
      itemStyle: {
        color: getRoleColor(r.role || '其他'),
        borderColor: '#FFFFFF',
        borderWidth: 2
      },
      label: { show: true, position: 'bottom', fontSize: 11, color: '#18181B', fontWeight: 400 }
    })
  }
  return nodes
})

const graphLinks = computed(() => {
  // 自己连接所有人物
  return relations.value.map(r => {
    const score = r.relationship_score || 5
    return {
      source: SELF_NODE_ID,
      target: r.id,
      value: score,
      lineStyle: {
        width: 0.5 + (score / 10) * 3,
        color: score >= 8 ? '#18181B' : (score >= 5 ? '#A1A1AA' : '#E4E4E7'),
        curveness: 0.1
      }
    }
  })
})

const echartsOption = computed(() => ({
  tooltip: {
    formatter: (params) => {
      if (params.dataType === 'node') {
        const r = relations.value.find(r => r.id === params.data.id)
        if (!r) return params.data.name
        const parts = [params.data.name]
        if (r.role) parts.push(`关系: ${r.role}`)
        if (r.context) parts.push(`场景: ${r.context}`)
        if (r.traits?.length) parts.push(`特征: ${r.traits.join('、')}`)
        parts.push(`亲密度: ${r.relationship_score}/10`)
        return parts.join('<br/>')
      }
      if (params.dataType === 'edge') {
        return `亲密度: ${params.data.value}/10`
      }
      return params.name
    }
  },
  legend: {
    data: graphCategories.value.map(c => c.name),
    textStyle: { color: '#71717A', fontSize: 11 },
    bottom: 5
  },
  series: [{
    type: 'graph',
    layout: 'force',
    data: graphNodes.value,
    links: graphLinks.value,
    categories: graphCategories.value,
    roam: true,
    draggable: true,
    force: {
      repulsion: 300,
      edgeLength: [80, 200],
      gravity: 0.08,
      layoutAnimation: true
    },
    emphasis: {
      focus: 'adjacency',
      lineStyle: { width: 4 }
    },
    lineStyle: { opacity: 0.7 },
    scaleLimit: {
      min: 0.5,
      max: 3
    }
  }]
}))

// ─── 按角色分组 ───
const groupedRelations = computed(() => {
  const map = {}
  for (const r of relations.value) {
    const role = r.role || '其他'
    if (!map[role]) map[role] = []
    map[role].push(r)
  }
  // 每组内按亲密度排序
  return Object.entries(map)
    .map(([role, list]) => ({ role, list: list.sort((a, b) => (b.relationship_score || 0) - (a.relationship_score || 0)) }))
    .sort((a, b) => b.list.length - a.list.length) // 按人数排序
})

// ─── 跳转 ───
function goDetail(id) {
  uni.navigateTo({ url: `/pages/settings/sub/relation-detail?id=${id}` })
}
function goRelationList() {
  uni.navigateTo({ url: '/pages/settings/sub/relations' })
}
function goBack() { safeNavigateBack() }
</script>

<style scoped lang="scss">
@import './relation-graph.scss';
</style>
