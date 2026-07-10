<script setup>
/**
 * 功能中心 v3 — 统一布局
 *
 * 搜索栏独立置顶，仅搜索功能
 * 下方功能模块统一卡片风格，分两大分区：生活记录 + AI 助手
 */
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import SijiIcon from '@/components/common/SijiIcon.vue'
import { useAppStore } from '@/store/index.js'
import { getDiaryList, getBillList, getPlanList } from '@/utils/storage.js'
import { isMemoryEnabled } from '@/utils/memory.js'
import { getProfile, getFilledCount } from '@/utils/profile.js'
import { getRelationsStats } from '@/utils/relations.js'
import { getDecisionStats } from '@/utils/decisions.js'
import { getSimulationStats } from '@/utils/simulation.js'
import { searchConversations } from '@/utils/conversation-search.js'

const store = useAppStore()

const dashboard = ref({
  monthExpense: 0, monthIncome: 0, balance: 0,
  diaryCount: 0, diaryThisWeek: 0,
  planTotal: 0, planCompleted: 0, planActive: 0,
  avgDailyExpense: 0, todayExpense: 0, yesterdayExpense: 0
})
const weekTrend = ref([])

// ─── AI 助手分区统计 ───
const memoryEnabled = ref(true)
const profileEnabled = ref(false)
const profileFilled = ref(0)
const relationsStats = ref({ total: 0 })
const decisionStats = ref({ total: 0, pendingReview: 0 })
const simStats = ref({ total: 0 })

const aiAssistantEntries = computed(() => [
  { id: 'profile', iconName: 'user', title: '我的信息', desc: profileEnabled.value ? `已开启 · ${profileFilled.value} 项` : '点击开启', route: '/pages/settings/sub/profile' },
  { id: 'memory', iconName: 'brain', title: '记忆管理', desc: memoryEnabled.value ? '已开启' : '已关闭', route: '/pages/settings/sub/memory' },
  { id: 'relations', iconName: 'heart', title: '关系图谱', desc: `${relationsStats.value.total} 人`, route: '/pages/settings/sub/relations' },
  { id: 'decisions', iconName: 'target', title: '决策日志', desc: `${decisionStats.value.total} 条`, route: '/pages/settings/sub/decisions' },
  { id: 'simulation', iconName: 'chat-bubble', title: '情景模拟', desc: simStats.value.total > 0 ? `${simStats.value.total} 次` : '对话演练', route: '/pages/settings/sub/simulation' }
])

// ─── 生活记录入口 ───
const funcEntries = computed(() => [
  { id: 'diary', iconName: 'diary', title: '日记', desc: `${dashboard.value.diaryCount} 篇本月`, listPage: '/pages/diary/list', newPage: '/pages/diary/detail?id=new' },
  { id: 'bill', iconName: 'bill', title: '记账', desc: `¥${formatAmount(dashboard.value.monthExpense)} 本月`, listPage: '/pages/bill/index', newPage: '/pages/bill/edit?type=expense' },
  { id: 'plan', iconName: 'plan', title: '计划', desc: `${dashboard.value.planActive} 个进行中`, listPage: '/pages/plan/index', newPage: '/pages/plan/templates' },
])

onMounted(() => { loadAll() })
onShow(() => {
  loadAll()
  loadAIStats()
})
function loadAll() { loadDashboard(); loadWeekTrend() }

function loadAIStats() {
  memoryEnabled.value = isMemoryEnabled()
  const p = getProfile(); profileEnabled.value = p.enabled; profileFilled.value = getFilledCount()
  relationsStats.value = getRelationsStats()
  decisionStats.value = getDecisionStats()
  simStats.value = getSimulationStats()
}

function goSub(url) { uni.navigateTo({ url }) }
function goPage(url) { uni.navigateTo({ url }) }
function goAI() { uni.switchTab({ url: '/pages/chat/index' }) }
function goSearch() { uni.navigateTo({ url: '/pages/search/result' }) }
function goStats() { uni.navigateTo({ url: '/pages/bill/stats' }) }

