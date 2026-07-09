<script setup>
/**
 * 功能中心 — AI + 工具融合仪表盘
 * 玻璃拟物卡片 + 功能色编码 + AI 辅助入口
 */
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import SijiIcon from '@/components/common/SijiIcon.vue'
import { useAppStore }from '@/store/index.js'
import { getDiaryList, getBillList, getPlanList } from '@/utils/storage.js'

const store = useAppStore()

const dashboard = ref({
  monthExpense: 0, monthIncome: 0, balance: 0,
  diaryCount: 0, diaryThisWeek: 0,
  planTotal: 0, planCompleted: 0, planActive: 0,
  avgDailyExpense: 0, todayExpense: 0, yesterdayExpense: 0
})
const weekTrend = ref([])

onMounted(() => { loadAll() })
onShow(() => {
  loadAll()
})
function loadAll() { loadDashboard(); loadWeekTrend() }

function getRecentDays(n) {
  const days = []; const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i)
    const label = `${d.getMonth() + 1}/${d.getDate()}`
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    days.push({ label, dateStr })
  }
  return days
}

function loadDashboard() {
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const bills = getBillList(month)
  const diaries = getDiaryList(month)
  const plans = getPlanList()
  const expenses = bills.filter(b => b.type === 'expense' || b.type === 0)
  const incomes = bills.filter(b => b.type === 'income' || b.type === 1)
  const monthExpense = expenses.reduce((s, b) => s + (b.amount || 0), 0)
  const monthIncome = incomes.reduce((s, b) => s + (b.amount || 0), 0)
  const todayStr = formatDateStr(now)
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  const yesterdayStr = formatDateStr(yesterday)
  const todayExpense = expenses.filter(b => b.bill_date === todayStr).reduce((s, b) => s + (b.amount || 0), 0)
  const yesterdayExpense = expenses.filter(b => b.bill_date === yesterdayStr).reduce((s, b) => s + (b.amount || 0), 0)
  const dayOfMonth = now.getDate()
  const avgDailyExpense = dayOfMonth > 0 ? monthExpense / dayOfMonth : 0
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0, 0, 0, 0)
  const diaryThisWeek = diaries.filter(d => d.created_at >= weekStart.getTime()).length
  dashboard.value = {
    monthExpense, monthIncome, balance: monthIncome - monthExpense,
    diaryCount: diaries.length, diaryThisWeek,
    planTotal: plans.length,
    planCompleted: plans.filter(p => p.status === 2).length,
    planActive: plans.filter(p => p.status === 1).length,
    avgDailyExpense, todayExpense, yesterdayExpense
  }
}

function loadWeekTrend() {
  const days = getRecentDays(7)
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const bills = getBillList(month).filter(b => b.type === 'expense' || b.type === 0)
  weekTrend.value = days.map(d => ({
    label: d.label,
    amount: bills.filter(b => b.bill_date === d.dateStr).reduce((s, b) => s + (b.amount || 0), 0)
  }))
}

const overviewItems = computed(() => [
  { label: '支出', value: dashboard.value.monthExpense, sub: `日均¥${dashboard.value.avgDailyExpense.toFixed(0)}`, color: '#F59E0B', isAmount: true },
  { label: '收入', value: dashboard.value.monthIncome, sub: `结余¥${dashboard.value.balance.toFixed(0)}`, color: '#10B981', isAmount: true },
  { label: '今日', value: dashboard.value.todayExpense, sub: dashboard.value.yesterdayExpense > 0 ? `昨¥${dashboard.value.yesterdayExpense.toFixed(0)}` : '—', color: '#EF4444', isAmount: true },
  { label: '计划', value: dashboard.value.planCompleted, suffix: `/${dashboard.value.planTotal}`, sub: dashboard.value.planTotal > 0 ? `${Math.round(dashboard.value.planCompleted / dashboard.value.planTotal * 100)}%` : '—', color: '#18181B', isAmount: false }
])

const categoryRanking = computed(() => {
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const bills = getBillList(month).filter(b => b.type === 'expense' || b.type === 0)
  const map = {}
  bills.forEach(b => { const c = b.category || '其他'; map[c] = (map[c] || 0) + (b.amount || 0) })
  const total = Object.values(map).reduce((s, v) => s + v, 0)
  return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, amount]) => ({
    name, amount, percent: total > 0 ? Math.round(amount / total * 100) : 0
  }))
})

const trendMax = computed(() => Math.max(...weekTrend.value.map(d => d.amount), 1))
const weekTotal = computed(() => weekTrend.value.reduce((s, d) => s + d.amount, 0))

