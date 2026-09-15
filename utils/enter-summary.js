/**
 * enter-summary.js — 「进入总结」纯逻辑（3.4.5 冷启动 / 3.5.12 前台恢复增量）
 *
 * 触发：冷启动（App.vue appReady）与回前台（App.vue onShow）两条路径共用本模块。
 * 口径：窗口起点之后发生的计划完成(done)、打卡(checkin)，以及新增记录(diary)数量。
 *       冷启动窗口起点 = 确认基线；回前台窗口起点 = 离开基线（见 resolveSummaryWindow）。
 * 本文件是纯函数，不读写存储，页面与测试共用。
 * 3.5.3：新增全局连续打卡天数（streak），随卡片一起展示
 * 3.5.12：新增 resolveSummaryWindow（窗口裁决 + 60s 节流）与 formatAwaySpan（离开时长文案）
 */

import { calcStreakFromDates } from './plan-recur.js'

/** 返回给 UI 的事件条数上限（卡片只展示前 3 条，eventsTotal 保留真实总数） */
const MAX_EVENT_LINES = 6

/** 确认基线 key：用户上次点掉总结卡片的时间（ms）— 卡片与 AI 动静摘要共用同一口径 */
export const CONFIRM_KEY = 'siji_enter_summary_at'
/** 离开基线 key：上次离开前台 / 上次结算的时间（ms）— 同上 */
export const LEAVE_KEY = 'siji_enter_summary_leave_at'

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
 * 按类型统计窗口内的计划事件（纯函数）：{ done, checkin }
 * 与 buildEnterSummary 同一套过滤规则（未删除 + at 落在 [since, now]），
 * 供 AI 动静摘要这类「只要计数不要明细」的场景使用
 */
export function countEventsByKind(plans, since, now = Date.now()) {
  const out = { done: 0, checkin: 0 }
  if (!since || since <= 0 || typeof since !== 'number') return out
  const source = Array.isArray(plans) ? plans.filter(p => p && p.is_deleted !== 1) : []
  source.forEach(p => {
    if (Array.isArray(p.checkins)) {
      p.checkins.forEach(c => { if (c && c.at && c.at >= since && c.at <= now) out.checkin += 1 })
    }
    if (Array.isArray(p.executions)) {
      p.executions.forEach(e => { if (e && e.action === 'done' && e.at && e.at >= since && e.at <= now) out.done += 1 })
    }
  })
  return out
}

/** 低落关键词（只做提示，不做诊断、不打分） */
const LOW_MOOD_WORDS = ['低落', '难过', '沮丧', '麻木', '崩溃']

function dayKeyOf(ts) {
  const d = new Date(ts)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

function dayStartOfKey(key) {
  const parts = String(key).split('-')
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
  return isNaN(d.getTime()) ? 0 : d.getTime()
}

/**
 * 最近两个有记录的日期是否都写着低落（纯函数，只用于「今天慢一点」这类休息提示）
 * 口径：窗口内未删除且带 emotion 的记录；按天聚合（同一天多条要全部低落才算），
 *       最近两个记录日必须相邻（连续两天），不做累计、不做评分。
 * @param {Object} opts
 * @param {number} opts.since - 窗口起点（ms）
 * @param {number} [opts.now]
 * @param {Function} [opts.diaryReader] - (monthKey) => diary[]
 * @returns {boolean}
 */
export function scanMoodDip({ since = 0, now = Date.now(), diaryReader = null } = {}) {
  if (!since || since <= 0 || typeof since !== 'number') return false
  if (typeof diaryReader !== 'function') return false
  const byDay = new Map()
  monthsBetween(since, now).forEach(month => {
    const list = diaryReader(month)
    if (!Array.isArray(list)) return
    list.forEach(d => {
      if (!d || d.is_deleted === 1) return
      if (!d.created_at || d.created_at < since || d.created_at > now) return
      const emotion = String(d.emotion || '')
      if (!emotion) return
      const key = dayKeyOf(d.created_at)
      const low = LOW_MOOD_WORDS.some(w => emotion.indexOf(w) >= 0)
      const prev = byDay.get(key)
      byDay.set(key, prev === undefined ? low : (prev && low))
    })
  })
  const days = Array.from(byDay.keys()).sort()
  if (days.length < 2) return false
  const lastTwo = days.slice(-2)
  const gap = dayStartOfKey(lastTwo[1]) - dayStartOfKey(lastTwo[0])
  if (gap !== 24 * 60 * 60 * 1000) return false
  return byDay.get(lastTwo[0]) === true && byDay.get(lastTwo[1]) === true
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

/** 回前台结算的最小间隔（ms）：避免切页/切后台频繁重算与刷屏 */
export const SUMMARY_QUIET_MS = 60 * 1000

/**
 * 裁决本次「进入总结」要不要算、窗口从哪开始（纯函数）
 *
 * 基线语义：
 *  - confirmBaseline：用户上次确认总结的时间（dismiss 推进），不知道它就无法计算
 *  - leaveBaseline：上次离开前台/上次结算的时间，优先用它（增量小、口径准）
 *
 * @param {Object} opts
 * @param {number} [opts.confirmBaseline] - siji_enter_summary_at
 * @param {number} [opts.leaveBaseline] - siji_enter_summary_leave_at
 * @param {number} [opts.now] - 当前时间（ms）
 * @param {number} [opts.lastCalcAt] - 上次结算时间（ms，内存态）；0 表示本会话还没算过
 * @param {boolean} [opts.hasPending] - 是否已有未读卡片
 * @param {number} [opts.quietMs] - 节流间隔，默认 60s
 * @returns {{ skip: boolean, reason: string, since: number, awayMs: number }}
 *   reason: ready 可算 | pending 已有未读卡片 | unarmed 基线未武装 | throttled 节流 | skew 基线超前于当前时间
 */
export function resolveSummaryWindow({
  confirmBaseline = 0,
  leaveBaseline = 0,
  now = Date.now(),
  lastCalcAt = 0,
  hasPending = false,
  quietMs = SUMMARY_QUIET_MS
} = {}) {
  const confirm = Number(confirmBaseline) || 0
  const leave = Number(leaveBaseline) || 0
  const since = leave > confirm ? leave : confirm
  const awayMs = since > 0 && since < now ? now - since : 0
  if (hasPending) return { skip: true, reason: 'pending', since, awayMs }
  if (!confirm) return { skip: true, reason: 'unarmed', since: 0, awayMs: 0 }
  if (since >= now) return { skip: true, reason: 'skew', since, awayMs: 0 }
  const last = Number(lastCalcAt) || 0
  if (last > 0 && now > last && now - last < quietMs) return { skip: true, reason: 'throttled', since, awayMs }
  return { skip: false, reason: 'ready', since, awayMs }
}

/**
 * 离开时长文案（卡片副标题）：刚刚 / N 分钟 / N 小时 / N 天
 * @param {number} ms
 * @returns {string} 非法输入返回空串
 */
export function formatAwaySpan(ms) {
  const v = Number(ms)
  if (!v || v < 0) return ''
  if (v < 60 * 1000) return '刚刚'
  const minutes = Math.floor(v / 60000)
  if (minutes < 60) return minutes + ' 分钟'
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours + ' 小时'
  return Math.floor(hours / 24) + ' 天'
}
