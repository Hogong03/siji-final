<script setup>
/**
 * 账单列表页 — 增强版
 *
 * 功能：
 *  ① 月度概览（收支/结余/预算进度）
 *  ② 月份切换 + 类型筛选 + 分类筛选
 *  ③ 按日期分组的账单列表
 *  ④ 搜索备注关键词
 *  ⑤ 左滑删除、点击编辑
 *  ⑥ 快速记账浮动按钮
 *  ⑦ 预算设置入口
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getBillList, deleteBill } from '@/utils/storage.js'
import { asyncSetStorage } from '@/utils/store-helpers.js'
import { debounce } from '@/utils/debounce.js'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, ALL_CATEGORIES, DANGER_COLOR } from '@/utils/categories.js'

import BillStats from '@/components/bill/BillStats.vue'
import BillMonthBar from '@/components/bill/BillMonthBar.vue'
import BillFilterBar from '@/components/bill/BillFilterBar.vue'
import BillList from '@/components/bill/BillList.vue'
import BillFabGroup from '@/components/bill/BillFabGroup.vue'
import BillBottomBar from '@/components/bill/BillBottomBar.vue'
import BillBudgetModal from '@/components/bill/BillBudgetModal.vue'

// ==================== 数据 ====================
const bills = ref([])
const currentMonth = ref('')
const filterType = ref(-1)    // -1=全部 0=支出 1=收入
const filterCategory = ref('') // ''=全部分类
const searchText = ref('')
const loading = ref(false)
const budget = ref(0)          // 月度预算
const showBudgetSet = ref(false)
const budgetInput = ref('')

// 月份列表（动态扩展，初始 6 个月）
const monthList = ref([])
const months = computed(() => monthList.value)

function initMonths() {
  const list = []
  const now = new Date()
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    list.push({ key, label: `${d.getMonth() + 1}月`, year: d.getFullYear() })
  }
  monthList.value = list
}

function loadMoreMonths() {
  const list = monthList.value
  const last = list[list.length - 1]
  if (!last) return
  const d = new Date(last.year, parseInt(last.key.split('-')[1]) - 2, 1)
  for (let i = 0; i < 6; i++) {
    const dd = new Date(d.getFullYear(), d.getMonth() - i, 1)
    const key = `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}`
    if (!list.find(m => m.key === key)) {
      list.push({ key, label: `${dd.getMonth() + 1}月`, year: dd.getFullYear() })
    }
  }
}

// ==================== 分类体系 ====================
const currentCategories = computed(() => {
  if (filterType.value === 0) return EXPENSE_CATEGORIES
  if (filterType.value === 1) return INCOME_CATEGORIES
  return ALL_CATEGORIES
})

// ==================== 筛选 & 统计 ====================
const filteredBills = computed(() => {
  let list = bills.value
  if (filterType.value !== -1) {
    list = list.filter(b => {
      const bType = b.type === 'income' ? 1 : 0
      return bType === filterType.value
    })
  }
  if (filterCategory.value) {
    list = list.filter(b => b.category === filterCategory.value)
  }
  if (searchText.value.trim()) {
    const kw = searchText.value.trim().toLowerCase()
    list = list.filter(b =>
      (b.note || b.remark || '').toLowerCase().includes(kw) ||
      (b.category || '').toLowerCase().includes(kw)
    )
  }
  return list
})

const stats = computed(() => {
  let income = 0, expense = 0
  bills.value.forEach(b => {
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

// ==================== 生命周期 ====================
onMounted(() => {
  initMonths()
  currentMonth.value = months.value[0]?.key || ''
  loadBudget()
  loadBills()
})

onUnmounted(() => {
  onSearchInput.cancel()
})

onShow(() => {
  loadBills()
})

function loadBills() {
  loading.value = true
  try { bills.value = getBillList(currentMonth.value) }
  finally { loading.value = false }
}

function loadBudget() {
  const raw = uni.getStorageSync(`budget_${currentMonth.value}`)
  budget.value = raw ? parseFloat(raw) : 0
}

function switchMonth(key) {
  currentMonth.value = key
  filterCategory.value = ''
  loadBudget()
  loadBills()
}

// ==================== 筛选交互 ====================
function setFilterType(type) {
  filterType.value = type
  filterCategory.value = ''
}

// ==================== 搜索 ====================
const onSearchInput = debounce((value) => {
  searchText.value = value || ''
}, 300)

function clearSearch() {
  searchText.value = ''
}

// ==================== 左滑删除 ====================
const swipeItem = ref(null)
const ACTION_WIDTH = 140

function onBillTap(bill) {
  if (swipeItem.value) {
    swipeItem.value = null
    return
  }
  goEdit(bill)
}

const swipeStartX = ref(0)
const swipeStartId = ref('')
const swipeMoveX = ref(0)
const swipingId = ref('')

function onTouchStart(e, bill) {
  swipeStartX.value = e.touches[0].clientX
  swipeStartId.value = bill.client_id
  if (swipeItem.value && swipeItem.value !== bill.client_id) {
    swipeItem.value = null
  }
}

function onTouchMove(e, bill) {
  if (swipeStartId.value !== bill.client_id) return
  const dx = e.touches[0].clientX - swipeStartX.value
  if (dx < 0) {
    swipingId.value = bill.client_id
    swipeMoveX.value = Math.max(-ACTION_WIDTH, dx)
  }
}

function onTouchEnd(bill) {
  if (swipingId.value !== bill.client_id) return
  if (swipeMoveX.value < -ACTION_WIDTH / 2) {
    swipeItem.value = bill.client_id
  } else {
    swipeItem.value = null
  }
  swipingId.value = ''
  swipeMoveX.value = 0
}

function getSwipeOffset(bill) {
  if (swipingId.value === bill.client_id) {
    return swipeMoveX.value + 'px'
  }
  if (swipeItem.value === bill.client_id) {
    return -ACTION_WIDTH + 'px'
  }
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
  uni.navigateTo({
    url: `/pages/bill/edit?id=${bill.client_id}&month=${month}`
  })
}

function goAdd(type) {
  uni.navigateTo({
    url: `/pages/bill/edit?type=${type || 'expense'}&month=${currentMonth.value}`
  })
}

// ==================== 预算 ====================
function openBudgetSet() {
  budgetInput.value = budget.value > 0 ? String(budget.value) : ''
  showBudgetSet.value = true
}

function saveBudget() {
  const val = parseFloat(budgetInput.value) || 0
  budget.value = val
  asyncSetStorage(`budget_${currentMonth.value}`, String(val))
  showBudgetSet.value = false
  uni.showToast({ title: '预算已设置', icon: 'success' })
}

function goStats() {
  uni.navigateTo({ url: `/pages/bill/stats?month=${currentMonth.value}` })
}

// ==================== 格式化 ====================
function formatDateLabel(dateStr) {
  if (!dateStr) return '未知日期'
  const d = new Date(dateStr)
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
    <BillStats
      :income="stats.income"
      :expense="stats.expense"
      :balance="stats.balance"
      :budget-used="stats.budgetUsed"
      :budget="budget"
      @open-budget-set="openBudgetSet"
    />

    <BillMonthBar
      :months="months"
      :current-month="currentMonth"
      @switch-month="switchMonth"
      @load-more="loadMoreMonths"
    />

    <BillFilterBar
      :filter-type="filterType"
      :filter-category="filterCategory"
      :search-text="searchText"
      :current-categories="currentCategories"
      @update:filter-type="setFilterType"
      @update:filter-category="filterCategory = $event"
      @search-input="onSearchInput"
      @clear-search="clearSearch"
    />

    <BillList
      :grouped-bills="groupedBills"
      :swipe-item="swipeItem"
      :get-swipe-offset="getSwipeOffset"
      :format-date-label="formatDateLabel"
      @bill-tap="onBillTap"
      @edit="goEdit"
      @delete="confirmDelete"
      @touch-start="onTouchStart"
      @touch-move="onTouchMove"
      @touch-end="onTouchEnd"
    />

    <BillFabGroup @add="goAdd" />

    <BillBottomBar @go-stats="goStats" />

    <BillBudgetModal
      v-model="budgetInput"
      :show="showBudgetSet"
      :current-month="currentMonth"
      @close="showBudgetSet = false"
      @save="saveBudget"
    />
  </view>
</template>

<style lang="scss" scoped>
.bill-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: $bg-page;
}
</style>
