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
import SijiIcon from '@/components/common/SijiIcon.vue'
import { onShow } from '@dcloudio/uni-app'
import { getBillList, deleteBill } from '@/utils/storage.js'
import { debounce } from '@/utils/debounce.js'
import EmptyState from '@/components/common/EmptyState.vue'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, ALL_CATEGORIES, getCategoryInfo, DANGER_COLOR } from '@/utils/categories.js'

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

// ==================== 分类体系（从 utils/categories.js 引入） ====================
const categoryConfig = {
  expense: EXPENSE_CATEGORIES,
  income: INCOME_CATEGORIES
}

// 扁平化分类查找
const allCategories = computed(() => ALL_CATEGORIES)

function getCatInfo(cat) {
  return getCategoryInfo(cat)
}

// 当前筛选类型下的分类列表
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
  // 排序：日期倒序
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

// TabBar 页面切回时刷新数据（AI 记账后能立即看到）
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

// ==================== 搜索 ====================
const onSearchInput = debounce((e) => {
  searchText.value = e.detail?.value || ''
}, 300)

function clearSearch() {
  searchText.value = ''
}

// ==================== 左滑删除 ====================
const swipeItem = ref(null) // 当前展开滑动的 client_id
const ACTION_WIDTH = 140 // 右侧操作区宽度(rpx→px近似)

/** 点击账单项 */
function onBillTap(bill) {
  // 如果当前有展开的滑动项，先收起
  if (swipeItem.value) {
    swipeItem.value = null
    return
  }
  goEdit(bill)
}

/** touch 开始 */
function onTouchStart(e, bill) {
  swipeStartX.value = e.touches[0].clientX
  swipeStartId.value = bill.client_id
  // 如果点击了其他项，收起当前展开项
  if (swipeItem.value && swipeItem.value !== bill.client_id) {
    swipeItem.value = null
  }
}

/** touch 移动 */
const swipeStartX = ref(0)
const swipeStartId = ref('')
const swipeMoveX = ref(0)
const swipingId = ref('')

function onTouchMove(e, bill) {
  if (swipeStartId.value !== bill.client_id) return
  const dx = e.touches[0].clientX - swipeStartX.value
  if (dx < 0) {
    swipingId.value = bill.client_id
    swipeMoveX.value = Math.max(-ACTION_WIDTH, dx)
  }
}

/** touch 结束 */
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

/** 获取滑动偏移量 */
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
  uni.setStorageSync(`budget_${currentMonth.value}`, String(val))
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

function isToday(dateStr) {
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return dateStr === today
}
</script>

