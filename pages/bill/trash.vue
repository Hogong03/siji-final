<script setup>
/**
 * 账单回收站 — 已删除账单恢复
 * 结构与 diary/trash.vue 一致：搜索 + 时间筛选 + 列表
 */
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getDeletedBills, restoreBill, purgeBill } from '@/utils/storage.js'
import { getCategoryInfo, DANGER_COLOR } from '@/utils/categories.js'

const allList = ref([])
const currentMonth = ref('')
const months = ref([])
const searchKeyword = ref('')
const showTimePicker = ref(false)

onMounted(() => {
  const now = new Date()
  const list = [{ key: 'all', label: '全部时间' }]
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    list.push({ key, label: `${d.getFullYear()}年${d.getMonth() + 1}月` })
  }
  months.value = list
  currentMonth.value = list[1]?.key || ''
  loadData()
})
onShow(() => loadData())

function loadData() {
  if (currentMonth.value === 'all') {
    const all = []
    for (const m of months.value) {
      if (m.key === 'all') continue
      const items = getDeletedBills(m.key)
      all.push(...items)
    }
    allList.value = all.sort((a, b) => (b.bill_date || '').localeCompare(a.bill_date || ''))
  } else {
    allList.value = getDeletedBills(currentMonth.value)
  }
}

function switchMonth(key) {
  currentMonth.value = key
  loadData()
  showTimePicker.value = false
}

function clearSearch() { searchKeyword.value = '' }

const currentMonthLabel = computed(() => {
  const m = months.value.find(m => m.key === currentMonth.value)
  return m ? m.label : ''
})

const filteredList = computed(() => {
  if (!searchKeyword.value.trim()) return allList.value
  const kw = searchKeyword.value.trim().toLowerCase()
  return allList.value.filter(item =>
    (item.category || '').toLowerCase().includes(kw) ||
    (item.note || item.remark || '').toLowerCase().includes(kw)
  )
})

