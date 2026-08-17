<script setup>
/**
 * 收支统计页 — 5.0 增强版
 * 路由: /pages/bill/stats?month=YYYY-MM
 *
 * 功能：
 *  ① 月度/年度 tab 切换
 *  ② 总览（收支/结余/日均）
 *  ③ 趋势图（近7天/近30天/近12月）
 *  ④ 分类占比环形图
 *  ⑤ Top5 消费排行
 *  ⑥ 分类趋势对比（选分类看6月变化）
 *  ⑦ 环比对比 + 消费洞察
 */
import { ref, computed, onMounted } from 'vue'
import { getBillList } from '@/utils/storage.js'
import SijiChart from '@/components/common/SijiChart.vue'
import { EXPENSE_CATEGORIES } from '@/utils/categories.js'

const currentMonth = ref('')
const bills = ref([])
const prevBills = ref([])
const viewMode = ref('month') // month | year
const trendRange = ref('week') // week | month | year
const selectedCatTrend = ref('') // 分类趋势选中分类

onMounted(() => {
  const pages = getCurrentPages()
  const page = pages[pages.length - 1]
  const query = page?.$route?.query || page?.options || {}
  currentMonth.value = query.month || getDefaultMonth()
  loadData()
})

function getDefaultMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function getPrevMonth(month) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function loadData() {
  if (viewMode.value === 'year') {
    // 年度：加载12个月
    const year = parseInt(currentMonth.value.split('-')[0])
    const all = []
    for (let i = 0; i < 12; i++) {
      const m = `${year}-${String(i + 1).padStart(2, '0')}`
      all.push(...getBillList(m))
    }
    bills.value = all
    prevBills.value = []
    trendRange.value = 'year'
  } else {
    bills.value = getBillList(currentMonth.value)
    prevBills.value = getBillList(getPrevMonth(currentMonth.value))
    trendRange.value = 'week'
  }
}

function switchMode(mode) {
  viewMode.value = mode
  loadData()
}

// ==================== 总览 ====================
const totalExpense = computed(() =>
  bills.value.filter(b => b.type === 'expense' || b.type === 0).reduce((s, b) => s + (b.amount || 0), 0)
)
const totalIncome = computed(() =>
  bills.value.filter(b => b.type === 'income' || b.type === 1).reduce((s, b) => s + (b.amount || 0), 0)
)
const balance = computed(() => totalIncome.value - totalExpense.value)
const billCount = computed(() => bills.value.length)

const avgDailyExpense = computed(() => {
  if (viewMode.value === 'year') {
    return totalExpense.value / 365
  }
  const now = new Date()
  const [y, m] = currentMonth.value.split('-').map(Number)
  const isCurrentMonth = y === now.getFullYear() && m === now.getMonth() + 1
  const days = isCurrentMonth ? now.getDate() : new Date(y, m, 0).getDate()
  return days > 0 ? totalExpense.value / days : 0
})

// 环比
const prevTotalExpense = computed(() =>
  prevBills.value.filter(b => b.type === 'expense' || b.type === 0).reduce((s, b) => s + (b.amount || 0), 0)
)
const expenseChange = computed(() => {
  if (prevTotalExpense.value === 0) return null
  return ((totalExpense.value - prevTotalExpense.value) / prevTotalExpense.value * 100).toFixed(1)
})

// ==================== 分类统计 ====================
const pieColors = ['#18181B', '#3F3F46', '#71717A', '#A1A1AA', '#F4F4F5', '#E8A838', '#D35D5D', '#5B8BD4', '#8BC34A', '#FF9800', '#9C27B0', '#607D8B', '#795548', '#00BCD4', '#E91E63', '#AB47BC']

const expenseByCategory = computed(() => {
  const map = {}
  bills.value.filter(b => b.type === 'expense' || b.type === 0).forEach(b => {
    const cat = b.category || '其他'
    map[cat] = (map[cat] || 0) + (b.amount || 0)
  })
  const total = Object.values(map).reduce((a, b) => a + b, 0) || 1
  return Object.entries(map)
    .map(([name, amount], i) => ({ name, amount, percent: Math.round(amount / total * 100), color: pieColors[i % pieColors.length] }))
    .sort((a, b) => b.amount - a.amount)
})

const incomeByCategory = computed(() => {
  const map = {}
  bills.value.filter(b => b.type === 'income' || b.type === 1).forEach(b => {
    const cat = b.category || '其他'
    map[cat] = (map[cat] || 0) + (b.amount || 0)
  })
  const total = Object.values(map).reduce((a, b) => a + b, 0) || 1
  return Object.entries(map)
    .map(([name, amount], i) => ({ name, amount, percent: Math.round(amount / total * 100), color: pieColors[i % pieColors.length] }))
    .sort((a, b) => b.amount - a.amount)
})

// ==================== Top 5 消费 ====================
const top5Expense = computed(() => {
  return bills.value
    .filter(b => b.type === 'expense' || b.type === 0)
    .sort((a, b) => (b.amount || 0) - (a.amount || 0))
    .slice(0, 5)
})

