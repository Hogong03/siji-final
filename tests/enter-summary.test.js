/**
 * enter-summary.js 测试（3.4.5：冷启动进入总结，纯函数口径）
 */
import { describe, it, expect } from 'vitest'
import { buildEnterSummary, monthsBetween, monthKeyOf, formatSummaryTime, calcGlobalStreak } from '@/utils/enter-summary.js'

const T0 = new Date(2026, 8, 9, 8, 0, 0).getTime() // 2026-09-09 08:00
const DAY = 24 * 60 * 60 * 1000

function plan(overrides) {
  return {
    client_id: 'p1',
    title: '晨跑',
    is_deleted: 0,
    status: 2,
    checkins: [],
    executions: [],
    ...overrides
  }
}

describe('buildEnterSummary：计划事件窗口', () => {
  it('窗口内的完成与打卡都计入，窗口外排除', () => {
    const plans = [
      plan({
        title: '晨跑',
        executions: [{ action: 'done', at: T0 - 2 * DAY }], // 基线前
        checkins: [{ at: T0 - 1 * DAY, date: '2026-09-08', note: '3 公里' }]
      }),
      plan({
        client_id: 'p2',
        title: '读书',
        executions: [{ action: 'done', at: T0 + 2 * DAY }]
      })
    ]
    const r = buildEnterSummary({ plans, since: T0 - 2 * DAY + 1000, now: T0 + 3 * DAY })
    expect(r.eventsTotal).toBe(2) // 晨跑打卡 + 读书完成
    expect(r.events.every(e => e.kind === 'done' || e.kind === 'checkin')).toBe(true)
    expect(r.events[0].kind).toBe('done')
    expect(r.events[0].title).toBe('读书')
    expect(r.events[1].kind).toBe('checkin')
    expect(r.events[1].title).toBe('晨跑')
  })

  it('is_deleted 计划不参与统计', () => {
    const r = buildEnterSummary({
      plans: [plan({ is_deleted: 1, executions: [{ action: 'done', at: T0 }] })],
      since: T0 - 1,
      now: T0 + 1
    })
    expect(r.eventsTotal).toBe(0)
  })

  it('事件超过 6 条时只返回前 6，eventsTotal 保留总数', () => {
    const plans = []
    for (let i = 0; i < 8; i++) {
      plans.push(plan({
        client_id: 'p' + i,
        title: '计划' + i,
        executions: [{ action: 'done', at: T0 - i }]
      }))
    }
    const r = buildEnterSummary({ plans, since: T0 - 10, now: T0 + 1 })
    expect(r.events).toHaveLength(6)
    expect(r.eventsTotal).toBe(8)
  })
})

describe('buildEnterSummary：新增记录', () => {
  it('跨月读取并按 created_at 窗口过滤', () => {
    const readerCalls = []
    const reader = (month) => {
      readerCalls.push(month)
      if (month === '2026-08') {
        return [
          { client_id: 'a', created_at: new Date(2026, 7, 20, 9, 0).getTime() } // 基线前
        ]
      }
      if (month === '2026-09') {
        return [
          { client_id: 'b', created_at: T0 + DAY },
          { client_id: 'c', created_at: new Date(2026, 7, 31, 12, 0).getTime() }, // 基线前
          { client_id: 'd', created_at: T0 + 2 * DAY, is_deleted: 1 }
        ]
      }
      return []
    }
    const since = new Date(2026, 8, 1, 0, 0, 0).getTime() - 1
    const r = buildEnterSummary({ plans: [], since, now: T0 + 2 * DAY, diaryReader: reader })
    expect(readerCalls).toEqual(['2026-08', '2026-09'])
    expect(r.diaryCount).toBe(1)
    expect(r.eventsTotal).toBe(0)
  })

  it('无 diaryReader 时记录数恒为 0', () => {
    const r = buildEnterSummary({ plans: [], since: T0 - 1, now: T0 })
    expect(r.diaryCount).toBe(0)
  })
})

describe('时间与月份工具', () => {
  it('monthKeyOf / monthsBetween 跨年跨月', () => {
    const dec = new Date(2026, 11, 31, 23, 0).getTime()
    const jan = new Date(2027, 0, 2, 1, 0).getTime()
    expect(monthKeyOf(dec)).toBe('2026-12')
    expect(monthsBetween(dec, jan)).toEqual(['2026-12', '2027-01'])
    expect(monthsBetween(jan, dec)).toEqual([]) // 起始晚于结束
  })

  it('formatSummaryTime：今天/昨天/更早', () => {
    const now = new Date(2026, 8, 9, 12, 0, 0).getTime()
    const today = new Date(2026, 8, 9, 8, 5).getTime()
    const yest = new Date(2026, 8, 8, 23, 40).getTime()
    const old = new Date(2026, 7, 20, 9, 30).getTime()
    expect(formatSummaryTime(today, now)).toBe('今天 08:05')
    expect(formatSummaryTime(yest, now)).toBe('昨天 23:40')
    expect(formatSummaryTime(old, now)).toBe('8月20日')
  })

  it('buildEnterSummary 无基线时返回空', () => {
    const r = buildEnterSummary({ plans: [], since: 0 })
    expect(r).toEqual({ events: [], eventsTotal: 0, diaryCount: 0, streak: 0 })
  })
})

describe('calcGlobalStreak：全局连续打卡天数（3.5.3）', () => {
  const now = new Date(2026, 8, 16, 9, 0, 0).getTime()
  const ymd = offsetDays => {
    const d = new Date(now - offsetDays * DAY)
    const pad = n => String(n).padStart(2, '0')
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
  }

  it('多计划并集：今天+昨天+前天 → 3', () => {
    const plans = [
      plan({ client_id: 'a', checkins: [{ date: ymd(0) }, { date: ymd(2) }] }),
      plan({ client_id: 'b', checkins: [{ date: ymd(1) }] })
    ]
    expect(calcGlobalStreak(plans, now)).toBe(3)
  })

  it('今天还没打卡但从昨天连续 → 从昨天数', () => {
    const plans = [plan({ checkins: [{ date: ymd(1) }, { date: ymd(2) }] })]
    expect(calcGlobalStreak(plans, now)).toBe(2)
  })

  it('断档后只算最近一段，已删除计划与无打卡不计', () => {
    const plans = [
      plan({ client_id: 'a', checkins: [{ date: ymd(0) }, { date: ymd(3) }, { date: ymd(4) }] }),
      plan({ client_id: 'b', is_deleted: 1, checkins: [{ date: ymd(1) }] }),
      plan({ client_id: 'c', checkins: [] })
    ]
    expect(calcGlobalStreak(plans, now)).toBe(1)
    expect(calcGlobalStreak([], now)).toBe(0)
  })

  it('buildEnterSummary 带上 streak 字段', () => {
    const plans = [plan({ checkins: [{ at: T0, date: ymd(0) }, { at: T0 - DAY, date: ymd(1) }] })]
    const r = buildEnterSummary({ plans, since: T0 - DAY - 1000, now })
    expect(r.streak).toBe(2)
    expect(r.eventsTotal).toBe(2)
  })
})
