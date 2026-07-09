<script setup>
/**
 * 收支统计页 — 增强版
 * 路由: /pages/bill/stats?month=YYYY-MM
 * 
 * 功能：
 *  ① 月度收支总览（含结余、日均）
 *  ② 近 7 天 / 近 30 天消费趋势柱状图
 *  ③ 支出/收入分类占比（环形图 + 排行）
 *  ④ 环比上月对比
 */

import { ref, computed, onMounted } from 'vue'
import { getBillList } from '@/utils/storage.js'
import SijiChart from '@/components/common/SijiChart.vue'

const currentMonth = ref('')
const bills = ref([])
const prevBills = ref([]) // 上月数据（环比）

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
  bills.value = getBillList(currentMonth.value)
  prevBills.value = getBillList(getPrevMonth(currentMonth.value))
}

// ==================== 总览统计 ====================
const totalExpense = computed(() =>
  bills.value.filter(b => b.type === 'expense' || b.type === 0).reduce((s, b) => s + (b.amount || 0), 0)
)
const totalIncome = computed(() =>
  bills.value.filter(b => b.type === 'income' || b.type === 1).reduce((s, b) => s + (b.amount || 0), 0)
)
const balance = computed(() => totalIncome.value - totalExpense.value)
const billCount = computed(() => bills.value.length)

// 日均消费
const avgDailyExpense = computed(() => {
  const now = new Date()
  const [y, m] = currentMonth.value.split('-').map(Number)
  const isCurrentMonth = y === now.getFullYear() && m === now.getMonth() + 1
  const days = isCurrentMonth ? now.getDate() : new Date(y, m, 0).getDate()
  return days > 0 ? totalExpense.value / days : 0
})

// ==================== 环比上月 ====================
const prevTotalExpense = computed(() =>
  prevBills.value.filter(b => b.type === 'expense' || b.type === 0).reduce((s, b) => s + (b.amount || 0), 0)
)
const prevTotalIncome = computed(() =>
  prevBills.value.filter(b => b.type === 'income' || b.type === 1).reduce((s, b) => s + (b.amount || 0), 0)
)

const expenseChange = computed(() => {
  if (prevTotalExpense.value === 0) return null
  return ((totalExpense.value - prevTotalExpense.value) / prevTotalExpense.value * 100).toFixed(1)
})
const incomeChange = computed(() => {
  if (prevTotalIncome.value === 0) return null
  return ((totalIncome.value - prevTotalIncome.value) / prevTotalIncome.value * 100).toFixed(1)
})

// ==================== 分类统计 ====================
const pieColors = ['#10B981', '#000000', '#E8A838', '#D35D5D', '#5B8BD4', '#8BC34A', '#FF9800', '#9C27B0', '#607D8B', '#795548']

const expenseByCategory = computed(() => {
  const map = {}
  bills.value.filter(b => b.type === 'expense' || b.type === 0).forEach(b => {
    const cat = b.category || '其他'
    map[cat] = (map[cat] || 0) + (b.amount || 0)
  })
  const total = Object.values(map).reduce((a, b) => a + b, 0) || 1
  return Object.entries(map)
    .map(([name, amount], i) => ({
      name, amount,
      percent: Math.round(amount / total * 100),
      color: pieColors[i % pieColors.length]
    }))
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
    .map(([name, amount], i) => ({
      name, amount,
      percent: Math.round(amount / total * 100),
      color: pieColors[i % pieColors.length]
    }))
    .sort((a, b) => b.amount - a.amount)
})

// ==================== 趋势图 ====================
const trendRange = ref('week') // week | month
const trendData = computed(() => {
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

    result.push({ label, dateStr, expense, income })
  }

  return result
})

// 趋势最大值已移除（Canvas 图表自动计算）

const trendTotalExpense = computed(() => trendData.value.reduce((s, d) => s + d.expense, 0))
const trendTotalIncome = computed(() => trendData.value.reduce((s, d) => s + d.income, 0))

// 趋势图显示间隔已移除（Canvas 图表自动处理）
</script>