// ==================== 趋势图 ====================
const trendData = computed(() => {
  if (trendRange.value === 'year') {
    // 12个月趋势
    const year = parseInt(currentMonth.value.split('-')[0])
    const result = []
    for (let i = 0; i < 12; i++) {
      const m = `${year}-${String(i + 1).padStart(2, '0')}`
      const monthBills = getBillList(m)
      const expense = monthBills.filter(b => b.type === 'expense' || b.type === 0).reduce((s, b) => s + (b.amount || 0), 0)
      const income = monthBills.filter(b => b.type === 'income' || b.type === 1).reduce((s, b) => s + (b.amount || 0), 0)
      result.push({ label: `${i + 1}月`, expense, income })
    }
    return result
  }

  const now = new Date()
  const days = trendRange.value === 'week' ? 7 : 30
  const result = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const label = `${d.getMonth() + 1}/${d.getDate()}`
    const dayBills = bills.value.filter(b => b.bill_date === dateStr)
    const expense = dayBills.filter(b => b.type === 'expense' || b.type === 0).reduce((s, b) => s + (b.amount || 0), 0)
    const income = dayBills.filter(b => b.type === 'income' || b.type === 1).reduce((s, b) => s + (b.amount || 0), 0)
    result.push({ label, expense, income })
  }
  return result
})

const trendTotalExpense = computed(() => trendData.value.reduce((s, d) => s + d.expense, 0))
const trendTotalIncome = computed(() => trendData.value.reduce((s, d) => s + d.income, 0))

// ==================== 分类趋势对比 ====================
const catTrendData = computed(() => {
  if (!selectedCatTrend.value) return []
  const year = parseInt(currentMonth.value.split('-')[0])
  const result = []
  for (let i = 0; i < 12; i++) {
    const m = `${year}-${String(i + 1).padStart(2, '0')}`
    const monthBills = getBillList(m)
    const amount = monthBills
      .filter(b => (b.type === 'expense' || b.type === 0) && b.category === selectedCatTrend.value)
      .reduce((s, b) => s + (b.amount || 0), 0)
    result.push({ label: `${i + 1}月`, amount })
  }
  return result
})

// ==================== 消费洞察 ====================
const insights = computed(() => {
  const list = []
  if (viewMode.value !== 'month') return list

  // 环比
  if (expenseChange.value !== null) {
    const change = parseFloat(expenseChange.value)
    if (change > 20) list.push(`支出环比增长 ${change}%，注意控制消费`)
    else if (change < -20) list.push(`支出环比下降 ${Math.abs(change)}%，做得不错`)
  }

  // Top 分类
  if (expenseByCategory.value.length > 0) {
    const top = expenseByCategory.value[0]
    list.push(`${top.name}占比最高（${top.percent}%），共 ¥${top.amount.toFixed(0)}`)
  }

  // 日均
  if (avgDailyExpense.value > 0) {
    list.push(`日均支出 ¥${avgDailyExpense.value.toFixed(0)}`)
  }

  // 大额
  if (top5Expense.value.length > 0) {
    const top1 = top5Expense.value[0]
    list.push(`最大单笔：${top1.category} ¥${top1.amount.toFixed(0)}`)
  }

  return list
})

function formatDate(ts) {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}
</script>