<template>
  <view class="bill-page">
    <!-- 概览卡片（两栏数字 + 居中结余 + 预算进度） -->
    <view class="summary-card">
      <!-- 两栏：支出 / 收入 -->
      <view class="summary-row">
        <view class="summary-item">
          <text class="sum-label">支出</text>
          <text class="sum-value expense">¥{{ stats.expense.toFixed(0) }}</text>
        </view>
        <view class="summary-item">
          <text class="sum-label">收入</text>
          <text class="sum-value income">+¥{{ stats.income.toFixed(0) }}</text>
        </view>
      </view>

      <!-- 结余 — 独立行带分隔线 -->
      <view class="balance-row">
        <view class="balance-divider" />
        <view class="balance-text" :class="stats.balance >= 0 ? 'positive' : 'negative'">
          <text class="balance-label">{{ stats.balance >= 0 ? '结余' : '超支' }}</text>
          <text class="balance-num">{{ stats.balance >= 0 ? '+' : '' }}{{ stats.balance.toFixed(0) }}</text>
        </view>
        <view class="balance-divider" />
      </view>

      <!-- 预算进度条 -->
      <view class="budget-section" v-if="budget > 0" @tap="openBudgetSet">
        <view class="budget-info">
          <text class="budget-label">预算 ¥{{ budget.toFixed(0) }}</text>
          <text class="budget-pct" :class="{ over: stats.budgetUsed >= 100 }">{{ Math.round(stats.budgetUsed) }}%</text>
        </view>
        <view class="budget-bar-wrap">
          <view
            class="budget-bar"
            :class="{ pulse: stats.budgetUsed >= 100 }"
            :style="{
              width: Math.min(100, stats.budgetUsed) + '%',
              background: stats.budgetUsed >= 100 ? 'var(--color-red)' : stats.budgetUsed >= 80 ? 'var(--color-amber)' : 'var(--color-plan)'
            }"
          />
        </view>
        <text class="budget-percent" :class="{ over: stats.budgetUsed >= 100 }">
          {{ stats.budgetUsed }}%{{ stats.budgetUsed >= 100 ? ' 已超支' : '' }}
        </text>
      </view>

      <!-- 未设置预算 -->
      <view class="budget-set-hint" v-else @tap="openBudgetSet">
        <view class="budget-hint"><SijiIcon name="tip" size="sm" class="budget-hint-icon" /><text class="budget-hint-text">点击设置月度预算，掌控消费</text></view>
      </view>
    </view>

    <!-- 月份切换 -->
    <scroll-view class="month-bar" scroll-x>
      <view class="month-list">
        <view
          v-for="m in months" :key="m.key"
          class="month-item" :class="{ active: currentMonth === m.key }"
          @tap="switchMonth(m.key)"
        >
          {{ m.label }}
        </view>
        <view class="month-item more-btn" @tap="loadMoreMonths">
          ···
        </view>
      </view>
    </scroll-view>

    <!-- 筛选 + 搜索 -->
    <view class="filter-section">
      <view class="type-filter">
        <view class="type-btn" :class="{ active: filterType === -1 }" @tap="filterType = -1; filterCategory = ''">全部</view>
        <view class="type-btn" :class="{ active: filterType === 0 }" @tap="filterType = 0; filterCategory = ''">支出</view>
        <view class="type-btn" :class="{ active: filterType === 1 }" @tap="filterType = 1; filterCategory = ''">收入</view>
      </view>

      <!-- 分类标签横滑 -->
      <scroll-view class="cat-scroll" scroll-x v-if="currentCategories.length > 0">
        <view class="cat-list">
          <view
            class="cat-tag" :class="{ active: filterCategory === '' }"
            @tap="filterCategory = ''"
          >全部</view>
          <view
            v-for="cat in currentCategories" :key="cat.key"
            class="cat-tag" :class="{ active: filterCategory === cat.key }"
            @tap="filterCategory = cat.key"
          >
            {{ cat.icon }} {{ cat.key }}
          </view>
        </view>
      </scroll-view>

      <!-- 搜索框 -->
      <view class="search-box">
        <SijiIcon name="search" size="md" class="search-icon" />
        <input
          class="search-input"
          type="text"
          placeholder="搜索备注、分类..."
          :value="searchText"
          @input="onSearchInput"
        />
        <text v-if="searchText" class="search-clear" @tap="clearSearch">✕</text>
      </view>
    </view>

    <!-- 账单列表（按日期分组） -->
    <scroll-view class="bill-scroll" scroll-y>
      <EmptyState
        v-if="filteredBills.length === 0"
        icon="bill"
        title="暂无账单"
        description="点击右下角按钮快速记一笔"
      />

      <view v-else class="bill-list">
        <view v-for="group in groupedBills" :key="group.date" class="bill-group">
          <!-- 日期头 -->
          <view class="date-header">
            <text class="date-label">{{ formatDateLabel(group.date) }}</text>
            <view class="date-summary">
              <text v-if="group.dayExpense > 0" class="ds-expense">支出 ¥{{ group.dayExpense.toFixed(0) }}</text>
              <text v-if="group.dayIncome > 0" class="ds-income">收入 ¥{{ group.dayIncome.toFixed(0) }}</text>
            </view>
          </view>

          <!-- 当日账单 -->
          <view
            v-for="item in group.items" :key="item.client_id"
            class="swipe-container"
          >
            <!-- 右侧操作按钮 -->
            <view class="swipe-actions" v-if="swipeItem === item.client_id">
              <view class="swipe-btn edit-btn" @tap.stop="goEdit(item)">
                <text class="sb-text">编辑</text>
              </view>
              <view class="swipe-btn delete-btn" @tap.stop="confirmDelete(item)">
                <text class="sb-text">删除</text>
              </view>
            </view>
            <!-- 账单项（可滑动） -->
            <view
              class="swipe-content"
              :style="{ transform: 'translateX(' + getSwipeOffset(item) + ')' }"
              @touchstart="onTouchStart($event, item)"
              @touchmove="onTouchMove($event, item)"
              @touchend="onTouchEnd(item)"
              @tap="onBillTap(item)"
            >
              <view class="bill-item">
                <view class="bill-icon-wrap" :style="{ background: getCatInfo(item.category).color + '15' }">
                  <text class="bill-icon">{{ getCatInfo(item.category).icon }}</text>
                </view>
                <view class="bill-body">
                  <text class="bill-category">{{ item.category || '未分类' }}</text>
                  <text class="bill-note" v-if="item.note || item.remark">{{ item.note || item.remark }}</text>
                </view>
                <view class="bill-amount-wrap">
                  <text class="bill-amount" :class="(item.type === 'income' || item.type === 1) ? 'income' : 'expense'">
                    {{ (item.type === 'income' || item.type === 1) ? '+' : '-' }}¥{{ (item.amount || 0).toFixed(2) }}
                  </text>
                  <text class="bill-time" v-if="item.created_at">{{ new Date(item.created_at).toTimeString().substring(0, 5) }}</text>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>

      <view style="height: 120rpx" />
    </scroll-view>

    <!-- 快速记账按钮 -->
    <view class="fab-group">
      <view class="fab fab-income" @tap="goAdd('income')">
        <text class="fab-icon">+</text>
        <text class="fab-label">收入</text>
      </view>
      <view class="fab fab-expense" @tap="goAdd('expense')">
        <text class="fab-icon">+</text>
        <text class="fab-label">支出</text>
      </view>
    </view>

    <!-- 底部统计入口 -->
    <view class="bottom-bar" @tap="goStats">
      <view class="bar-text-row"><SijiIcon name="stats" size="sm" class="bar-icon" /><text class="bar-text">收支统计分析</text></view>
      <text class="bar-arrow">→</text>
    </view>

    <!-- 预算设置弹窗 -->
    <view class="modal-mask" v-if="showBudgetSet" @tap="showBudgetSet = false">
      <view class="modal-content" @tap.stop>
        <text class="modal-title">设置 {{ currentMonth }} 月预算</text>
        <view class="modal-input-row">
          <text class="modal-prefix">¥</text>
          <input
            class="modal-input"
            type="digit"
            v-model="budgetInput"
            placeholder="输入预算金额"
            focus
          />
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
.bill-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: $bg-page;
}

