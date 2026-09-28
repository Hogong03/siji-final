/**
 * plan-heatmap.js 测试（3.5.3：打卡热力月视图纯逻辑）
 * 2026-09-14 是周一：2026-09-01 为周二 → 9 月网格首行 1 个空位、共 5 周
 */
import { describe, it, expect } from 'vitest'
import {
  levelOf,
  dateKeyOf,
  collectDayCounts,
  monthGrid,
  monthTotals,
  shiftMonth,
  canGoNext,
  weekCheckinSummary,
  countsOf
} from '@/utils/plan-heatmap.js'

const SEPT_16 = new Date(2026, 8, 16, 9, 0, 0).getTime()
const SEPT_16_TEN = new Date(2026, 8, 16, 10, 30, 0).getTime()

describe('levelOf：强度分级', () => {
  it('0 无 / 1 一次 / 2 两次 / 3 三次及以上', () => {
    expect(levelOf(0)).toBe(0)
    expect(levelOf(undefined)).toBe(0)
    expect(levelOf(1)).toBe(1)
    expect(levelOf(2)).toBe(2)
    expect(levelOf(3)).toBe(3)
    expect(levelOf(9)).toBe(3)
  })
})

describe('collectDayCounts：打卡次数表', () => {
  it('打卡按日期累加，完成日志按时间归日，已删除计划排除', () => {
    const plans = [
      { client_id: 'a', is_deleted: 0, checkins: [{ date: '2026-09-14' }, { date: '2026-09-15' }] },
      { client_id: 'b', is_deleted: 0, checkins: [{ date: '2026-09-14' }], executions: [{ action: 'done', at: SEPT_16 }] },
      { client_id: 'c', is_deleted: 1, checkins: [{ date: '2026-09-14' }] }
    ]
    const map = collectDayCounts(plans)
    expect(map['2026-09-14']).toBe(2)
    expect(map['2026-09-15']).toBe(1)
    expect(map[dateKeyOf(SEPT_16)]).toBe(1)
  })
})

describe('monthGrid：周一起 7 列网格', () => {
  const counts = { '2026-09-01': 1, '2026-09-02': 2, '2026-09-03': 5 }

  it('2026-09 首行 1 个空位、共 5 周、末行补空', () => {
    const weeks = monthGrid(2026, 8, counts, SEPT_16)
    expect(weeks).toHaveLength(5)
    expect(weeks[0][0]).toBeNull()
    expect(weeks[0][1].date).toBe('2026-09-01')
    expect(weeks[2][0].date).toBe('2026-09-14') // 周一
    expect(weeks[4][2].day).toBe(30)
    expect(weeks[4][3]).toBeNull()
  })

  it('格子带 count / level / isToday', () => {
    const weeks = monthGrid(2026, 8, counts, SEPT_16)
    expect(weeks[0][1].count).toBe(1)
    expect(weeks[0][1].level).toBe(1)
    expect(weeks[0][2].level).toBe(2)
    expect(weeks[0][3].level).toBe(3)
    expect(weeks[0][4].level).toBe(0)
    expect(weeks[2][2].isToday).toBe(true) // 2026-09-16
    expect(weeks[2][1].isToday).toBe(false)
  })

  it('2026-02：1 日为周日 → 首行 6 个空位，28 天落在 5 周内且末格补空', () => {
    const weeks = monthGrid(2026, 1, {}, SEPT_16)
    expect(weeks).toHaveLength(5)
    expect(weeks[0][6].day).toBe(1)
    expect(weeks[4][5].day).toBe(28)
    expect(weeks[4][6]).toBeNull()
  })
})

describe('monthTotals / shiftMonth / canGoNext', () => {
  it('合计只统计当月有记录的天数', () => {
    const counts = { '2026-09-01': 1, '2026-09-02': 3, '2026-08-31': 9 }
    expect(monthTotals(2026, 8, counts)).toEqual({ days: 2, times: 4 })
  })

  it('月份偏移跨年', () => {
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 })
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 })
  })

  it('不允许翻到未来月份', () => {
    expect(canGoNext(2026, 7, SEPT_16)).toBe(true)
    expect(canGoNext(2026, 8, SEPT_16)).toBe(false)
    expect(canGoNext(2027, 0, SEPT_16)).toBe(false)
  })
})

describe('weekCheckinSummary：本周打卡概览（3.5.4）', () => {
  it('只统计周一起当周、只算打卡、主计划与子计划一起算', () => {
    const plans = [
      { client_id: 'root', is_deleted: 0, checkins: [{ date: '2026-09-14' }, { date: '2026-09-16' }] },
      { client_id: 'child', parent_id: 'root', is_deleted: 0, checkins: [{ date: '2026-09-16' }] },
      { client_id: 'old', is_deleted: 0, checkins: [{ date: '2026-09-13' }] }, // 上周日
      { client_id: 'gone', is_deleted: 1, checkins: [{ date: '2026-09-16' }] }
    ]
    expect(weekCheckinSummary(plans, SEPT_16)).toEqual({ times: 3, days: 2 })
  })

  it('完成日志不计数，空数据返回 0', () => {
    const plans = [
      { client_id: 'a', is_deleted: 0, checkins: [], executions: [{ action: 'done', at: SEPT_16 }] }
    ]
    expect(weekCheckinSummary(plans, SEPT_16)).toEqual({ times: 0, days: 0 })
    expect(weekCheckinSummary([], SEPT_16)).toEqual({ times: 0, days: 0 })
  })
})

describe('countsOf：单计划热度唯一口径（3.5.6）', () => {
  it('打卡 + 完成日志都算，按天累加', () => {
    const plan = {
      checkins: [{ date: '2026-09-14' }, { date: '2026-09-15' }],
      executions: [{ action: 'done', at: SEPT_16_TEN }]
    }
    const map = countsOf(plan)
    expect(map['2026-09-14']).toBe(1)
    expect(map['2026-09-15']).toBe(1)
    expect(map['2026-09-16']).toBe(1)
  })

  it('同一天既打卡又完成 = 2 次（两个动作确实发生了两次）', () => {
    const plan = {
      checkins: [{ date: '2026-09-16' }],
      executions: [{ action: 'done', at: SEPT_16_TEN }]
    }
    expect(countsOf(plan)['2026-09-16']).toBe(2)
  })

  it('已删除计划 / 空计划 → 空表', () => {
    expect(countsOf({ is_deleted: 1, checkins: [{ date: '2026-09-16' }] })).toEqual({})
    expect(countsOf(null)).toEqual({})
  })

  it('collectDayCounts 就是逐计划 countsOf 相加（两处颜色可以互相对照）', () => {
    const a = { checkins: [{ date: '2026-09-16' }] }
    const b = { checkins: [{ date: '2026-09-16' }], executions: [{ action: 'done', at: SEPT_16_TEN }] }
    const all = collectDayCounts([a, b])
    expect(all['2026-09-16']).toBe(1 + 2)
  })
})

describe('monthGrid：未来日期可识别（3.5.6）', () => {
  it('晚于今天标 isFuture，今天标 isToday', () => {
    const weeks = monthGrid(2026, 8, {}, SEPT_16)
    const cells = weeks.flat().filter(Boolean)
    const today = cells.find(c => c.date === '2026-09-16')
    const future = cells.find(c => c.date === '2026-09-17')
    const past = cells.find(c => c.date === '2026-09-15')
    expect(today.isToday).toBe(true)
    expect(today.isFuture).toBe(false)
    expect(future.isFuture).toBe(true)
    expect(past.isFuture).toBe(false)
  })
})
