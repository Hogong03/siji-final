/**
 * enter-summary.js 测试（3.4.5：冷启动进入总结，纯函数口径 / 3.5.12：回前台增量窗口裁决）
 */
import { describe, it, expect } from 'vitest'
import {
  buildEnterSummary, monthsBetween, monthKeyOf, formatSummaryTime, calcGlobalStreak,
  resolveSummaryWindow, formatAwaySpan, SUMMARY_QUIET_MS, scanMoodDip
} from '@/utils/enter-summary.js'

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

describe('resolveSummaryWindow：回前台增量窗口裁决（3.5.12）', () => {
  const NOW = new Date(2026, 8, 14, 10, 0, 0).getTime()
  const MIN = 60 * 1000

  it('离开基线晚于确认基线时优先用它，awayMs 为真实离开时长', () => {
    const r = resolveSummaryWindow({
      confirmBaseline: NOW - 5 * 60 * MIN,
      leaveBaseline: NOW - 30 * MIN,
      now: NOW
    })
    expect(r).toMatchObject({ skip: false, reason: 'ready', since: NOW - 30 * MIN, awayMs: 30 * MIN })
  })

  it('进程被杀没写离开基线时回落确认基线', () => {
    const r = resolveSummaryWindow({ confirmBaseline: NOW - 2 * MIN, leaveBaseline: 0, now: NOW })
    expect(r).toMatchObject({ skip: false, reason: 'ready', since: NOW - 2 * MIN, awayMs: 2 * MIN })
  })

  it('已有未读卡片时不重算，避免叠卡', () => {
    const r = resolveSummaryWindow({
      confirmBaseline: NOW - MIN, leaveBaseline: NOW - MIN, now: NOW, hasPending: true
    })
    expect(r.skip).toBe(true)
    expect(r.reason).toBe('pending')
  })

  it('60s 内重复回前台被节流，超过间隔放行；本会话没算过时直接放行', () => {
    const base = { confirmBaseline: NOW - 10 * MIN, leaveBaseline: NOW - 10 * MIN, now: NOW }
    expect(resolveSummaryWindow({ ...base, lastCalcAt: NOW - 20 * 1000 }))
      .toMatchObject({ skip: true, reason: 'throttled' })
    expect(resolveSummaryWindow({ ...base, lastCalcAt: NOW - 61 * 1000 }).skip).toBe(false)
    expect(resolveSummaryWindow({ ...base, lastCalcAt: 0 }).skip).toBe(false)
    expect(SUMMARY_QUIET_MS).toBe(60 * 1000)
  })

  it('lastCalcAt 落在未来（设备时钟回拨）时不节流', () => {
    const r = resolveSummaryWindow({
      confirmBaseline: NOW - 10 * MIN, leaveBaseline: NOW - 10 * MIN, now: NOW, lastCalcAt: NOW + 5 * MIN
    })
    expect(r.skip).toBe(false)
    expect(r.awayMs).toBe(10 * MIN)
  })

  it('节流间隔可自定义', () => {
    const base = { confirmBaseline: NOW - MIN, leaveBaseline: NOW - MIN, now: NOW, lastCalcAt: NOW - 5 * 1000 }
    expect(resolveSummaryWindow({ ...base, quietMs: 1000 }).skip).toBe(false)
  })

  it('基线未武装（首次升级）时不弹历史，且不给出窗口', () => {
    const r = resolveSummaryWindow({ confirmBaseline: 0, leaveBaseline: NOW - MIN, now: NOW })
    expect(r).toMatchObject({ skip: true, reason: 'unarmed', since: 0, awayMs: 0 })
  })

  it('基线晚于当前时间（时钟回拨）时跳过', () => {
    const r = resolveSummaryWindow({
      confirmBaseline: NOW + MIN, leaveBaseline: NOW + MIN, now: NOW, lastCalcAt: NOW - 5 * MIN
    })
    expect(r).toMatchObject({ skip: true, reason: 'skew' })
  })
})

describe('formatAwaySpan：离开时长文案（3.5.12）', () => {
  it('分档输出，非法输入给空串', () => {
    expect(formatAwaySpan(0)).toBe('')
    expect(formatAwaySpan(-1)).toBe('')
    expect(formatAwaySpan(NaN)).toBe('')
    expect(formatAwaySpan(30 * 1000)).toBe('刚刚')
    expect(formatAwaySpan(20 * 60 * 1000)).toBe('20 分钟')
    expect(formatAwaySpan(3 * 60 * 60 * 1000)).toBe('3 小时')
    expect(formatAwaySpan(50 * 60 * 60 * 1000)).toBe('2 天')
  })
})

describe('scanMoodDip：连续两天低落（3.5.13）', () => {
  const NOW = new Date(2026, 8, 14, 20, 0, 0).getTime()
  const DAY = 24 * 60 * 60 * 1000
  const SINCE = NOW - 3 * DAY

  function readerOf(list) {
    return (month) => (month === '2026-09' ? list : [])
  }
  function entry(id, at, emotion, extra) {
    return Object.assign({ client_id: id, created_at: at, is_deleted: 0, emotion: emotion }, extra)
  }

  it('最近两个记录日都是低落 → true', () => {
    const list = [entry('a', NOW - DAY, '低落'), entry('b', NOW - 3600 * 1000, '低落')]
    expect(scanMoodDip({ since: SINCE, now: NOW, diaryReader: readerOf(list) })).toBe(true)
  })

  it('只有一天低落 → false', () => {
    const list = [entry('a', NOW - DAY, '低落'), entry('b', NOW - 3600 * 1000, '平静')]
    expect(scanMoodDip({ since: SINCE, now: NOW, diaryReader: readerOf(list) })).toBe(false)
  })

  it('两个记录日不相邻（中间断档）→ false', () => {
    const list = [entry('a', NOW - 3 * DAY, '低落'), entry('b', NOW - 3600 * 1000, '低落')]
    expect(scanMoodDip({ since: SINCE, now: NOW, diaryReader: readerOf(list) })).toBe(false)
  })

  it('同一天多条要全部低落才算', () => {
    const list = [
      entry('a', NOW - DAY, '低落'),
      entry('b', NOW - 2 * 3600 * 1000, '低落'),
      entry('c', NOW - 3600 * 1000, '平静')
    ]
    expect(scanMoodDip({ since: SINCE, now: NOW, diaryReader: readerOf(list) })).toBe(false)
  })

  it('窗口外、已删除、无情绪字段都不计，缺基线或缺 reader → false', () => {
    const list = [
      entry('old', NOW - 10 * DAY, '低落'),
      entry('del', NOW - DAY, '低落', { is_deleted: 1 }),
      entry('noemo', NOW - 3600 * 1000, '低落', { emotion: '' })
    ]
    const reader = readerOf(list)
    expect(scanMoodDip({ since: SINCE, now: NOW, diaryReader: reader })).toBe(false)
    expect(scanMoodDip({ since: 0, now: NOW, diaryReader: reader })).toBe(false)
    expect(scanMoodDip({ since: SINCE, now: NOW })).toBe(false)
  })
})
