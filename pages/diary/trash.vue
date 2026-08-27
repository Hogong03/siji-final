<script setup>
/**
 * 回收站 — 已删除记录恢复
 * H2: 回收站功能
 * 工具栏：搜索 + 时间筛选 一行
 */
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import EmptyState from '@/components/common/EmptyState.vue'
import { getDeletedDiaries, restoreDiary, purgeDiary } from '@/utils/storage.js'

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
    // 遍历所有月份分片
    const all = []
    for (const m of months.value) {
      if (m.key === 'all') continue
      const items = getDeletedDiaries(m.key)
      all.push(...items)
    }
    allList.value = all.sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
  } else {
    allList.value = getDeletedDiaries(currentMonth.value)
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
  return allList.value.filter(item => {
    const title = (item.title || '').toLowerCase()
    const content = (item.content || '').toLowerCase()
    return title.includes(kw) || content.includes(kw)
  })
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
    title: '恢复记录',
    content: `恢复「${item.title || '无标题'}」？`,
    success: (res) => {
      if (res.confirm) {
        const monthKey = item.month || currentMonth.value
        restoreDiary(item.client_id, monthKey)
        uni.showToast({ title: '已恢复', icon: 'success' })
        loadData()
      }
    }
  })
}

function handlePurge(item) {
  uni.showModal({
    title: '彻底删除',
    content: `彻底删除「${item.title || '无标题'}」？此操作不可恢复。`,
    confirmText: '删除',
    confirmColor: '#EF4444',
    success: (res) => {
      if (res.confirm) {
        const monthKey = item.month || currentMonth.value
        purgeDiary(item.client_id, monthKey)
        uni.showToast({ title: '已彻底删除', icon: 'success' })
        loadData()
      }
    }
  })
}
</script>

<template>
  <view class="trash-page">
    <!-- 工具栏：搜索 + 时间 一行 -->
    <view class="toolbar">
      <view class="search-input-wrap">
        <text class="search-icon">🔍</text>
        <input v-model="searchKeyword" class="search-input" placeholder="搜索已删除记录..." confirm-type="search" />
        <text v-if="searchKeyword" class="search-clear" @tap="clearSearch">✕</text>
      </view>
      <view class="tool-btns">
        <view class="tool-btn" @tap="showTimePicker = !showTimePicker">
          <text class="tool-label">{{ currentMonthLabel }}</text>
          <text class="tool-arrow" :class="{ up: showTimePicker }">▼</text>
        </view>
      </view>
    </view>

    <!-- 时间选择（展开式） -->
    <view class="time-picker" v-if="showTimePicker">
      <scroll-view class="time-chips" scroll-x>
        <view v-for="m in months" :key="m.key" class="time-chip" :class="{ active: currentMonth === m.key }" @tap="switchMonth(m.key)">
          <text>{{ m.label }}</text>
        </view>
      </scroll-view>
    </view>

    <!-- 搜索状态 -->
    <view class="search-status" v-if="searchKeyword">
      <text class="status-text">搜索「{{ searchKeyword }}」· {{ filteredList.length }} 条结果</text>
      <text class="status-clear" @tap="clearSearch">✕</text>
    </view>

    <EmptyState v-if="filteredList.length === 0" icon="diary" title="回收站是空的" description="删除的记录会在这里保留，可以随时恢复" />

    <scroll-view v-else class="trash-scroll" scroll-y>
      <view v-for="item in filteredList" :key="item.client_id" class="trash-card">
        <text class="card-date">{{ formatDate(item.created_at) }}</text>
        <text class="card-title">{{ item.title || item.content?.substring(0, 30) || '无标题' }}</text>
        <text class="card-preview" v-if="item.content">{{ item.content.substring(0, 80) }}</text>
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

/* ═══ 工具栏 ═══ */
.toolbar {
  display: flex;
  align-items: center;
  gap: 12rpx;
  background: #FFFFFF;
  padding: 12rpx 20rpx;
  border-bottom: 1rpx solid #E4E4E7;
  flex-shrink: 0;
}
.search-input-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  background: #F4F4F5;
  border-radius: 32rpx;
  padding: 0 20rpx;
  height: 60rpx;
}
.search-icon { font-size: 24rpx; margin-right: 8rpx; color: #A1A1AA; }
.search-input { flex: 1; font-size: 26rpx; color: #18181B; }
.search-clear { font-size: 24rpx; color: #A1A1AA; padding: 8rpx; }

.tool-btns { display: flex; align-items: center; gap: 4rpx; flex-shrink: 0; }
.tool-btn {
  padding: 8rpx 12rpx;
  display: flex;
  align-items: center;
  gap: 4rpx;
}
.tool-label {
  font-size: 24rpx;
  color: #52525B;
  max-width: 120rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tool-arrow {
  font-size: 18rpx;
  color: #A1A1AA;
  transition: transform 0.2s ease;
  &.up { transform: rotate(180deg); }
}

/* ═══ 时间选择 ═══ */
.time-picker {
  background: #FFFFFF;
  padding: 8rpx 20rpx 12rpx;
  border-bottom: 1rpx solid #E4E4E7;
  flex-shrink: 0;
}
.time-chips { white-space: nowrap; }
.time-chip {
  display: inline-block;
  padding: 8rpx 24rpx;
  border-radius: 24rpx;
  font-size: 26rpx;
  color: #52525B;
  background: #F4F4F5;
  margin-right: 12rpx;
  white-space: nowrap;
  &.active { background: #18181B; color: #FFFFFF; }
}

/* ═══ 搜索状态 ═══ */
.search-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #FFFFFF;
  padding: 8rpx 20rpx;
  border-bottom: 1rpx solid #E4E4E7;
  flex-shrink: 0;
}
.status-text { font-size: 24rpx; color: #71717A; }
.status-clear { font-size: 24rpx; color: #A1A1AA; padding: 8rpx; }

/* ═══ 内容区 ═══ */
.trash-scroll { padding: 12rpx 20rpx; flex: 1; box-sizing: border-box; }

.trash-card {
  background: #FFFFFF; border-radius: 16rpx; padding: 20rpx 24rpx; margin-bottom: 10rpx;
}
.card-date { font-size: 22rpx; color: #A1A1AA; }
.card-title { display: block; font-size: 28rpx; font-weight: 600; color: #18181B; margin: 8rpx 0 6rpx; }
.card-preview { display: block; font-size: 24rpx; color: #71717A; line-height: 1.4; }
.card-actions { display: flex; gap: 20rpx; margin-top: 20rpx; }
.btn-restore {
  padding: 12rpx 36rpx; background: #18181B; color: #FFFFFF; border-radius: 8rpx;
  font-size: 24rpx; text-align: center;
}
.btn-purge {
  padding: 12rpx 36rpx; background: #F4F4F5; color: #EF4444; border-radius: 8rpx;
  font-size: 24rpx; text-align: center;
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
  .time-picker { background: #27272A; border-bottom-color: #3F3F46; }
  .time-chip { color: #F4F4F5; background: #3F3F46; &.active { background: #FAFAFA; color: #18181B; } }
  .search-status { background: #27272A; border-bottom-color: #3F3F46; }
  .status-text { color: #A1A1AA; }
  .status-clear { color: #71717A; }
  .trash-card { background: #27272A; }
  .card-title { color: #FAFAFA; }
  .card-preview { color: #A1A1AA; }
  .btn-restore { background: #FAFAFA; color: #18181B; }
  .btn-purge { background: #3F3F46; }
}
</style>
