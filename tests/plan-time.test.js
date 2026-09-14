/**
 * M4 计划时间分布预览测试（3.2 升级方案 5.3）
 * 覆盖：少于 2 个日期返回 null、子计划区间兜底、同日起止边界、
 *       跨年 offset、今天节点进出区间、超长跨度不越界、字段优先级与无效日期
 */
import { describe, it, expect } from 'vitest'
import { buildTimeStrip } from '../utils/plan-time.js'

const today = '2026-09-06'

describe('buildTimeStrip 基本判定', () => {
  it('无任何日期 → null', () => {
    expect(buildTimeStrip({}, [], today)).toBeNull()
  })

  it('只有单个日期（仅 deadline / 仅开始）→ null', () => {
    expect(buildTimeStrip({ deadline: '2026-09-10' }, [], today)).toBeNull()
    expect(buildTimeStrip({ estimated_time: '2026-09-10' }, [], today)).toBeNull()
  })

  it('日期无法解析时视为无效并返回 null', () => {
    expect(buildTimeStrip({ start_time: '下个月', end_time: '随便写' }, [], today)).toBeNull()
  })

  it('主计划无日期但子计划成对 → 以子计划区间渲染', () => {
    const strip = buildTimeStrip({}, [
      { client_id: 'c1', title: '阶段一', estimated_time: '2026-09-10', due_date: '2026-09-12' }
    ], today)
    expect(strip).not.toBeNull()
    expect(strip.start).toBe('2026-09-10')
    expect(strip.end).toBe('2026-09-12')
    expect(strip.totalDays).toBe(2)
    expect(strip.startLabel).toContain('9月10日')
    expect(strip.endLabel).toContain('9月12日')
    expect(strip.nodes).toHaveLength(2)
    expect(strip.nodes.map(n => n.kind)).toEqual(['child', 'child'])
    expect(strip.nodes[0].offsetPct).toBe(0)
    expect(strip.nodes[1].offsetPct).toBe(100)
  })

  it('同日起止边界（无其他日期）→ null', () => {
    const plan = { start_time: '2026-09-10', end_time: '2026-09-10' }
    expect(buildTimeStrip(plan, [], '2026-09-10')).toBeNull()
  })
})

describe('buildTimeStrip 主计划 + 子计划节点', () => {
  it('主计划首尾 + 子计划节点位置正确', () => {
    const plan = { start_time: '2026-09-01', end_time: '2026-09-30' }
    const children = [
      { client_id: 'c1', title: '准备', estimated_time: '2026-09-05', due_date: '2026-09-10' },
      { client_id: 'c2', title: '冲刺', estimated_time: '2026-09-20', due_date: '2026-09-25' }
    ]
    const strip = buildTimeStrip(plan, children, today)
    expect(strip.totalDays).toBe(29)
    const nodes = strip.nodes.filter(n => n.kind !== 'today')
    expect(nodes.map(n => n.key)).toEqual([
      'plan_start', 'c1_start', 'c1_end', 'c2_start', 'c2_end', 'plan_end'
    ])
    // 9-05 距 9-01 是 4/29 ≈ 13.8%
    expect(nodes.find(n => n.key === 'c1_start').offsetPct).toBe(13.8)
    expect(nodes.find(n => n.key === 'c1_end').offsetPct).toBe(31)
    expect(nodes.find(n => n.key === 'plan_end').offsetPct).toBe(100)
    expect(strip.nodes.some(n => n.kind === 'today')).toBe(true)
  })

  it('字段优先级：start_time 优先于 estimated_time，due_date/deadline 作结束', () => {
    const plan = {
      start_time: '2026-09-01',
      estimated_time: '2026-09-05',
      due_date: '2026-09-08',
      deadline: '2026-09-10'
    }
    const strip = buildTimeStrip(plan, [], today)
    const nodes = strip.nodes.filter(n => n.kind !== 'today')
    expect(nodes.map(n => n.key)).toEqual(['plan_start', 'plan_end'])
    expect(nodes[0].date).toBe('2026-09-01')
    expect(nodes[1].date).toBe('2026-09-08')
  })

  it('子计划缺失一侧日期时按现有节点参与区间', () => {
    const strip = buildTimeStrip(
      { estimated_time: '2026-09-10' },
      [{ client_id: 'c1', due_date: '2026-10-10' }],
      today
    )
    expect(strip).not.toBeNull()
    expect(strip.start).toBe('2026-09-10')
    expect(strip.end).toBe('2026-10-10')
    expect(strip.nodes.map(n => n.key)).toEqual(['plan_start', 'c1_end'])
  })
})

describe('buildTimeStrip 跨年 / 今天节点 / 超长跨度', () => {
  it('跨年区间 offset 计算正确且含 today 节点', () => {
    const plan = { start_time: '2026-12-30', end_time: '2027-01-02' }
    const children = [{ client_id: 'c1', estimated_time: '2026-12-31' }]
    const strip = buildTimeStrip(plan, children, '2027-01-01')
    expect(strip.totalDays).toBe(3)
    expect(strip.endLabel).toContain('2027年1月2日')
    const c1 = strip.nodes.find(n => n.key === 'c1_start')
    expect(c1.offsetPct).toBe(33.3)
    const todayNode = strip.nodes.find(n => n.kind === 'today')
    expect(todayNode).toBeTruthy()
    expect(todayNode.offsetPct).toBe(66.7)
  })

  it('今天在区间外 → 不渲染 today 节点', () => {
    const plan = { start_time: '2026-12-30', end_time: '2027-01-02' }
    const strip = buildTimeStrip(plan, [], '2026-09-01')
    expect(strip.nodes.some(n => n.kind === 'today')).toBe(false)
  })

  it('今天与区间端点同日 → today 节点存在', () => {
    const plan = { start_time: '2026-09-01', end_time: '2026-12-31' }
    const strip = buildTimeStrip(plan, [], '2026-09-01')
    expect(strip.nodes.some(n => n.kind === 'today' && n.offsetPct === 0)).toBe(true)
  })

  it('超长跨度（>730 天）线性压缩，百分比不越界', () => {
    const plan = { start_time: '2020-01-01', end_time: '2030-12-31' }
    const strip = buildTimeStrip(plan, [], '2026-06-15')
    expect(strip.totalDays).toBeGreaterThan(730)
    for (const n of strip.nodes) {
      expect(n.offsetPct).toBeGreaterThanOrEqual(0)
      expect(n.offsetPct).toBeLessThanOrEqual(100)
    }
    expect(strip.nodes.find(n => n.key === 'plan_start').offsetPct).toBe(0)
    expect(strip.nodes.find(n => n.key === 'plan_end').offsetPct).toBe(100)
    expect(strip.startLabel).toContain('2020年1月1日')
    expect(strip.endLabel).toContain('2030年12月31日')
  })
})
