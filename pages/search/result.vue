<script setup>
/**
 * 全局搜索结果页
 * 路由: /pages/search/result?keyword=xxx
 *
 * 功能：
 *  ① 顶部搜索框（自动聚焦，可修改关键词重新搜索）
 *  ② 时间范围筛选（全部/近7天/近30天）
 *  ③ 类型筛选（日记/账单/计划）
 *  ④ 结果按类型分组展示，点击跳转详情
 */
import { ref, computed, onMounted } from 'vue'
import { globalSearch } from '@/utils/storage.js'
import { debounce } from '@/utils/debounce.js'
import SijiIcon from '@/components/common/SijiIcon.vue'
import EmptyState from '@/components/common/EmptyState.vue'

const keyword = ref('')
const searchInput = ref('')
const results = ref([])
const loading = ref(false)

// 筛选
const timeRange = ref(0) // 0=全部, 7=近7天, 30=近30天
const typeFilter = ref('all') // all | diary | bill | plan

// 搜索历史
const searchHistory = ref([])
const showHistory = ref(true)

onMounted(() => {
  const pages = getCurrentPages()
  const page = pages[pages.length - 1]
  const query = page?.$route?.query || page?.options || {}
  const kw = query.keyword || ''
  if (kw) {
    keyword.value = kw
    searchInput.value = kw
    doSearch()
  } else {
    loadHistory()
    showHistory.value = true
  }
})

function loadHistory() {
  try {
    const h = uni.getStorageSync('siji_search_history')
    searchHistory.value = h ? JSON.parse(h) : []
  } catch {
    searchHistory.value = []
  }
}

function saveHistory(kw) {
  if (!kw) return
  const h = searchHistory.value.filter(x => x !== kw)
  h.unshift(kw)
  searchHistory.value = h.slice(0, 8)
  uni.setStorageSync('siji_search_history', JSON.stringify(searchHistory.value))
}

function clearHistory() {
  searchHistory.value = []
  uni.removeStorageSync('siji_search_history')
}

// 防抖搜索
const debouncedSearch = debounce(() => doSearch(), 350)

function onInput() {
  if (searchInput.value.trim()) {
    debouncedSearch()
  } else {
    results.value = []
    showHistory.value = true
  }
}

function doSearch() {
  const kw = searchInput.value.trim()
  if (!kw) {
    results.value = []
    showHistory.value = true
    return
  }
  showHistory.value = false
  keyword.value = kw
  loading.value = true
  saveHistory(kw)

  const types = typeFilter.value === 'all'
    ? ['diary', 'bill', 'plan']
    : [typeFilter.value]

  try {
    results.value = globalSearch(kw, {
      types,
      days: timeRange.value
    })
  } catch (e) {
    console.warn('[搜索] 失败:', e.message)
    results.value = []
  } finally {
    loading.value = false
  }
}

function tapHistory(kw) {
  searchInput.value = kw
  doSearch()
}

// 按类型分组
const groupedResults = computed(() => {
  const groups = { diary: [], bill: [], plan: [] }
  results.value.forEach(r => {
    if (groups[r.type]) groups[r.type].push(r)
  })
  return groups
})

const totalCount = computed(() => results.value.length)

const typeMeta = {
  diary: { label: '日记', iconName: 'diary', color: '#FCD34D' },
  bill: { label: '账单', iconName: 'bill', color: '#F59E0B' },
  plan: { label: '计划', iconName: 'plan', color: '#10B981' }
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function tapResult(item) {
  uni.navigateTo({ url: item.route })
}

function switchType(type) {
  typeFilter.value = type
  if (keyword.value) doSearch()
}

function switchTime(days) {
  timeRange.value = days
  if (keyword.value) doSearch()
}
</script>

<template>
  <view class="search-page">
    <!-- 搜索栏 -->
    <view class="search-bar">
      <view class="search-input-wrap">
        <SijiIcon name="search" size="sm" color="var(--text-hint)" />
        <input
          v-model="searchInput"
          class="search-input"
          placeholder="搜索日记、账单、计划..."
          confirm-type="search"
          @confirm="doSearch"
          @input="onInput"
          :focus="true"
        />
        <view v-if="searchInput" class="clear-btn" @tap="searchInput = ''; doSearch()">
          <text class="clear-icon">×</text>
        </view>
      </view>
      <text class="cancel-btn" @tap="uni.navigateBack()">取消</text>
    </view>

    <!-- 筛选栏 -->
    <view class="filter-bar" v-if="!showHistory">
      <view class="filter-group">
        <text
          v-for="t in [{v:'all',l:'全部'},{v:'diary',l:'日记'},{v:'bill',l:'账单'},{v:'plan',l:'计划'}]"
          :key="t.v"
          class="filter-chip" :class="{ active: typeFilter === t.v }"
          @tap="switchType(t.v)"
        >{{ t.l }}</text>
      </view>
      <view class="filter-group">
        <text
          v-for="t in [{v:0,l:'全部'},{v:7,l:'近7天'},{v:30,l:'近30天'}]"
          :key="t.v"
          class="filter-chip" :class="{ active: timeRange === t.v }"
          @tap="switchTime(t.v)"
        >{{ t.l }}</text>
      </view>
    </view>

    <!-- 搜索历史 -->
    <view class="history-section" v-if="showHistory && searchHistory.length > 0">
      <view class="section-header">
        <text class="section-title">搜索历史</text>
        <text class="clear-link" @tap="clearHistory">清空</text>
      </view>
      <view class="history-tags">
        <text
          v-for="h in searchHistory" :key="h"
          class="history-tag"
          @tap="tapHistory(h)"
        >{{ h }}</text>
      </view>
    </view>

    <!-- 空状态 -->
    <view class="empty-state" v-if="showHistory && searchHistory.length === 0">
      <EmptyState
        title="搜索什么？"
        subtitle="输入关键词，同时搜索日记、账单和计划"
        icon-name="search"
      />
    </view>

    <!-- 搜索结果 -->
    <scroll-view v-if="!showHistory" class="result-scroll" scroll-y>
      <!-- 结果统计 -->
      <view class="result-summary" v-if="!loading">
        <text class="result-count">共 {{ totalCount }} 条结果</text>
      </view>

      <!-- 加载中 -->
      <view class="loading-state" v-if="loading">
        <text class="loading-text">搜索中...</text>
      </view>

      <!-- 无结果 -->
      <view class="no-result" v-if="!loading && totalCount === 0">
        <EmptyState
          title="未找到相关内容"
          subtitle="试试其他关键词"
          icon-name="search"
        />
      </view>

      <!-- 按类型分组展示 -->
      <template v-if="!loading && totalCount > 0">
        <view
          v-for="(group, type) in groupedResults"
          :key="type"
          class="result-group"
          v-if="group.length > 0"
        >
          <view class="group-header">
            <view class="group-left">
              <view class="group-dot" :style="{ background: typeMeta[type].color }" />
              <text class="group-title">{{ typeMeta[type].label }}</text>
              <text class="group-count">{{ group.length }}</text>
            </view>
          </view>

          <view
            v-for="item in group" :key="item.id"
            class="result-item"
            @tap="tapResult(item)"
          >
            <view class="item-main">
              <text class="item-title">{{ item.title }}</text>
              <text class="item-preview" v-if="item.preview">{{ item.preview }}</text>
            </view>
            <view class="item-meta">
              <text class="item-extra" v-if="item.extra">{{ item.extra }}</text>
              <text class="item-date">{{ formatTime(item.date) }}</text>
            </view>
          </view>
        </view>
      </template>

      <view style="height: 60rpx" />
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
.search-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: $bg-page;
}

