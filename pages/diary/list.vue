<script setup>
/**
 * 记录列表页 — Tab1
 * 原生导航栏 → 工具栏(搜索+筛选+时间+回收站一行) → 内容 → FAB
 */
import { onMounted, ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import EmptyState from '@/components/common/EmptyState.vue'
import { useDiaryList } from '@/composables/useDiaryList.js'

const {
  diaries, currentMonth, loading, filterTag, filterCategory, filterTags, categories,
  searchKeyword, viewMode,
  monthCount, totalWords, streakDays, topTags, emotionStats,
  filteredDiaries, calendarDays, timelineGroups, months,
  loadDiaries, loadTags, loadCategories, switchMonth, toggleTag, toggleCategory,
  getItemTags, tagColor, formatDate,
  hasActiveFilter, resetFilters
} = useDiaryList()

const showFilter = ref(false)
const showStats = ref(false)
const showTimePicker = ref(false)

onMounted(() => {
  currentMonth.value = months.value[1]?.key || ''
  loadDiaries(); loadTags(); loadCategories()
})
onShow(() => { loadDiaries(); loadTags(); loadCategories() })

function goDetail(clientId, m) {
  const useMonth = m || currentMonth.value
  if (clientId) uni.navigateTo({ url: `/pages/diary/detail?clientId=${clientId}&month=${useMonth}` })
}
function goNew() { uni.navigateTo({ url: '/pages/diary/detail?id=new' }) }
function goTrash() { uni.navigateTo({ url: '/pages/diary/trash' }) }

function toggleFilter() { showFilter.value = !showFilter.value }
function closeFilter() { showFilter.value = false }
function toggleTimePicker() { showTimePicker.value = !showTimePicker.value }
function clearSearch() { searchKeyword.value = '' }

const currentMonthLabel = computed(() => {
  const m = months.value.find(m => m.key === currentMonth.value)
  return m ? m.label : ''
})

const weekDays = ['日', '一', '二', '三', '四', '五', '六']
</script>

<template>
  <view class="diary-page">
    <!-- 工具栏：搜索 + 筛选 + 时间 + 回收站 一行 -->
    <view class="toolbar">
      <view class="search-input-wrap">
        <text class="search-icon">🔍</text>
        <input v-model="searchKeyword" class="search-input" placeholder="搜索记录..." confirm-type="search" />
        <text v-if="searchKeyword" class="search-clear" @tap="clearSearch">✕</text>
      </view>
      <view class="tool-btns">
        <view class="tool-btn" @tap="toggleTimePicker">
          <text class="tool-label">{{ currentMonthLabel }}</text>
          <text class="tool-arrow" :class="{ up: showTimePicker }">▼</text>
        </view>
        <view class="tool-btn tool-filter" @tap="toggleFilter">
          <text>⚙</text>
          <view class="filter-dot" v-if="hasActiveFilter || filterCategory || filterTag"></view>
        </view>
        <view class="tool-btn" @tap="goTrash"><text>🗑</text></view>
      </view>
    </view>

    <!-- 时间选择（展开式） -->
    <view class="time-picker" v-if="showTimePicker">
      <scroll-view class="time-chips" scroll-x>
        <view v-for="m in months" :key="m.key" class="time-chip" :class="{ active: currentMonth === m.key }" @tap="switchMonth(m.key); showTimePicker = false">
          <text>{{ m.label }}</text>
        </view>
      </scroll-view>
    </view>

    <!-- 激活的筛选条件 -->
    <view class="active-filters" v-if="hasActiveFilter">
      <text class="filter-tag" v-if="filterCategory" @tap="filterCategory = ''">{{ filterCategory }} ✕</text>
      <text class="filter-tag" v-if="filterTag" @tap="filterTag = ''">#{{ filterTag }} ✕</text>
      <text class="filter-clear-all" @tap="resetFilters">清除</text>
    </view>

    <!-- 高级筛选面板（遮罩 + 下滑面板） -->
    <view class="filter-overlay" v-if="showFilter" @tap="closeFilter"></view>
    <view class="filter-panel" :class="{ show: showFilter }">
      <view class="fp-header">
        <text class="fp-title">筛选</text>
        <text class="fp-close" @tap="closeFilter">✕</text>
      </view>

      <!-- 分类 -->
      <view class="fp-section" v-if="categories.length > 0">
        <text class="fp-section-label">分类</text>
        <scroll-view class="fp-chips" scroll-x>
          <view class="fp-chip" :class="{ active: !filterCategory }" @tap="filterCategory = ''"><text>全部</text></view>
          <view v-for="c in categories" :key="'c'+c.name" class="fp-chip" :class="{ active: filterCategory === c.name }" @tap="toggleCategory(c.name)"><text>{{ c.name }}</text></view>
        </scroll-view>
      </view>

      <!-- 标签 -->
      <view class="fp-section" v-if="topTags.length > 0">
        <text class="fp-section-label">标签</text>
        <scroll-view class="fp-chips" scroll-x>
          <view class="fp-chip" :class="{ active: !filterTag }" @tap="filterTag = ''"><text>全部</text></view>
          <view v-for="t in topTags" :key="'t'+t.name" class="fp-chip" :class="{ active: filterTag === t.name }" @tap="toggleTag(t.name)"><text>{{ t.name }}</text></view>
        </scroll-view>
      </view>

      <!-- 视图切换 -->
      <view class="fp-section">
        <text class="fp-section-label">视图</text>
        <view class="fp-view-row">
          <text class="fp-view-btn" :class="{ active: viewMode === 'list' }" @tap="viewMode = 'list'">列表</text>
          <text class="fp-view-btn" :class="{ active: viewMode === 'timeline' }" @tap="viewMode = 'timeline'">时间线</text>
          <text class="fp-view-btn" :class="{ active: viewMode === 'calendar' }" @tap="viewMode = 'calendar'" v-if="currentMonth !== 'all'">日历</text>
        </view>
      </view>

      <!-- 统计 -->
      <view class="fp-section" v-if="diaries.length > 0">
        <view class="fp-stats-row" @tap="showStats = !showStats">
          <text class="fp-stats-text">{{ monthCount }} 篇 · {{ streakDays }} 天 · {{ totalWords }} 字</text>
          <text class="fp-stats-arrow">{{ showStats ? '▲' : '▼' }}</text>
        </view>
        <view class="fp-stats-detail" v-if="showStats">
          <view class="fp-stat-line"><text>记录数</text><text>{{ monthCount }}</text></view>
          <view class="fp-stat-line"><text>活跃天</text><text>{{ streakDays }}</text></view>
          <view class="fp-stat-line"><text>总字数</text><text>{{ totalWords }}</text></view>
          <view class="fp-stat-line emo-line" v-if="emotionStats.total > 0">
            <text>情绪</text>
            <view class="fp-emo-tags">
              <template v-for="(count, emo) in emotionStats.map" :key="emo">
                <text v-if="count > 0" class="fp-emo-tag" :class="'emo-' + emo">{{ emo }} {{ count }}</text>
              </template>
            </view>
          </view>
        </view>
      </view>

      <view class="fp-footer" v-if="hasActiveFilter">
        <text class="fp-reset" @tap="resetFilters">重置筛选</text>
      </view>
    </view>

    <!-- 内容区 -->
    <view v-if="loading" class="loading-hint">加载中...</view>

    <EmptyState v-else-if="diaries.length === 0" icon="diary" title="还没有记录" description="点 + 写一篇吧">
      <view class="empty-btn" @tap="goNew">写记录</view>
    </EmptyState>

    <EmptyState v-else-if="filteredDiaries.length === 0" icon="search" title="没有匹配的记录" :description="searchKeyword ? `搜索「${searchKeyword}」无结果` : '当前筛选无结果'" />

    <!-- 日历视图 -->
    <scroll-view v-else-if="viewMode === 'calendar'" class="diary-scroll calendar-scroll" scroll-y>
      <view class="calendar-grid">
        <view v-for="(w, i) in weekDays" :key="i" class="cal-weekday">{{ w }}</view>
        <view v-for="(cell, i) in calendarDays" :key="i" class="cal-cell" :class="{ empty: cell.empty, today: cell.isToday }">
          <template v-if="!cell.empty">
            <text class="cal-day">{{ cell.day }}</text>
            <view class="cal-heatmap" v-if="cell.count > 0" :class="'heat-' + Math.min(cell.count, 4)"></view>
            <text class="cal-count" v-if="cell.count > 0">{{ cell.count }}</text>
          </template>
        </view>
      </view>
      <view v-for="cell in calendarDays.filter(c => !c.empty && c.count > 0)" :key="'cal-' + cell.day" class="cal-day-records">
        <text class="cal-day-label">{{ cell.day }}日 · {{ cell.count }}篇 · {{ cell.words }}字</text>
        <view v-for="r in cell.records" :key="r.client_id" class="diary-card cal-card" @tap="goDetail(r.client_id)">
          <text class="card-title">{{ r.title || r.content?.substring(0, 30) || '无标题' }}</text>
          <text class="card-preview" v-if="r.content">{{ r.content.substring(0, 80) }}</text>
          <view v-if="getItemTags(r).length > 0" class="tag-row">
            <text v-for="t in getItemTags(r)" :key="t" class="tag" :style="{ color: tagColor(t) }">#{{ t }}</text>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- 列表视图 -->
    <scroll-view v-else-if="viewMode === 'list'" class="diary-scroll" scroll-y>
      <view v-for="item in filteredDiaries" :key="item.client_id" class="diary-card" :class="{ pinned: item.pinned }" @tap="goDetail(item.client_id)">
        <view class="card-header">
          <text class="card-date">{{ formatDate(item.created_at) }}</text>
          <text v-if="item.pinned" class="pin-badge">📌</text>
          <text v-if="item.category" class="cat-badge">{{ item.category }}</text>
        </view>
        <text class="card-title">{{ item.title || item.content?.substring(0, 30) || '无标题' }}</text>
        <text class="card-preview" v-if="item.content">{{ item.content.substring(0, 120) }}</text>
        <view class="card-images" v-if="item.images && item.images.length > 0">
          <image v-for="(img, i) in item.images.slice(0, 3)" :key="i" :src="img" mode="aspectFill" class="card-img-thumb" />
          <text class="img-more" v-if="item.images.length > 3">+{{ item.images.length - 3 }}</text>
        </view>
        <view v-if="getItemTags(item).length > 0" class="tag-row">
          <text v-for="t in getItemTags(item)" :key="t" class="tag" :style="{ color: tagColor(t) }">#{{ t }}</text>
        </view>
      </view>
      <view style="height: 120rpx;"></view>
    </scroll-view>

    <!-- 时间线视图 -->
    <scroll-view v-else class="diary-scroll timeline-scroll" scroll-y>
      <view v-for="group in timelineGroups" :key="group.date" class="timeline-group">
        <view class="timeline-date">{{ group.date }}</view>
        <view v-for="item in group.items" :key="item.client_id" class="diary-card timeline-card" :class="{ pinned: item.pinned }" @tap="goDetail(item.client_id)">
          <text class="card-title">{{ item.title || item.content?.substring(0, 30) || '无标题' }}</text>
          <text class="card-preview" v-if="item.content">{{ item.content.substring(0, 100) }}</text>
          <view class="card-images" v-if="item.images && item.images.length > 0">
            <image v-for="(img, i) in item.images.slice(0, 3)" :key="i" :src="img" mode="aspectFill" class="card-img-thumb" />
          </view>
          <view v-if="getItemTags(item).length > 0" class="tag-row">
            <text v-for="t in getItemTags(item)" :key="t" class="tag" :style="{ color: tagColor(t) }">#{{ t }}</text>
          </view>
        </view>
      </view>
      <view style="height: 120rpx;"></view>
    </scroll-view>

    <!-- FAB -->
    <view class="fab" @tap="goNew"><text class="fab-icon">+</text></view>
  </view>
</template>

<style scoped lang="scss">
@import './list.scss';
</style>
