<script setup>
/**
 * 日记列表页 — Tab1
 * 功能：按月筛选、标签筛选、AI摘要预览、新建入口
 */
import { ref, computed, onMounted } from 'vue'
import SijiIcon from '@/components/common/SijiIcon.vue'
import { onShow } from '@dcloudio/uni-app'
import { getDiaryList, getUsedTags } from '@/utils/storage.js'
import { useAppStore } from '@/store/index.js'
import EmptyState from '@/components/common/EmptyState.vue'
import VirtualList from '@/components/common/VirtualList.vue'

const store = useAppStore()
const diaries = ref([])
const currentMonth = ref('')
const loading = ref(false)

// 标签筛选
const filterTag = ref('')
const filterTags = ref([])

// 可选月份列表（当前月 + 前5个月）
const months = computed(() => {
  const list = []
  const now = new Date()
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = `${d.getFullYear()}年${d.getMonth() + 1}月`
    list.push({ key, label })
  }
  return list
})

onMounted(() => {
  currentMonth.value = months.value[0]?.key || ''
  loadDiaries()
  loadTags()
})
onShow(() => {
  loadDiaries()
  loadTags()
})

function loadDiaries() {
  loading.value = true
  try {
    diaries.value = getDiaryList(currentMonth.value)
  } finally {
    loading.value = false
  }
}

function loadTags() {
  filterTags.value = getUsedTags('diary')
}

function switchMonth(key) {
  currentMonth.value = key
  filterTag.value = ''
  loadDiaries()
  loadTags()
}

function toggleTag(tagName) {
  if (filterTag.value === tagName) {
    filterTag.value = ''
  } else {
    filterTag.value = tagName
  }
}

// 筛选后的日记
const filteredDiaries = computed(() => {
  if (!filterTag.value) return diaries.value
  return diaries.value.filter(item => {
    const tags = getItemTags(item)
    return tags.includes(filterTag.value)
  })
})

function goDetail(clientId) {
  if (clientId) {
    uni.navigateTo({ url: `/pages/diary/detail?clientId=${clientId}&month=${currentMonth.value}` })
  }
}

function goNew() {
  uni.navigateTo({ url: '/pages/diary/detail?id=new' })
}

function formatDate(ts) {
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

const moodEmojis = ['😢', '😰', '😌', '😊', '🤩']

function getItemTags(item) {
  if (Array.isArray(item.tags)) return item.tags
  if (typeof item.tags === 'string') {
    try { const p = JSON.parse(item.tags); return Array.isArray(p) ? p : [] } catch { return [] }
  }
  return []
}

function tagColor(name) {
  const t = filterTags.value.find(t => t.name === name)
  return t?.color || '#000000'
}
const DIARY_ITEM_HEIGHT = 280  // 预估卡片高度（rpx）
</script>

<template>
  <view class="diary-page">
    <!-- 月份切换 -->
    <scroll-view class="month-bar" scroll-x>
      <view class="month-list">
        <view
          v-for="m in months" :key="m.key"
          class="month-item"
          :class="{ active: currentMonth === m.key }"
          @tap="switchMonth(m.key)"
        >
          {{ m.label }}
        </view>
      </view>
    </scroll-view>

    <!-- 标签筛选行 -->
    <scroll-view class="tag-bar" scroll-x v-if="filterTags.length > 0">
      <view class="tag-list">
        <view
          class="tag-item"
          :class="{ active: filterTag === '' }"
          @tap="filterTag = ''"
        >
          <text>全部</text>
        </view>
        <view
          v-for="t in filterTags" :key="t.name"
          class="tag-item"
          :class="{ active: filterTag === t.name }"
          :style="filterTag === t.name ? { background: t.color, borderColor: t.color } : {}"
          @tap="toggleTag(t.name)"
        >
          <text>{{ t.name }}</text>
          <text class="tag-count">{{ t.count }}</text>
        </view>
      </view>
    </scroll-view>

    <!-- 日记列表（虚拟滚动） -->
    <view v-if="loading" class="loading-hint">加载中...</view>

    <EmptyState
      v-else-if="diaries.length === 0"
      icon="diary"
      title="这个月还没有日记"
      description="去和思迹聊聊，让 AI 帮你写一篇吧"
    >
      <view class="empty-btn" @tap="goNew">写日记</view>
    </EmptyState>

    <EmptyState
      v-else-if="filteredDiaries.length === 0"
      icon="search"
      title="没有匹配的日记"
      :description="`标签「${filterTag}」下无日记`"
    />

    <VirtualList
      v-else
      class="diary-scroll"
      :items="filteredDiaries"
      :item-height="DIARY_ITEM_HEIGHT"
      :buffer="3"
      key-field="client_id"
    >
      <template #default="{ item }">
        <view class="diary-card" @tap="goDetail(item.client_id)">
          <view class="card-header">
            <text class="card-date">{{ formatDate(item.created_at) }}</text>
            <text class="card-mood">{{ moodEmojis[item.mood] || '😌' }}</text>
          </view>

          <text class="card-title">{{ item.title || '无标题' }}</text>

          <text class="card-preview">
            {{ item.content ? item.content.substring(0, 120) : '' }}
          </text>

          <view v-if="item.ai_summary" class="ai-badge">
            <SijiIcon name="sparkle" size="sm" class="ai-icon" />
            <text class="ai-text">AI 摘要: {{ item.ai_summary }}</text>
          </view>

          <view v-if="getItemTags(item).length > 0" class="tag-row">
            <text
              v-for="t in getItemTags(item)" :key="t"
              class="tag"
              :style="{ color: tagColor(t) }"
            >#{{ t }}</text>
          </view>
        </view>
      </template>
    </VirtualList>

    <!-- 新建浮动按钮 -->
    <view class="fab" @tap="goNew">
      <text class="fab-icon">+</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.diary-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: $bg-page;
}

