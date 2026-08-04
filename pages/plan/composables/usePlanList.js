/**
 * 计划列表数据 — 加载、搜索、筛选、统计
 */
import { ref, computed } from 'vue'
import { getPlanList, getUsedTags } from '@/utils/storage.js'
import { savePlan, deletePlan } from '@/utils/storage/plan.js'

export function usePlanList() {
  const allPlans = ref([])
  const searchKeyword = ref('')
  const filterStatus = ref(-1)
  const filterPriority = ref(-1)
  const filterTag = ref('')
  const filterTags = ref([])

  function loadPlans() {
    allPlans.value = getPlanList()
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
      list = list.filter(p =>
        (p.title || '').toLowerCase().includes(kw) ||
        (p.description || '').toLowerCase().includes(kw) ||
        (Array.isArray(p.subtasks) && p.subtasks.some(s => (s.title || '').toLowerCase().includes(kw)))
      )
    }
    return list.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
      if (a.due_date) return -1
      if (b.due_date) return 1
      return 0
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

    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const overdue = all.filter(p => p.status !== 2 && p.due_date && p.due_date < todayStr).length

    let subTotal = 0, subDone = 0
    all.forEach(p => {
      if (Array.isArray(p.subtasks)) {
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
    const updated = { ...plan, status: nextStatus, updated_at: Date.now() }
    savePlan(updated)
    allPlans.value = allPlans.value.map(p => p.client_id === plan.client_id ? updated : p)
    uni.showToast({ title: `已标记为${statusNames[nextStatus]}`, icon: 'none' })
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