// ─── 功能搜索 ───
const searchKeyword = ref('')

// 所有可搜索的功能入口（统一列表）
const allFuncEntries = computed(() => [
  ...funcEntries.value.map(e => ({ ...e, category: 'life' })),
  ...aiAssistantEntries.value.map(e => ({ ...e, category: 'ai', route: e.route })),
  { id: 'stats', iconName: 'trend', title: '消费分析', desc: '账单统计与趋势', category: 'life', listPage: '/pages/bill/stats' }
])

// 搜索过滤功能入口
const filteredFuncEntries = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase()
  if (!kw) return []
  return allFuncEntries.value.filter(e => {
    return e.title.toLowerCase().includes(kw) ||
           e.desc.toLowerCase().includes(kw) ||
           e.id.toLowerCase().includes(kw)
  })
})

// 搜索对话内容（AI 助手聊天记录）
const conversationResults = computed(() => {
  const kw = searchKeyword.value.trim()
  if (!kw || kw.length < 1) return []
  return searchConversations(kw, { limit: 10 })
})

function onSearchInput(e) {
  searchKeyword.value = e.detail.value || ''
}

function onSearchConfirm() {
  const kw = searchKeyword.value.trim()
  if (!kw) return
  // 有功能匹配或对话匹配时留在当前页展示
  // 都无结果时跳转全局搜索页
  if (filteredFuncEntries.value.length === 0 && conversationResults.value.length === 0) {
    uni.navigateTo({ url: '/pages/search/result?keyword=' + kw })
  }
}

function clearSearch() {
  searchKeyword.value = ''
}

function goToEntry(entry) {
  const url = entry.listPage || entry.route
  if (url) goPage(url)
}

/** 跳转到指定对话 */
function goToConversation(convId) {
  // 切换到该会话并跳转 chat 页
  store.switchConversation(convId)
  uni.switchTab({ url: '/pages/chat/index' })
}

function getRecentDays(n) {
  const days = []; const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i)
    const label = `${d.getMonth() + 1}/${d.getDate()}`
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    days.push({ label, dateStr })
  }
  return days
}

function loadDashboard() {
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const bills = getBillList(month)
  const diaries = getDiaryList(month)
  const plans = getPlanList()
  const expenses = bills.filter(b => b.type === 'expense' || b.type === 0)
  const incomes = bills.filter(b => b.type === 'income' || b.type === 1)
  const monthExpense = expenses.reduce((s, b) => s + (b.amount || 0), 0)
  const monthIncome = incomes.reduce((s, b) => s + (b.amount || 0), 0)
  const todayStr = formatDateStr(now)
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  const yesterdayStr = formatDateStr(yesterday)
  const todayExpense = expenses.filter(b => b.bill_date === todayStr).reduce((s, b) => s + (b.amount || 0), 0)
  const yesterdayExpense = expenses.filter(b => b.bill_date === yesterdayStr).reduce((s, b) => s + (b.amount || 0), 0)
  const dayOfMonth = now.getDate()
  const avgDailyExpense = dayOfMonth > 0 ? monthExpense / dayOfMonth : 0
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0, 0, 0, 0)
  const diaryThisWeek = diaries.filter(d => d.created_at >= weekStart.getTime()).length
  dashboard.value = {
    monthExpense, monthIncome, balance: monthIncome - monthExpense,
    diaryCount: diaries.length, diaryThisWeek,
    planTotal: plans.length,
    planCompleted: plans.filter(p => p.status === 2).length,
    planActive: plans.filter(p => p.status === 1).length,
    avgDailyExpense, todayExpense, yesterdayExpense
  }
}

function loadWeekTrend() {
  const days = getRecentDays(7)
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const bills = getBillList(month).filter(b => b.type === 'expense' || b.type === 0)
  weekTrend.value = days.map(d => ({
    label: d.label,
    amount: bills.filter(b => b.bill_date === d.dateStr).reduce((s, b) => s + (b.amount || 0), 0)
  }))
}

