/**
 * 记录列表页 — 搜索、统计、标签、日历、时间线
 *
 * 4.2.0：分类并入标签（分类维度从 3 套压到 1 套）
 *   - 筛选只留两个入口：时间范围（全部 / 本月 / 上月）+ 标签
 *   - 搜索框支持一句话筛选（「上周的工作记录」→ 自动落时间范围 + 关键词）
 *   - 顶部回顾卡：每天一次，从 7 天前 / 30 天前 / 去年今日各挑一条旧记录
 * 不再区分本地/全局搜索
 */
import { ref, computed, watch } from 'vue'
import { getDiaryList, getUsedTags, getDiariesBetween } from '@/utils/storage.js'
import { parseDiaryQuery } from '@/utils/diary-query.js'
import { pickReviewRecords } from '@/utils/record-review.js'

export function useDiaryList() {
  const diaries = ref([])
  const currentMonth = ref('')
  const loading = ref(false)
  const filterTag = ref('')
  const filterTags = ref([])
  const searchKeyword = ref('')
  // 回顾卡（每天一次）
  const reviewRecords = ref([])
  const viewMode = ref('list') // list | timeline | calendar

  // 统计（基于当前时间范围内全部记录，不受搜索/筛选影响）
  const monthCount = computed(() => diaries.value.filter(d => d.is_deleted !== 1).length)
  const totalWords = computed(() => diaries.value.reduce((sum, d) => sum + (d.title || '').length + (d.content || '').length, 0))
  const streakDays = computed(() => {
    if (diaries.value.length === 0) return 0
    const days = new Set()
    diaries.value.forEach(d => {
      if (d.is_deleted !== 1 && d.created_at) {
        const date = new Date(d.created_at)
        days.add(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`)
      }
    })
    return days.size
  })

  // 情绪分布
  const emotionStats = computed(() => {
    const map = { 开心: 0, 平静: 0, 焦虑: 0, 低落: 0, 愤怒: 0 }
    diaries.value.forEach(d => {
      if (d.is_deleted !== 1 && d.emotion && map[d.emotion] !== undefined) map[d.emotion]++
    })
    const total = Object.values(map).reduce((a, b) => a + b, 0)
    return { map, total }
  })

  // 高频标签：筛选面板用前 5，快捷条用前 8（按使用频次排，点一下就筛）
  const topTags = computed(() => {
    return [...filterTags.value].sort((a, b) => b.count - a.count).slice(0, 5)
  })
  const quickTags = computed(() => {
    return [...filterTags.value].sort((a, b) => b.count - a.count).slice(0, 8)
  })

  // 置顶排序
  const sortedDiaries = computed(() => {
    return [...diaries.value].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      return (b.created_at || 0) - (a.created_at || 0)
    })
  })

  // 统一筛选：搜索 + 标签（4.2.0 起不再有分类维度）
  const filteredDiaries = computed(() => {
    let result = sortedDiaries.value
    if (filterTag.value) {
      result = result.filter(item => getItemTags(item).includes(filterTag.value))
    }
    if (searchKeyword.value.trim()) {
      const kw = searchKeyword.value.trim().toLowerCase()
      result = result.filter(d =>
        (d.title || '').toLowerCase().includes(kw) ||
        (d.content || '').toLowerCase().includes(kw) ||
        (Array.isArray(d.tags) && d.tags.some(t => t.toLowerCase().includes(kw)))
      )
    }
    return result
  })

  // 日历视图数据
  const calendarDays = computed(() => {
    if (!currentMonth.value || currentMonth.value === 'all') return []
    const [y, m] = currentMonth.value.split('-').map(Number)
    const firstDay = new Date(y, m - 1, 1)
    const lastDay = new Date(y, m, 0)
    const startWeekday = firstDay.getDay()
    const daysInMonth = lastDay.getDate()
    const cells = []
    for (let i = 0; i < startWeekday; i++) cells.push({ empty: true })
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(y, m - 1, d)
      const dayRecords = filteredDiaries.value.filter(r => {
        const rd = new Date(r.created_at)
        return rd.getFullYear() === y && rd.getMonth() === m - 1 && rd.getDate() === d
      })
      cells.push({
        day: d,
        count: dayRecords.length,
        words: dayRecords.reduce((s, r) => s + (r.title || '').length + (r.content || '').length, 0),
        records: dayRecords,
        isToday: date.toDateString() === new Date().toDateString()
      })
    }
    return cells
  })

  // 时间线分组
  const timelineGroups = computed(() => {
    const groups = {}
    filteredDiaries.value.forEach(d => {
      const date = new Date(d.created_at)
      const key = `${date.getMonth() + 1}月${date.getDate()}日`
      if (!groups[key]) groups[key] = []
      groups[key].push(d)
    })
    return Object.entries(groups).map(([date, items]) => ({ date, items }))
  })

  /** 月份 key（YYYY-MM） */
  function monthKeyOf(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  }

  // 时间范围（4.2.0：从 13 个 chip 收敛到 3 个 —— 找更早的记录用搜索或「全部」）
  const months = computed(() => {
    const now = new Date()
    const last = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return [
      { key: 'all', label: '全部' },
      { key: monthKeyOf(now), label: '本月' },
      { key: monthKeyOf(last), label: '上月' }
    ]
  })

  function loadDiaries() {
    loading.value = true
    try {
      if (currentMonth.value === 'all') {
        const allKeys = uni.getStorageInfoSync().keys || []
        const all = []
        allKeys.filter(k => k.startsWith('diary_')).forEach(key => {
          const raw = uni.getStorageSync(key)
          if (!raw) return
          try { JSON.parse(raw).forEach(d => { if (d.is_deleted !== 1) all.push(d) }) } catch {}
        })
        all.sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
        diaries.value = all
      } else {
        diaries.value = getDiaryList(currentMonth.value)
      }
    } finally { loading.value = false }
  }

  function loadTags() { filterTags.value = getUsedTags('diary') }

  // 切换时间范围 — 只重载数据，不清搜索/标签
  function switchMonth(key) {
    currentMonth.value = key
    loadDiaries()
    loadTags()
  }

  /**
   * 一句话筛选（4.2.0）：「上周的工作记录」→ 自动落时间范围 + 关键词
   * 规则在 utils/diary-query.js（纯函数），这里只负责把结果落到状态上
   * @param {string} text
   */
  function applyQuery(text) {
    const parsed = parseDiaryQuery(text)
    if (parsed.keyword) searchKeyword.value = parsed.keyword
    const now = new Date()
    if (parsed.range === 'lastMonth') {
      switchMonth(monthKeyOf(new Date(now.getFullYear(), now.getMonth() - 1, 1)))
    } else if (parsed.range) {
      switchMonth(monthKeyOf(now))
    }
  }

  // ==================== 回顾卡（4.2.0，每天最多一次） ====================
  const REVIEW_KEY = 'siji_diary_review_day'

  /** 今天的日期串（YYYY-MM-DD），用于「今天回顾过没有」 */
  function todayKey() {
    const d = new Date()
    return monthKeyOf(d) + '-' + String(d.getDate()).padStart(2, '0')
  }

  /** 今天是否还没回顾过 */
  function reviewDue() {
    try {
      return uni.getStorageSync(REVIEW_KEY) !== todayKey()
    } catch (e) {
      return true
    }
  }

  function markReviewed() {
    try {
      uni.setStorageSync(REVIEW_KEY, todayKey())
    } catch (e) { /* 存不下就下次再问 */ }
  }

  /** 加载回顾卡（近两年记录里挑 3 条） */
  function loadReview() {
    if (!reviewDue()) { reviewRecords.value = []; return }
    try {
      const now = Date.now()
      const pool = getDiariesBetween(now - 730 * 24 * 60 * 60 * 1000, now)
      reviewRecords.value = pickReviewRecords(pool, now, { limit: 3 })
    } catch (e) {
      reviewRecords.value = []
    }
  }

  /** 关掉回顾卡（今天不再出现） */
  function dismissReview() {
    reviewRecords.value = []
    markReviewed()
  }

  // ==================== 分页（可选，用户自由开关，设置持久化） ====================
  const PAGINATION_KEY = 'siji_diary_pagination'
  const PAGE_SIZE_KEY = 'siji_diary_page_size'

  function readStorageBool(key, def) {
    try {
      const v = uni.getStorageSync(key)
      return v === '' || v === null || v === undefined ? def : !!v
    } catch { return def }
  }
  function readStorageNumber(key, def) {
    try {
      const v = uni.getStorageSync(key)
      return typeof v === 'number' && v > 0 ? v : def
    } catch { return def }
  }

  const paginationEnabled = ref(readStorageBool(PAGINATION_KEY, false))
  const pageSize = ref(readStorageNumber(PAGE_SIZE_KEY, 20))
  const page = ref(1)

  const pageCount = computed(() => {
    if (!paginationEnabled.value) return 1
    return Math.max(1, Math.ceil(filteredDiaries.value.length / pageSize.value))
  })

  // 分页视图数据：关闭分页时等价于全量列表
  const pagedDiaries = computed(() => {
    if (!paginationEnabled.value) return filteredDiaries.value
    const start = (page.value - 1) * pageSize.value
    return filteredDiaries.value.slice(start, start + pageSize.value)
  })

  // 数据/筛选/条数变化时修正页码（超出范围回退到最后一页；允许空页占位）
  watch([filteredDiaries, pageSize, paginationEnabled], () => {
    if (!paginationEnabled.value) { page.value = 1; return }
    if (page.value > pageCount.value) page.value = pageCount.value
  })

  function setPagination(on) {
    paginationEnabled.value = !!on
    page.value = 1
    try { uni.setStorageSync(PAGINATION_KEY, paginationEnabled.value) } catch { /* ignore */ }
  }

  function setPageSize(n) {
    pageSize.value = n
    page.value = 1
    try { uni.setStorageSync(PAGE_SIZE_KEY, n) } catch { /* ignore */ }
  }

  function prevPage() { if (page.value > 1) page.value-- }
  function nextPage() { if (page.value < pageCount.value) page.value++ }
  function goPage(p) { if (p >= 1 && p <= pageCount.value) page.value = p }

  // 是否有激活的筛选条件（4.2.0：只有标签与搜索两个维度）
  const hasActiveFilter = computed(() => {
    return !!(filterTag.value || searchKeyword.value.trim())
  })

  // 重置筛选（不清时间范围）
  function resetFilters() {
    filterTag.value = ''
    searchKeyword.value = ''
  }

  function toggleTag(tagName) {
    filterTag.value = filterTag.value === tagName ? '' : tagName
  }

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

  function formatDate(ts) {
    const d = new Date(ts)
    const pad = n => String(n).padStart(2, '0')
    if (currentMonth.value === 'all') {
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    }
    return `${d.getMonth() + 1}月${d.getDate()}日`
  }

  return {
    diaries, currentMonth, loading, filterTag, filterTags,
    searchKeyword, viewMode, reviewRecords,
    monthCount, totalWords, streakDays, topTags, quickTags, emotionStats,
    filteredDiaries, calendarDays, timelineGroups, months,
    paginationEnabled, pageSize, page, pageCount, pagedDiaries,
    setPagination, setPageSize, prevPage, nextPage, goPage,
    loadDiaries, loadTags, switchMonth, toggleTag, applyQuery, loadReview, dismissReview,
    getItemTags, tagColor, formatDate,
    hasActiveFilter, resetFilters
  }
}