// 功能入口 — 三大模块各用功能色
const funcEntries = [
  { id: 'diary', iconName: 'diary', title: '日记', stat: () => dashboard.value.diaryCount, statLabel: '本月', gradient: '#F4F4F5', color: '#18181B', listPage: '/pages/diary/list', newPage: '/pages/diary/detail?id=new' },
  { id: 'bill', iconName: 'bill', title: '记账', stat: () => '—', statLabel: '明细', gradient: '#F4F4F5', color: '#18181B', listPage: '/pages/bill/index', newPage: '/pages/bill/edit?type=expense' },
  { id: 'plan', iconName: 'plan', title: '计划', stat: () => dashboard.value.planActive, statLabel: '进行中', gradient: '#F4F4F5', color: '#18181B', listPage: '/pages/plan/index', newPage: '/pages/plan/templates' },
]

const quickPills = [
  { label: '写日记', iconName: 'diary', mode: 'diary', action: () => uni.navigateTo({ url: '/pages/diary/detail?id=new' }) },
  { label: '记笔账', iconName: 'bill', mode: 'bill', action: () => uni.navigateTo({ url: '/pages/bill/edit?type=expense' }) },
  { label: '定计划', iconName: 'plan', mode: 'plan', action: () => uni.navigateTo({ url: '/pages/plan/templates' }) },
  { label: '问AI', iconName: 'ai', mode: 'chat', action: () => uni.switchTab({ url: '/pages/chat/index' }) }
]

function goPage(url) { uni.navigateTo({ url }) }
function quickChat(mode) { store.setCurrentMode(mode); uni.switchTab({ url: '/pages/chat/index' }) }
function goStats() { uni.navigateTo({ url: '/pages/bill/stats' }) }
function goAI() { uni.switchTab({ url: '/pages/chat/index' }) }

function formatAmount(val) {
  if (val >= 10000) return (val / 10000).toFixed(1) + 'w'
  return val.toFixed(0)
}
function formatDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
</script>

<template>
  <view class="functions-page">
    <scroll-view class="func-scroll" scroll-y @refresherrefresh="loadAll" refresher-enabled>
      <!-- AI 玻璃头部 -->
      <view class="hero-card">
        <view class="hero-bg" />
        <view class="hero-content">
          <view class="hero-row">
            <view>
              <text class="hero-title">功能中心</text>
              <text class="hero-sub">{{ dashboard.diaryCount + dashboard.planActive }} 项进行中</text>
            </view>
            <view class="ai-entry" @tap="goAI">
              <view class="ai-orb" />
              <text class="ai-entry-text">问 AI</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 搜索入口 -->
      <view class="search-entry" @tap="uni.navigateTo({ url: '/pages/search/result' })">
        <SijiIcon name="search" size="sm" color="var(--text-hint)" />
        <text class="search-placeholder">搜索日记、账单、计划...</text>
      </view>

      <!-- 概览横排 — 玻璃卡片 -->
      <view class="overview-bar glass-card">
        <view v-for="item in overviewItems" :key="item.label" class="ov-item">
          <text class="ov-value" :style="{ color: item.color }">
            {{ item.isAmount ? '¥' + formatAmount(item.value) : item.value + (item.suffix || '') }}
          </text>
          <text class="ov-label">{{ item.label }}</text>
          <text class="ov-sub">{{ item.sub }}</text>
        </view>
      </view>

      <!-- 快捷操作 — pill 胶囊 -->
      <view class="pill-row">
        <view v-for="p in quickPills" :key="p.mode" class="pill-btn" @tap="p.action()">
          <SijiIcon :name="p.iconName" size="sm" color="var(--text-primary)" />
          <text class="pill-text">{{ p.label }}</text>
        </view>
      </view>

      <!-- 消费分析 — 玻璃合并卡 -->
      <view class="analysis-card glass-card" v-if="categoryRanking.length > 0 || weekTrend.length > 0">
        <view class="ac-header">
          <view class="ac-title-row">
            <SijiIcon name="trend" size="sm" color="var(--text-primary)" />
            <text class="ac-title">消费分析</text>
          </view>
          <text class="ac-link" @tap="goStats">详细 →</text>
        </view>

        <view class="trend-section" v-if="weekTrend.length > 0">
          <view class="trend-meta">
            <text class="trend-label">近 7 天</text>
            <text class="trend-total">¥{{ weekTotal.toFixed(0) }}</text>
          </view>
          <view class="trend-chart">
            <view v-for="(d, i) in weekTrend" :key="i" class="trend-col">
              <view class="trend-bar-bg">
                <view class="trend-bar" :style="{
                  height: Math.max(6, (d.amount / trendMax) * 100) + '%',
                  background: d.amount > 0 ? '#000000' : '#F4F4F5'
                }" />
              </view>
              <text class="trend-day">{{ d.label }}</text>
            </view>
          </view>
        </view>

        <view class="ac-divider" v-if="categoryRanking.length > 0 && weekTrend.length > 0" />

        <view class="rank-section" v-if="categoryRanking.length > 0">
          <text class="rank-title">分类 TOP{{ categoryRanking.length }}</text>
          <view v-for="item in categoryRanking" :key="item.name" class="rank-row">
            <text class="rank-name">{{ item.name }}</text>
            <view class="rank-bar-wrap">
              <view class="rank-bar" :style="{ width: item.percent + '%' }" />
            </view>
            <text class="rank-amount">¥{{ item.amount.toFixed(0) }}</text>
            <text class="rank-pct">{{ item.percent }}%</text>
          </view>
        </view>
      </view>

      <!-- 功能入口 — 渐变卡片 -->
      <view class="func-row">
        <view v-for="card in funcEntries" :key="card.id" class="func-entry" @tap="goPage(card.listPage)">
          <view class="fe-icon-circle" :style="{ background: card.gradient }">
            <SijiIcon :name="card.iconName" size="md" :color="card.color" />
          </view>
          <text class="fe-title">{{ card.title }}</text>
          <text class="fe-stat" :style="{ color: card.color }">{{ card.stat() }} {{ card.statLabel }}</text>
          <view class="fe-new-btn" :style="{ background: card.color }" @tap.stop="goPage(card.newPage)">
            <text class="fe-new-text">+ 新建</text>
          </view>
        </view>
      </view>

      <view style="height: 40rpx" />
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
.functions-page {
  height: 100vh;
  background: var(--bg-page);
  overflow: hidden;
}

