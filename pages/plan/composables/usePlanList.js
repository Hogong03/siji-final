/**
 * 计划列表数据 — 加载、搜索、筛选、统计（子计划模型）
 */
import { ref, computed } from 'vue'
import { getPlanList, getUsedTags } from '@/utils/storage.js'
import { savePlan, deletePlan } from '@/utils/storage/plan.js'
import { toPlanTs } from '@/utils/plan-timeline.js'

export function usePlanList() {
  const allPlans = ref([])
  const searchKeyword = ref('')
  const filterStatus = ref(-1)
  const filterPriority = ref(-1)
  const filterTag = ref('')
  const filterTags = ref([])

  /** 为列表补充子计划进度（_childStats 仅用于展示，不落库） */
  function enrich(list) {
    const byParent = {}
    list.forEach(p => { if (p.parent_id) (byParent[p.parent_id] || (byParent[p.parent_id] = [])).push(p) })
    return list.map(p => {
      const kids = byParent[p.client_id]
      const childStats = kids && kids.length > 0
        ? { total: kids.length, done: kids.filter(k => k.status === 2).length }
        : null
      return childStats ? { ...p, _childStats: childStats } : p
    })
  }

  function loadPlans() {
    allPlans.value = enrich(getPlanList())
  }

  function loadTags() {
    filterTags.value = getUsedTags('plan')
  }

  // ==================== 筛选 ====================
  const filteredPlans = computed(() => {
    let list = allPlans.value
    if (filterStatus.value !== -1) list = list.filter(p => p.status === filterStatus.value)
    if (filterPriority.value !== -1) list = list.filter(p => p.priority === filterPriority.value)
    if (filterTag.value) {
      list = list.filter(p => {
        const tags = Array.isArray(p.tags) ? p.tags : []
        return tags.includes(filterTag.value)
      })
    }
    if (searchKeyword.value.trim()) {
      const kw = searchKeyword.value.trim().toLowerCase()
      const childTitles = {}
      allPlans.value.forEach(p => {
        if (p.parent_id) {
          const t = (p.title || '').toLowerCase()
          if (!childTitles[p.parent_id]) childTitles[p.parent_id] = []
          childTitles[p.parent_id].push(t)
        }
      })
      list = list.filter(p => {
        if ((p.title || '').toLowerCase().includes(kw)) return true
        if ((p.description || '').toLowerCase().includes(kw)) return true
        if (Array.isArray(p.subtasks) && p.subtasks.some(s => (s.title || '').toLowerCase().includes(kw))) return true
        return (childTitles[p.client_id] || []).some(t => t.includes(kw))
      })
    }
    return list.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority
      const at = toPlanTs(a.due_date || a.deadline) || 0
      const bt = toPlanTs(b.due_date || b.deadline) || 0
      if (at !== bt) return at - bt
      return (b.created_at || 0) - (a.created_at || 0)
    })
  })

  const hasActiveFilter = computed(() =>
    searchKeyword.value || filterStatus.value !== -1 || filterPriority.value !== -1 || filterTag.value
  )

  function resetFilters() {
    searchKeyword.value = ''
    filterStatus.value = -1
    filterPriority.value = -1
    filterTag.value = ''
  }

  // ==================== 统计 ====================
  const stats = computed(() => {
    const all = allPlans.value
    const total = all.length
    const active = all.filter(p => p.status === 1).length
    const completed = all.filter(p => p.status === 2).length
    const pending = all.filter(p => p.status === 0).length
    const rate = total > 0 ? Math.round(completed / total * 100) : 0

    const pHigh = all.filter(p => p.priority === 2).length
    const pMid = all.filter(p => p.priority === 1).length
    const pLow = all.filter(p => p.priority === 0).length

    const overdue = all.filter(p => p.status !== 2 && p.due_date && toPlanTs(p.due_date, true) < Date.now()).length

    let subTotal = 0, subDone = 0
    all.forEach(p => {
      if (p._childStats) {
        subTotal += p._childStats.total
        subDone += p._childStats.done
      } else if (Array.isArray(p.subtasks) && p.subtasks.length > 0) {
        subTotal += p.subtasks.length
        subDone += p.subtasks.filter(s => s.done).length
      }
    })

    return { total, active, completed, pending, rate, pHigh, pMid, pLow, overdue, subTotal, subDone }
  })

  const priorityBar = computed(() => {
    const s = stats.value
    const total = s.pHigh + s.pMid + s.pLow
    if (total === 0) return []
    return [
      { label: '紧急', count: s.pHigh, pct: (s.pHigh / total * 100).toFixed(0), color: '#D35D5D' },
      { label: '重要', count: s.pMid, pct: (s.pMid / total * 100).toFixed(0), color: '#E8A838' },
      { label: '普通', count: s.pLow, pct: (s.pLow / total * 100).toFixed(0), color: '#999' }
    ]
  })

  // ==================== 快捷操作 ====================
  function quickToggleStatus(plan, targetStatus) {
    const nextStatus = targetStatus !== undefined ? targetStatus : (plan.status === 0 ? 1 : plan.status === 1 ? 2 : 0)
    const statusNames = ['待开始', '进行中', '已完成']
    const { _childStats, ...rest } = plan
    const updated = { ...rest, status: nextStatus, updated_at: Date.now() }
    savePlan(updated)
    allPlans.value = enrich(allPlans.value.map(p => p.client_id === plan.client_id ? updated : p))
    uni.showToast({ title: '已标记为' + statusNames[nextStatus], icon: 'none' })
  }

  function removePlan(clientId) {
    deletePlan(clientId)
    allPlans.value = allPlans.value.filter(p => p.client_id !== clientId)
  }

  return {
    allPlans, searchKeyword, filterStatus, filterPriority, filterTag, filterTags,
    filteredPlans, hasActiveFilter, stats, priorityBar,
    loadPlans, loadTags, resetFilters, quickToggleStatus, removePlan
  }
}
