<script setup>
/**
 * 计划回收站 — 已删除计划恢复/彻底删除
 */
import { ref, computed, onMounted } from 'vue'
import SijiIcon from '@/components/common/SijiIcon.vue'
import EmptyState from '@/components/common/EmptyState.vue'

const PLAN_KEY = 'plan_all'

const deletedPlans = ref([])
const searchKeyword = ref('')

onMounted(() => { loadDeleted() })

function loadDeleted() {
  try {
    const raw = uni.getStorageSync(PLAN_KEY)
    if (!raw) return
    const all = JSON.parse(raw)
    deletedPlans.value = all
      .filter(p => p.is_deleted === 1)
      .sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0))
  } catch { deletedPlans.value = [] }
}

const filteredPlans = computed(() => {
  if (!searchKeyword.value.trim()) return deletedPlans.value
  const kw = searchKeyword.value.trim().toLowerCase()
  return deletedPlans.value.filter(p =>
    (p.title || '').toLowerCase().includes(kw) ||
    (p.description || '').toLowerCase().includes(kw)
  )
})

function formatDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const priorityColors = { 0: '#A1A1AA', 1: '#E8A838', 2: '#EF4444' }

function restorePlan(plan) {
  uni.showModal({
    title: '恢复计划',
    content: `恢复「${plan.title}」？`,
    success: (res) => {
      if (res.confirm) {
        const raw = uni.getStorageSync(PLAN_KEY)
        const all = JSON.parse(raw)
        const idx = all.findIndex(p => p.client_id === plan.client_id)
        if (idx >= 0) {
          all[idx].is_deleted = 0
          all[idx].updated_at = Date.now()
          uni.setStorageSync(PLAN_KEY, JSON.stringify(all))
        }
        loadDeleted()
        uni.showToast({ title: '已恢复', icon: 'success' })
      }
    }
  })
}

function purgePlan(plan) {
  uni.showModal({
    title: '彻底删除',
    content: `「${plan.title}」将永久删除，无法恢复。确认？`,
    confirmColor: '#D35D5D',
    success: (res) => {
      if (res.confirm) {
        const raw = uni.getStorageSync(PLAN_KEY)
        let all = JSON.parse(raw)
        // 同时删除子计划
        const childIds = all.filter(p => p.parent_id === plan.client_id).map(p => p.client_id)
        all = all.filter(p => p.client_id !== plan.client_id && !childIds.includes(p.client_id))
        uni.setStorageSync(PLAN_KEY, JSON.stringify(all))
        loadDeleted()
        uni.showToast({ title: '已彻底删除', icon: 'success' })
      }
    }
  })
}

function restoreAll() {
  if (deletedPlans.value.length === 0) return
  uni.showModal({
    title: '恢复全部',
    content: `恢复全部 ${deletedPlans.value.length} 个计划？`,
    success: (res) => {
      if (res.confirm) {
        const raw = uni.getStorageSync(PLAN_KEY)
        const all = JSON.parse(raw)
        all.forEach(p => { if (p.is_deleted === 1) { p.is_deleted = 0; p.updated_at = Date.now() } })
        uni.setStorageSync(PLAN_KEY, JSON.stringify(all))
        loadDeleted()
        uni.showToast({ title: '已全部恢复', icon: 'success' })
      }
    }
  })
}
</script>

<template>
  <view class="trash-page">
    <!-- 搜索栏 -->
    <view class="search-bar">
      <view class="search-box">
        <SijiIcon name="search" size="sm" class="search-icon" />
        <input
          v-model="searchKeyword"
          class="search-input"
          placeholder="搜索已删除的计划..."
          :placeholder-style="'color: #A1A1AA'"
        />
        <text v-if="searchKeyword" class="search-clear" @tap="searchKeyword = ''">✕</text>
      </view>
      <view v-if="deletedPlans.length > 0" class="restore-all" @tap="restoreAll">
        <text>全部恢复</text>
      </view>
    </view>

    <!-- 列表 -->
    <scroll-view class="trash-scroll" scroll-y>
      <EmptyState v-if="filteredPlans.length === 0" icon="trash" title="回收站为空" description="删除的计划会出现在这里" />

      <view v-else class="trash-list">
        <view v-for="item in filteredPlans" :key="item.client_id" class="trash-card">
          <view class="card-top">
            <view class="priority-dot" :style="{ background: priorityColors[item.priority] || '#999' }" />
            <text class="card-title">{{ item.title }}</text>
          </view>
          <text v-if="item.description" class="card-desc">{{ item.description.substring(0, 60) }}</text>
          <view class="card-meta">
            <text class="meta-text">删除于 {{ formatDate(item.updated_at) }}</text>
          </view>
          <view class="card-actions">
            <view class="action-btn restore" @tap="restorePlan(item)">恢复</view>
            <view class="action-btn purge" @tap="purgePlan(item)">彻底删除</view>
          </view>
        </view>
      </view>

      <view style="height: 60rpx" />
    </scroll-view>
  </view>
</template>

<style scoped lang="scss">
.trash-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: #F4F4F5;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 20rpx;
  background: #FFFFFF;
  border-bottom: 1rpx solid #E4E4E7;
}

.search-box {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8rpx;
  background: #F4F4F5;
  border-radius: 20rpx;
  padding: 8rpx 16rpx;
}

.search-icon { flex-shrink: 0; }

.search-input {
  flex: 1;
  font-size: 26rpx;
  color: #18181B;
  padding: 4rpx 0;
}

.search-clear {
  font-size: 24rpx;
  color: #A1A1AA;
  padding: 4rpx 8rpx;
}

.restore-all {
  padding: 8rpx 20rpx;
  background: #18181B;
  color: #FFFFFF;
  border-radius: 12rpx;
  font-size: 24rpx;
  font-weight: 600;
  white-space: nowrap;

  &:active { transform: scale(0.95); }
}

.trash-scroll {
  flex: 1;
  padding: 12rpx 20rpx;
}

.trash-list {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.trash-card {
  background: #FFFFFF;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
}

.card-top {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.priority-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  flex-shrink: 0;
}

.card-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #18181B;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-desc {
  font-size: 24rpx;
  color: #71717A;
  margin-top: 4rpx;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-meta {
  margin-top: 8rpx;
}

.meta-text {
  font-size: 20rpx;
  color: #A1A1AA;
}

.card-actions {
  display: flex;
  gap: 12rpx;
  margin-top: 12rpx;
  border-top: 1rpx solid #E4E4E7;
  padding-top: 12rpx;
}

.action-btn {
  flex: 1;
  text-align: center;
  padding: 14rpx 0;
  border-radius: 10rpx;
  font-size: 26rpx;
  font-weight: 600;

  &.restore {
    background: #18181B;
    color: #FFFFFF;
  }

  &.purge {
    background: #F4F4F5;
    color: #D35D5D;
  }

  &:active { transform: scale(0.95); }
}

@media (prefers-color-scheme: dark) {
  .trash-page { background: #18181B; }
  .search-bar { background: #27272A; border-bottom-color: #3F3F46; }
  .search-box { background: #3F3F46; }
  .search-input { color: #FAFAFA; }
  .search-clear { color: #52525B; }
  .restore-all { background: #FAFAFA; color: #18181B; }
  .trash-card { background: #27272A; }
  .card-title { color: #FAFAFA; }
  .card-desc { color: #A1A1AA; }
  .meta-text { color: #52525B; }
  .card-actions { border-top-color: #3F3F46; }
  .action-btn {
    &.restore { background: #FAFAFA; color: #18181B; }
    &.purge { background: #3F3F46; color: #F87171; }
  }
}
</style>
