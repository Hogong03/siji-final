/**
 * weekly-insights.js — AI 主动洞察：周报升级版（4.20.0）
 *
 * 在 bill-weekly 的「三个数字」之上做归因与建议：
 *   上周花了 ¥180（餐饮 ¥120 占 67%，比前周多 40%）；外卖连着 5 天每天超 ¥20；
 *   打卡 8 次 / 写了 4 篇记录 —— 要不要看看餐饮都花在哪了？
 *
 * 分层：bill-weekly.js 管基础口径（区间汇总 / 环比 / 门控），本文件管洞察（分类环比 /
 * 连续模式 / 打卡与记录维度 / 建议生成）。只读不写，除了沿用周门控 key。
 * 铁律沿用 bill-weekly：只陈述事实与可执行的下一步，不制造失败感。
 */
import {
  sumExpenseIn, formatMoney, weekKeyOf,
  readBillsForWeeks, shouldAnnounceWeeklyBill
} from './bill-weekly.js'
import { weekRangeTsOf } from './plan-recur.js'
import { monthsBetween, monthKeyOf } from './enter-summary.js'
import { getBillList, getDiaryList } from './storage.js'

const DAY_MS = 24 * 60 * 60 * 1000

/** 建议触发阈值：分类环比涨幅与占比门槛 */
const TREND_JUMP_PCT = 30
const TREND_SHARE = 0.4
/** 连续模式识别参数：连续天数下限 / 单日金额下限 */
const STREAK_MIN_DAYS = 3
const STREAK_MIN_DAILY = 20

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

function isExpense(b) {
  return !!b && (b.type === 'expense' || b.type === 0)
}

/**
 * 分类级环比（纯函数）：统计「刚结束的完整一周」vs 再往前一周 —— 每周一早播报上周，
 * 此刻本周刚开始几乎没有数据，统计窗口必须取上周（bill-weekly 的旧语义是「本周至今」，
 * 4.20.0 对齐洞察需求后改为完整周）
 * @returns {Array<{ category, amount, pct, lastAmount, diffPct }>} 按统计周金额降序
 */
export function buildCategoryTrends(bills, now = Date.now()) {
  const weekStart = weekRangeTsOf(now).weekStart
  const thisWeek = sumExpenseIn(bills, weekStart - 7 * DAY_MS, weekStart)
  const lastWeek = sumExpenseIn(bills, weekStart - 14 * DAY_MS, weekStart - 7 * DAY_MS)
  const total = thisWeek.total
  const cats = Array.from(new Set(Object.keys(thisWeek.byCategory).concat(Object.keys(lastWeek.byCategory))))
  const out = cats.map(cat => {
    const amount = round2(thisWeek.byCategory[cat] || 0)
    const lastAmount = round2(lastWeek.byCategory[cat] || 0)
    return {
      category: cat,
      amount: amount,
      pct: total > 0 ? amount / total : 0,
      lastAmount: lastAmount,
      diffPct: lastAmount > 0 ? Math.round((amount - lastAmount) / lastAmount * 100) : null
    }
  }).filter(t => t.amount > 0 || t.lastAmount > 0)
  out.sort((a, b) => b.amount - a.amount)
  return out
}

/**
 * 连续消费模式（纯函数）：上周内同一分类连续 N 天、每天金额都达阈值
 * （外卖天天点 / 每天打车 这类习惯型支出；数据里没有时段，只陈述「连续 N 天」）
 * @returns {{ category, days, avgAmount }|null} 取最长连续段；不足 minDays 返回 null
 */
