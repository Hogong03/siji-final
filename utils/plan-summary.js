/**
 * plan-summary.js — 计划汇总表（4.29.5）
 *
 * 用途：每次打开应用 / 每天第一次进聊天页时自动弹的那张「全部计划明细」汇总。
 * 内容 = 计划 Tab 的「计划总览」统计头 + 按状态分组的逐条明细（合并两张旧视图的信息）。
 *
 * 口径要求：统计头必须与 `pages/plan/composables/usePlanList.js` 的 stats 完全一致
 * （只计顶层计划、子计划进度归并到 subTotal/subDone、本周打卡复用 weekCheckinSummary）
 * —— 否则用户在聊天页看到的数字和计划页对不上，比不给更糟。
 *
 * 纯函数 + 两个薄存储封装，可直接单测（tests/plan-summary.test.js）。
 */
import { toPlanTs } from './datetime.js'
import { weekCheckinSummary } from './plan-heatmap.js'
import { recurTypeOf } from './plan-recur.js'

/** 每天首次弹出的日期门控 key（存当天 YYYY-MM-DD） */
export const SUMMARY_SHOWN_KEY = 'siji_plan_summary_at'

/** 已完成分组最多列多少条（全部列出会在计划多时拖垮 App 渲染；只截「已完成」不截在办） */
export const DONE_LIMIT = 30

const STATUS_TEXT = ['待开始', '进行中', '已完成']
const PRIORITY_TEXT = ['普通', '重要', '紧急']
const PRIORITY_COLOR = ['#999999', '#E8A838', '#D35D5D']

