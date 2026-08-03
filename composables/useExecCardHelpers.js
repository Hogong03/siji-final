/**
 * useExecCardHelpers - 执行结果卡片的辅助函数
 *
 * 从 ExecResultCard.vue 拆出 — 心情 emoji、优先级样式、进度计算等
 */

export function priorityClass(priority) {
  if (priority === 'high' || priority === 3) return 'high'
  if (priority === 'medium' || priority === 2) return 'medium'
  return 'low'
}

export function planProgressPercent(detail) {
  if (!detail.subtasks || detail.subtasks.length === 0) return 0
  return Math.round((detail.subtasks.filter(s => s.done).length / detail.subtasks.length) * 100)
}

export function planDoneCount(detail) {
  if (!detail.subtasks) return 0
  return detail.subtasks.filter(s => s.done).length
}

export function topCategories(breakdown) {
  if (!breakdown || typeof breakdown !== 'object') return []
  const entries = Object.entries(breakdown).map(([name, amount]) => ({ name, amount: Math.round(amount) }))
  const total = entries.reduce((s, e) => s + e.amount, 0)
  const sorted = entries.sort((a, b) => b.amount - a.amount).slice(0, 5)
  const max = sorted.length > 0 ? sorted[0].amount : 1
  return sorted.map(e => ({
    ...e,
    percent: total > 0 ? Math.round((e.amount / total) * 100) : 0,
    opacity: max > 0 ? Math.max(0.35, Math.round((e.amount / max) * 100) / 100) : 1
  }))
}

export function formatTs(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ''
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function execIcon(type) {
  const map = {
    diary: 'diary', bill: 'bill', plan: 'plan',
    query_diary: 'search', query_bill: 'stats', query_plan: 'search', query_stat: 'stats'
  }
  return map[type] || 'check'
}

export const CATEGORIES = ['餐饮', '交通', '购物', '娱乐', '医疗', '住房', '工资', '兼职', '红包', '其他']
