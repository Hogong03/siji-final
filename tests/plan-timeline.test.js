/**
 * 计划时间轴纯函数测试
 */
import { describe, it, expect } from 'vitest'
import { toPlanTs, dayStart, buildTimelineNodes, timelineRange, pickTickStep, buildTicks } from '../utils/plan-timeline.js'

describe('toPlanTs', () => {
  it('解析标准日期时间', () => {
    const ts = toPlanTs('2026-08-22 09:30')
    expect(ts).toBe(new Date(2026, 7, 22, 9, 30).getTime())
  })

  it('容忍非补零日期', () => {
    const ts = toPlanTs('2026-8-5')
    expect(ts).toBe(new Date(2026, 7, 5).getTime())
  })

  it('date-only 默认当天 0 点，endOfDay 为 23:59:59', () => {
    const ts = toPlanTs('2026-08-22')
    expect(ts).toBe(new Date(2026, 7, 22).getTime())
    expect(toPlanTs('2026-08-22', true)).toBe(new Date(2026, 7, 22).getTime() + 86400000 - 1)
  })

  it('空值/非法输入返回 null', () => {
    expect(toPlanTs('')).toBe(null)
    expect(toPlanTs(null)).toBe(null)
    expect(toPlanTs('abc')).toBe(null)
  })
})

describe('buildTimelineNodes', () => {
  it('只有带时间的计划进入时间轴', () => {
    const nodes = buildTimelineNodes([
      { client_id: 'a', title: '有时间', estimated_time: '2026-08-01', due_date: '2026-08-10' },
      { client_id: 'b', title: '只有截止', due_date: '2026-09-01' },
      { client_id: 'c', title: '无时间' }
    ])
    expect(nodes).toHaveLength(2)
    expect(nodes[0].startTs).toBe(toPlanTs('2026-08-01'))
    expect(nodes[0].endTs).toBe(toPlanTs('2026-08-10'))
    expect(nodes[1].startTs).toBe(toPlanTs('2026-09-01'))
  })

  it('记录子计划标记', () => {
    const nodes = buildTimelineNodes([
      { client_id: 'p', title: '父', parent_id: '', due_date: '2026-08-01' },
      { client_id: 'c', title: '子', parent_id: 'p', due_date: '2026-08-02' }
    ])
    expect(nodes.find(n => n.id === 'c').parent_id).toBe('p')
  })
})

describe('timelineRange', () => {
  it('计算总跨度（天），无节点返回 null', () => {
    expect(timelineRange([])).toBe(null)
    const range = timelineRange([
      { startTs: toPlanTs('2026-08-01'), endTs: toPlanTs('2026-08-05') },
      { startTs: toPlanTs('2026-08-20'), endTs: toPlanTs('2026-08-25') }
    ])
    expect(range.spanDays).toBe(24)
    expect(range.minTs).toBe(toPlanTs('2026-08-01'))
    expect(range.maxTs).toBe(toPlanTs('2026-08-25'))
  })

  it('同一天跨度最小为 1 天', () => {
    const range = timelineRange([{ startTs: toPlanTs('2026-08-01'), endTs: toPlanTs('2026-08-01') }])
    expect(range.spanDays).toBe(1)
  })
})

describe('pickTickStep', () => {
  it('按 px/天 选择刻度步长', () => {
    expect(pickTickStep(200)).toBe(1)
    expect(pickTickStep(100)).toBe(3)
    expect(pickTickStep(30)).toBe(7)
    expect(pickTickStep(10)).toBe(14)
    expect(pickTickStep(5)).toBe(30)
    expect(pickTickStep(2)).toBe(90)
    expect(pickTickStep(0.8)).toBe(180)
    expect(pickTickStep(0.1)).toBe(365)
  })
})

describe('buildTicks', () => {
  it('按步长生成刻度并含起始日', () => {
    const ticks = buildTicks(toPlanTs('2026-08-01'), 10, 100)
    expect(ticks.length).toBeGreaterThanOrEqual(4)
    expect(ticks[0].ts).toBe(toPlanTs('2026-08-01'))
    expect(ticks[0].label).toBe('8/1')
    expect(ticks[1].label).toBe('8/4')
  })

  it('大步长使用月日文案', () => {
    const ticks = buildTicks(toPlanTs('2026-01-01'), 100, 3)
    expect(ticks[0].label).toBe('1月1日')
  })
})