.func-scroll {
  height: 100%;
  padding: $spacing-sm $spacing-md;
  box-sizing: border-box;
}

/* AI Hero 卡片 */
.hero-card {
  position: relative;
  border-radius: $radius-md;
  overflow: hidden;
  margin-bottom: $spacing-sm;
  box-sizing: border-box;
  box-shadow: $shadow-sm;
}

.hero-bg {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: var(--color-ai);
}

.hero-content {
  position: relative;
  padding: $spacing-md $spacing-lg;
  box-sizing: border-box;
}

.hero-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-sm;
  overflow: hidden;
}

.hero-title {
  font-size: $font-xl;
  font-weight: 800;
  color: var(--text-on-ai);
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hero-sub {
  font-size: $font-xs;
  color: rgba(255, 255, 255, 0.7);
  display: block;
  margin-top: 4rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-entry {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  background: rgba(255, 255, 255, 0.18);
  padding: 12rpx 24rpx;
  border-radius: $radius-md;
  border: 1rpx solid rgba(255, 255, 255, 0.2);
  transition: transform $transition-fast;
  flex-shrink: 0;
  box-sizing: border-box;

  &:active { transform: scale(0.95); }
}

.ai-orb {
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
  background: var(--bg-card);
}

.ai-entry-text {
  font-size: $font-sm;
  color: var(--text-on-ai);
  font-weight: 600;
}

/* 搜索入口 */
.search-entry {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  margin: 0 $spacing-sm $spacing-sm;
  padding: $spacing-sm $spacing-md;
  background: $bg-card;
  border-radius: $radius-lg;
  box-shadow: $shadow-sm;
}

.search-placeholder {
  font-size: $font-sm;
  color: $text-hint;
}

/* 概览横排 — 玻璃 */
.overview-bar {
  display: flex;
  padding: $spacing-sm 0;
  margin-bottom: $spacing-sm;
  background: var(--bg-card);
  border: 1rpx solid var(--border-color);
  border-radius: $radius-md;
  box-sizing: border-box;
  overflow: hidden;
}

.ov-item {
  flex: 1;
  min-width: 0;
  text-align: center;
  position: relative;
  overflow: hidden;

  &:not(:last-child)::after {
    content: '';
    position: absolute;
    right: 0;
    top: 20%;
    height: 60%;
    width: 1rpx;
    background: var(--border-color);
  }

  .ov-value { font-size: $font-lg; font-weight: 800; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ov-label { font-size: 20rpx; color: var(--text-secondary); display: block; margin-top: 2rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ov-sub { font-size: 18rpx; color: var(--text-hint); display: block; margin-top: 2rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
}

/* 快捷 pill */
.pill-row {
  display: flex;
  gap: $spacing-xs;
  margin-bottom: $spacing-sm;
  overflow: hidden;
}

.pill-btn {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  padding: 14rpx 0;
  background: var(--bg-card);
  border-radius: $radius-md;
  border: 1rpx solid var(--border-color);
  transition: transform $transition-fast;
  box-sizing: border-box;
  overflow: hidden;
  box-shadow: $shadow-sm;

  &:active { transform: scale(0.95); }
  .pill-icon { font-size: $font-md; flex-shrink: 0; }
  .pill-text { font-size: $font-xs; font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
}

/* 分析卡 — 玻璃 */
.analysis-card {
  padding: $spacing-sm $spacing-md;
  margin-bottom: $spacing-sm;
  background: var(--bg-card);
  border: 1rpx solid var(--border-color);
  border-radius: $radius-md;
  box-sizing: border-box;
  overflow: hidden;
}

.ac-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: $spacing-xs;
  gap: $spacing-sm;
  overflow: hidden;

  .ac-title { font-size: $font-sm; font-weight: 700; color: var(--text-primary); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ac-link { font-size: $font-xs; color: var(--color-ai); flex-shrink: 0; white-space: nowrap; }
}

.trend-meta {
  display: flex;
  justify-content: space-between;
  margin-bottom: $spacing-xs;
  gap: $spacing-xs;
  overflow: hidden;
  .trend-label { font-size: 20rpx; color: var(--text-hint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .trend-total { font-size: $font-xs; color: $color-bill; font-weight: 600; flex-shrink: 0; white-space: nowrap; }
}

.trend-chart {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  height: 120rpx;
  overflow: hidden;
}

.trend-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;
  overflow: hidden;
}

.trend-bar-bg {
  flex: 1;
  width: 24rpx;
  max-width: 24rpx;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.trend-bar {
  width: 100%;
  border-radius: 6rpx 6rpx 2rpx 2rpx;
  min-height: 6rpx;
  transition: height 0.3s ease;
}

.trend-day { font-size: 16rpx; color: var(--text-hint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }

.ac-divider {
  height: 1rpx;
  background: var(--border-color);
  margin: $spacing-xs 0;
}

.rank-section { padding-top: $spacing-xs; }

.rank-title {
  font-size: 20rpx;
  font-weight: 600;
  color: var(--text-secondary);
  display: block;
  margin-bottom: $spacing-xs;
}

.rank-row {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  padding: 4rpx 0;
  overflow: hidden;

  .rank-name { width: 80rpx; min-width: 80rpx; font-size: $font-xs; color: var(--text-secondary); flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rank-bar-wrap { flex: 1; min-width: 0; height: 10rpx; background: var(--bg-input); border-radius: 5rpx; overflow: hidden; }
  .rank-bar { height: 100%; background: var(--color-ai); border-radius: 5rpx; transition: width 0.3s ease; }
  .rank-amount { font-size: $font-xs; font-weight: 600; color: var(--text-primary); width: 80rpx; min-width: 80rpx; text-align: right; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rank-pct { font-size: 18rpx; color: var(--text-hint); width: 50rpx; min-width: 50rpx; text-align: right; flex-shrink: 0; }
}

/* 功能入口 — 渐变圆图标 */
.func-row {
  display: flex;
  gap: $spacing-sm;
  overflow: hidden;
}

.func-entry {
  flex: 1;
  min-width: 0;
  text-align: center;
  padding: $spacing-sm $spacing-xs;
  background: var(--bg-card);
  border-radius: $radius-md;
  border: 1rpx solid var(--border-color);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
  transition: transform $transition-fast;
  box-sizing: border-box;
  overflow: hidden;

  &:active { transform: scale(0.96); }
}

.fe-icon-circle {
  width: 80rpx;
  height: 80rpx;
  min-width: 80rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4rpx;
  box-sizing: border-box;
}

.fe-icon { font-size: 40rpx; }
.fe-title { font-size: $font-sm; font-weight: 700; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.fe-stat { font-size: 18rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }

.fe-new-btn {
  padding: 6rpx 20rpx;
  border-radius: $radius-md;
  margin-top: 4rpx;
  box-sizing: border-box;
  flex-shrink: 0;

  .fe-new-text {
    font-size: $font-xs;
    font-weight: 600;
    color: var(--text-on-ai);
    white-space: nowrap;
  }
}
</style>
