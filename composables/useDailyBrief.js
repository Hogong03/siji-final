/**
 * 每日小结（4.15 P1-4）—— 纯本地聚合，不耗 AI 调用
 * 数据：今日记录数 / 今日支出 / 进行中计划数 / 今日打卡数
 * 每天最多出现一次（siji_daily_brief_day），关闭后当天不再出现
 */
import { getDiariesBetween } from '@/utils/storage/diary.js'
import { getBillList } from '@/utils/storage/bill.js'
import { getPlanList } from '@/utils/storage/plan.js'
import { getMonthFromDate } from '@/utils/storage/helpers.js'

const BRIEF_KEY = 'siji_daily_brief_day'

function todayStr() {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** 是否今天已经展示过 */
export function briefShownToday() {
  try { return uni.getStorageSync(BRIEF_KEY) === todayStr() } catch { return false }
}

export function markBriefShown() {
  try { uni.setStorageSync(BRIEF_KEY, todayStr()) } catch { /* 存不下就算了 */ }
}

/**
 * 聚合今日数据；没有任何内容时返回 null（不弹卡）
 */
export function buildDailyBrief() {
  if (briefShownToday()) return null
  const start = startOfToday()

  // 今日记录
  let diaryCount = 0
  try {
    diaryCount = (getDiariesBetween(start, Date.now()) || []).length
  } catch { /* ignore */ }

  // 今日支出
  let expense = 0
  try {
    const month = getMonthFromDate(Date.now())
    ;(getBillList(month) || []).forEach(b => {
      const ts = new Date(b.bill_date || b.created_at || 0).getTime()
      if (ts >= start && b.type !== 'income' && b.type !== 1) {
        expense += Number(b.amount) || 0
      }
    })
  } catch { /* ignore */ }

  // 进行中计划 + 今日打卡
  let activePlans = 0
  let todayCheckins = 0
  try {
    ;(getPlanList() || []).forEach(p => {
      if (p.is_deleted === 1) return
      if (p.status === 1) activePlans++
      if (Array.isArray(p.checkins)) {
        todayCheckins += p.checkins.filter(c => c && c.date === todayStr()).length
      }
    })
  } catch { /* ignore */ }

  if (diaryCount === 0 && expense === 0 && activePlans === 0 && todayCheckins === 0) return null

  const lines = []
  if (diaryCount > 0) lines.push(`📝 今天写了 ${diaryCount} 篇记录`)
  if (expense > 0) lines.push(`💰 今天花了 ¥${expense.toFixed(2)}`)
  if (todayCheckins > 0) lines.push(`✅ 今天打卡 ${todayCheckins} 次`)
  if (activePlans > 0) lines.push(`📌 有 ${activePlans} 个计划进行中`)

  return {
    lines,
    text: lines.join('\n')
  }
}
