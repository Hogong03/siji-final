<template>
  <view class="page">
    <view class="custom-nav" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content">
        <view class="nav-back" @click="goBack"><text class="nav-back-icon">‹</text></view>
        <text class="nav-title">人脉</text>
        <view class="nav-btn" @click="goRelationList"><text class="nav-btn-text">管理</text></view>
      </view>
    </view>

    <scroll-view scroll-y class="main-scroll">
      <!-- 顶部提醒：久未联系 -->
      <view v-if="staleList.length > 0" class="stale-banner">
        <view class="stale-dot"></view>
        <text class="stale-text">{{ staleList.length }} 人超过 {{ staleThreshold }} 天没联系了</text>
      </view>

      <!-- 概览数字 -->
      <view class="overview-row">
        <view class="ov-item">
          <text class="ov-num">{{ relations.length }}</text>
          <text class="ov-label">总人数</text>
        </view>
        <view class="ov-divider"></view>
        <view class="ov-item">
          <text class="ov-num">{{ recentCount }}</text>
          <text class="ov-label">7天内互动</text>
        </view>
        <view class="ov-divider"></view>
        <view class="ov-item">
          <text class="ov-num">{{ avgScore }}</text>
          <text class="ov-label">平均亲密度</text>
        </view>
      </view>

      <!-- 按关系分组 -->
      <view v-if="relations.length === 0" class="empty-state">
        <text class="empty-title">还没有人脉</text>
        <text class="empty-sub">点击右上角「管理」添加第一个人吧</text>
      </view>

      <view v-for="group in grouped" :key="group.role" class="group-block">
        <view class="group-header">
          <text class="group-name">{{ group.role }}</text>
          <text class="group-count">{{ group.list.length }}</text>
        </view>

        <view class="person-list">
          <view v-for="r in group.list" :key="r.id" class="person-card" @click="goDetail(r.id)">
            <view class="avatar" :class="{ stale: daysSince(r) > staleThreshold }">
              <text class="avatar-text">{{ r.name.charAt(0) }}</text>
            </view>
            <view class="person-info">
              <text class="person-name">{{ r.name }}</text>
              <text class="person-meta">{{ metaText(r) }}</text>
            </view>
            <view class="person-right">
              <text v-if="daysSince(r) <= staleThreshold" class="days-text">{{ daysText(r) }}</text>
              <text v-else class="days-text stale">{{ daysText(r) }}</text>
            </view>
          </view>
        </view>
      </view>

      <view style="height: 40rpx" />
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getAllRelations } from '@/utils/relations.js'
import { safeNavigateBack } from '@/utils/nav-helper.js'

const statusBarHeight = ref(20)
try {
  const sys = uni.getSystemInfoSync()
  if (sys && sys.statusBarHeight) statusBarHeight.value = sys.statusBarHeight
} catch (e) {}

const relations = ref([])
const staleThreshold = 30

function loadData() {
  relations.value = getAllRelations()
}
onShow(() => { loadData() })

// 按 role 分组（归一化到大类）
const ROLE_GROUPS = [
  { name: '家人', match: ['母亲','父亲','爸爸','妈妈','爸','妈','哥哥','姐姐','弟弟','妹妹','爷爷','奶奶','外公','外婆','家人','父母','家属'] },
  { name: '伴侣', match: ['女友','男友','女朋友','男朋友','对象','老婆','老公','配偶','伴侣','夫妻'] },
  { name: '朋友', match: ['朋友','好友','死党','闺蜜','室友','同学','发小'] },
  { name: '工作', match: ['同事','领导','下属','老板','客户','上级','下级','工作','职场'] },
  { name: '师长', match: ['老师','导师','教授','师傅','教练','学长','学姐'] },
]
function normalizeRole(role) {
  for (const g of ROLE_GROUPS) {
    if (g.match.some(m => role && role.includes(m))) return g.name
  }
  return '其他'
}
const grouped = computed(() => {
  const map = {}
  for (const r of relations.value) {
    const g = normalizeRole(r.role || '')
    if (!map[g]) map[g] = []
    map[g].push(r)
  }
  return Object.entries(map).map(([role, list]) => ({
    role,
    list: list.sort((a, b) => daysSince(a) - daysSince(b))
  })).sort((a, b) => b.list.length - a.list.length)
})

// 距今天数
function daysSince(r) {
  if (!r.last_interaction) return 999
  const today = new Date()
  today.setHours(0,0,0,0)
  const d = new Date(r.last_interaction + 'T00:00:00')
  return Math.floor((today - d) / 86400000)
}

function daysText(r) {
  const n = daysSince(r)
  if (n <= 0) return '今天'
  if (n === 1) return '昨天'
  if (n < 7) return n + '天前'
  if (n < 30) return Math.floor(n/7) + '周前'
  return Math.floor(n/30) + '月前'
}

function metaText(r) {
  const parts = []
  if (r.context) parts.push(r.context)
  if (r.tags && r.tags.length) parts.push(r.tags.slice(0,2).join('·'))
  return parts.join('  ') || '添加备注'
}

// 久未联系
const staleList = computed(() =>
  relations.value.filter(r => daysSince(r) > staleThreshold)
)

// 7天内互动
const recentCount = computed(() =>
  relations.value.filter(r => daysSince(r) <= 7).length
)

// 平均亲密度
const avgScore = computed(() => {
  if (!relations.value.length) return 0
  const sum = relations.value.reduce((s, r) => s + (r.relationship_score || 5), 0)
  return (sum / relations.value.length).toFixed(1)
})

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