<template>
  <view class="stats-page">
    <!-- 顶部月份 -->
    <view class="month-header">
      <text class="month-title">{{ currentMonth }} 收支统计</text>
      <text class="month-sub">共 {{ billCount }} 笔记录</text>
    </view>

    <scroll-view class="stats-scroll" scroll-y>
      <!-- ① 总览卡片 -->
      <view class="overview-section">
        <view class="overview-row">
          <view class="overview-card expense-card">
            <text class="ov-label">总支出</text>
            <text class="ov-value">¥{{ totalExpense.toFixed(2) }}</text>
            <text class="ov-sub" v-if="expenseChange !== null" :class="expenseChange > 0 ? 'up' : 'down'">
              环比 {{ expenseChange > 0 ? '↑' : '↓' }} {{ Math.abs(expenseChange) }}%
            </text>
          </view>
          <view class="overview-card income-card">
            <text class="ov-label">总收入</text>
            <text class="ov-value">¥{{ totalIncome.toFixed(2) }}</text>
            <text class="ov-sub" v-if="incomeChange !== null" :class="incomeChange > 0 ? 'up' : 'down'">
              环比 {{ incomeChange > 0 ? '↑' : '↓' }} {{ Math.abs(incomeChange) }}%
            </text>
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

      <!-- ② 趋势图 -->
      <view class="chart-card">
        <view class="chart-header">
          <text class="chart-title">消费趋势</text>
          <view class="range-switch">
            <text
              class="range-btn" :class="{ active: trendRange === 'week' }"
              @tap="trendRange = 'week'"
            >近 7 天</text>
            <text
              class="range-btn" :class="{ active: trendRange === 'month' }"
              @tap="trendRange = 'month'"
            >近 30 天</text>
          </view>
        </view>

        <!-- 趋势合计 -->
        <view class="trend-summary">
          <view class="ts-item">
            <view class="ts-dot expense-dot" />
            <text class="ts-label">支出</text>
            <text class="ts-value">¥{{ trendTotalExpense.toFixed(0) }}</text>
          </view>
          <view class="ts-item">
            <view class="ts-dot income-dot" />
            <text class="ts-label">收入</text>
            <text class="ts-value">¥{{ trendTotalIncome.toFixed(0) }}</text>
          </view>
        </view>

        <!-- 柱状图（Canvas） -->
        <SijiChart
          type="bar"
          :data="trendData.map(d => ({ label: d.label, values: [d.expense, d.income] }))"
          :group-mode="true"
          :colors="['#EF4444', '#10B981']"
          :height="180"
        />
      </view>

      <!-- ③ 支出分类 -->
      <view class="chart-card">
        <text class="chart-title">支出分类</text>
        <view v-if="expenseByCategory.length === 0" class="no-data">暂无支出记录</view>
        <view v-else class="cat-chart-row">
          <!-- 环形图 -->
          <view class="ring-section">
            <SijiChart
              type="ring"
              :data="expenseByCategory.map(c => ({ value: c.amount, color: c.color }))"
              label="支出"
              :height="240"
            />
          </view>
          <!-- 图例列表 -->
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

      <!-- ④ 收入分类 -->
      <view class="chart-card" v-if="incomeByCategory.length > 0">
        <text class="chart-title">收入分类</text>
        <view class="cat-chart-row">
          <view class="ring-section">
            <SijiChart
              type="ring"
              :data="incomeByCategory.map(c => ({ value: c.amount, color: c.color }))"
              label="收入"
              :height="240"
            />
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
.stats-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: $bg-page;
}

/* 月份头部 */
.month-header {
  padding: $spacing-md;
  background: var(--color-ai);
  border-bottom-left-radius: $radius-lg;
  border-bottom-right-radius: $radius-lg;
  box-shadow: 0 4rpx 20rpx rgba(245, 158, 11, 0.2);

  .month-title {
    font-size: $font-xl;
    font-weight: 700;
    color: var(--text-on-ai);
    display: block;
  }

  .month-sub {
    font-size: $font-xs;
    color: rgba(255, 255, 255, 0.7);
    display: block;
    margin-top: 4rpx;
  }
}

