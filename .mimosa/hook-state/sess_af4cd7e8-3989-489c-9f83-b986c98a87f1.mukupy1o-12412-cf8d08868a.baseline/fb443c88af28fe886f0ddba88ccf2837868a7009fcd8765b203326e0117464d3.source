/**
 * 功能中心数据 composable
 *
 * 从 functions/index.vue 拆出 — 仪表盘数据加载、趋势计算、分类排名
 */
import { ref, computed } from 'vue'
import { getDiaryList, getBillList, getPlanList } from '@/utils/storage.js'
import { isMemoryEnabled } from '@/utils/memory.js'
import { getProfile, getFilledCount } from '@/utils/profile.js'
import { getRelationsStats } from '@/utils/relations.js'
import { getDecisionStats } from '@/utils/decisions.js'
import { getSimulationStats } from '@/utils/simulation.js'

export function useFunctionsData() {
  const dashboard = ref({
    monthExpense: 0, monthIncome: 0, balance: 0,
    diaryCount: 0, diaryThisWeek: 0,
    planTotal: 0, planCompleted: 0, planActive: 0,
    avgDailyExpense: 0, todayExpense: 0, yesterdayExpense: 0
  })
  const weekTrend = ref([])

  const memoryEnabled = ref(true)
  const profileEnabled = ref(false)
  const profileFilled = ref(0)
  const relationsStats = ref({ total: 0 })
  const decisionStats = ref({ total: 0, pendingReview: 0 })
  const simStats = ref({ total: 0 })

  function loadAll() {
    _loadDashboard()
    _loadWeekTrend()
  }

  function loadAIStats() {
    memoryEnabled.value = isMemoryEnabled()
    const p = getProfile()
    profileEnabled.value = p.enabled
    profileFilled.value = getFilledCount()
    relationsStats.value = getRelationsStats()
    decisionStats.value = getDecisionStats()
    simStats.value = getSimulationStats()
  }

  const categoryRanking = computed(() => {
    const now = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const bills = getBillList(month).filter(b => b.type === 'expense' || b.type === 0)
    const map = {}
    bills.forEach(b => {
      const c = b.category || '其他'
      map[c] = (map[c] || 0) + (b.amount || 0)
    })
    const total = Object.values(map).reduce((s, v) => s + v, 0)
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, amount]) => ({
        name, amount,
        percent: total > 0 ? Math.round(amount / total * 100) : 0
      }))
  })

  const trendMax = computed(() => Math.max(...weekTrend.value.map(d => d.amount), 1))
  const weekTotal = computed(() => weekTrend.value.reduce((s, d) => s + d.amount, 0))

  const weekCompare = computed(() => {
    if (weekTrend.value.length < 7) return 0
    const first3 = weekTrend.value.slice(0, 3).reduce((s, d) => s + d.amount, 0) / 3
    const last4 = weekTrend.value.slice(3).reduce((s, d) => s + d.amount, 0) / 4
    if (first3 === 0) return 0
    return Math.round((last4 - first3) / first3 * 100)
  })

  // ─── 内部函数 ───

  function _loadDashboard() {
    const now = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const bills = getBillList(month)
    const diaries = getDiaryList(month)
    const plans = getPlanList()
    const expenses = bills.filter(b => b.type === 'expense' || b.type === 0)
    const incomes = bills.filter(b => b.type === 'income' || b.type === 1)
    const monthExpense = expenses.reduce((s, b) => s + (b.amount || 0), 0)
    const monthIncome = incomes.reduce((s, b) => s + (b.amount || 0), 0)
    const todayStr = _formatDateStr(now)
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
    const yesterdayStr = _formatDateStr(yesterday)
    const todayExpense = expenses.filter(b => b.bill_date === todayStr).reduce((s, b) => s + (b.amount || 0), 0)
    const yesterdayExpense = expenses.filter(b => b.bill_date === yesterdayStr).reduce((s, b) => s + (b.amount || 0), 0)
    const dayOfMonth = now.getDate()
    const avgDailyExpense = dayOfMonth > 0 ? monthExpense / dayOfMonth : 0
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay())
    weekStart.setHours(0, 0, 0, 0)
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

  function _loadWeekTrend() {
    const days = _getRecentDays(7)
    const now = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const bills = getBillList(month).filter(b => b.type === 'expense' || b.type === 0)
    weekTrend.value = days.map(d => ({
      label: d.label,
      amount: bills.filter(b => b.bill_date === d.dateStr).reduce((s, b) => s + (b.amount || 0), 0)
    }))
  }

  return {
    dashboard, weekTrend,
    memoryEnabled, profileEnabled, profileFilled,
    relationsStats, decisionStats, simStats,
    categoryRanking, trendMax, weekTotal, weekCompare,
    loadAll, loadAIStats
  }
}

// ─── 工具函数 ───

function _formatDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function _getRecentDays(n) {
  const days = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i)
    const label = `${d.getMonth() + 1}/${d.getDate()}`
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    days.push({ label, dateStr })
  }
  return days
}