const categoryRanking = computed(() => {
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const bills = getBillList(month).filter(b => b.type === 'expense' || b.type === 0)
  const map = {}
  bills.forEach(b => { const c = b.category || '其他'; map[c] = (map[c] || 0) + (b.amount || 0) })
  const total = Object.values(map).reduce((s, v) => s + v, 0)
  return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, amount]) => ({
    name, amount, percent: total > 0 ? Math.round(amount / total * 100) : 0
  }))
})

const trendMax = computed(() => Math.max(...weekTrend.value.map(d => d.amount), 1))
const weekTotal = computed(() => weekTrend.value.reduce((s, d) => s + d.amount, 0))

function formatAmount(val) {
  if (val >= 10000) return (val / 10000).toFixed(1) + 'w'
  return val.toFixed(0)
}
function formatDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
</script>

<template>
  <view class="functions-page">
    <scroll-view class="func-scroll" scroll-y @refresherrefresh="loadAll" refresher-enabled>

      <!-- 搜索栏（独立置顶，可搜数据+功能） -->
      <view class="search-box">
        <SijiIcon name="search" size="sm" color="#A1A1AA" />
        <input
          class="search-input"
          v-model="searchKeyword"
          placeholder="搜索功能、日记、账单、计划..."
          :confirm-type="search"
          @input="onSearchInput"
          @confirm="onSearchConfirm"
        />
        <text v-if="searchKeyword" class="search-clear" @tap="clearSearch">✕</text>
      </view>

      <!-- 功能搜索结果（有关键词时显示） -->
      <view v-if="searchKeyword && filteredFuncEntries.length > 0" class="search-results">
        <text class="section-label">功能匹配</text>
        <view class="card-list">
          <view
            v-for="entry in filteredFuncEntries" :key="entry.id"
            class="entry-card"
            @tap="goToEntry(entry)"
          >
            <view class="entry-left">
              <view class="entry-icon-circle">
                <SijiIcon :name="entry.iconName" size="md" color="#18181B" />
              </view>
              <view class="entry-info">
                <text class="entry-title">{{ entry.title }}</text>
                <text class="entry-desc">{{ entry.desc }}</text>
              </view>
            </view>
            <text class="entry-arrow">›</text>
          </view>
        </view>
      </view>

      <!-- 对话搜索结果（有关键词时显示） -->
      <view v-if="searchKeyword && conversationResults.length > 0" class="search-results">
        <text class="section-label">对话内容 · {{ conversationResults.length }} 条</text>
        <view class="card-list">
          <view
            v-for="msg in conversationResults" :key="msg.convId + '-' + msg.messageIndex"
            class="conv-result-card"
            @tap="goToConversation(msg.convId)"
          >
            <view class="conv-result-top">
              <text class="conv-role-tag" :class="msg.role">{{ msg.role === 'user' ? '你' : 'AI' }}</text>
              <text class="conv-title">{{ msg.convTitle }}</text>
              <SijiIcon name="chevron-right" size="sm" class="conv-arrow" />
            </view>
            <text class="conv-preview">{{ msg.preview }}</text>
          </view>
        </view>
      </view>

      <!-- 生活记录分区 -->
      <text class="section-label">生活记录</text>
      <view class="card-list">
        <view
          v-for="card in funcEntries" :key="card.id"
          class="entry-card"
          @tap="goPage(card.listPage)"
        >
          <view class="entry-left">
            <view class="entry-icon-circle">
              <SijiIcon :name="card.iconName" size="md" color="#18181B" />
            </view>
            <view class="entry-info">
              <text class="entry-title">{{ card.title }}</text>
              <text class="entry-desc">{{ card.desc }}</text>
            </view>
          </view>
          <view class="entry-right">
            <view class="entry-new-btn" @tap.stop="goPage(card.newPage)">
              <text class="entry-new-text">+</text>
            </view>
            <text class="entry-arrow">›</text>
          </view>
        </view>
      </view>

      <!-- 消费分析 -->
      <view class="analysis-card" v-if="categoryRanking.length > 0 || weekTrend.length > 0">
        <view class="ac-header">
          <text class="ac-title">消费分析</text>
          <text class="ac-link" @tap="goStats">详细 →</text>
        </view>

        <view class="trend-section" v-if="weekTrend.length > 0">
          <view class="trend-meta">
            <text class="trend-label">近 7 天</text>
            <text class="trend-total">¥{{ weekTotal.toFixed(0) }}</text>
          </view>
          <view class="trend-chart">
            <view v-for="(d, i) in weekTrend" :key="i" class="trend-col">
              <view class="trend-bar-bg">
                <view class="trend-bar" :style="{
                  height: Math.max(6, (d.amount / trendMax) * 100) + '%',
                  background: d.amount > 0 ? '#000000' : '#F4F4F5'
                }" />
              </view>
              <text class="trend-day">{{ d.label }}</text>
            </view>
          </view>
        </view>

        <view class="ac-divider" v-if="categoryRanking.length > 0 && weekTrend.length > 0" />

        <view class="rank-section" v-if="categoryRanking.length > 0">
          <text class="rank-title">分类 TOP{{ categoryRanking.length }}</text>
          <view v-for="item in categoryRanking" :key="item.name" class="rank-row">
            <text class="rank-name">{{ item.name }}</text>
            <view class="rank-bar-wrap">
              <view class="rank-bar" :style="{ width: item.percent + '%' }" />
            </view>
            <text class="rank-amount">¥{{ item.amount.toFixed(0) }}</text>
            <text class="rank-pct">{{ item.percent }}%</text>
          </view>
        </view>
      </view>

      <!-- AI 助手分区 -->
      <text class="section-label">AI 助手</text>
      <view class="card-list">
        <view
          v-for="entry in aiAssistantEntries" :key="entry.id"
          class="entry-card"
          @tap="goSub(entry.route)"
        >
          <view class="entry-left">
            <view class="entry-icon-circle">
              <SijiIcon :name="entry.iconName" size="md" color="#18181B" />
            </view>
            <view class="entry-info">
              <text class="entry-title">{{ entry.title }}</text>
              <text class="entry-desc">{{ entry.desc }}</text>
            </view>
          </view>
          <text class="entry-arrow">›</text>
        </view>
      </view>

      <view style="height: 40rpx" />
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
.functions-page {
  height: 100vh;
  background: #F4F4F5;
  overflow: hidden;
}