/* 搜索栏 */
.search-bar {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-sm $spacing-md;
  background: $bg-card;
  border-bottom: 1rpx solid $bg-input;
}

.search-input-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  background: $bg-input;
  border-radius: $radius-lg;
  padding: $spacing-xs $spacing-sm;
}

.search-input {
  flex: 1;
  font-size: $font-sm;
  color: $text-primary;
}

.clear-btn {
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  background: $text-hint;
  display: flex;
  align-items: center;
  justify-content: center;
}

.clear-icon {
  color: #FFFFFF;
  font-size: 24rpx;
  line-height: 1;
}

.cancel-btn {
  font-size: $font-sm;
  color: $text-secondary;
  padding: $spacing-xs 0;
}

/* 筛选栏 */
.filter-bar {
  display: flex;
  justify-content: space-between;
  padding: $spacing-xs $spacing-md;
  background: $bg-card;
  border-bottom: 1rpx solid $bg-input;
}

.filter-group {
  display: flex;
  gap: $spacing-xs;
}

.filter-chip {
  font-size: $font-xs;
  padding: 6rpx 20rpx;
  border-radius: $radius-round;
  background: $bg-input;
  color: $text-secondary;
  transition: all $transition-fast;

  &.active {
    background: $text-primary;
    color: $text-on-ai;
    font-weight: 600;
  }
}

/* 搜索历史 */
.history-section {
  padding: $spacing-md;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $spacing-sm;
}

.section-title {
  font-size: $font-sm;
  color: $text-secondary;
  font-weight: 600;
}

.clear-link {
  font-size: $font-xs;
  color: $text-hint;
}

.history-tags {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-xs;
}

.history-tag {
  font-size: $font-xs;
  padding: 10rpx 24rpx;
  border-radius: $radius-round;
  background: $bg-card;
  color: $text-secondary;
  border: 1rpx solid $bg-input;
}

/* 空状态 */
.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 结果列表 */
.result-scroll {
  flex: 1;
  padding: 0 $spacing-md;
}

.result-summary {
  padding: $spacing-sm 0;
}

.result-count {
  font-size: $font-xs;
  color: $text-hint;
}

.loading-state {
  padding: $spacing-xl;
  text-align: center;
}

.loading-text {
  font-size: $font-sm;
  color: $text-hint;
}

.no-result {
  padding: $spacing-xl 0;
}

/* 分组 */
.result-group {
  margin-bottom: $spacing-md;
}

.group-header {
  display: flex;
  align-items: center;
  padding: $spacing-sm 0;
}

.group-left {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
}

.group-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
}

.group-title {
  font-size: $font-sm;
  font-weight: 700;
  color: $text-primary;
}

.group-count {
  font-size: $font-xs;
  color: $text-hint;
  background: $bg-input;
  padding: 2rpx 12rpx;
  border-radius: $radius-round;
}

/* 结果项 */
.result-item {
  background: $bg-card;
  border-radius: $radius-md;
  padding: $spacing-md;
  margin-bottom: $spacing-xs;
  box-shadow: $shadow-sm;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: $spacing-sm;
}

.item-main {
  flex: 1;
  min-width: 0;
}

.item-title {
  font-size: $font-sm;
  font-weight: 600;
  color: $text-primary;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-preview {
  font-size: $font-xs;
  color: $text-secondary;
  display: block;
  margin-top: 4rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-meta {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4rpx;
}

.item-extra {
  font-size: $font-xs;
  color: $text-primary;
  font-weight: 600;
}

.item-date {
  font-size: 18rpx;
  color: $text-hint;
}
</style>
