/**
 * 计划统计 — 数据计算 composable
 */
import { ref, computed } from 'vue'
import { getPlanList } from '@/utils/storage.js'

export function usePlanStats() {
  const plans = ref([])
  const timeRange = ref('all') // all / month / 30days

  function loadPlans() {
    plans.value = getPlanList()
  }

  // 按时间范围筛选
  const rangePlans = computed(() => {
    if (timeRange.value === 'all') return plans.value
    const now = new Date()
    if (timeRange.value === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
      return plans.value.filter(p => (p.created_at || 0) >= start)
    }
    // 30days
    const start = now.getTime() - 30 * 86400000
    return plans.value.filter(p => (p.created_at || 0) >= start)
  })

  // 总览
  const overview = computed(() => {
    const all = rangePlans.value
    const total = all.length
    const active = all.filter(p => p.status === 1).length
    const completed = all.filter(p => p.status === 2).length
    const pending = all.filter(p => p.status === 0).length
    const rate = total > 0 ? Math.round(completed / total * 100) : 0
    return { total, active, completed, pending, rate }
  })

  // 优先级分布
  const priorityDist = computed(() => {
    const all = rangePlans.value
    const high = all.filter(p => p.priority === 2).length
    const mid = all.filter(p => p.priority === 1).length
    const low = all.filter(p => p.priority === 0).length
    const total = high + mid + low
    return [
      { label: '紧急', count: high, color: '#D35D5D', pct: total > 0 ? Math.round(high / total * 100) : 0 },
      { label: '重要', count: mid, color: '#E8A838', pct: total > 0 ? Math.round(mid / total * 100) : 0 },
      { label: '普通', count: low, color: '#999', pct: total > 0 ? Math.round(low / total * 100) : 0 }
    ]
  })

  // 状态分布
  const statusDist = computed(() => {
    const all = rangePlans.value
    const active = all.filter(p => p.status === 1).length
    const completed = all.filter(p => p.status === 2).length
    const pending = all.filter(p => p.status === 0).length
    const total = active + completed + pending
    return [
      { label: '进行中', count: active, color: '#18181B', pct: total > 0 ? Math.round(active / total * 100) : 0 },
      { label: '已完成', count: completed, color: '#52525B', pct: total > 0 ? Math.round(completed / total * 100) : 0 },
      { label: '待开始', count: pending, color: '#A1A1AA', pct: total > 0 ? Math.round(pending / total * 100) : 0 }
    ]
  })

  // 近30天趋势
  const trendData = computed(() => {
    const now = new Date()
    const days = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      const startTs = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
      const endTs = startTs + 86400000
      const created = plans.value.filter(p => p.created_at >= startTs && p.created_at < endTs).length
      const done = plans.value.filter(p => {
        if (p.status !== 2) return false
        const updated = p.updated_at || 0
        return updated >= startTs && updated < endTs
      }).length
      const label = `${d.getMonth() + 1}/${d.getDate()}`
      days.push({ label, created, done })
    }
    return days
  })

  // 完成速度
  const completionStats = computed(() => {
    const done = rangePlans.value.filter(p => p.status === 2 && p.created_at && p.updated_at)
    if (done.length === 0) return { avg: 0, fastest: 0, slowest: 0, count: 0 }
    const days = done.map(p => Math.ceil((p.updated_at - p.created_at) / 86400000))
    const avg = Math.round(days.reduce((s, d) => s + d, 0) / days.length)
    const fastest = Math.min(...days)
    const slowest = Math.max(...days)
    return { avg, fastest, slowest, count: done.length }
  })

  // 子任务统计（含阶段化子任务）
  const subtaskStats = computed(() => {
    let total = 0, done = 0
    rangePlans.value.forEach(p => {
      // 普通子任务
      if (Array.isArray(p.subtasks) && (!p.phases || p.phases.length === 0)) {
        total += p.subtasks.length
        done += p.subtasks.filter(s => s.done).length
      }
      // 阶段化子任务
      if (Array.isArray(p.phases)) {
        p.phases.forEach(ph => {
          if (Array.isArray(ph.subtasks)) {
            total += ph.subtasks.length
            done += ph.subtasks.filter(s => s.done).length
          }
        })
      }
    })
    return { total, done, rate: total > 0 ? Math.round(done / total * 100) : 0 }
  })

  // 优先级完成率
  const priorityCompletion = computed(() => {
    return priorityDist.value.map(p => {
      const targetP = p.label === '紧急' ? 2 : p.label === '重要' ? 1 : 0
      const items = rangePlans.value.filter(pl => (pl.priority || 0) === targetP)
      const done = items.filter(pl => pl.status === 2).length
      return { ...p, total: items.length, done, completionRate: items.length > 0 ? Math.round(done / items.length * 100) : 0 }
    })
  })

  // 标签统计
  const tagStats = computed(() => {
    const tagMap = {}
    rangePlans.value.forEach(p => {
      if (Array.isArray(p.tags)) {
        p.tags.forEach(t => {
          if (!tagMap[t]) tagMap[t] = { label: t, total: 0, done: 0 }
          tagMap[t].total++
          if (p.status === 2) tagMap[t].done++
        })
      }
    })
    return Object.values(tagMap)
      .map(t => ({ ...t, rate: t.total > 0 ? Math.round(t.done / t.total * 100) : 0 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
  })

  // 过期分析
  const overdueStats = computed(() => {
    const all = rangePlans.value
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const overdueItems = all.filter(p => p.status !== 2 && p.due_date && p.due_date < todayStr)
    const overdueDays = overdueItems.map(p => {
      const due = new Date(p.due_date.replace(/-/g, '/'))
      return Math.ceil((today - due) / 86400000)
    })
    const avgOverdue = overdueDays.length > 0 ? Math.round(overdueDays.reduce((s, d) => s + d, 0) / overdueDays.length) : 0
    return {
      count: overdueItems.length,
      avgDays: avgOverdue,
      maxDays: overdueDays.length > 0 ? Math.max(...overdueDays) : 0
    }
  })

  // 活跃度热力图（近30天）
  const heatmapData = computed(() => {
    const now = new Date()
    const days = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      const startTs = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
      const endTs = startTs + 86400000
      const count = plans.value.filter(p => {
        const ts = p.created_at || 0
        const updated = p.updated_at || 0
        return (ts >= startTs && ts < endTs) || (p.status === 2 && updated >= startTs && updated < endTs)
      }).length
      days.push({
        date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        day: d.getDate(),
        count,
        isToday: i === 0
      })
    }
    return days
  })

  return {
    plans, timeRange, rangePlans,
    overview, priorityDist, statusDist, trendData,
    completionStats, subtaskStats, priorityCompletion,
    tagStats, overdueStats, heatmapData,
    loadPlans
  }
}