.stats-scroll { flex: 1; padding: $spacing-md; }

/* 总览 */
.overview-section {
  margin-bottom: $spacing-md;
}

.overview-row {
  display: flex;
  gap: $spacing-sm;
  margin-bottom: $spacing-sm;
}

.overview-card {
  flex: 1;
  padding: $spacing-md $spacing-sm;
  border-radius: $radius-md;
  box-shadow: $shadow-sm;

  &.expense-card { background: rgba(211, 93, 93, 0.06); }
  &.income-card { background: rgba(74, 124, 89, 0.06); }
  &.balance-card { background: rgba(102, 126, 234, 0.06); }
  &.avg-card { background: rgba(232, 168, 56, 0.06); }

  .ov-label {
    font-size: $font-xs;
    color: $text-secondary;
    display: block;
  }

  .ov-value {
    font-size: $font-xl;
    font-weight: 800;
    display: block;
    margin-top: 6rpx;

    &.positive { color: $success; }
    &.negative { color: $danger; }
  }

  .ov-sub {
    font-size: 18rpx;
    display: block;
    margin-top: 4rpx;

    &.up { color: $danger; }
    &.down { color: $success; }
  }
}

/* 图表卡片 */
.chart-card {
  background: $bg-card;
  border-radius: $radius-lg;
  padding: $spacing-md;
  margin-bottom: $spacing-md;
  box-shadow: $shadow-sm;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $spacing-sm;
}

.chart-title {
  font-size: $font-md;
  font-weight: 700;
  color: $text-primary;
  display: block;
  margin-bottom: $spacing-sm;
}

/* 范围切换 */
.range-switch {
  display: flex;
  background: $bg-input;
  border-radius: $radius-sm;
  padding: 4rpx;

  .range-btn {
    font-size: 18rpx;
    padding: 6rpx 16rpx;
    border-radius: $radius-sm;
    color: $text-secondary;
    transition: all $transition-fast;

    &.active {
      background: var(--color-ai);
      color: var(--text-on-ai);
      box-shadow: 0 2rpx 8rpx rgba(245, 158, 11, 0.25);
      font-weight: 600;
    }
  }
}

/* 趋势合计 */
.trend-summary {
  display: flex;
  gap: $spacing-lg;
  margin-bottom: $spacing-md;
  padding: $spacing-sm 0;

  .ts-item {
    display: flex;
    align-items: center;
    gap: 6rpx;
  }

  .ts-dot {
    width: 12rpx;
    height: 12rpx;
    border-radius: 50%;
  }

  .expense-dot { background: $danger; }
  .income-dot { background: $success; }

  .ts-label {
    font-size: $font-xs;
    color: $text-secondary;
  }

  .ts-value {
    font-size: $font-sm;
    font-weight: 700;
    color: $text-primary;
  }
}

/* 趋势柱状图（旧 CSS 柱状图样式移除，已改用 Canvas） */
.trend-chart {
  display: none;
}

/* 分类图表行 */
.cat-chart-row {
  display: flex;
  gap: $spacing-md;
  align-items: flex-start;
}

.ring-section {
  flex-shrink: 0;
  width: 240rpx;
}

/* 图例 */
.legend-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.legend-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6rpx 0;
}

.legend-left {
  display: flex;
  align-items: center;
  gap: $spacing-sm;

  .legend-dot {
    width: 16rpx;
    height: 16rpx;
    border-radius: 50%;
  }

  .legend-name {
    font-size: $font-sm;
    color: $text-primary;
  }
}

.legend-right {
  display: flex;
  align-items: center;
  gap: $spacing-sm;

  .legend-amount {
    font-size: $font-sm;
    color: $text-secondary;
    font-weight: 600;
  }

  .legend-pct {
    font-size: $font-xs;
    color: $text-hint;
    width: 60rpx;
    text-align: right;
  }
}

.no-data {
  text-align: center;
  padding: $spacing-lg;
  color: $text-hint;
  font-size: $font-sm;
}
</style>
