/**
 * bill-weekly.js — 每周账单播报（3.5.14，PRODUCT_VISION P3「金钱真相」）
 *
 * 「不看账单也知道本周花了多少」：本周支出、主要花在哪、比上周多还是少，三个数字。
 * 每周只播一次（按「本周周一」做 key），数据来自账单分片，不落盘、不改任何账单。
 * 只陈述事实，不做道德评价、不设预算警告 —— 铁律 1：不制造新的失败感。
 */
import { getBillList } from './storage.js'
import { monthsBetween, monthKeyOf } from './enter-summary.js'
import { weekRangeTsOf } from './plan-recur.js'

const DAY_MS = 24 * 60 * 60 * 1000
/** 上次播报的周 key（本周周一的 YYYY-MM-DD） */
const SHOWN_KEY = 'siji_bill_weekly_at'

function isExpense(b) {
  return !!b && (b.type === 'expense' || b.type === 0)
}

/** 'YYYY-MM-DD' → 当天 00:00 的毫秒（非法输入返回 0） */
function tsOfDateStr(dateStr) {
  if (typeof dateStr !== 'string') return 0
  const m = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (!m) return 0
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return isNaN(d.getTime()) ? 0 : d.getTime()
}

function dayKeyOfTs(ts) {
  const d = new Date(ts)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

/** 金额文案：整数不带小数，其余两位 */
export function formatMoney(n) {
  const v = round2(n)
  return Number.isInteger(v) ? '¥' + v : '¥' + v.toFixed(2)
}

/** 本周 key（本周周一的日期），用于「本周已播报」判定 */
export function weekKeyOf(now = Date.now()) {
  return dayKeyOfTs(weekRangeTsOf(now).weekStart)
}

/**
 * 汇总区间 [fromTs, toTs) 内的支出（纯函数）
 * @returns {{ total: number, count: number, byCategory: Object }}
 */
export function sumExpenseIn(bills, fromTs, toTs) {
  const out = { total: 0, count: 0, byCategory: {} }
  ;(Array.isArray(bills) ? bills : []).forEach(b => {
    if (!isExpense(b)) return
    const ts = tsOfDateStr(b.bill_date) || Number(b.created_at) || 0
    if (!ts || ts < fromTs || ts >= toTs) return
    const amount = Number(b.amount) || 0
    out.total += amount
    out.count += 1
    const key = String(b.category || '未分类')
    out.byCategory[key] = (out.byCategory[key] || 0) + amount
  })
  out.total = round2(out.total)
  return out
}

/**
 * 本周 vs 上周（纯函数；bills 需覆盖最近两周，跨月由调用方拼好）
 * @returns {{ total, count, topCategory, topAmount, lastTotal, diffPct }}
 */
export function buildWeeklyBill(bills, now = Date.now()) {
  const weekStart = weekRangeTsOf(now).weekStart
  const thisWeek = sumExpenseIn(bills, weekStart, weekStart + 7 * DAY_MS)
  const lastWeek = sumExpenseIn(bills, weekStart - 7 * DAY_MS, weekStart)
  let topCategory = ''
  let topAmount = 0
  Object.keys(thisWeek.byCategory).forEach(key => {
    if (thisWeek.byCategory[key] > topAmount) {
      topCategory = key
      topAmount = thisWeek.byCategory[key]
    }
  })
  return {
    total: thisWeek.total,
    count: thisWeek.count,
    topCategory: topCategory,
    topAmount: round2(topAmount),
    lastTotal: lastWeek.total,
    diffPct: lastWeek.total > 0 ? Math.round((thisWeek.total - lastWeek.total) / lastWeek.total * 100) : null
  }
}

/** 一行播报文案（纯函数） */
export function formatWeeklyBillLine(data) {
  if (!data || !(data.total > 0)) return ''
  const parts = ['本周花了 ' + formatMoney(data.total)]
  if (data.topCategory) parts.push('主要是' + data.topCategory + ' ' + formatMoney(data.topAmount))
  if (data.diffPct === null) parts.push('上周没有支出记录')
  else if (data.diffPct === 0) parts.push('和上周差不多')
  else parts.push('比上周' + (data.diffPct > 0 ? '多' : '少') + Math.abs(data.diffPct) + '%')
  return parts.join(' · ')
}

/** 读取覆盖最近两周的账单（可能跨月分片） */
export function readBillsForWeeks(now = Date.now()) {
  const weekStart = weekRangeTsOf(now).weekStart
  const months = monthsBetween(weekStart - 7 * DAY_MS, now)
  if (months.length === 0) months.push(monthKeyOf(now))
  const all = []
  months.forEach(m => {
    const list = getBillList(m)
    if (Array.isArray(list)) all.push(...list)
  })
  return all
}

/** 本周是否还没播报过 */
export function shouldAnnounceWeeklyBill(now = Date.now()) {
  try {
    return String(uni.getStorageSync(SHOWN_KEY) || '') !== weekKeyOf(now)
  } catch (e) {
    return false
  }
}

/** 标记本周已播报 */
export function markWeeklyBillAnnounced(now = Date.now()) {
  try {
    uni.setStorageSync(SHOWN_KEY, weekKeyOf(now))
  } catch (e) {
    /* 存储失败不影响本次播报 */
  }
}

/**
 * 生成本周播报（未到新的一周 / 本周没有支出 → null，不打扰）
 * @param {Object} [opts]
 * @param {number} [opts.now]
 * @param {Array} [opts.bills] - 便于测试注入（需覆盖最近两周）
 * @returns {{ total, count, topCategory, topAmount, lastTotal, diffPct, text }|null}
 */
export function buildWeeklyBillAnnouncement({ now = Date.now(), bills = null } = {}) {
  if (!shouldAnnounceWeeklyBill(now)) return null
  const source = Array.isArray(bills) ? bills : readBillsForWeeks(now)
  const data = buildWeeklyBill(source, now)
  const text = formatWeeklyBillLine(data)
  if (!text) return null
  return Object.assign({}, data, { text: text })
}
