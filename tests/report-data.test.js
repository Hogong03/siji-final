/**
 * 月度报告数据聚合测试 — utils/report-data.js buildMonthlyReport
 * 覆盖：账单聚合 / 记录聚合 / 打卡计数 / 软删除过滤 / 跨月不串 / 非法入参 / 无数据
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { resetStorage } from './setup.js'
import { buildMonthlyReport } from '../utils/report-data.js'

const NOTE_1 = '今天跑了五公里，状态不错'
const NOTE_2 = '加班到深夜，有点累'

/** 塞 2026-09 的账单 / 记录 / 打卡（打卡混入 10 月一条与已删除计划一条） */
function seedSeptember() {
  uni.setStorageSync('bill_2026-09', [
    { client_id: 'b1', type: 'expense', amount: 30, category: '餐饮', bill_date: '2026-09-02', is_deleted: 0 },
    { client_id: 'b2', type: 'expense', amount: 120.5, category: '购物', bill_date: '2026-09-05', is_deleted: 0 },
    { client_id: 'b3', type: 'expense', amount: 19.5, category: '餐饮', bill_date: '2026-09-08', is_deleted: 0 },
    { client_id: 'b4', type: 'income', amount: 5000, category: '工资', bill_date: '2026-09-10', is_deleted: 0 }
  ])
  uni.setStorageSync('diary_2026-09', [
    { client_id: 'd1', content: NOTE_1, mood: 4, is_deleted: 0 },
    { client_id: 'd2', content: NOTE_2, mood: 2, is_deleted: 0 }
  ])
  uni.setStorageSync('plan_all', JSON.stringify([
    { client_id: 'p1', is_deleted: 0, checkins: [{ date: '2026-09-01' }, { date: '2026-09-02' }, { date: '2026-10-01' }] },
    { client_id: 'p2', is_deleted: 0, checkins: [{ date: '2026-09-15' }] },
    { client_id: 'p3', is_deleted: 1, checkins: [{ date: '2026-09-20' }] }
  ]))
}

beforeEach(() => {
  resetStorage()
})

describe('buildMonthlyReport 账单聚合', () => {
  it('总支出 / 总收入 / 笔数 / 分类 top3', () => {
    seedSeptember()
    const r = buildMonthlyReport(2026, 9)
    expect(r.ok).toBe(true)
    expect(r.month).toBe('2026-09')
    expect(r.bills.expense).toBe(170)
    expect(r.bills.income).toBe(5000)
    expect(r.bills.count).toBe(4)
    expect(r.bills.topCategories).toEqual([
      { category: '购物', total: 120.5 },
      { category: '餐饮', total: 49.5 }
    ])
  })

  it('软删除账单不计入', () => {
    seedSeptember()
    const raw = JSON.parse(uni.getStorageSync('bill_2026-09'))
    raw[0].is_deleted = 1
    uni.setStorageSync('bill_2026-09', raw)
    const r = buildMonthlyReport(2026, 9)
    expect(r.bills.expense).toBe(140)
    expect(r.bills.count).toBe(3)
  })
})

describe('buildMonthlyReport 记录聚合', () => {
  it('篇数 / 总字数 / mood 均值', () => {
    seedSeptember()
    const r = buildMonthlyReport(2026, 9)
    expect(r.diary.count).toBe(2)
    expect(r.diary.words).toBe(NOTE_1.length + NOTE_2.length)
    expect(r.diary.moodAvg).toBe(3)
  })

  it('没有 mood 打分时 moodAvg 为 null', () => {
    uni.setStorageSync('diary_2026-09', [
      { client_id: 'd1', content: '随便写写', is_deleted: 0 }
    ])
    const r = buildMonthlyReport(2026, 9)
    expect(r.diary.count).toBe(1)
    expect(r.diary.moodAvg).toBeNull()
  })

  it('软删除记录不计入', () => {
    seedSeptember()
    const raw = JSON.parse(uni.getStorageSync('diary_2026-09'))
    raw[0].is_deleted = 1
    uni.setStorageSync('diary_2026-09', raw)
    const r = buildMonthlyReport(2026, 9)
    expect(r.diary.count).toBe(1)
    expect(r.diary.words).toBe(NOTE_2.length)
    expect(r.diary.moodAvg).toBe(2)
  })
})

describe('buildMonthlyReport 打卡计数', () => {
  it('只数当月、排除跨月与已删除计划', () => {
    seedSeptember()
    const r = buildMonthlyReport(2026, 9)
    expect(r.checkins).toBe(3)
  })

  it('10 月只剩跨进来的那条（跨月不串）', () => {
    seedSeptember()
    const r = buildMonthlyReport(2026, 10)
    expect(r.checkins).toBe(1)
  })
})

describe('buildMonthlyReport 边界', () => {
  it('空月份：全零且 moodAvg 为 null', () => {
    const r = buildMonthlyReport(2026, 10)
    expect(r.ok).toBe(true)
    expect(r.bills).toEqual({ expense: 0, income: 0, count: 0, topCategories: [] })
    expect(r.diary).toEqual({ count: 0, words: 0, moodAvg: null })
    expect(r.checkins).toBe(0)
  })

  it('非法月份返回 ok=false', () => {
    expect(buildMonthlyReport(2026, 13).ok).toBe(false)
    expect(buildMonthlyReport(2026, 0).ok).toBe(false)
    expect(buildMonthlyReport(NaN, 5).ok).toBe(false)
  })

  it('两个月并存时互不串数', () => {
    seedSeptember()
    uni.setStorageSync('bill_2026-10', [
      { client_id: 'b10', type: 'expense', amount: 88, category: '餐饮', bill_date: '2026-10-02', is_deleted: 0 }
    ])
    uni.setStorageSync('diary_2026-10', [
      { client_id: 'd10', content: '十月第一条', mood: 5, is_deleted: 0 }
    ])
    const sep = buildMonthlyReport(2026, 9)
    const oct = buildMonthlyReport(2026, 10)
    expect(sep.bills.expense).toBe(170)
    expect(sep.diary.count).toBe(2)
    expect(oct.bills.expense).toBe(88)
    expect(oct.bills.count).toBe(1)
    expect(oct.diary.count).toBe(1)
    expect(oct.diary.moodAvg).toBe(5)
    expect(oct.bills.topCategories).toEqual([{ category: '餐饮', total: 88 }])
  })
})