export function findSpendingStreak(bills, now = Date.now(), opts = {}) {
  const minDays = Number(opts.minDays) || STREAK_MIN_DAYS
  const minDaily = Number(opts.minDaily) || STREAK_MIN_DAILY
  const weekStart = weekRangeTsOf(now).weekStart
  const list = (Array.isArray(bills) ? bills : []).filter(isExpense)
  // 上周 7 天：dayIndex → { category: 金额 }
  const days = []
  for (let i = 0; i < 7; i++) {
    const from = weekStart - 7 * DAY_MS + i * DAY_MS
    const day = sumExpenseIn(list, from, from + DAY_MS)
    days.push(day.byCategory)
  }
  let best = null
  let run = null
  for (let i = 0; i <= 7; i++) {
    const dayCats = i < 7 ? days[i] : null
    const hitCat = dayCats ? Object.keys(dayCats).find(c => (dayCats[c] || 0) >= minDaily) : null
    if (hitCat && run && run.category === hitCat) {
      run.days++
      run.sum += dayCats[hitCat]
    } else {
      run = hitCat ? { category: hitCat, days: 1, sum: dayCats[hitCat] } : null
    }
    if (run && run.days >= minDays && (!best || run.days > best.days)) {
      best = { category: run.category, days: run.days, sum: run.sum }
    }
  }
  if (!best) return null
  return { category: best.category, days: best.days, avgAmount: round2(best.sum / best.days) }
}

/**
 * 上周打卡统计：扫计划（含子计划）checkins，at 落在上周范围的次数与覆盖的计划数
 * @returns {{ checkinCount, checkinPlans, activePlans }}
 */
export function collectPlanWeeklyStat(plans, now = Date.now()) {
  const weekStart = weekRangeTsOf(now).weekStart
  const from = weekStart - 7 * DAY_MS
  let checkinCount = 0
  const hitPlanIds = new Set()
  let activePlans = 0
  const scan = (p, isChild) => {
    if (!p || p.is_deleted === 1) return
    if (!isChild && Number(p.status) !== 2) activePlans++
    const checkins = Array.isArray(p.checkins) ? p.checkins : []
    checkins.forEach(c => {
      const at = Number(c && c.at) || 0
      if (at >= from && at < weekStart) {
        checkinCount++
        hitPlanIds.add(p.client_id)
      }
    })
    if (Array.isArray(p.children)) p.children.forEach(ch => scan(ch, true))
  }
  ;(Array.isArray(plans) ? plans : []).forEach(p => scan(p, false))
  return { checkinCount: checkinCount, checkinPlans: hitPlanIds.size, activePlans: activePlans }
}

/**
 * 上周新增记录篇数（跨月分片，按 created_at 归属日期）
 */
export function countDiariesInRange(fromTs, toTs) {
  try {
    const months = monthsBetween(fromTs, toTs)
    if (months.length === 0) return 0
    let count = 0
    months.forEach(m => {
      const list = getDiaryList(m)
      ;(Array.isArray(list) ? list : []).forEach(d => {
        if (!d || d.is_deleted === 1) return
        const ts = Number(d.created_at) || 0
        if (ts >= fromTs && ts < toTs) count++
      })
    })
    return count
  } catch (e) {
    return 0
  }
}

/**
 * 生成一条可执行建议（纯函数）：连续模式优先（更具体），其次分类暴涨
 * @returns {{ line, ask, prefill }|null} line 拼进播报正文，prefill 给预置按钮
 */
export function buildWeeklySuggestion(trends, streak) {
  if (streak && streak.days >= STREAK_MIN_DAYS) {
    const cat = streak.category
    return {
      line: cat + '连着 ' + streak.days + ' 天每天超 ' + formatMoney(STREAK_MIN_DAILY) + '（日均 ' + formatMoney(streak.avgAmount) + '）',
      ask: '要不要看看' + cat + '都花在哪了？',
      prefill: '帮我看看上周' + cat + '都花在哪了'
    }
  }
  const jump = (Array.isArray(trends) ? trends : []).find(t =>
    t.diffPct !== null && t.diffPct >= TREND_JUMP_PCT && t.pct >= TREND_SHARE && t.amount > 0)
  if (jump) {
    return {
      line: jump.category + '占到了 ' + Math.round(jump.pct * 100) + '%，比前周多 ' + jump.diffPct + '%',
      ask: '要不要看看' + jump.category + '都花在哪了？',
      prefill: '帮我看看上周' + jump.category + '都花在哪了'
    }
  }
  return null
}

