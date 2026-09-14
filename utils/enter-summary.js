/**
 * enter-summary.js — 冷启动「进入总结」纯逻辑（3.4.5）
 *
 * 触发：仅应用冷启动（App.vue appReady）时计算一次；前台恢复不重复弹。
 * 口径：上次「知道了/查看」时间点之后发生的计划完成(done)、打卡(checkin)，
 *       以及新增记录(diary)数量。本文件是纯函数，不读写存储，页面与测试共用。
 * 3.5.3：新增全局连续打卡天数（streak），随卡片一起展示
 */

import { calcStreakFromDates } from './plan-recur.js'

/** 返回给 UI 的事件条数上限（卡片只展示前 3 条，eventsTotal 保留真实总数） */
const MAX_EVENT_LINES = 6

/**
 * 全局连续打卡天数：所有未删除计划打卡日期的并集，从今天（或昨天）向前连续计数
 * 「今天任一计划打了卡」就算这一天有效，不做计划粒度区分
 */
export function calcGlobalStreak(plans, nowTs = Date.now()) {
  const dates = []
  const source = Array.isArray(plans) ? plans : []
  source.forEach(p => {
    if (!p || p.is_deleted === 1) return
    if (!Array.isArray(p.checkins)) return
    p.checkins.forEach(c => { if (c && c.date) dates.push(c.date) })
  })
  return calcStreakFromDates(dates, nowTs)
}

/** 毫秒时间 → 'YYYY-MM' */
export function monthKeyOf(ts) {
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** 覆盖 [fromTs, toTs] 的月份 key 数组（含首尾月） */
export function monthsBetween(fromTs, toTs) {
  const months = []
  const from = new Date(fromTs)
  const to = new Date(toTs)
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || fromTs > toTs) return months
  const cur = new Date(from.getFullYear(), from.getMonth(), 1)
  const end = new Date(to.getFullYear(), to.getMonth(), 1)
  while (cur <= end) {
    months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`)
    cur.setMonth(cur.getMonth() + 1)
  }
  return months
}

/**
 * 聚合进入总结数据（纯函数）
 * @param {Object} opts
 * @param {Array} opts.plans - getPlanList() 结果
 * @param {number} opts.since - 上次确认基线（ms），<=0 视为未武装返回空
 * @param {number} [opts.now] - 当前时间（ms），默认 Date.now()
 * @param {Function} [opts.diaryReader] - (monthKey) => diary[]，用于统计新增记录
 * @returns {{ events: Array, eventsTotal: number, diaryCount: number }}
 */
export function buildEnterSummary({ plans = [], since = 0, now = Date.now(), diaryReader = null } = {}) {
  if (!since || since <= 0 || typeof since !== 'number') {
    return { events: [], eventsTotal: 0, diaryCount: 0, streak: 0 }
  }

  const events = []
  const source = Array.isArray(plans) ? plans.filter(p => p && p.is_deleted !== 1) : []
  source.forEach(p => {
    const title = String(p.title || '').trim() || '未命名计划'
    const planId = p.client_id || p.id || ''
    // 打卡事件
    if (Array.isArray(p.checkins)) {
      p.checkins.forEach(c => {
        if (c && c.at && c.at >= since && c.at <= now) {
          events.push({
            kind: 'checkin',
            at: c.at,
            date: c.date || '',
            note: String(c.note || '').slice(0, 80),
            title,
            planId
          })
        }
      })
    }
    // 完成事件（savePlan 在 status → 2 时写入 executions action='done'）
    if (Array.isArray(p.executions)) {
      p.executions.forEach(e => {
        if (e && e.action === 'done' && e.at && e.at >= since && e.at <= now) {
          events.push({
            kind: 'done',
            at: e.at,
            date: '',
            note: String(e.note || '').slice(0, 80),
            title,
            planId
          })
        }
      })
    }
  })
  events.sort((a, b) => (b.at || 0) - (a.at || 0))

  let diaryCount = 0
  if (typeof diaryReader === 'function') {
    monthsBetween(since, now).forEach(month => {
      const list = diaryReader(month)
      if (!Array.isArray(list)) return
      diaryCount += list.filter(d =>
        d && d.is_deleted !== 1 && d.created_at && d.created_at >= since && d.created_at <= now
      ).length
    })
  }

  return {
    events: events.slice(0, MAX_EVENT_LINES),
    eventsTotal: events.length,
    diaryCount,
    streak: calcGlobalStreak(source, now)
  }
}

/**
 * 事件时间标签：今天 HH:mm / 昨天 HH:mm / M月D日
 * @param {number} at
 * @param {number} [nowTs]
 * @returns {string}
 */
export function formatSummaryTime(at, nowTs = Date.now()) {
  const d = new Date(at)
  const n = new Date(nowTs)
  if (isNaN(d.getTime()) || isNaN(n.getTime())) return ''
  const pad = v => String(v).padStart(2, '0')
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  const sameDay = d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
  if (sameDay) return `今天 ${hm}`
  const y = new Date(n)
  y.setDate(n.getDate() - 1)
  const isYesterday = d.getFullYear() === y.getFullYear() && d.getMonth() === y.getMonth() && d.getDate() === y.getDate()
  if (isYesterday) return `昨天 ${hm}`
  return `${d.getMonth() + 1}月${d.getDate()}日`
}