/* 月份切换 */
.month-bar {
  flex-shrink: 0;
  background: $bg-card;
  border-bottom: 1rpx solid rgba(0,0,0,0.05);

  .month-list {
    display: flex;
    padding: $spacing-sm $spacing-md;
    gap: $spacing-sm;
  }

  .month-item {
    flex-shrink: 0;
    padding: 10rpx 28rpx;
    border-radius: 32rpx;
    font-size: $font-sm;
    color: $text-secondary;
    background: $bg-input;
    transition: all $transition-fast;

    &.active {
      background: var(--color-ai);
      color: var(--text-on-ai);
      font-weight: 600;
    }
  }
}

/* 标签筛选行 */
.tag-bar {
  flex-shrink: 0;
  background: $bg-card;
  border-bottom: 1rpx solid rgba(0,0,0,0.05);

  .tag-list {
    display: flex;
    padding: $spacing-xs $spacing-md;
    gap: $spacing-xs;
    align-items: center;
  }

  .tag-item {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 4rpx;
    padding: 6rpx 20rpx;
    border-radius: 32rpx;
    font-size: $font-xs;
    color: $text-secondary;
    background: $bg-input;
    border: 1rpx solid transparent;
    transition: all $transition-fast;

    &.active {
      color: var(--text-on-ai);
      font-weight: 600;
    }

    .tag-count {
      font-size: 18rpx;
      opacity: 0.6;
    }
  }
}

/* 日记列表 */
.diary-scroll {
  flex: 1;
  padding: $spacing-md;
}

.diary-card {
  background: $bg-card;
  border-radius: $radius-md;
  padding: $spacing-md;
  margin-bottom: $spacing-md;
  box-shadow: $shadow-sm;

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: $spacing-sm;

    .card-date {
      font-size: $font-sm;
      color: var(--color-amber);
      font-weight: 600;
    }

    .card-mood {
      font-size: 40rpx;
    }
  }

  .card-title {
    font-size: $font-lg;
    font-weight: 700;
    color: $text-primary;
    display: block;
    margin-bottom: $spacing-sm;
  }

  .card-preview {
    font-size: $font-sm;
    color: $text-secondary;
    line-height: 1.6;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .ai-badge {
    display: flex;
    align-items: flex-start;
    margin-top: $spacing-sm;
    padding: $spacing-xs $spacing-sm;
    background: rgba(0, 0, 0, 0.06);
    border-radius: $radius-sm;

    .ai-icon { font-size: $font-sm; margin-right: 8rpx; }
    .ai-text { font-size: $font-xs; color: $accent; line-height: 1.5; }
  }

  .tag-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8rpx;
    margin-top: $spacing-sm;

    .tag {
      font-size: $font-xs;
      font-weight: 500;
    }
  }
}

/* 空状态按钮 */
.empty-btn {
  margin-top: $spacing-md;
  padding: 16rpx 48rpx;
  background: var(--color-ai);
  color: var(--text-on-ai);
  border-radius: $radius-md;
  font-size: $font-md;
}

.loading-hint {
  text-align: center;
  padding: $spacing-xl;
  color: $text-hint;
  font-size: $font-sm;
}

/* 浮动按钮 */
@keyframes fabIdle {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4rpx); }
}

.fab {
  position: fixed;
  right: $spacing-lg;
  bottom: $spacing-lg;
  width: 112rpx;
  height: 112rpx;
  border-radius: $radius-md;
  background: var(--color-ai);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  transition: transform $transition-fast;
  animation: fabIdle 2.5s ease-in-out infinite;
  box-shadow: $shadow-md;

  &:active { transform: scale(0.9); }

  .fab-icon {
    font-size: 52rpx;
    color: var(--text-on-ai);
    font-weight: 300;
  }
}
</style>