.func-scroll {
  height: 100%;
  padding: 24rpx;
  box-sizing: border-box;
}

/* ─── 搜索栏（独立置顶） ─── */
.search-box {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 20rpx 24rpx;
  background: #FFFFFF;
  border-radius: 20rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}

.search-input {
  flex: 1;
  font-size: 28rpx;
  color: #18181B;
  background: transparent;
}

.search-clear {
  font-size: 28rpx;
  color: #A1A1AA;
  padding: 4rpx 8rpx;
}

.search-placeholder {
  font-size: 28rpx;
  color: #A1A1AA;
}

.search-results {
  margin-bottom: 16rpx;
}

/* ─── 分区标签 ─── */
.section-label {
  display: block;
  font-size: 24rpx;
  font-weight: 600;
  color: #A1A1AA;
  letter-spacing: 2rpx;
  margin: 16rpx 0 12rpx 8rpx;
}

/* ─── 统一卡片列表 ─── */
.card-list {
  background: #FFFFFF;
  border-radius: 20rpx;
  overflow: hidden;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}

.entry-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 24rpx;
  border-bottom: 1rpx solid #F4F4F5;
  gap: 16rpx;
  box-sizing: border-box;

  &:last-child { border-bottom: none; }
  &:active { background: #FAFAFA; }
}