<template>
  <view class="stats-page">
    <!-- 顶部 -->
    <view class="month-header">
      <text class="month-title">{{ viewMode === 'year' ? currentMonth.split('-')[0] + '年' : currentMonth }} 收支统计</text>
      <text class="month-sub">共 {{ billCount }} 笔记录</text>
    </view>

    <!-- 模式切换 -->
    <view class="mode-switch">
      <text class="mode-btn" :class="{ active: viewMode === 'month' }" @tap="switchMode('month')">月度</text>
      <text class="mode-btn" :class="{ active: viewMode === 'year' }" @tap="switchMode('year')">年度</text>
    </view>

    <scroll-view class="stats-scroll" scroll-y>
      <!-- ① 总览 -->
      <view class="overview-section">
        <view class="overview-row">
          <view class="overview-card expense-card">
            <text class="ov-label">总支出</text>
            <text class="ov-value">¥{{ totalExpense.toFixed(2) }}</text>
            <text class="ov-sub" v-if="expenseChange !== null" :class="parseFloat(expenseChange) > 0 ? 'up' : 'down'">
              环比 {{ parseFloat(expenseChange) > 0 ? '↑' : '↓' }} {{ Math.abs(parseFloat(expenseChange)) }}%
            </text>
          </view>
          <view class="overview-card income-card">
            <text class="ov-label">总收入</text>
            <text class="ov-value">¥{{ totalIncome.toFixed(2) }}</text>
          </view>
        </view>
        <view class="overview-row">
          <view class="overview-card balance-card">
            <text class="ov-label">结余</text>
            <text class="ov-value" :class="balance >= 0 ? 'positive' : 'negative'">
              {{ balance >= 0 ? '+' : '' }}¥{{ balance.toFixed(2) }}
            </text>
          </view>
          <view class="overview-card avg-card">
            <text class="ov-label">日均支出</text>
            <text class="ov-value">¥{{ avgDailyExpense.toFixed(2) }}</text>
          </view>
        </view>
      </view>

      <!-- 消费洞察 -->
      <view class="insights-card" v-if="insights.length > 0">
        <text class="insights-title">📊 消费洞察</text>
        <view class="insight-item" v-for="(ins, i) in insights" :key="i">
          <text class="insight-dot">·</text>
          <text class="insight-text">{{ ins }}</text>
        </view>
      </view>

      <!-- ② 趋势图 -->
      <view class="chart-card">
        <view class="chart-header">
          <text class="chart-title">消费趋势</text>
          <view class="range-switch" v-if="viewMode === 'month'">
            <text class="range-btn" :class="{ active: trendRange === 'week' }" @tap="trendRange = 'week'">近7天</text>
            <text class="range-btn" :class="{ active: trendRange === 'month' }" @tap="trendRange = 'month'">近30天</text>
          </view>
        </view>
        <view class="trend-summary">
          <view class="ts-item"><view class="ts-dot" style="background:#18181B" /><text class="ts-label">支出</text><text class="ts-value">¥{{ trendTotalExpense.toFixed(0) }}</text></view>
          <view class="ts-item"><view class="ts-dot" style="background:#A1A1AA" /><text class="ts-label">收入</text><text class="ts-value">¥{{ trendTotalIncome.toFixed(0) }}</text></view>
        </view>
        <SijiChart type="bar" :data="trendData.map(d => ({ label: d.label, values: [d.expense, d.income] }))" :group-mode="true" :colors="['#18181B', '#A1A1AA']" :height="180" />
      </view>

      <!-- ③ Top 5 -->
      <view class="chart-card" v-if="top5Expense.length > 0">
        <text class="chart-title">Top 5 消费</text>
        <view class="top5-list">
          <view v-for="(item, i) in top5Expense" :key="item.client_id" class="top5-row">
            <text class="top5-rank">{{ i + 1 }}</text>
            <view class="top5-body">
              <text class="top5-cat">{{ item.category }}</text>
              <text class="top5-date" v-if="item.bill_date">{{ item.bill_date.substring(5) }}</text>
            </view>
            <text class="top5-amount">¥{{ item.amount.toFixed(2) }}</text>
          </view>
        </view>
      </view>

      <!-- ④ 支出分类 -->
      <view class="chart-card">
        <text class="chart-title">支出分类</text>
        <view v-if="expenseByCategory.length === 0" class="no-data">暂无支出记录</view>
        <view v-else class="cat-chart-row">
          <view class="ring-section">
            <SijiChart type="ring" :data="expenseByCategory.map(c => ({ value: c.amount, color: c.color }))" label="支出" :height="240" />
          </view>
          <view class="legend-list">
            <view v-for="cat in expenseByCategory" :key="cat.name" class="legend-row">
              <view class="legend-left">
                <view class="legend-dot" :style="{ background: cat.color }" />
                <text class="legend-name">{{ cat.name }}</text>
              </view>
              <view class="legend-right">
                <text class="legend-amount">¥{{ cat.amount.toFixed(2) }}</text>
                <text class="legend-pct">{{ cat.percent }}%</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- ⑤ 分类趋势对比 -->
      <view class="chart-card" v-if="viewMode === 'year'">
        <text class="chart-title">分类趋势</text>
        <scroll-view class="cat-trend-scroll" scroll-x>
          <view class="cat-trend-list">
            <view class="cat-trend-chip" :class="{ active: selectedCatTrend === '' }" @tap="selectedCatTrend = ''"><text>不选</text></view>
            <view v-for="cat in EXPENSE_CATEGORIES" :key="cat.key" class="cat-trend-chip" :class="{ active: selectedCatTrend === cat.key }" @tap="selectedCatTrend = cat.key">
              <text>{{ cat.icon }} {{ cat.key }}</text>
            </view>
          </view>
        </scroll-view>
        <view v-if="selectedCatTrend && catTrendData.length > 0">
          <text class="cat-trend-title">{{ selectedCatTrend }} 月度趋势</text>
          <SijiChart type="bar" :data="catTrendData.map(d => ({ label: d.label, values: [d.amount] }))" :colors="['#18181B']" :height="160" />
        </view>
        <view v-else class="no-data">选择分类查看月度趋势</view>
      </view>

      <!-- ⑥ 收入分类 -->
      <view class="chart-card" v-if="incomeByCategory.length > 0">
        <text class="chart-title">收入分类</text>
        <view class="cat-chart-row">
          <view class="ring-section">
            <SijiChart type="ring" :data="incomeByCategory.map(c => ({ value: c.amount, color: c.color }))" label="收入" :height="240" />
          </view>
          <view class="legend-list">
            <view v-for="cat in incomeByCategory" :key="cat.name" class="legend-row">
              <view class="legend-left">
                <view class="legend-dot" :style="{ background: cat.color }" />
                <text class="legend-name">{{ cat.name }}</text>
              </view>
              <view class="legend-right">
                <text class="legend-amount">¥{{ cat.amount.toFixed(2) }}</text>
                <text class="legend-pct">{{ cat.percent }}%</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <view style="height: 60rpx" />
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
@import './stats.scss';
</style>
