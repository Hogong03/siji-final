<script setup>
/**
 * 全局搜索结果页
 * 路由: /pages/search/result?keyword=xxx
 *
 * 功能：
 *  ① 顶部搜索框（自动聚焦，可修改关键词重新搜索）
 *  ② 筛选栏（类型 + 时间，单行紧凑）
 *  ③ 结果按类型分组展示，点击跳转详情
 */
import { ref, computed, onMounted } from 'vue'
import { globalSearch } from '@/utils/storage.js'
import { asyncSetStorageJSON } from '@/utils/store-helpers.js'
import { searchConversations } from '@/utils/conversation-search.js'
import { debounce } from '@/utils/debounce.js'
import { safeNavigateBack } from '@/utils/nav-helper.js'
import SijiIcon from '@/components/common/SijiIcon.vue'
import { useAppStore } from '@/store/index.js'

const keyword = ref('')
const searchInput = ref('')
const results = ref([])
const convResults = ref([])
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
  asyncSetStorageJSON('siji_search_history', searchHistory.value)
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
    convResults.value = []
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
    // 同步搜索对话内容（仅"全部"类型时）
    convResults.value = typeFilter.value === 'all'
      ? searchConversations(kw, { limit: 15 })
      : []
  } catch (e) {
    results.value = []
    convResults.value = []
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

const totalCount = computed(() => results.value.length + convResults.value.length)

const typeMeta = {
  diary: { label: '记录', iconName: 'diary', color: '#0EA5E9' },
  bill: { label: '账单', iconName: 'bill', color: '#F59E0B' },
  plan: { label: '计划', iconName: 'plan', color: '#059669' },
  conversation: { label: '对话', iconName: 'chat-bubble', color: '#18181B' }
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function tapResult(item) {
  uni.navigateTo({ url: item.route })
}

/** 点击对话搜索结果的跳转 */
function tapConvResult(msg) {
  const store = useAppStore()
  store.switchConversation(msg.convId)
  uni.switchTab({ url: '/pages/chat/index' })
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
    <!-- 搜索栏（紧凑） -->
    <view class="search-bar">
      <view class="search-input-wrap">
        <SijiIcon name="search" size="sm" color="#A1A1AA" />
        <input
          v-model="searchInput"
          class="search-input"
          placeholder="搜索记录、账单、计划..."
          confirm-type="search"
          @confirm="doSearch"
          @input="onInput"
          :focus="true"
        />
        <text v-if="searchInput" class="clear-icon" @tap="searchInput = ''; doSearch()">✕</text>
      </view>
      <text class="cancel-btn" @tap="safeNavigateBack()">取消</text>
    </view>

    <!-- 筛选栏（单行紧凑） -->
    <view class="filter-bar" v-if="!showHistory">
      <view class="filter-group">
        <text
          v-for="t in [{v:'all',l:'全部'},{v:'diary',l:'记录'},{v:'bill',l:'账单'},{v:'plan',l:'计划'}]"
          :key="t.v"
          class="filter-chip" :class="{ active: typeFilter === t.v }"
          @tap="switchType(t.v)"
        >{{ t.l }}</text>
      </view>
      <view class="filter-divider" />
      <view class="filter-group">
        <text
          v-for="t in [{v:0,l:'全部'},{v:7,l:'7天'},{v:30,l:'30天'}]"
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
      <text class="empty-text">输入关键词搜索</text>
    </view>

    <!-- 搜索结果 -->
    <scroll-view v-if="!showHistory" class="result-scroll" scroll-y>
      <!-- 结果统计 -->
      <text class="result-count" v-if="!loading && totalCount > 0">共 {{ totalCount }} 条</text>

      <!-- 加载中 -->
      <view class="loading-state" v-if="loading">
        <text class="loading-text">搜索中...</text>
      </view>

      <!-- 无结果 -->
      <view class="no-result" v-if="!loading && totalCount === 0">
        <text class="no-result-text">未找到相关内容</text>
      </view>

      <!-- 对话搜索结果 -->
      <view v-if="!loading && convResults.length > 0" class="result-group">
        <view class="group-header">
          <view class="group-dot" :style="{ background: typeMeta.conversation.color }" />
          <text class="group-title">{{ typeMeta.conversation.label }}</text>
          <text class="group-count">{{ convResults.length }}</text>
        </view>
        <view class="group-list">
          <view
            v-for="msg in convResults" :key="msg.convId + '-' + msg.messageIndex"
            class="result-item"
            @tap="tapConvResult(msg)"
          >
            <view class="item-main">
              <view class="conv-item-top">
                <text class="conv-role-tag" :class="msg.role">{{ msg.role === 'user' ? '你' : 'AI' }}</text>
                <text class="conv-source">{{ msg.convTitle }}</text>
              </view>
              <text class="item-preview">{{ msg.preview }}</text>
            </view>
          </view>
        </view>
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
            <view class="group-dot" :style="{ background: typeMeta[type].color }" />
            <text class="group-title">{{ typeMeta[type].label }}</text>
            <text class="group-count">{{ group.length }}</text>
          </view>

          <view class="group-list">
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
        </view>
      </template>

      <view style="height: 40rpx" />
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
@import './result.scss';
</style>
