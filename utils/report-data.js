/**
 * utils/report-data.js — 月度报告数据聚合（4.11.0，纯函数可单测）
 *
 * buildMonthlyReport(year, month) 聚合当月三块数据：
 *  - 账单：getBillList（bill_YYYY-MM，软删除已过滤）→ 总支出/总收入/笔数/支出分类 top3
 *  - 记录：getDiaryList（diary_YYYY-MM，软删除已过滤）→ 篇数/总字数/mood 均值（无打分则 null）
 *  - 打卡：plan_all 里每个计划的 checkins[].date 按 YYYY-MM 前缀计数（软删除计划不计）；
 *          取法与 utils/storage/plan.js 的 getPlanCheckInStats 同源（checkins 是唯一事实源），
 *          plan_all 解析失败标 null（不编数），空数据返回 0
 *
 * 返回：{ ok, month, bills: { expense, income, count, topCategories }, diary: { count, words, moodAvg }, checkins }
 * 金额统一保留两位小数（浮点累加防 0.1+0.2 型尾差）。
 */
import { getBillList } from './storage/bill.js'
import { getDiaryList } from './storage/diary.js'

const PLAN_KEY = 'plan_all'

function pad2(n) {
  return String(n).padStart(2, '0')
}

function round2(n) {
  return Math.round(n * 100) / 100
}

function emptyBills() {
  return { expense: 0, income: 0, count: 0, topCategories: [] }
}

function emptyDiary() {
  return { count: 0, words: 0, moodAvg: null }
}

/** 打卡计数：plan_all → checkins[].date 前缀匹配；解析失败返回 null */
function countMonthCheckins(monthKey) {
  const raw = uni.getStorageSync(PLAN_KEY)
  if (!raw) return 0
  let list
  try {
    list = JSON.parse(raw)
  } catch (e) {
    return null
  }
  if (!Array.isArray(list)) return null
  let n = 0
  list.forEach((plan) => {
    if (!plan || plan.is_deleted === 1) return
    const checkins = Array.isArray(plan.checkins) ? plan.checkins : []
    checkins.forEach((c) => {
      if (c && typeof c.date === 'string' && c.date.indexOf(monthKey) === 0) n++
    })
  })
  return n
}

/**
 * 聚合某月数据
 * @param {number} year  四位年份，如 2026
 * @param {number} month 1~12
 */
export function buildMonthlyReport(year, month) {
  const y = Math.floor(Number(year))
  const m = Math.floor(Number(month))
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12 || y < 1970 || y > 9999) {
    return { ok: false, month: '', bills: emptyBills(), diary: emptyDiary(), checkins: null }
  }
  const monthKey = `${y}-${pad2(m)}`
  try {
    // ── 账单 ──
    const bills = getBillList(monthKey)
    const expenseList = bills.filter((b) => b && b.type === 'expense')
    const incomeList = bills.filter((b) => b && b.type === 'income')
    const expense = round2(expenseList.reduce((s, b) => s + (Number(b.amount) || 0), 0))
    const income = round2(incomeList.reduce((s, b) => s + (Number(b.amount) || 0), 0))
    const byCat = {}
    expenseList.forEach((b) => {
      const cat = String(b.category || '').trim() || '未分类'
      byCat[cat] = (byCat[cat] || 0) + (Number(b.amount) || 0)
    })
    const topCategories = Object.keys(byCat)
      .map((cat) => ({ category: cat, total: round2(byCat[cat]) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3)

    // ── 记录 ──
    const diaries = getDiaryList(monthKey)
    const words = diaries.reduce((s, d) => s + String((d && d.content) || '').length, 0)
    const moods = diaries
      .map((d) => Number(d && d.mood))
      .filter((v) => v >= 1 && v <= 5)
    const moodAvg = moods.length
      ? Math.round((moods.reduce((s, v) => s + v, 0) / moods.length) * 10) / 10
      : null

    // ── 打卡 ──
    const checkins = countMonthCheckins(monthKey)

    return {
      ok: true,
      month: monthKey,
      bills: { expense, income, count: bills.length, topCategories },
      diary: { count: diaries.length, words, moodAvg },
      checkins
    }
  } catch (e) {
    return { ok: false, month: monthKey, bills: emptyBills(), diary: emptyDiary(), checkins: null }
  }
}