/* 概览卡片 */
.summary-card {
  margin: $spacing-sm $spacing-md;
  padding: $spacing-lg $spacing-md $spacing-md;
  background: var(--bg-card);
  border-radius: $radius-lg;
  box-shadow: $shadow-sm;
}

.summary-row {
  display: flex;
  align-items: baseline;
  gap: $spacing-md;
}

.summary-item {
  flex: 1;
  text-align: center;

  .sum-label {
    font-size: $font-xs;
    color: var(--text-hint);
  }

  .sum-value {
    font-size: 56rpx;
    font-weight: 800;
    display: block;
    margin-top: 4rpx;
    font-variant-numeric: tabular-nums;
    letter-spacing: -1rpx;

    &.expense { color: var(--color-danger); }
    &.income { color: var(--color-plan); }
  }
}

/* 结余行 — 居中分隔 */
.balance-row {
  display: flex;
  align-items: center;
  margin-top: $spacing-sm;
  padding: $spacing-sm 0;
}

.balance-divider {
  flex: 1;
  height: 1rpx;
  background: var(--border-color);
}

.balance-text {
  padding: 0 $spacing-md;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rpx;

  .balance-label {
    font-size: $font-xs;
    color: var(--text-hint);
  }

  .balance-num {
    font-size: 36rpx;
    font-weight: 700;
    color: var(--text-primary);
  }

  &.positive .balance-num { color: var(--color-plan); }
  &.negative .balance-num { color: var(--color-danger); }
}

