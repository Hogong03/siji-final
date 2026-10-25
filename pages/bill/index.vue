<script setup>
/**
 * 账单列表页 — 5.0 统一工具栏版
 *
 * 结构：概览卡片 → 工具栏(搜索+时间+类型+回收站) → 内容 → FAB
 * 搜索+时间+类型+分类 四维 AND 筛选，支持跨月搜索
 *
 * 拆分：useBillList（数据+筛选+统计）+ useBillSwipe（左滑手势）
 */
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { deleteBill, setMonthlyBudget } from '@/utils/storage.js'
import { getCategoryInfo } from '@/utils/categories.js'
import { useBillList } from './composables/useBillList.js'
import { useBillSwipe } from './composables/useBillSwipe.js'
import EmptyState from '@/components/common/EmptyState.vue'
import CountUp from '@/components/common/CountUp.vue'
import { useTheme } from '@/composables/useTheme.js'
import { seriesColor } from '@/utils/chart-theme.js'
import { hapticLight, hapticSelect, hapticSuccess } from '@/utils/haptic.js'

const { isDark } = useTheme()

const showTimePicker = ref(false)
const showCatPicker = ref(false)
const showBudgetSet = ref(false)
const budgetInput = ref('')

const {
  allBills, currentMonth, filterType, filterCategory, searchKeyword,
  budget, months, currentMonthLabel, currentCategories,
  filteredBills, stats, groupedBills, hasActiveFilter,
  initMonths, loadBills, loadBudget, switchMonth,
  resetFilters, setFilterType, formatDateLabel
} = useBillList()

/** 预算进度条主色：深色卡片上 #18181B 等于隐形，统一交给 chart-theme 反白 */
const budgetBarColor = computed(() => {
  const used = stats.value?.budgetUsed || 0
  if (used >= 100) return '#EF4444'
  if (used >= 80) return '#E8A838'
  return seriesColor('#18181B', isDark.value)
})

function handleDelete(bill) {
  const month = bill.bill_date ? bill.bill_date.substring(0, 7) : currentMonth.value
  deleteBill(bill.client_id, month)
  loadBills()
  uni.showToast({ title: '已删除', icon: 'success' })
}

const {
  swipeItem, onTouchStart, onTouchMove, onTouchEnd,
  getSwipeOffset, confirmDelete
} = useBillSwipe(handleDelete)

function onBillTap(bill) {
  if (swipeItem.value) { swipeItem.value = null; return }
  goEdit(bill)
}

function clearSearch() { searchKeyword.value = '' }

// ==================== 生命周期 ====================
onMounted(() => {
  initMonths()
  currentMonth.value = months.value[1]?.key || ''
  loadBudget()
  loadBills()
})

onShow(() => loadBills())

// ==================== 导航 ====================
function goEdit(bill) {
  const month = bill.bill_date ? bill.bill_date.substring(0, 7) : currentMonth.value
  uni.navigateTo({ url: `/pages/bill/edit?id=${bill.client_id}&month=${month}` })
}
function goAdd(type) {
  hapticLight()
  uni.navigateTo({ url: `/pages/bill/edit?type=${type || 'expense'}&month=${currentMonth.value === 'all' ? '' : currentMonth.value}` })
}
function goStats() {
  const m = currentMonth.value === 'all' ? '' : currentMonth.value
  uni.navigateTo({ url: `/pages/bill/stats?month=${m}` })
}
function goTrash() {
  uni.navigateTo({ url: '/pages/bill/trash' })
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
  hapticSuccess()
  uni.showToast({ title: '预算已设置', icon: 'success' })
}

// ==================== 筛选 / 弹层反馈（4.47 灵动性） ====================
function toggleTimePicker() {
  showTimePicker.value = !showTimePicker.value
  if (showTimePicker.value) showCatPicker.value = false
  hapticLight()
}
function toggleCatPicker() {
  showCatPicker.value = !showCatPicker.value
  if (showCatPicker.value) showTimePicker.value = false
  hapticLight()
}
function onSwitchMonth(key) { hapticLight(); switchMonth(key) }
function onSetFilterType(t) { hapticLight(); setFilterType(t) }
function onPickCategory(cat) { hapticSelect(); filterCategory.value = cat }
function pickQuick(v) { hapticSelect(); budgetInput.value = String(v) }
</script>