.entry-left {
  display: flex;
  align-items: center;
  gap: 20rpx;
  flex: 1;
  min-width: 0;
}

.entry-icon-circle {
  width: 72rpx;
  height: 72rpx;
  min-width: 72rpx;
  border-radius: 50%;
  background: #F4F4F5;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.entry-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.entry-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #18181B;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entry-desc {
  font-size: 24rpx;
  color: #A1A1AA;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entry-right {
  display: flex;
  align-items: center;
  gap: 16rpx;
  flex-shrink: 0;
}

.entry-new-btn {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: #18181B;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.entry-new-text {
  font-size: 36rpx;
  font-weight: 400;
  color: #FFFFFF;
  line-height: 1;
}

.entry-arrow {
  font-size: 36rpx;
  color: #D4D4D8;
  font-weight: 300;
  flex-shrink: 0;
}

/* ─── 消费分析 ─── */
.analysis-card {
  padding: 28rpx 24rpx;
  margin-bottom: 16rpx;
  background: #FFFFFF;
  border-radius: 20rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
  box-sizing: border-box;
}

.ac-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 16rpx;
  gap: 16rpx;

  .ac-title { font-size: 28rpx; font-weight: 700; color: #18181B; }
  .ac-link { font-size: 24rpx; color: #000000; font-weight: 500; }
}

.trend-meta {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12rpx;
  gap: 12rpx;
  .trend-label { font-size: 22rpx; color: #A1A1AA; }
  .trend-total { font-size: 26rpx; color: #18181B; font-weight: 600; }
}

.trend-chart {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  height: 120rpx;
}

.trend-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;
}

.trend-bar-bg {
  flex: 1;
  width: 24rpx;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.trend-bar {
  width: 100%;
  border-radius: 6rpx 6rpx 2rpx 2rpx;
  min-height: 6rpx;
  transition: height 0.3s ease;
}

.trend-day { font-size: 18rpx; color: #A1A1AA; }

.ac-divider {
  height: 1rpx;
  background: #F4F4F5;
  margin: 16rpx 0;
}

.rank-section { padding-top: 4rpx; }

.rank-title {
  font-size: 22rpx;
  font-weight: 600;
  color: #71717A;
  display: block;
  margin-bottom: 12rpx;
}

.rank-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 6rpx 0;

  .rank-name { width: 80rpx; min-width: 80rpx; font-size: 24rpx; color: #71717A; flex-shrink: 0; }
  .rank-bar-wrap { flex: 1; min-width: 0; height: 10rpx; background: #F4F4F5; border-radius: 5rpx; overflow: hidden; }
  .rank-bar { height: 100%; background: #000000; border-radius: 5rpx; transition: width 0.3s ease; }
  .rank-amount { font-size: 24rpx; font-weight: 600; color: #18181B; width: 80rpx; min-width: 80rpx; text-align: right; flex-shrink: 0; }
  .rank-pct { font-size: 20rpx; color: #A1A1AA; width: 50rpx; min-width: 50rpx; text-align: right; flex-shrink: 0; }
}

/* ─── 对话搜索结果 ─── */
.conv-result-card {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 24rpx 24rpx;
  border-bottom: 1rpx solid #F4F4F5;
  box-sizing: border-box;

  &:last-child { border-bottom: none; }
  &:active { background: #FAFAFA; }
}

.conv-result-top {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.conv-role-tag {
  font-size: 20rpx;
  font-weight: 600;
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
  flex-shrink: 0;

  &.user { background: #F4F4F5; color: #71717A; }
  &.assistant { background: #18181B; color: #FFFFFF; }
}

.conv-title {
  flex: 1;
  font-size: 26rpx;
  color: #18181B;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.conv-arrow {
  flex-shrink: 0;
  color: #D4D4D8;
}

.conv-preview {
  font-size: 24rpx;
  color: #71717A;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ─── AI 对话入口（已移除） ─── */
</style>