/** 当天 key（YYYY-MM-DD，本地时区）—— 与提醒/周报同口径 */
export function summaryDayKey(now = Date.now()) {
  const d = new Date(now)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 今天是否还没弹过汇总表（存储坏了按「弹」处理，宁可多看一次也不静默不弹） */
export function shouldShowPlanSummary(now = Date.now()) {
  try {
    return uni.getStorageSync(SUMMARY_SHOWN_KEY) !== summaryDayKey(now)
  } catch (e) {
    return true
  }
}

/** 记下今天已弹过 */
export function markPlanSummaryShown(now = Date.now()) {
  try {
    uni.setStorageSync(SUMMARY_SHOWN_KEY, summaryDayKey(now))
  } catch (e) { /* 写失败只影响去重，不影响主流程 */ }
}

/** M月D日（无有效日期返回空串） */
function monthDayText(raw) {
  const m = String(raw || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (!m) return ''
  return `${Number(m[2])}月${Number(m[3])}日`
}

/** 今天零点时间戳 */
function todayStartOf(now) {
  const d = new Date(now)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** 该计划今天是否打过卡 */
function checkedTodayOf(plan, todayStart) {
  const checkins = Array.isArray(plan.checkins) ? plan.checkins : []
  return checkins.some(c => Number(c && c.at) >= todayStart)
}

/** 循环描述：每天 / 每周 N 次 / 空 */
function recurTextOf(plan) {
  const type = recurTypeOf(plan)
  if (type === 'daily') return '每天'
  if (type === 'weekly') return `每周${Number(plan.recur_count) || 1}次`
  return ''
}

/** 把一条顶层计划压成汇总行 */
function toSummaryItem(plan, ctx) {
  const { now, todayStart, childMap } = ctx
  const priority = Number(plan.priority) || 0
  const status = Number(plan.status) || 0
  const dueRaw = plan.due_date || plan.deadline || ''
  const startRaw = plan.start_time || plan.estimated_time || ''
  const dueTs = toPlanTs(dueRaw, true)
  const overdue = status !== 2 && dueTs != null && dueTs < now

  const kids = childMap[plan.client_id] || []
  const childDone = kids.filter(k => Number(k.status) === 2).length

  // 元信息行：时间 + 子计划进度 + 循环 + 状态标记
  const metas = []
  if (dueRaw) metas.push(`截止 ${monthDayText(dueRaw)}`)
  else if (startRaw) metas.push(`开始 ${monthDayText(startRaw)}`)
  if (kids.length > 0) metas.push(`子计划 ${childDone}/${kids.length}`)
  const recur = recurTextOf(plan)
  if (recur) metas.push(recur)
  if (plan.frozen_at) metas.push('已冷藏')
  if (plan.someday_at) metas.push('任意时间')
  if (checkedTodayOf(plan, todayStart)) metas.push('今日已打卡')

  return {
    clientId: plan.client_id,
    title: plan.title || '未命名计划',
    status: status,
    statusText: STATUS_TEXT[status] || '进行中',
    priority: priority,
    priorityText: PRIORITY_TEXT[priority] || '普通',
    priorityColor: PRIORITY_COLOR[priority] || PRIORITY_COLOR[0],
    overdue: overdue,
    lateDays: overdue ? Math.max(1, Math.round((now - dueTs) / 86400000)) : 0,
    metaText: metas.join(' · ')
  }
}

/** 组内排序：优先级高的在前 → 截止早的在前 → 新建的在前（与计划列表保持一致） */
function sortItems(a, b) {
  if (b.priority !== a.priority) return b.priority - a.priority
  const at = a._dueTs || 0
  const bt = b._dueTs || 0
  if (at !== bt) return at - bt
  return (b._createdAt || 0) - (a._createdAt || 0)
}

/**
 * 组装汇总表数据
 * @param {Array} plans getPlanList() 原样
 * @param {number} [now]
 * @returns {{ stats, priorityBar, groups, doneHidden }}
 */
export function buildPlanSummary(plans, now = Date.now()) {
  const all = (Array.isArray(plans) ? plans : []).filter(p => p && p.is_deleted !== 1)
  const tops = all.filter(p => !p.parent_id)

  const childMap = {}
  all.forEach(p => {
    if (p.parent_id) (childMap[p.parent_id] || (childMap[p.parent_id] = [])).push(p)
  })

  const total = tops.length
  const active = tops.filter(p => Number(p.status) === 1).length
  const completed = tops.filter(p => Number(p.status) === 2).length
  const pending = tops.filter(p => Number(p.status) === 0).length
  const rate = total > 0 ? Math.round(completed / total * 100) : 0
  const overdue = tops.filter(p => Number(p.status) !== 2 && toPlanTs(p.due_date || p.deadline, true) != null && toPlanTs(p.due_date || p.deadline, true) < now).length

  const pHigh = tops.filter(p => Number(p.priority) === 2).length
  const pMid = tops.filter(p => Number(p.priority) === 1).length
  const pLow = tops.filter(p => Number(p.priority) === 0).length

  let subTotal = 0
  let subDone = 0
  tops.forEach(p => {
    const kids = childMap[p.client_id]
    if (kids && kids.length > 0) {
      subTotal += kids.length
      subDone += kids.filter(k => Number(k.status) === 2).length
    } else if (Array.isArray(p.subtasks) && p.subtasks.length > 0) {
      subTotal += p.subtasks.length
      subDone += p.subtasks.filter(s => s && s.done).length
    }
  })

  const week = weekCheckinSummary(all, now)

  const stats = {
    total, active, completed, pending, rate, overdue,
    high: pHigh, mid: pMid, low: pLow,
    subTotal, subDone,
    weekCheckins: week.times, weekDays: week.days
  }

  const pSum = pHigh + pMid + pLow
  const priorityBar = pSum === 0 ? [] : [
    { label: '紧急', count: pHigh, pct: Math.round(pHigh / pSum * 100), color: PRIORITY_COLOR[2] },
    { label: '重要', count: pMid, pct: Math.round(pMid / pSum * 100), color: PRIORITY_COLOR[1] },
    { label: '普通', count: pLow, pct: Math.round(pLow / pSum * 100), color: PRIORITY_COLOR[0] }
  ]

  const ctx = { now, todayStart: todayStartOf(now), childMap }
  const items = tops.map(p => {
    const item = toSummaryItem(p, ctx)
    // 排序用的临时字段（不进渲染）
    item._dueTs = toPlanTs(p.due_date || p.deadline, true) || 0
    item._createdAt = Number(p.created_at) || 0
    return item
  })

  const overdueItems = items.filter(i => i.overdue).sort(sortItems)
  const activeItems = items.filter(i => !i.overdue && i.status === 1).sort(sortItems)
  const pendingItems = items.filter(i => !i.overdue && i.status === 0).sort(sortItems)
  const doneAll = items.filter(i => i.status === 2).sort((a, b) => (b._createdAt || 0) - (a._createdAt || 0))
  const doneItems = doneAll.slice(0, DONE_LIMIT)

  const strip = arr => arr.map(({ _dueTs, _createdAt, ...rest }) => rest)

  const groups = [
    { key: 'overdue', label: '已过期', items: strip(overdueItems) },
    { key: 'active', label: '进行中', items: strip(activeItems) },
    { key: 'pending', label: '待开始', items: strip(pendingItems) },
    { key: 'done', label: '已完成', items: strip(doneItems) }
  ].filter(g => g.items.length > 0)

  return {
    stats,
    priorityBar,
    groups,
    doneHidden: Math.max(0, doneAll.length - doneItems.length)
  }
}