/* 预算 */
.budget-section {
  margin-top: $spacing-md;
  padding-top: $spacing-md;
  border-top: 1rpx solid var(--border-color);

  .budget-info {
    display: flex;
    justify-content: space-between;
    margin-bottom: 6rpx;

    .budget-label {
      font-size: $font-xs;
      color: var(--text-hint);
    }

    .budget-pct {
      font-size: $font-xs;
      font-weight: 700;
      color: var(--text-secondary);

      &.over {
        color: var(--color-red);
        animation: budgetPulse 1.5s ease-in-out infinite;
      }
    }
  }

  .budget-bar-wrap {
    height: 10rpx;
    background: var(--bg-input);
    border-radius: 5rpx;
    overflow: hidden;
  }

  .budget-bar {
    height: 100%;
    border-radius: 5rpx;
    transition: width 0.5s $transition-normal;
  }

  .budget-bar.pulse {
    animation: budgetPulse 1.5s ease-in-out infinite;
  }

  @keyframes budgetPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  .budget-percent {
    font-size: 18rpx;
    color: rgba(255, 255, 255, 0.6);
    display: block;
    text-align: right;
    margin-top: 4rpx;

    &.over { color: var(--color-pink); }
  }
}

.budget-set-hint {
  margin-top: $spacing-sm;
  padding-top: $spacing-sm;
  border-top: 1rpx solid var(--border-color);
  text-align: center;

  .budget-hint-text {
    font-size: $font-xs;
    color: rgba(255, 255, 255, 0.6);
  }
}

/* 月份切换 */
.month-bar {
  flex-shrink: 0;
  padding: 0 $spacing-md;
  margin-bottom: $spacing-xs;

  .month-list {
    display: flex;
    gap: $spacing-xs;
  }

  .month-item {
    flex-shrink: 0;
    padding: 8rpx 24rpx;
    border-radius: 32rpx;
    font-size: $font-sm;
    background: $bg-card;
    color: $text-secondary;

    &.active {
      background: var(--color-ai);
      color: var(--text-on-ai);
      font-weight: 600;
    }

    &.more-btn {
      color: var(--text-hint);
      letter-spacing: 2rpx;
      font-weight: 700;
    }
  }
}

/* 筛选区 */
.filter-section {
  padding: 0 $spacing-md;
  margin-bottom: $spacing-xs;
}

.type-filter {
  display: flex;
  gap: $spacing-xs;
  margin-bottom: $spacing-xs;

  .type-btn {
    flex: 1;
    text-align: center;
    padding: 10rpx 0;
    border-radius: $radius-sm;
    font-size: $font-xs;
    background: $bg-card;
    color: $text-secondary;

    &.active {
      background: var(--color-ai);
      color: var(--text-on-ai);
      font-weight: 600;
      ;
    }
  }
}

/* 分类标签 */
.cat-scroll {
  margin-bottom: $spacing-xs;
}

.cat-list {
  display: flex;
  gap: $spacing-xs;
  padding: 2rpx 0;
}

.cat-tag {
  flex-shrink: 0;
  padding: 6rpx 18rpx;
  border-radius: 32rpx;
  font-size: 20rpx;
  background: $bg-card;
  color: $text-secondary;
  white-space: nowrap;

  &.active {
    background: var(--color-ai);
    color: var(--text-on-ai);
  }
}

/* 搜索框 */
.search-box {
  display: flex;
  align-items: center;
  background: $bg-card;
  border-radius: $radius-round;
  padding: 8rpx $spacing-md;
  margin-bottom: $spacing-xs;

  .search-icon {
    font-size: $font-sm;
    margin-right: $spacing-xs;
  }

  .search-input {
    flex: 1;
    font-size: $font-sm;
    color: $text-primary;
  }

  .search-clear {
    font-size: $font-sm;
    color: $text-hint;
    padding: 0 8rpx;
  }
}

/* 账单列表 */
.bill-scroll {
  flex: 1;
  padding: 0 $spacing-md;
}

.bill-group {
  margin-bottom: $spacing-sm;
}

.date-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-xs 0;

  .date-label {
    font-size: $font-xs;
    font-weight: 700;
    color: $text-secondary;
  }

  .date-summary {
    display: flex;
    gap: $spacing-sm;

    .ds-expense {
      font-size: 18rpx;
      color: $danger;
    }

    .ds-income {
      font-size: 18rpx;
      color: $success;
    }
  }
}

/* 左滑容器 */
.swipe-container {
  position: relative;
  overflow: hidden;
  margin-bottom: 2rpx;
  border-radius: $radius-md;
}

/* 右侧操作区 */
.swipe-actions {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  display: flex;
  z-index: 1;
}

