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
          <view class="nav-btn" @tap="goProfile"><text class="nav-btn-text">画像</text></view>
        </view>
      </view>
    </view>

    <scroll-view scroll-y class="graph-scroll">
      <!-- 我的画像卡片（融入 profile 信息） -->
      <view class="profile-card">
        <view class="profile-header">
          <view class="profile-avatar">{{ selfName.charAt(0) }}</view>
          <view class="profile-meta">
            <text class="profile-name">{{ selfName }}</text>
            <text class="profile-bio">{{ selfBio }}</text>
          </view>
          <view class="profile-score-badge">{{ selfScore }}/10</view>
        </view>
        <view class="profile-tags" v-if="profileTags.length > 0">
          <view v-for="tag in profileTags" :key="tag" class="profile-tag">
            <text class="tag-text">{{ tag }}</text>
          </view>
        </view>
        <view class="profile-traits" v-if="selfTraits.length > 0">
          <text class="traits-label">性格特征</text>
          <text class="traits-text">{{ selfTraits.join(' · ') }}</text>
        </view>
        <view class="profile-detail-row" v-if="profileDetails.length > 0">
          <view v-for="d in profileDetails" :key="d.label" class="detail-item">
            <text class="detail-label">{{ d.label }}</text>
            <text class="detail-value">{{ d.value }}</text>
          </view>
        </view>
      </view>

      <!-- ECharts 力导向关系图 -->
      <view class="graph-section">
        <text class="section-title">关系网络</text>
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

      <!-- 亲密度排序列表 -->
      <view class="rank-section">
        <text class="rank-title">亲密度排行</text>
        <view v-for="r in sortedRelations" :key="r.id" class="rank-row" @tap="goDetail(r.id)">
          <view class="rank-left">
            <view class="rank-avatar" :class="{ 'rank-self': r.id === '__self__' }">{{ r.name.charAt(0) }}</view>
            <view class="rank-info">
              <text class="rank-name">{{ r.name }}</text>
              <text class="rank-role">{{ r.role }}</text>
            </view>
          </view>
          <view class="rank-score">{{ r.relationship_score }}</view>
        </view>
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
import { getProfile, getCard } from '@/utils/profile.js'
import { safeNavigateBack } from '@/utils/nav-helper.js'

const statusBarHeight = ref(20)
try {
  const sys = uni.getSystemInfoSync()
  if (sys && sys.statusBarHeight) statusBarHeight.value = sys.statusBarHeight
} catch (e) {}

// ─── 数据 ───
const relations = ref([])
const profile = ref({ cards: [] })

function loadData() {
  relations.value = getAllRelations()
  try { profile.value = getProfile() } catch { profile.value = { cards: [] } }
}

onShow(() => { loadData() })

// ─── 画像数据 ───
const basicCard = computed(() => {
  const c = profile.value.cards.find(c => c.id === 'basic')
  return c || { fields: {} }
})

const selfName = computed(() => basicCard.value.fields.nickname || '我')
const selfBio = computed(() => basicCard.value.fields.bio || '点击完善个人信息')
const selfScore = computed(() => 10) // 自己恒定满分

// 从 profile cards 提取标签（性格特征/MBTI/星座等）
const profileTags = computed(() => {
  const tags = []
  for (const card of profile.value.cards) {
    if (card.id === 'basic') continue
    for (const [key, val] of Object.entries(card.fields)) {
      if (val == null || val === '') continue
      if (Array.isArray(val) && val.length === 0) continue
      if (Array.isArray(val)) {
        val.forEach(v => tags.push(v))
      } else {
        tags.push(String(val))
      }
    }
  }
  return tags.slice(0, 12)
})

// 自己的性格特征（从 profile 提取或默认）
const selfTraits = computed(() => {
  // 从 profile cards 中提取特征类标签
  const traits = []
  for (const card of profile.value.cards) {
    if (card.id === 'basic') continue
    for (const [, val] of Object.entries(card.fields)) {
      if (Array.isArray(val)) traits.push(...val)
      else if (val) traits.push(String(val))
    }
  }
  return traits.slice(0, 8)
})

// profile 详情行（职业/位置/生日等）
const profileDetails = computed(() => {
  const f = basicCard.value.fields
  const rows = []
  if (f.occupation) rows.push({ label: '职业', value: f.occupation })
  if (f.location) rows.push({ label: '所在地', value: f.location })
  if (f.birthday) rows.push({ label: '生日', value: f.birthday })
  if (f.gender) rows.push({ label: '性别', value: f.gender })
  return rows.slice(0, 4)
})

// ─── ECharts 力导向图数据构建 ───
// 悲惨世界风格：节点大小按亲密度，颜色按分组，连线粗细按关系
const SELF_NODE_ID = '__self__'

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
    nodes.push({
      id: r.id,
      name: r.name,
      symbolSize: 20 + score * 4,
      category: score >= 8 ? 1 : (score >= 5 ? 2 : 3),
      value: score,
      itemStyle: {
        color: score >= 8 ? '#18181B' : (score >= 5 ? '#71717A' : '#D4D4D8'),
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

const graphCategories = [
  { name: '自己' },
  { name: '高亲密度' },
  { name: '中亲密度' },
  { name: '低亲密度' }
]

const echartsOption = computed(() => ({
  tooltip: {
    formatter: (params) => {
      if (params.dataType === 'node') {
        const r = relations.value.find(r => r.id === params.data.id)
        if (!r) return params.data.name
        const parts = [params.data.name]
        if (r.role) parts.push(`角色: ${r.role}`)
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
    data: graphCategories.map(c => c.name),
    textStyle: { color: '#71717A', fontSize: 11 },
    bottom: 5
  },
  series: [{
    type: 'graph',
    layout: 'force',
    data: graphNodes.value,
    links: graphLinks.value,
    categories: graphCategories,
    roam: true, // 拖拽 + 缩放
    draggable: true,
    force: {
      repulsion: 300, // 节点间斥力
      edgeLength: [80, 200], // 连线长度范围
      gravity: 0.08, // 向心力
      layoutAnimation: true
    },
    emphasis: {
      focus: 'adjacency', // 高亮关联节点
      lineStyle: { width: 4 }
    },
    lineStyle: { opacity: 0.7 },
    scaleLimit: {
      min: 0.5,
      max: 3
    }
  }]
}))

// ─── 排行 ───
const sortedRelations = computed(() =>
  [...relations.value].sort((a, b) => (b.relationship_score || 0) - (a.relationship_score || 0))
)

// ─── 跳转 ───
function goDetail(id) {
  uni.navigateTo({ url: `/pages/settings/sub/relation-detail?id=${id}` })
}
function goProfile() {
  uni.navigateTo({ url: '/pages/settings/sub/profile' })
}
function goBack() { safeNavigateBack() }
</script>

<style scoped lang="scss">
@import './relation-graph.scss';
</style>