function formatDate(ts) {
  const d = new Date(ts)
  if (currentMonth.value === 'all') {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

function handleRestore(item) {
  uni.showModal({
    title: '恢复账单',
    content: `恢复 ${item.category} ¥${item.amount.toFixed(2)}？`,
    success: (res) => {
      if (res.confirm) {
        const monthKey = item.bill_date ? item.bill_date.substring(0, 7) : currentMonth.value
        restoreBill(item.client_id, monthKey)
        uni.showToast({ title: '已恢复', icon: 'success' })
        loadData()
      }
    }
  })
}

function handlePurge(item) {
  uni.showModal({
    title: '彻底删除',
    content: `彻底删除 ${item.category} ¥${item.amount.toFixed(2)}？此操作不可恢复。`,
    confirmText: '删除',
    confirmColor: DANGER_COLOR,
    success: (res) => {
      if (res.confirm) {
        const monthKey = item.bill_date ? item.bill_date.substring(0, 7) : currentMonth.value
        purgeBill(item.client_id, monthKey)
        uni.showToast({ title: '已彻底删除', icon: 'success' })
        loadData()
      }
    }
  })
}
</script>

<template>
  <view class="trash-page">
    <!-- 工具栏 -->
    <view class="toolbar">
      <view class="search-input-wrap">
        <text class="search-icon">🔍</text>
        <input v-model="searchKeyword" class="search-input" placeholder="搜索已删除账单..." confirm-type="search" />
        <text v-if="searchKeyword" class="search-clear" @tap="clearSearch">✕</text>
      </view>
      <view class="tool-btns">
        <view class="tool-btn" @tap="showTimePicker = !showTimePicker">
          <text class="tool-label">{{ currentMonthLabel }}</text>
          <text class="tool-arrow" :class="{ up: showTimePicker }">▼</text>
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

    <!-- 搜索状态 -->
    <view class="search-status" v-if="searchKeyword">
      <text class="status-text">搜索「{{ searchKeyword }}」· {{ filteredList.length }} 条结果</text>
      <text class="status-clear" @tap="clearSearch">✕</text>
    </view>

    <!-- 空态 -->
    <view v-if="filteredList.length === 0" class="empty-state">
      <text class="empty-text">回收站是空的</text>
      <text class="empty-sub">删除的账单会在这里保留，可以随时恢复</text>
    </view>

    <!-- 列表 -->
    <scroll-view v-else class="trash-scroll" scroll-y>
      <view v-for="item in filteredList" :key="item.client_id" class="trash-card">
        <view class="card-header">
          <text class="card-date">{{ formatDate(item.bill_date || item.created_at) }}</text>
          <view class="card-amount">
            <text class="amount-sign">{{ (item.type === 'income' || item.type === 1) ? '+' : '-' }}</text>
            <text class="amount-num">¥{{ (item.amount || 0).toFixed(2) }}</text>
          </view>
        </view>
        <view class="card-body">
          <view class="card-cat-wrap">
            <text class="card-cat-icon">{{ getCategoryInfo(item.category || '').icon || '📌' }}</text>
            <text class="card-cat">{{ item.category || '未分类' }}</text>
          </view>
          <text class="card-note" v-if="item.note || item.remark">{{ item.note || item.remark }}</text>
        </view>
        <view class="card-actions">
          <view class="btn-restore" @tap="handleRestore(item)">恢复</view>
          <view class="btn-purge" @tap="handlePurge(item)">彻底删除</view>
        </view>
      </view>
      <view style="height: 60rpx;"></view>
    </scroll-view>
  </view>
</template>

<style scoped lang="scss">
.trash-page { min-height: 100vh; background: #F4F4F5; display: flex; flex-direction: column; }

/* 工具栏 */
.toolbar {
  display: flex;
  align-items: center;
  gap: 8rpx;
  background: #FFFFFF;
  padding: 10rpx 20rpx;
  border-bottom: 1rpx solid #E4E4E7;
  flex-shrink: 0;
}
.search-input-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  background: #F4F4F5;
  border-radius: 32rpx;
  padding: 0 16rpx;
  height: 56rpx;
  .search-icon { font-size: 22rpx; margin-right: 6rpx; color: #A1A1AA; }
  .search-input { flex: 1; font-size: 24rpx; color: #18181B; }
  .search-clear { font-size: 22rpx; color: #A1A1AA; padding: 8rpx; }
}
.tool-btns { display: flex; align-items: center; gap: 4rpx; flex-shrink: 0; }
.tool-btn { padding: 8rpx 10rpx; display: flex; align-items: center; gap: 4rpx; }
.tool-label { font-size: 22rpx; color: #52525B; max-width: 120rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tool-arrow { font-size: 16rpx; color: #A1A1AA; transition: transform 0.2s ease; &.up { transform: rotate(180deg); } }

/* 折叠面板 */
.picker-panel { background: #FFFFFF; padding: 8rpx 20rpx 12rpx; border-bottom: 1rpx solid #E4E4E7; flex-shrink: 0; }
.chip-scroll { white-space: nowrap; }
.chip {
  display: inline-block;
  padding: 6rpx 20rpx;
  border-radius: 20rpx;
  font-size: 24rpx;
  color: #52525B;
  background: #F4F4F5;
  margin-right: 8rpx;
  white-space: nowrap;
  &.active { background: #18181B; color: #FFFFFF; }
}

/* 搜索状态 */
.search-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #FFFFFF;
  padding: 6rpx 20rpx;
  border-bottom: 1rpx solid #E4E4E7;
  flex-shrink: 0;
  .status-text { font-size: 22rpx; color: #71717A; }
  .status-clear { font-size: 22rpx; color: #A1A1AA; padding: 8rpx; }
}

/* 空态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 8rpx;
  .empty-text { font-size: 28rpx; color: #71717A; font-weight: 600; }
  .empty-sub { font-size: 22rpx; color: #A1A1AA; }
}

/* 列表 */
.trash-scroll { padding: 12rpx 20rpx; flex: 1; box-sizing: border-box; }

.trash-card {
  background: #FFFFFF;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  margin-bottom: 8rpx;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  .card-date { font-size: 20rpx; color: #A1A1AA; }
  .card-amount {
    display: flex;
    align-items: baseline;
    .amount-sign { font-size: 22rpx; color: #18181B; }
    .amount-num { font-size: 28rpx; font-weight: 700; color: #18181B; font-variant-numeric: tabular-nums; }
  }
}

.card-body {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin: 8rpx 0;
  .card-cat-wrap { display: flex; align-items: center; gap: 6rpx; }
  .card-cat-icon { font-size: 24rpx; }
  .card-cat { font-size: 26rpx; font-weight: 600; color: #18181B; }
  .card-note { font-size: 22rpx; color: #71717A; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
}

.card-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 12rpx;
  .btn-restore {
    padding: 10rpx 32rpx;
    background: #18181B;
    color: #FFFFFF;
    border-radius: 8rpx;
    font-size: 22rpx;
    text-align: center;
  }
  .btn-purge {
    padding: 10rpx 32rpx;
    background: #F4F4F5;
    color: #EF4444;
    border-radius: 8rpx;
    font-size: 22rpx;
    text-align: center;
  }
}

@media (prefers-color-scheme: dark) {
  .trash-page { background: #18181B; }
  .toolbar { background: #27272A; border-bottom-color: #3F3F46; }
  .search-input-wrap { background: #3F3F46; }
  .search-icon { color: #71717A; }
  .search-input { color: #FAFAFA; }
  .search-clear { color: #71717A; }
  .tool-label { color: #F4F4F5; }
  .tool-arrow { color: #71717A; }
  .picker-panel { background: #27272A; border-bottom-color: #3F3F46; }
  .chip { color: #F4F4F5; background: #3F3F46; &.active { background: #FAFAFA; color: #18181B; } }
  .search-status { background: #27272A; border-bottom-color: #3F3F46; }
  .status-text { color: #A1A1AA; }
  .status-clear { color: #71717A; }
  .empty-text { color: #A1A1AA; }
  .empty-sub { color: #71717A; }
  .trash-card { background: #27272A; }
  .card-date { color: #71717A; }
  .amount-sign, .amount-num { color: #FAFAFA; }
  .card-cat { color: #FAFAFA; }
  .card-note { color: #A1A1AA; }
  .btn-restore { background: #FAFAFA; color: #18181B; }
  .btn-purge { background: #3F3F46; }
}
</style>