.swipe-btn {
  width: 140rpx;
  display: flex;
  align-items: center;
  justify-content: center;

  &.edit-btn {
    background: var(--color-ai);
  }

  &.delete-btn {
    background: var(--color-red);
  }

  .sb-text {
    color: var(--text-on-ai);
    font-size: $font-sm;
    font-weight: 600;
  }
}

/* 滑动内容 */
.swipe-content {
  position: relative;
  z-index: 2;
  transition: transform 0.25s ease;
  background: $bg-card;
  border-radius: $radius-md;

  &:active { background: $bg-input; }
}

/* 账单项 */
.bill-item {
  display: flex;
  align-items: center;
  padding: $spacing-sm;
}

.bill-icon-wrap {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: $spacing-sm;
  flex-shrink: 0;
}

.bill-icon {
  font-size: 32rpx;
}

.bill-body {
  flex: 1;
  min-width: 0;

  .bill-category {
    font-size: $font-md;
    color: $text-primary;
    display: block;
    font-weight: 600;
  }

  .bill-note {
    font-size: $font-xs;
    color: $text-hint;
    display: block;
    margin-top: 2rpx;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.bill-amount-wrap {
  text-align: right;
  flex-shrink: 0;

  .bill-amount {
    font-size: $font-lg;
    font-weight: 700;

    &.expense { color: $danger; }
    &.income { color: $success; }
  }

  .bill-time {
    font-size: 18rpx;
    color: $text-hint;
    display: block;
  }
}

/* 快速记账按钮组 — 入场动画 */
.fab-group {
  position: fixed;
  right: $spacing-md;
  bottom: 120rpx;
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
  z-index: 100;
  animation: fabIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

@keyframes fabIn {
  from { opacity: 0; transform: scale(0); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes fabIdle {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4rpx); }
}

.fab {
  width: 96rpx;
  height: 96rpx;
  border-radius: $radius-round;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: $shadow-lg;
  transition: transform $transition-fast;
  animation: fabIdle 2.5s ease-in-out infinite;

  &:active { transform: scale(0.92); }

  &.fab-expense {
    background: var(--color-ai);
    box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.12);
  }

  &.fab-income {
    background: var(--text-strong);
    box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.08);
  }

  .fab-icon {
    font-size: 32rpx;
    color: var(--text-on-ai);
    font-weight: 300;
    line-height: 1;
  }

  .fab-label {
    font-size: 18rpx;
    color: var(--text-on-ai);
    margin-top: 2rpx;
  }
}

/* 底部统计入口 */
.bottom-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $spacing-sm $spacing-md;
  background: $bg-card;
  border-top: 1rpx solid rgba(0, 0, 0, 0.05);

  .bar-text {
    font-size: $font-sm;
    color: $accent;
  }

  .bar-arrow {
    font-size: $font-md;
    color: $accent;
    margin-left: $spacing-xs;
  }
}

/* 预算弹窗 */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-content {
  width: 600rpx;
  background: $bg-card;
  border-radius: $radius-lg;
  padding: $spacing-lg;

  .modal-title {
    font-size: $font-lg;
    font-weight: 700;
    color: $text-primary;
    display: block;
    text-align: center;
    margin-bottom: $spacing-md;
  }
}

.modal-input-row {
  display: flex;
  align-items: center;
  background: $bg-input;
  border-radius: $radius-md;
  padding: $spacing-sm $spacing-md;
  margin-bottom: $spacing-sm;

  .modal-prefix {
    font-size: $font-xl;
    color: $text-secondary;
    margin-right: $spacing-xs;
  }

  .modal-input {
    flex: 1;
    font-size: $font-xl;
    color: $text-primary;
    font-weight: 700;
  }
}

.modal-quick {
  display: flex;
  justify-content: space-between;
  margin-bottom: $spacing-md;

  .quick-val {
    font-size: $font-xs;
    color: $accent;
    padding: 8rpx 20rpx;
    background: rgba(0, 0, 0, 0.04);
    border-radius: $radius-round;
  }
}

.modal-actions {
  display: flex;
  gap: $spacing-sm;

  .modal-btn {
    flex: 1;
    text-align: center;
    padding: 16rpx 0;
    border-radius: $radius-md;
    font-size: $font-md;
    font-weight: 600;

    &.cancel {
      background: $bg-input;
      color: $text-secondary;
    }

    &.confirm {
      background: var(--color-ai);
      color: var(--text-on-ai);
    }
  }
}
</style>
