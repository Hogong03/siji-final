/**
 * plan-alerts 测试（4.5.0）— 计划状态警示（过时 / 快到期）
 *
 * 口径锁死：
 *  - 只报顶层（有 parent_id 的子计划不报）、只看 deadline/due_date
 *  - 已完成 / 已删除 / 冷藏 / 顺延 / 循环计划不参与
 *  - 过时 = 截止日在今天之前（lateDays 从 1 起）；快到期 = 今天 ~ 今天 + 3 天
 */
import { describe, it, expect } from 'vitest'
import { collectPlanAlerts, DUE_SOON_DAYS } from '../utils/plan-alerts.js'

// 固定「今天」= 2026-09-15 12:00，避免用例随运行日期漂移
const NOW = new Date(2026, 8, 15, 12, 0, 0).getTime()

function plan(over) {
  return Object.assign({
    client_id: 'p1',
    title: '测试计划',
    status: 1,
    is_deleted: 0,
    deadline: '2026-09-20'
  }, over)
}

describe('collectPlanAlerts：过时计划', () => {
  it('截止已过 → overdue，lateDays 从 1 起算', () => {
    const r = collectPlanAlerts([plan({ deadline: '2026-09-14' })], NOW)
    expect(r.overdue).toHaveLength(1)
    expect(r.overdue[0].lateDays).toBe(1)
    expect(r.overdue[0].name).toBe('测试计划')
  })

  it('昨天截止 lateDays=1，10 天前 lateDays=10', () => {
    expect(collectPlanAlerts([plan({ deadline: '2026-09-05' })], NOW).overdue[0].lateDays).toBe(10)
  })

  it('今天到期不算过时（算快到期 leftDays=0）', () => {
    const r = collectPlanAlerts([plan({ deadline: '2026-09-15' })], NOW)
    expect(r.overdue).toHaveLength(0)
    expect(r.dueSoon[0].leftDays).toBe(0)
  })

  it('过时久的排前面', () => {
    const r = collectPlanAlerts([
      plan({ client_id: 'a', deadline: '2026-09-13' }),
      plan({ client_id: 'b', deadline: '2026-08-01' })
    ], NOW)
    expect(r.overdue[0].clientId).toBe('b')
  })
})

describe('collectPlanAlerts：快到期计划', () => {
  it('3 天内到期进 dueSoon，leftDays 按剩余整天', () => {
    const r = collectPlanAlerts([
      plan({ client_id: 'a', deadline: '2026-09-18' }),
      plan({ client_id: 'b', deadline: '2026-09-16' })
    ], NOW)
    expect(r.dueSoon).toHaveLength(2)
    expect(r.dueSoon[0].leftDays).toBe(1)
    expect(r.dueSoon[1].leftDays).toBe(3)
  })

  it('超出窗口（默认 3 天）不报', () => {
    const r = collectPlanAlerts([plan({ deadline: '2026-09-19' })], NOW)
    expect(r.dueSoon).toHaveLength(0)
    expect(r.total).toBe(0)
  })

  it('窗口可调（dueSoonDays）', () => {
    const r = collectPlanAlerts([plan({ deadline: '2026-09-25' })], NOW, { dueSoonDays: 10 })
    expect(r.dueSoon).toHaveLength(1)
    expect(DUE_SOON_DAYS).toBe(3)
  })
})

describe('collectPlanAlerts：排除口径', () => {
  it('已完成 / 已删除 / 冷藏 / 顺延 / 循环计划 / 子计划 / 无截止都不报', () => {
    const r = collectPlanAlerts([
      plan({ client_id: 'done', status: 2 }),
      plan({ client_id: 'del', is_deleted: 1 }),
      plan({ client_id: 'frozen', frozen_at: Date.now() }),
      plan({ client_id: 'someday', someday_at: Date.now() }),
      plan({ client_id: 'recur', recur_type: 'daily' }),
      plan({ client_id: 'child', parent_id: 'root', deadline: '2026-09-01' }),
      plan({ client_id: 'nodate', deadline: '' }),
      plan({ client_id: 'baddate', deadline: '九月底前' })
    ], NOW)
    expect(r.total).toBe(0)
    expect(r.overdue).toHaveLength(0)
    expect(r.dueSoon).toHaveLength(0)
  })

  it('due_date 兜底（没有 deadline 时）', () => {
    const r = collectPlanAlerts([plan({ deadline: '', due_date: '2026-09-10' })], NOW)
    expect(r.overdue[0].lateDays).toBe(5)
  })

  it('空输入安全', () => {
    expect(collectPlanAlerts([], NOW).total).toBe(0)
    expect(collectPlanAlerts(null, NOW).total).toBe(0)
  })
})
