/**
 * bill-weekly.js 测试（3.5.14：每周账单播报）
 *
 * 覆盖：区间汇总口径（左闭右开 / type 兼容 / created_at 兜底）、周对比与占比、
 * 一行文案（无支出返回空串）、每周只播一次（跨周恢复）、跨月分片读取。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { resetStorage } from './setup.js'
import { weekRangeTsOf } from '../utils/plan-recur.js'
import { monthKeyOf } from '../utils/enter-summary.js'
import {
  formatMoney,
  weekKeyOf,
  sumExpenseIn,
  buildWeeklyBill,
  formatWeeklyBillLine,
  readBillsForWeeks,
  shouldAnnounceWeeklyBill,
  markWeeklyBillAnnounced,
  buildWeeklyBillAnnouncement
} from '../utils/bill-weekly.js'

const DAY = 24 * 60 * 60 * 1000
/** 2026-09-14（周一）10:00 */
const NOW = new Date(2026, 8, 14, 10, 0, 0).getTime()
/** 2026-09-02（周三，本周起点 8-31 落在 8 月分片，可测跨月） */
const CROSS = new Date(2026, 8, 2, 10, 0, 0).getTime()
const WEEK_START = weekRangeTsOf(NOW).weekStart

function ymd(ts) {
  const d = new Date(ts)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

function mkBill(over) {
  return Object.assign({
    client_id: 'b1',
    type: 'expense',
    amount: 10,
    category: '餐饮',
    bill_date: ymd(WEEK_START),
    created_at: WEEK_START
  }, over)
}

beforeEach(() => {
  resetStorage()
})

describe('formatMoney：金额文案', () => {
  it('整数不带小数', () => {
    expect(formatMoney(12)).toBe('¥12')
    expect(formatMoney(0)).toBe('¥0')
  })

  it('小数保留两位', () => {
    expect(formatMoney(12.5)).toBe('¥12.50')
    expect(formatMoney('8.126')).toBe('¥8.13')
  })

  it('非法输入按 0 处理', () => {
    expect(formatMoney(null)).toBe('¥0')
    expect(formatMoney(undefined)).toBe('¥0')
    expect(formatMoney('abc')).toBe('¥0')
  })
})

describe('weekKeyOf：本周 key', () => {
  it('取本周周一的日期', () => {
    expect(weekKeyOf(NOW)).toBe(ymd(WEEK_START))
    expect(weekKeyOf(NOW)).toBe('2026-09-14')
  })

  it('同一周内不同时刻 key 相同', () => {
    expect(weekKeyOf(NOW)).toBe(weekKeyOf(WEEK_START + 3 * DAY + 5 * 3600 * 1000))
  })
})

describe('sumExpenseIn：区间汇总', () => {
  it('区间左闭右开', () => {
    const bills = [
      mkBill({ client_id: 'in1', amount: 10, bill_date: ymd(WEEK_START), created_at: WEEK_START }),
      mkBill({ client_id: 'in2', amount: 20, bill_date: ymd(WEEK_START + DAY), created_at: WEEK_START + DAY }),
      mkBill({ client_id: 'out', amount: 99, bill_date: ymd(WEEK_START + 7 * DAY), created_at: WEEK_START + 7 * DAY })
    ]
    const r = sumExpenseIn(bills, WEEK_START, WEEK_START + 7 * DAY)
    expect(r.total).toBe(30)
    expect(r.count).toBe(2)
  })

  it('只统计支出：type 为 0 的数字形态也算，收入排除', () => {
    const bills = [
      mkBill({ client_id: 'a', type: 0, amount: 5 }),
      mkBill({ client_id: 'b', type: 'expense', amount: 5 }),
      mkBill({ client_id: 'c', type: 'income', amount: 1000 }),
      mkBill({ client_id: 'd', type: 1, amount: 1000 }),
      null
    ]
    const r = sumExpenseIn(bills, WEEK_START, WEEK_START + 7 * DAY)
    expect(r.total).toBe(10)
    expect(r.count).toBe(2)
  })

  it('没有 bill_date 时用 created_at 兜底', () => {
    const bills = [
      mkBill({ client_id: 'a', bill_date: '', created_at: WEEK_START + 2 * DAY, amount: 7 }),
      mkBill({ client_id: 'b', bill_date: '', created_at: WEEK_START - DAY, amount: 7 })
    ]
    expect(sumExpenseIn(bills, WEEK_START, WEEK_START + 7 * DAY).total).toBe(7)
  })

  it('两者都非法时跳过，不污染金额', () => {
    const bills = [mkBill({ client_id: 'a', bill_date: '今天', created_at: 0, amount: 66 })]
    const r = sumExpenseIn(bills, WEEK_START, WEEK_START + 7 * DAY)
    expect(r.total).toBe(0)
    expect(r.count).toBe(0)
  })

  it('按分类累计', () => {
    const bills = [
      mkBill({ client_id: 'a', category: '餐饮', amount: 10 }),
      mkBill({ client_id: 'b', category: '餐饮', amount: 5 }),
      mkBill({ client_id: 'c', category: '交通', amount: 3 }),
      mkBill({ client_id: 'd', category: '', amount: 2 })
    ]
    const r = sumExpenseIn(bills, WEEK_START, WEEK_START + 7 * DAY)
    expect(r.byCategory['餐饮']).toBe(15)
    expect(r.byCategory['交通']).toBe(3)
    expect(r.byCategory['未分类']).toBe(2)
  })

  it('非数组输入返回空汇总', () => {
    expect(sumExpenseIn(null, 0, DAY)).toEqual({ total: 0, count: 0, byCategory: {} })
  })
})

describe('buildWeeklyBill：本周 vs 上周', () => {
  it('本周与上周对比给出百分比', () => {
    const bills = [
      mkBill({ client_id: 't1', amount: 60, category: '餐饮', bill_date: ymd(WEEK_START + DAY), created_at: WEEK_START + DAY }),
      mkBill({ client_id: 't2', amount: 40, category: '交通', bill_date: ymd(WEEK_START + 2 * DAY), created_at: WEEK_START + 2 * DAY }),
      mkBill({ client_id: 'l1', amount: 50, bill_date: ymd(WEEK_START - 3 * DAY), created_at: WEEK_START - 3 * DAY })
    ]
    const r = buildWeeklyBill(bills, NOW)
    expect(r.total).toBe(100)
    expect(r.count).toBe(2)
    expect(r.lastTotal).toBe(50)
    expect(r.diffPct).toBe(100)
    expect(r.topCategory).toBe('餐饮')
    expect(r.topAmount).toBe(60)
  })

  it('上周没有支出时 diffPct 为 null', () => {
    const bills = [mkBill({ amount: 30 })]
    const r = buildWeeklyBill(bills, NOW)
    expect(r.total).toBe(30)
    expect(r.lastTotal).toBe(0)
    expect(r.diffPct).toBe(null)
  })

  it('与上周持平时 diffPct 为 0', () => {
    const bills = [
      mkBill({ client_id: 't', amount: 20, bill_date: ymd(WEEK_START + DAY), created_at: WEEK_START + DAY }),
      mkBill({ client_id: 'l', amount: 20, bill_date: ymd(WEEK_START - 3 * DAY), created_at: WEEK_START - 3 * DAY })
    ]
    expect(buildWeeklyBill(bills, NOW).diffPct).toBe(0)
  })

  it('本周为 0 时不产生分类冠军', () => {
    const bills = [mkBill({ client_id: 'l', amount: 20, bill_date: ymd(WEEK_START - 3 * DAY), created_at: WEEK_START - 3 * DAY })]
    const r = buildWeeklyBill(bills, NOW)
    expect(r.total).toBe(0)
    expect(r.topCategory).toBe('')
    expect(r.topAmount).toBe(0)
    expect(r.diffPct).toBe(-100)
  })
})

describe('formatWeeklyBillLine：一行文案', () => {
  it('没有支出返回空串', () => {
    expect(formatWeeklyBillLine(null)).toBe('')
    expect(formatWeeklyBillLine({ total: 0, diffPct: null })).toBe('')
  })

  it('包含金额、主要类别与上周对比', () => {
    const line = formatWeeklyBillLine({ total: 128, topCategory: '餐饮', topAmount: 80, diffPct: 30 })
    expect(line).toBe('本周花了 ¥128 · 主要是餐饮 ¥80 · 比上周多30%')
  })

  it('减少与持平分别有独立措辞', () => {
    expect(formatWeeklyBillLine({ total: 50, topCategory: '', topAmount: 0, diffPct: -25 }))
      .toBe('本周花了 ¥50 · 比上周少25%')
    expect(formatWeeklyBillLine({ total: 50, topCategory: '', topAmount: 0, diffPct: 0 }))
      .toBe('本周花了 ¥50 · 和上周差不多')
  })

  it('上周没有记录时直说，不算百分比', () => {
    expect(formatWeeklyBillLine({ total: 50, topCategory: '', topAmount: 0, diffPct: null }))
      .toBe('本周花了 ¥50 · 上周没有支出记录')
  })
})

describe('每周只播一次', () => {
  it('初始可播报，标记后本周不再播报', () => {
    expect(shouldAnnounceWeeklyBill(NOW)).toBe(true)
    markWeeklyBillAnnounced(NOW)
    expect(shouldAnnounceWeeklyBill(NOW)).toBe(false)
    expect(shouldAnnounceWeeklyBill(WEEK_START + 6 * DAY)).toBe(false)
  })

  it('跨到下一周恢复播报', () => {
    markWeeklyBillAnnounced(NOW)
    expect(shouldAnnounceWeeklyBill(NOW + 7 * DAY)).toBe(true)
  })
})

describe('buildWeeklyBillAnnouncement：生成播报', () => {
  it('本周没有支出时返回 null，且不消耗本周播报额度', () => {
    expect(buildWeeklyBillAnnouncement({ now: NOW, bills: [] })).toBe(null)
    expect(shouldAnnounceWeeklyBill(NOW)).toBe(true)
  })

  it('有支出时返回完整数据结构', () => {
    const bills = [mkBill({ amount: 42, category: '餐饮' })]
    const r = buildWeeklyBillAnnouncement({ now: NOW, bills: bills })
    expect(r.total).toBe(42)
    expect(r.text).toContain('本周花了 ¥42')
    // 生成本身不写标记，由调用方（进入总结结算）标记；标记后本周不再生成
    markWeeklyBillAnnounced(NOW)
    expect(buildWeeklyBillAnnouncement({ now: NOW, bills: bills })).toBe(null)
  })
})

describe('readBillsForWeeks：跨月分片', () => {
  it('合并上一周所在月份与本月分片，并排除已删除', () => {
    const weekStart = weekRangeTsOf(CROSS).weekStart
    const lastDay = weekStart - 3 * DAY
    expect(monthKeyOf(weekStart)).toBe('2026-08')
    expect(monthKeyOf(lastDay)).toBe('2026-08')
    uni.setStorageSync('bill_' + monthKeyOf(weekStart), JSON.stringify([
      mkBill({ client_id: 'l1', amount: 20, bill_date: ymd(lastDay), created_at: lastDay }),
      mkBill({ client_id: 'l2', amount: 30, bill_date: ymd(lastDay), created_at: lastDay, is_deleted: 1 }),
      mkBill({ client_id: 't1', amount: 5, bill_date: ymd(weekStart), created_at: weekStart })
    ]))
    // 本周的第二条落在 9 月分片（周起点 8-31 属 8 月，需两个分片拼齐）
    const septBill = new Date(2026, 8, 1, 12, 0, 0).getTime()
    uni.setStorageSync('bill_2026-09', JSON.stringify([
      mkBill({ client_id: 't2', amount: 12, bill_date: '2026-09-01', created_at: septBill })
    ]))
    const bills = readBillsForWeeks(CROSS)
    expect(bills.length).toBe(3)
    const r = buildWeeklyBill(bills, CROSS)
    expect(r.total).toBe(17)
    expect(r.lastTotal).toBe(20)
    expect(r.diffPct).toBe(-15)
  })

  it('分片缺失时返回空数组，不抛错', () => {
    expect(readBillsForWeeks(NOW)).toEqual([])
  })
})