<template>
  <view class="bill-page page-enter">
    <!-- 概览卡片 -->
    <view class="summary-card">
      <view class="summary-row">
        <view class="summary-item" @tap="setFilterType(0)">
          <text class="sum-label">支出</text>
          <CountUp class="sum-value expense" :value="stats.expense" :decimals="2" prefix="¥" />
        </view>
        <view class="summary-item" @tap="setFilterType(1)">
          <text class="sum-label">收入</text>
          <CountUp class="sum-value income" :value="stats.income" :decimals="2" prefix="+¥" />
        </view>
      </view>
      <view class="balance-row">
        <view class="balance-divider" />
        <text class="balance-label">{{ stats.balance >= 0 ? '结余' : '超支' }}</text>
        <CountUp class="balance-num" :class="stats.balance >= 0 ? 'positive' : 'negative'"
          :value="stats.balance" :decimals="2" :prefix="stats.balance >= 0 ? '+¥' : '¥'" />
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
            :style="{ width: Math.min(100, stats.budgetUsed) + '%', background: budgetBarColor }" />
        </view>
      </view>
      <view class="budget-set-hint" v-else-if="currentMonth !== 'all'" @tap="openBudgetSet">
        <!-- 4.18.0：无预算时与收支统计合并一行，卡片下半不再空出一行淡字 -->
        <text class="budget-hint-text">点击设置月度预算</text>
        <view class="stats-link-inline" @tap.stop="goStats">
          <text class="stats-link-text">收支统计</text>
          <text class="stats-link-arrow">→</text>
        </view>
      </view>
      <!-- 统计入口（有预算时预算进度占一行，收支统计另起一行；全部视图始终显示） -->
      <view class="stats-link" v-if="currentMonth === 'all' || budget > 0" @tap="goStats">
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
        <view class="tool-btn" @tap="toggleTimePicker">
          <text class="tool-label">{{ currentMonthLabel }}</text>
          <text class="tool-arrow" :class="{ up: showTimePicker }">▼</text>
        </view>
        <view class="tool-btn" @tap="toggleCatPicker">
          <text class="tool-label">{{ filterType === -1 ? '全部' : filterType === 0 ? '支出' : '收入' }}</text>
          <text class="tool-arrow" :class="{ up: showCatPicker }">▼</text>
        </view>
        <view class="tool-btn" @tap="goTrash">
          <text class="tool-label">🗑</text>
        </view>
      </view>
    </view>

    <!-- 时间选择 -->
    <view class="picker-panel panel-in" v-if="showTimePicker">
      <scroll-view class="chip-scroll" scroll-x>
        <view v-for="m in months" :key="m.key" class="chip chip-transition" :class="{ active: currentMonth === m.key }" @tap="onSwitchMonth(m.key)">
          <text>{{ m.label }}</text>
        </view>
      </scroll-view>
    </view>

    <!-- 类型+分类选择 -->
    <view class="picker-panel panel-in" v-if="showCatPicker">
      <view class="type-row">
        <view class="type-chip chip-transition" :class="{ active: filterType === -1 }" @tap="onSetFilterType(-1)">全部</view>
        <view class="type-chip chip-transition" :class="{ active: filterType === 0 }" @tap="onSetFilterType(0)">支出</view>
        <view class="type-chip chip-transition" :class="{ active: filterType === 1 }" @tap="onSetFilterType(1)">收入</view>
      </view>
      <scroll-view class="chip-scroll" scroll-x v-if="currentCategories.length > 0">
        <view class="chip chip-transition" :class="{ active: filterCategory === '' }" @tap="onPickCategory('')"><text>全部分类</text></view>
        <view v-for="cat in currentCategories" :key="cat.key" class="chip chip-transition" :class="{ active: filterCategory === cat.key }" @tap="onPickCategory(cat.key)">
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
      <EmptyState v-if="groupedBills.length === 0" icon="bill" title="暂无账单" />
      <view v-else class="card-list-stagger">
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
              <view class="bill-icon-wrap" :style="{ background: (getCategoryInfo(item.category || '').color || '#9E9E9E') + '26' }">
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
    <view class="fab-group fab-in">
      <view class="fab fab-income" @tap="goAdd('income')"><text class="fab-icon">+</text><text class="fab-label">收入</text></view>
      <view class="fab fab-expense" @tap="goAdd('expense')"><text class="fab-icon">+</text><text class="fab-label">支出</text></view>
    </view>

    <!-- 预算设置弹窗 -->
    <view class="modal-mask mask-in" v-if="showBudgetSet" @tap="showBudgetSet = false">
      <view class="modal-content modal-pop" @tap.stop>
        <text class="modal-title">设置月度预算</text>
        <view class="modal-input-row">
          <text class="modal-prefix">¥</text>
          <input class="modal-input" type="digit" :value="budgetInput" placeholder="输入预算金额" focus @input="(e) => budgetInput = e.detail.value" />
        </view>
        <view class="modal-quick">
          <text class="quick-val btn-tactile" @tap="pickQuick(1000)">¥1000</text>
          <text class="quick-val btn-tactile" @tap="pickQuick(2000)">¥2000</text>
          <text class="quick-val btn-tactile" @tap="pickQuick(3000)">¥3000</text>
          <text class="quick-val btn-tactile" @tap="pickQuick(5000)">¥5000</text>
        </view>
        <view class="modal-actions">
          <view class="modal-btn cancel btn-tactile" @tap="showBudgetSet = false">取消</view>
          <view class="modal-btn confirm btn-tactile" @tap="saveBudget">确定</view>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import './index.scss';
</style>
