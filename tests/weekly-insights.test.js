/**
 * test: AI 主动洞察（周报升级版，4.20.0）
 *
 * 覆盖 utils/weekly-insights.js：分类级环比（buildCategoryTrends）、连续消费模式
 * （findSpendingStreak）、上周打卡统计（collectPlanWeeklyStat）、建议生成
 * （buildWeeklySuggestion）、正文拼装（buildWeeklyInsightText）与聚合门控
 * （buildWeeklyInsightAnnouncement：同周只出一次 / 全空不打扰）。
 *
 * 夹具日期现算：以「注入的 now」反推周界，避免跨天跑测试时夹具漂移（3.5.13 教训）。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import './setup.js'
import {
  buildCategoryTrends, findSpendingStreak, collectPlanWeeklyStat,
  countDiariesInRange, buildWeeklySuggestion, buildWeeklyInsightText,
  buildWeeklyInsightAnnouncement
} from '../utils/weekly-insights.js'
import { markWeeklyBillAnnounced } from '../utils/bill-weekly.js'

// 取一个稳定的「本周周三 12:00」作为 now（周一为一周起点）
function mondayBase() {
  const d = new Date()
  const dayIndex = (d.getDay() + 6) % 7
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dayIndex)
  return monday
}
function tsOf(y, m, d, hour = 12) {
  return new Date(y, m - 1, d, hour).getTime()
}
function dateStr(ts) {
  const d = new Date(ts)
  const pad = n => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

const NOW = mondayBase().getTime() + 3 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000 // 本周三中午
const WEEK_START = mondayBase().getTime()
const LAST_MON = WEEK_START - 7 * 24 * 60 * 60 * 1000

function bill(dateTs, amount, category) {
  return { client_id: 'b' + dateTs + category, type: 'expense', amount: amount, category: category, bill_date: dateStr(dateTs) }
}

describe('buildCategoryTrends（分类级环比）', () => {
  it('占比与环比按分类分别计算（统计周=上周，对比周=上上周）', () => {
    const bills = [
      bill(LAST_MON - 7 * 86400e3 + 3600e3, 100, '餐饮'), bill(LAST_MON - 7 * 86400e3 + 2 * 3600e3, 100, '交通'),
      bill(LAST_MON + 3600e3, 180, '餐饮'), bill(LAST_MON + 2 * 3600e3, 20, '交通')
    ]
    const trends = buildCategoryTrends(bills, NOW)
    const food = trends.find(t => t.category === '餐饮')
    expect(food.amount).toBe(180)
    expect(food.pct).toBeCloseTo(0.9, 5)
    expect(food.diffPct).toBe(80)
    const trans = trends.find(t => t.category === '交通')
    expect(trans.diffPct).toBe(-80)
  })

  it('对比周没有该分类 → diffPct 为 null，不编造百分比', () => {
    const bills = [bill(LAST_MON - 7 * 86400e3 + 3600e3, 100, '餐饮'), bill(LAST_MON + 3600e3, 50, '购物')]
    const trends = buildCategoryTrends(bills, NOW)
    expect(trends.find(t => t.category === '购物').diffPct).toBeNull()
    expect(trends.find(t => t.category === '餐饮').amount).toBe(0)
  })
})

describe('findSpendingStreak（连续消费模式）', () => {
  it('上周连续 5 天同分类每天超阈值 → days=5，日均正确', () => {
    const bills = []
    for (let i = 0; i < 5; i++) bills.push(bill(LAST_MON + i * 86400e3 + 3600e3, 20 + i, '外卖'))
    const s = findSpendingStreak(bills, NOW)
    expect(s).not.toBeNull()
    expect(s.category).toBe('外卖')
    expect(s.days).toBe(5)
    expect(s.avgAmount).toBe(22)
  })

  it('断一天就断段：2+1 天不够 minDays → null', () => {
    const bills = [
      bill(LAST_MON + 3600e3, 25, '外卖'), bill(LAST_MON + 86400e3 + 3600e3, 25, '外卖'),
      bill(LAST_MON + 3 * 86400e3 + 3600e3, 25, '外卖')
    ]
    expect(findSpendingStreak(bills, NOW)).toBeNull()
  })

  it('金额低于阈值的天不算连续', () => {
    const bills = []
    for (let i = 0; i < 4; i++) bills.push(bill(LAST_MON + i * 86400e3 + 3600e3, i === 2 ? 5 : 25, '外卖'))
    expect(findSpendingStreak(bills, NOW)).toBeNull()
  })
})

describe('collectPlanWeeklyStat（上周打卡统计）', () => {
  it('统计次数、覆盖计划数与活跃计划数；子计划打卡也计入', () => {
    const plans = [
      { client_id: 'p1', status: 1, checkins: [{ at: LAST_MON + 3600e3 }, { at: LAST_MON + 2 * 86400e3 + 3600e3 }] },
      { client_id: 'p2', status: 1, children: [{ client_id: 'p2c', checkins: [{ at: LAST_MON + 3 * 86400e3 + 3600e3 }] }] },
      { client_id: 'p3', status: 2, checkins: [{ at: LAST_MON - 86400e3 }] },
      { client_id: 'p4', status: 1, checkins: [{ at: WEEK_START + 3600e3 }] }
    ]
    const s = collectPlanWeeklyStat(plans, NOW)
    expect(s.checkinCount).toBe(3)
    expect(s.checkinPlans).toBe(2)
    expect(s.activePlans).toBe(3)
  })
})

describe('countDiariesInRange（上周记录篇数，跨月）', () => {
  beforeEach(() => { uni.clearStorageSync() })

  it('按 created_at 归属计数，软删不算，跨月分片都扫', () => {
    const lastMonthDay = LAST_MON - 5 * 86400e3
    const m1 = new Date(lastMonthDay)
    const m2 = new Date(LAST_MON + 2 * 86400e3)
    const pad = n => String(n).padStart(2, '0')
    const key1 = 'diary_' + m1.getFullYear() + '-' + pad(m1.getMonth() + 1)
    const key2 = 'diary_' + m2.getFullYear() + '-' + pad(m2.getMonth() + 1)
    uni.setStorageSync(key1, JSON.stringify([
      { client_id: 'd1', created_at: lastMonthDay + 3600e3, is_deleted: 0 }
    ]))
    uni.setStorageSync(key2, JSON.stringify([
      { client_id: 'd2', created_at: LAST_MON + 2 * 86400e3 + 3600e3, is_deleted: 0 },
      { client_id: 'd3', created_at: LAST_MON + 3 * 86400e3 + 3600e3, is_deleted: 1 }
    ]))
    expect(countDiariesInRange(LAST_MON, WEEK_START)).toBe(1)
  })
})

describe('buildWeeklySuggestion（建议生成）', () => {
  it('连续模式优先于分类暴涨', () => {
    const trends = [{ category: '餐饮', amount: 120, pct: 0.67, lastAmount: 30, diffPct: 300 }]
    const streak = { category: '外卖', days: 5, avgAmount: 22 }
    const s = buildWeeklySuggestion(trends, streak)
    expect(s.line).toContain('外卖连着 5 天')
    expect(s.prefill).toBe('帮我看看上周外卖都花在哪了')
  })

  it('没有连续段时，涨幅达标且占比过半的分类触发', () => {
    const trends = [
      { category: '餐饮', amount: 120, pct: 0.67, lastAmount: 85, diffPct: 41 },
      { category: '交通', amount: 30, pct: 0.17, lastAmount: 20, diffPct: 50 }
    ]
    const s = buildWeeklySuggestion(trends, null)
    expect(s.line).toContain('餐饮占到了 67%')
  })

  it('一切正常 → 不打扰（null）', () => {
    const trends = [{ category: '餐饮', amount: 100, pct: 0.8, lastAmount: 100, diffPct: 0 }]
    expect(buildWeeklySuggestion(trends, null)).toBeNull()
  })
})

describe('buildWeeklyInsightText（正文拼装）', () => {
  it('完整形状：花费归因 + 连续模式 + 打卡 + 记录 + 建议问句', () => {
    const text = buildWeeklyInsightText({
      total: 180,
      diffPct: 20,
      top: { category: '餐饮', amount: 120, pct: 0.667, lastAmount: 85, diffPct: 41 },
      streak: { category: '外卖', days: 5, avgAmount: 22, line: '外卖连着 5 天每天超 ¥20（日均 ¥22）' },
      suggestion: { line: '外卖连着 5 天每天超 ¥20（日均 ¥22）', ask: '要不要看看外卖都花在哪了？', prefill: '帮我看看上周外卖都花在哪了' },
      planStat: { checkinCount: 8, checkinPlans: 2, activePlans: 3 },
      diaryCount: 4
    })
    expect(text).toContain('上周花了 ¥180')
    expect(text).toContain('主要是餐饮 ¥120（占 67%，比前周多41%）')
    expect(text).toContain('外卖连着 5 天每天超 ¥20')
    expect(text).toContain('打了 8 次卡')
    expect(text).toContain('写了 4 篇记录')
    expect(text).toContain('要不要看看外卖都花在哪了？')
  })

  it('空洞察 → 空串', () => {
    expect(buildWeeklyInsightText(null)).toBe('')
    expect(buildWeeklyInsightText({ total: 0, planStat: { checkinCount: 0 }, diaryCount: 0 })).toBe('')
  })
})

describe('buildWeeklyInsightAnnouncement（聚合与门控）', () => {
  beforeEach(() => { uni.clearStorageSync() })

  it('有支出时产出洞察；调用方标记已播报后同周第二次被门控拦下', () => {
    const bills = [bill(LAST_MON + 3600e3, 180, '餐饮')]
    const first = buildWeeklyInsightAnnouncement({ now: NOW, bills, plans: [] })
    expect(first).not.toBeNull()
    expect(first.total).toBe(180)
    expect(first.planStat.checkinCount).toBe(0)
    expect(first.text).toContain('上周花了 ¥180')
    // 标记是调用方（useEnterSummary）的职责 —— 洞察函数只读，播不播由外层决定
    markWeeklyBillAnnounced(NOW)
    const second = buildWeeklyInsightAnnouncement({ now: NOW, bills, plans: [] })
    expect(second).toBeNull()
  })

  it('整周零支出零打卡零记录 → null（不打扰）', () => {
    uni.setStorageSync('siji_bill_weekly_at', '')
    const r = buildWeeklyInsightAnnouncement({ now: NOW, bills: [], plans: [] })
    expect(r).toBeNull()
  })

  it('零支出但有打卡与记录 → 也产出（不只盯着钱）', () => {
    uni.setStorageSync('siji_bill_weekly_at', '')
    const plans = [{ client_id: 'p1', status: 1, checkins: [{ at: LAST_MON + 3600e3 }] }]
    const m2 = new Date(LAST_MON + 2 * 86400e3)
    const pad = n => String(n).padStart(2, '0')
    uni.setStorageSync('diary_' + m2.getFullYear() + '-' + pad(m2.getMonth() + 1), JSON.stringify([
      { client_id: 'd2', created_at: LAST_MON + 2 * 86400e3 + 3600e3, is_deleted: 0 }
    ]))
    const r = buildWeeklyInsightAnnouncement({ now: NOW, bills: [], plans })
    expect(r).not.toBeNull()
    expect(r.text).toContain('打了 1 次卡')
    expect(r.text).toContain('写了 1 篇记录')
  })
})