/**
 * 洞察正文（纯函数）：把结构化结果拼成一段话，全空返回空串
 */
export function buildWeeklyInsightText(insight) {
  if (!insight) return ''
  const parts = []
  if (insight.total > 0) {
    let head = '上周花了 ' + formatMoney(insight.total)
    const top = insight.top
    if (top && top.category) {
      let seg = '主要是' + top.category + ' ' + formatMoney(top.amount) + '（占 ' + Math.round(top.pct * 100) + '%'
      if (top.diffPct !== null && top.diffPct !== undefined) {
        seg += '，比前周' + (top.diffPct > 0 ? '多' : '少') + Math.abs(top.diffPct) + '%'
      }
      seg += '）'
      head += '，' + seg
    } else if (insight.diffPct !== null && insight.diffPct !== undefined) {
      head += '，比前周' + (insight.diffPct > 0 ? '多' : '少') + Math.abs(insight.diffPct) + '%'
    }
    parts.push(head)
  }
  // streak 本身不含 line 字段（只有 category/days/avgAmount），连续模式与分类暴涨的
  // 描述文案统一由 buildWeeklySuggestion 产出在 suggestion.line；这里只 push 一次
  if (insight.suggestion && insight.suggestion.line) parts.push(insight.suggestion.line)
  const plan = insight.planStat
  if (plan && plan.checkinCount > 0) parts.push('打了 ' + plan.checkinCount + ' 次卡')
  if ((insight.diaryCount || 0) > 0) parts.push('写了 ' + insight.diaryCount + ' 篇记录')
  if (insight.suggestion && insight.suggestion.ask) parts.push(insight.suggestion.ask)
  return parts.join('；')
}

/**
 * 聚合本周洞察（读取层）：门控复用 bill-weekly 的周 key —— 升级后仍是每周只出一次。
 * @returns {{ total, diffPct, top, streak, suggestion, planStat, diaryCount, text, weekKey }|null}
 *          未到新的一周 / 全部维度都空 → null（不打扰）
 */
export function buildWeeklyInsightAnnouncement({ now = Date.now(), bills = null, plans = null } = {}) {
  if (!shouldAnnounceWeeklyBill(now)) return null
  const source = Array.isArray(bills) ? bills : readBillsForWeeks(now)
  const trends = buildCategoryTrends(source, now)
  const streak = findSpendingStreak(source, now)
  const top = trends.length > 0 ? trends[0] : null
  const suggestion = buildWeeklySuggestion(trends, streak)
  const weekStart = weekRangeTsOf(now).weekStart
  const planStat = collectPlanWeeklyStat(plans, now)
  const diaryCount = countDiariesInRange(weekStart - 7 * DAY_MS, weekStart)
  const insight = {
    total: round2(sumExpenseIn(source, weekStart - 7 * DAY_MS, weekStart).total),
    top: top,
    streak: streak,
    suggestion: suggestion,
    planStat: planStat,
    diaryCount: diaryCount,
    weekKey: weekKeyOf(now)
  }
  // 顶部环比：统计周（上周）vs 对比周（上上周）；没有分类可对比时用总支出环比兜底
  const lastTotal = round2(sumExpenseIn(source, weekStart - 14 * DAY_MS, weekStart - 7 * DAY_MS).total)
  insight.diffPct = lastTotal > 0 ? Math.round((insight.total - lastTotal) / lastTotal * 100) : null
  insight.text = buildWeeklyInsightText(insight)
  const hasAnything = insight.total > 0 || planStat.checkinCount > 0 || insight.diaryCount > 0
  if (!hasAnything) return null
  return insight
}
