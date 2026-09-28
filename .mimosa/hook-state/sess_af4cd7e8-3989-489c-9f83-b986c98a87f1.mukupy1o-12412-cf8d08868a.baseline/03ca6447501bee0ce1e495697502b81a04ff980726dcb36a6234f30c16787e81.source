/**
 * plan-alerts.js — 计划状态警示（过时 / 快到期）（4.5.0）
 *
 * 进入消息要用：计划过时（截止已过还没完成）或快到时间（N 天内到期）时点破，
 * 对应愿景里「计划性逃避点破」的对策。只统计、不诊断、不催 —— 文案进 enter-dialogue。
 *
 * 口径：
 *   - 只看顶层计划（无 parent_id）：子计划跟着根计划的窗口走，根计划逾期必然带动子计划，
 *     两层都报会一句话里说两遍
 *   - deadline / due_date 取日期部分；过时 = 截止日在今天之前；快到期 = 今天 ~ 今天+N 天
 *   - 循环计划（daily/weekly）没有「截止」概念，不参与；已完成 / 已删除 / 冷藏 / 顺延不参与
 *
 * 纯函数、不依赖 uni，可直接单测（tests/plan-alerts.test.js）。
 */

/** 快到期窗口（天） */
export const DUE_SOON_DAYS = 3

const DAY_MS = 24 * 60 * 60 * 1000

function midnightOf(y, m, d) {
  return new Date(y, m - 1, d).getTime()
}

/** 截止字段（deadline 优先，回落 due_date）的日期部分 → 当天零点；无/非法返回 null */
function deadlineMidnightOf(plan) {
  const s = plan && (plan.deadline || plan.due_date)
  if (!s) return null
  const m = String(s).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (!m) return null
  return midnightOf(+m[1], +m[2], +m[3])
}

/**
 * 收集需要点破的计划
 * @param {Array} plans 计划列表（getPlanList 原样）
 * @param {number} [now]
 * @param {{ dueSoonDays?: number }} [opts]
 * @returns {{ overdue: Array<{clientId,name,lateDays}>, dueSoon: Array<{clientId,name,leftDays}>, total: number }}
 */
export function collectPlanAlerts(plans, now = Date.now(), opts = {}) {
  const dueSoonDays = Number.isFinite(opts.dueSoonDays) ? Math.max(0, opts.dueSoonDays) : DUE_SOON_DAYS
  const today = new Date(now)
  const todayMidnight = midnightOf(today.getFullYear(), today.getMonth() + 1, today.getDate())
  const overdue = []
  const dueSoon = []
  for (const plan of Array.isArray(plans) ? plans : []) {
    if (!plan || plan.is_deleted === 1 || plan.status === 2) continue
    if (plan.frozen_at || plan.someday_at) continue
    if (plan.parent_id) continue // 只报顶层，子计划跟着根计划走
    if (plan.recur_type === 'daily' || plan.recur_type === 'weekly') continue
    const dl = deadlineMidnightOf(plan)
    if (dl == null) continue
    const name = String(plan.title || '未命名计划')
    if (dl < todayMidnight) {
      const lateDays = Math.max(1, Math.round((todayMidnight - dl) / DAY_MS))
      overdue.push({ clientId: plan.client_id, name: name, lateDays: lateDays })
    } else if (dl <= todayMidnight + dueSoonDays * DAY_MS) {
      const leftDays = Math.round((dl - todayMidnight) / DAY_MS)
      dueSoon.push({ clientId: plan.client_id, name: name, leftDays: leftDays })
    }
  }
  // 过时久的排前面；快到的按剩余天数升序（最先到期的排前面）
  overdue.sort((a, b) => b.lateDays - a.lateDays)
  dueSoon.sort((a, b) => a.leftDays - b.leftDays)
  return { overdue: overdue, dueSoon: dueSoon, total: overdue.length + dueSoon.length }
}
