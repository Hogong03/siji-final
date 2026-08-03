<script setup>
/**
 * 账单列表页 — 5.0 统一工具栏版
 *
 * 结构：概览卡片 → 工具栏(搜索+时间+类型+回收站) → 内容 → FAB
 * 搜索+时间+类型+分类 四维 AND 筛选，支持跨月搜索
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getBillList, deleteBill, getMonthlyBudget, setMonthlyBudget, getCategoryBudgets } from '@/utils/storage.js'
import { asyncSetStorage } from '@/utils/store-helpers.js'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, ALL_CATEGORIES, getCategoryInfo, DANGER_COLOR } from '@/utils/categories.js'
import { safeNavigateBack } from '@/utils/nav-helper.js'

// ==================== 数据 ====================
const allBills = ref([])
const currentMonth = ref('')
const filterType = ref(-1)    // -1=全部 0=支出 1=收入
const filterCategory = ref('')
const searchKeyword = ref('')
const showTimePicker = ref(false)
const showCatPicker = ref(false)
const showBudgetSet = ref(false)
const budgetInput = ref('')
const budget = ref(0)
const catBudgets = ref({})

// 月份列表（12个月 + 全部时间）
const monthList = ref([])
const months = computed(() => monthList.value)

function initMonths() {
  const list = [{ key: 'all', label: '全部时间' }]
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    list.push({ key, label: `${d.getFullYear()}年${d.getMonth() + 1}月` })
  }
  monthList.value = list
}

const currentMonthLabel = computed(() => {
  const m = months.value.find(m => m.key === currentMonth.value)
  return m ? m.label : ''
})

const currentCategories = computed(() => {
  if (filterType.value === 0) return EXPENSE_CATEGORIES
  if (filterType.value === 1) return INCOME_CATEGORIES
  return ALL_CATEGORIES
})

// ==================== 加载数据 ====================
function loadBills() {
  if (currentMonth.value === 'all') {
    const all = []
    for (const m of months.value) {
      if (m.key === 'all') continue
      const items = getBillList(m.key)
      all.push(...items)
    }
    allBills.value = all.sort((a, b) => (b.bill_date || '').localeCompare(a.bill_date || ''))
  } else {
    allBills.value = getBillList(currentMonth.value)
  }
}

function loadBudget() {
  budget.value = getMonthlyBudget(currentMonth.value === 'all' ? '' : currentMonth.value)
  if (currentMonth.value !== 'all') {
    catBudgets.value = getCategoryBudgets(currentMonth.value)
  } else {
    catBudgets.value = {}
  }
}

function switchMonth(key) {
  currentMonth.value = key
  filterCategory.value = ''
  showTimePicker.value = false
  loadBudget()
  loadBills()
}

// ==================== 四维筛选 ====================
const filteredBills = computed(() => {
  let list = allBills.value
  if (filterType.value !== -1) {
    list = list.filter(b => {
      const bType = (b.type === 'income' || b.type === 1) ? 1 : 0
      return bType === filterType.value
    })
  }
  if (filterCategory.value) {
    list = list.filter(b => b.category === filterCategory.value)
  }
  if (searchKeyword.value.trim()) {
    const kw = searchKeyword.value.trim().toLowerCase()
    list = list.filter(b =>
      (b.note || b.remark || '').toLowerCase().includes(kw) ||
      (b.category || '').toLowerCase().includes(kw)
    )
  }
  return list
})

// ==================== 统计 ====================
const stats = computed(() => {
  let income = 0, expense = 0
  allBills.value.forEach(b => {
    if (b.type === 'income' || b.type === 1) income += b.amount || 0
    else expense += b.amount || 0
  })
  return {
    income,
    expense,
    balance: income - expense,
    budgetUsed: budget.value > 0 ? Math.round(expense / budget.value * 100) : 0
  }
})

// 按日期分组
const groupedBills = computed(() => {
  const groups = {}
  filteredBills.value.forEach(b => {
    const date = b.bill_date || ''
    if (!groups[date]) groups[date] = []
    groups[date].push(b)
  })
  return Object.entries(groups)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => {
      const dayExpense = items.filter(b => b.type !== 'income' && b.type !== 1).reduce((s, b) => s + (b.amount || 0), 0)
      const dayIncome = items.filter(b => b.type === 'income' || b.type === 1).reduce((s, b) => s + (b.amount || 0), 0)
      return { date, items, dayExpense, dayIncome }
    })
})

const hasActiveFilter = computed(() =>
  searchKeyword.value || filterType.value !== -1 || filterCategory.value
)

function resetFilters() {
  searchKeyword.value = ''
  filterType.value = -1
  filterCategory.value = ''
}

function clearSearch() { searchKeyword.value = '' }

function setFilterType(type) {
  filterType.value = type
  filterCategory.value = ''
}

// ==================== 生命周期 ====================
onMounted(() => {
  initMonths()
  currentMonth.value = months.value[1]?.key || ''
  loadBudget()
  loadBills()
})

onShow(() => loadBills())

// ==================== 左滑删除 ====================
const swipeItem = ref(null)
const ACTION_WIDTH = 140

function onBillTap(bill) {
  if (swipeItem.value) { swipeItem.value = null; return }
  goEdit(bill)
}

const swipeStartX = ref(0)
const swipeStartId = ref('')
const swipeMoveX = ref(0)
const swipingId = ref('')

function onTouchStart(e, bill) {
  swipeStartX.value = e.touches[0].clientX
  swipeStartId.value = bill.client_id
  if (swipeItem.value && swipeItem.value !== bill.client_id) swipeItem.value = null
}
function onTouchMove(e, bill) {
  if (swipeStartId.value !== bill.client_id) return
  const dx = e.touches[0].clientX - swipeStartX.value
  if (dx < 0) { swipingId.value = bill.client_id; swipeMoveX.value = Math.max(-ACTION_WIDTH, dx) }
}
function onTouchEnd(bill) {
  if (swipingId.value !== bill.client_id) return
  if (swipeMoveX.value < -ACTION_WIDTH / 2) swipeItem.value = bill.client_id
  else swipeItem.value = null
  swipingId.value = ''; swipeMoveX.value = 0
}
function getSwipeOffset(bill) {
  if (swipingId.value === bill.client_id) return swipeMoveX.value + 'px'
  if (swipeItem.value === bill.client_id) return -ACTION_WIDTH + 'px'
  return '0px'
}

function confirmDelete(bill) {
  uni.showModal({
    title: '删除账单',
    content: `确认删除 ${bill.category} ¥${bill.amount.toFixed(2)}？`,
    confirmColor: DANGER_COLOR,
    success: (res) => {
      if (res.confirm) {
        uni.vibrateShort({ type: 'light' })
        const month = bill.bill_date ? bill.bill_date.substring(0, 7) : currentMonth.value
        deleteBill(bill.client_id, month)
        swipeItem.value = null
        loadBills()
        uni.showToast({ title: '已删除', icon: 'success' })
      }
    }
  })
}

// ==================== 编辑 ====================
function goEdit(bill) {
  const month = bill.bill_date ? bill.bill_date.substring(0, 7) : currentMonth.value
  uni.navigateTo({ url: `/pages/bill/edit?id=${bill.client_id}&month=${month}` })
}
function goAdd(type) {
  uni.navigateTo({ url: `/pages/bill/edit?type=${type || 'expense'}&month=${currentMonth.value === 'all' ? '' : currentMonth.value}` })
}

// ==================== 预算 ====================
function openBudgetSet() {
  budgetInput.value = budget.value > 0 ? String(budget.value) : ''
  showBudgetSet.value = true
}
function saveBudget() {
  const val = parseFloat(budgetInput.value) || 0
  budget.value = val
  if (currentMonth.value !== 'all') {
    setMonthlyBudget(currentMonth.value, val)
  }
  showBudgetSet.value = false
  uni.showToast({ title: '预算已设置', icon: 'success' })
}

function goStats() {
  const m = currentMonth.value === 'all' ? '' : currentMonth.value
  uni.navigateTo({ url: `/pages/bill/stats?month=${m}` })
}
function goTrash() {
  uni.navigateTo({ url: '/pages/bill/trash' })
}

// ==================== 格式化 ====================
function formatDateLabel(dateStr) {
  if (!dateStr) return '未知日期'
  const d = new Date(dateStr)
  if (currentMonth.value === 'all') {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diff = Math.round((today - target) / 86400000)
  if (diff === 0) return '今天'
  if (diff === 1) return '昨天'
  if (diff === 2) return '前天'
  const weekDay = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]
  return `${d.getMonth() + 1}月${d.getDate()}日 ${weekDay}`
}
</script>

<template>
  <view class="bill-page">
    <!-- 概览卡片 -->
    <view class="summary-card">
      <view class="summary-row">
        <view class="summary-item" @tap="setFilterType(0)">
          <text class="sum-label">支出</text>
          <text class="sum-value expense">¥{{ stats.expense.toFixed(2) }}</text>
        </view>
        <view class="summary-item" @tap="setFilterType(1)">
          <text class="sum-label">收入</text>
          <text class="sum-value income">+¥{{ stats.income.toFixed(2) }}</text>
        </view>
      </view>
      <view class="balance-row">
        <view class="balance-divider" />
        <text class="balance-label">{{ stats.balance >= 0 ? '结余' : '超支' }}</text>
        <text class="balance-num" :class="stats.balance >= 0 ? 'positive' : 'negative'">
          {{ stats.balance >= 0 ? '+' : '' }}¥{{ stats.balance.toFixed(2) }}
        </text>
        <view class="balance-divider" />
      </view>
      <!-- 预算进度 -->
      <view class="budget-section" v-if="budget > 0 && currentMonth !== 'all'" @tap="openBudgetSet">
        <view class="budget-info">
          <text class="budget-label">预算 ¥{{ budget.toFixed(0) }}</text>
          <text class="budget-pct" :class="{ over: stats.budgetUsed >= 100 }">{{ Math.round(stats.budgetUsed) }}%</text>
        </view>
        <view class="budget-bar-wrap">
          <view class="budget-bar" :class="{ pulse: stats.budgetUsed >= 100 }"
            :style="{ width: Math.min(100, stats.budgetUsed) + '%', background: stats.budgetUsed >= 100 ? '#EF4444' : stats.budgetUsed >= 80 ? '#E8A838' : '#18181B' }" />
        </view>
      </view>
      <view class="budget-set-hint" v-else-if="currentMonth !== 'all'" @tap="openBudgetSet">
        <text class="budget-hint-text">点击设置月度预算</text>
      </view>
      <!-- 统计入口 -->
      <view class="stats-link" @tap="goStats">
        <text class="stats-link-text">收支统计</text>
        <text class="stats-link-arrow">→</text>
      </view>
    </view>

    <!-- 工具栏：搜索 + 时间 + 类型 + 回收站 -->
    <view class="toolbar">
      <view class="search-input-wrap">
        <text class="search-icon">🔍</text>
        <input v-model="searchKeyword" class="search-input" placeholder="搜索账单..." confirm-type="search" />
        <text v-if="searchKeyword" class="search-clear" @tap="clearSearch">✕</text>
      </view>
      <view class="tool-btns">
        <view class="tool-btn" @tap="showTimePicker = !showTimePicker">
          <text class="tool-label">{{ currentMonthLabel }}</text>
          <text class="tool-arrow" :class="{ up: showTimePicker }">▼</text>
        </view>
        <view class="tool-btn" @tap="showCatPicker = !showCatPicker">
          <text class="tool-label">{{ filterType === -1 ? '全部' : filterType === 0 ? '支出' : '收入' }}</text>
          <text class="tool-arrow" :class="{ up: showCatPicker }">▼</text>
        </view>
        <view class="tool-btn" @tap="goTrash">
          <text class="tool-label">🗑</text>
        </view>
      </view>
    </view>

    <!-- 时间选择 -->
    <view class="picker-panel" v-if="showTimePicker">
      <scroll-view class="chip-scroll" scroll-x>
        <view v-for="m in months" :key="m.key" class="chip" :class="{ active: currentMonth === m.key }" @tap="switchMonth(m.key)">
          <text>{{ m.label }}</text>
        </view>
      </scroll-view>
    </view>

    <!-- 类型+分类选择 -->
    <view class="picker-panel" v-if="showCatPicker">
      <view class="type-row">
        <view class="type-chip" :class="{ active: filterType === -1 }" @tap="setFilterType(-1)">全部</view>
        <view class="type-chip" :class="{ active: filterType === 0 }" @tap="setFilterType(0)">支出</view>
        <view class="type-chip" :class="{ active: filterType === 1 }" @tap="setFilterType(1)">收入</view>
      </view>
      <scroll-view class="chip-scroll" scroll-x v-if="currentCategories.length > 0">
        <view class="chip" :class="{ active: filterCategory === '' }" @tap="filterCategory = ''"><text>全部分类</text></view>
        <view v-for="cat in currentCategories" :key="cat.key" class="chip" :class="{ active: filterCategory === cat.key }" @tap="filterCategory = cat.key">
          <text>{{ cat.icon }} {{ cat.key }}</text>
        </view>
      </scroll-view>
    </view>

    <!-- 筛选状态条 -->
    <view class="filter-status" v-if="hasActiveFilter">
      <view class="fs-tags">
        <text class="fs-tag" v-if="searchKeyword">🔍 {{ searchKeyword }} <text class="fs-x" @tap="clearSearch">✕</text></text>
        <text class="fs-tag" v-if="filterType !== -1">{{ filterType === 0 ? '支出' : '收入' }} <text class="fs-x" @tap="filterType = -1">✕</text></text>
        <text class="fs-tag" v-if="filterCategory">{{ filterCategory }} <text class="fs-x" @tap="filterCategory = ''">✕</text></text>
      </view>
      <text class="fs-clear" @tap="resetFilters">清除全部</text>
    </view>

    <!-- 账单列表 -->
    <scroll-view class="bill-scroll" scroll-y>
      <view v-if="groupedBills.length === 0" class="empty-state">
        <text class="empty-text">暂无账单</text>
      </view>
      <view v-else>
        <view v-for="group in groupedBills" :key="group.date" class="bill-group">
          <view class="date-header">
            <text class="date-label">{{ formatDateLabel(group.date) }}</text>
            <view class="date-summary">
              <text v-if="group.dayExpense > 0" class="ds-expense">支出 ¥{{ group.dayExpense.toFixed(0) }}</text>
              <text v-if="group.dayIncome > 0" class="ds-income">收入 ¥{{ group.dayIncome.toFixed(0) }}</text>
            </view>
          </view>
          <view v-for="item in group.items" :key="item.client_id" class="swipe-container">
            <!-- 左滑操作 -->
            <view class="swipe-actions" v-if="swipeItem === item.client_id">
              <view class="swipe-btn edit-btn" @tap.stop="goEdit(item)"><text class="sb-icon">✎</text><text class="sb-text">编辑</text></view>
              <view class="swipe-btn delete-btn" @tap.stop="confirmDelete(item)"><text class="sb-icon">×</text><text class="sb-text">删除</text></view>
            </view>
            <view class="bill-item" :style="{ transform: 'translateX(' + getSwipeOffset(item) + ')' }"
              @touchstart="onTouchStart($event, item)" @touchmove="onTouchMove($event, item)" @touchend="onTouchEnd(item)" @tap="onBillTap(item)">
              <view class="bill-icon-wrap" :style="{ background: (getCategoryInfo(item.category || '').color || '#9E9E9E') + '15' }">
                <text class="bill-icon">{{ getCategoryInfo(item.category || '').icon || '📌' }}</text>
              </view>
              <view class="bill-body">
                <text class="bill-category">{{ item.category || '未分类' }}</text>
                <text class="bill-note" v-if="item.note || item.remark">{{ item.note || item.remark }}</text>
              </view>
              <view class="bill-amount-wrap">
                <text class="bill-amount" :class="(item.type === 'income' || item.type === 1) ? 'income' : 'expense'">
                  {{ (item.type === 'income' || item.type === 1) ? '+' : '-' }}¥{{ (item.amount || 0).toFixed(2) }}
                </text>
              </view>
            </view>
          </view>
        </view>
      </view>
      <view style="height: 160rpx" />
    </scroll-view>

    <!-- FAB -->
    <view class="fab-group">
      <view class="fab fab-income" @tap="goAdd('income')"><text class="fab-icon">+</text><text class="fab-label">收入</text></view>
      <view class="fab fab-expense" @tap="goAdd('expense')"><text class="fab-icon">+</text><text class="fab-label">支出</text></view>
    </view>

    <!-- 预算设置弹窗 -->
    <view class="modal-mask" v-if="showBudgetSet" @tap="showBudgetSet = false">
      <view class="modal-content" @tap.stop>
        <text class="modal-title">设置月度预算</text>
        <view class="modal-input-row">
          <text class="modal-prefix">¥</text>
          <input class="modal-input" type="digit" :value="budgetInput" placeholder="输入预算金额" focus @input="(e) => budgetInput = e.detail.value" />
        </view>
        <view class="modal-quick">
          <text class="quick-val" @tap="budgetInput = '1000'">¥1000</text>
          <text class="quick-val" @tap="budgetInput = '2000'">¥2000</text>
          <text class="quick-val" @tap="budgetInput = '3000'">¥3000</text>
          <text class="quick-val" @tap="budgetInput = '5000'">¥5000</text>
        </view>
        <view class="modal-actions">
          <view class="modal-btn cancel" @tap="showBudgetSet = false">取消</view>
          <view class="modal-btn confirm" @tap="saveBudget">确定</view>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import './index.scss';
</style>
