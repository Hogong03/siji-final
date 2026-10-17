/**
 * test: 计划汇总表（4.29.5）
 *
 * 覆盖 utils/plan-summary.js：
 *  - 统计口径必须与计划 Tab 的「计划总览」一致（只计顶层计划、子计划进度归并、本周打卡）
 *  - 分组（已过期 / 进行中 / 待开始 / 已完成）、组内排序、逾期天数
 *  - 已完成分组截断 + doneHidden
 *  - 每天首次弹出的日期门控
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { resetStorage } from './setup.js'
import './setup.js'
import {
  buildPlanSummary, summaryDayKey, shouldShowPlanSummary, markPlanSummaryShown,
  SUMMARY_SHOWN_KEY, DONE_LIMIT
} from '../utils/plan-summary.js'

// 固定「现在」= 2026-10-17（周六）10:00 —— 本周一 10-12、本周日 10-18
const NOW = new Date(2026, 9, 17, 10, 0, 0).getTime()

beforeEach(() => {
  resetStorage()
})

function plan(over = {}) {
  return Object.assign({
    client_id: 'p' + Math.random().toString(36).slice(2, 8),
    title: '计划',
    status: 0,
    priority: 0,
    is_deleted: 0,
    created_at: NOW - 86400000
  }, over)
}

describe('summaryDayKey / 每天首次门控', () => {
  it('当天 key 为本地时区的 YYYY-MM-DD', () => {
    expect(summaryDayKey(NOW)).toBe('2026-10-17')
    // 跨零点：换日即换 key
    expect(summaryDayKey(new Date(2026, 9, 18, 0, 0, 1).getTime())).toBe('2026-10-18')
  })

  it('没弹过 → 该弹；弹过当天 → 不再弹；换天 → 重新弹', () => {
    expect(shouldShowPlanSummary(NOW)).toBe(true)
    markPlanSummaryShown(NOW)
    expect(uni.getStorageSync(SUMMARY_SHOWN_KEY)).toBe('2026-10-17')
    expect(shouldShowPlanSummary(NOW)).toBe(false)
    // 同一天晚些时候仍不弹
    expect(shouldShowPlanSummary(NOW + 6 * 3600 * 1000)).toBe(false)
    // 第二天重新弹
    expect(shouldShowPlanSummary(new Date(2026, 9, 18, 9, 0, 0).getTime())).toBe(true)
  })
})

describe('buildPlanSummary：统计口径', () => {
  it('只计顶层计划，子计划归并进 subTotal/subDone', () => {
    const plans = [
      plan({ client_id: 'a', status: 1 }),
      plan({ client_id: 'a1', parent_id: 'a', status: 2 }),
      plan({ client_id: 'a2', parent_id: 'a', status: 0 }),
      plan({ client_id: 'b', status: 0 })
    ]
    const { stats } = buildPlanSummary(plans, NOW)
    expect(stats.total).toBe(2)          // a、b 两个顶层
    expect(stats.active).toBe(1)
    expect(stats.pending).toBe(1)
    expect(stats.completed).toBe(0)
    expect(stats.rate).toBe(0)
    expect(stats.subTotal).toBe(2)       // 子计划 2 条
    expect(stats.subDone).toBe(1)
  })

  it('完成率按顶层算；已删除计划整条排除', () => {
    const plans = [
      plan({ client_id: 'a', status: 2 }),
      plan({ client_id: 'b', status: 2 }),
      plan({ client_id: 'c', status: 1 }),
      plan({ client_id: 'd', status: 0 }),
      plan({ client_id: 'x', status: 1, is_deleted: 1 })
    ]
    const { stats } = buildPlanSummary(plans, NOW)
    expect(stats.total).toBe(4)
    expect(stats.completed).toBe(2)
    expect(stats.rate).toBe(50)
    expect(stats.active).toBe(1)
    expect(stats.pending).toBe(1)
  })

  it('过期只算未完成且截止已过的顶层计划', () => {
    const plans = [
      plan({ client_id: 'a', status: 1, due_date: '2026-10-15' }),  // 过期
      plan({ client_id: 'b', status: 0, deadline: '2026-10-01' }),  // 过期（deadline 优先兜底）
      plan({ client_id: 'c', status: 2, due_date: '2026-10-01' }),  // 已完成，不算
      plan({ client_id: 'd', status: 1, due_date: '2026-10-20' }),  // 未到期
      plan({ client_id: 'e', status: 1 })                            // 无截止
    ]
    const { stats } = buildPlanSummary(plans, NOW)
    expect(stats.overdue).toBe(2)
  })

  it('本周打卡复用 weekCheckinSummary（主计划 + 子计划一起算）', () => {
    const plans = [
      plan({ client_id: 'a', status: 1, checkins: [{ at: NOW, date: '2026-10-13' }, { at: NOW, date: '2026-10-14' }] }),
      plan({ client_id: 'a1', parent_id: 'a', status: 0, checkins: [{ at: NOW, date: '2026-10-14' }] }),
      // 上周的不计
      plan({ client_id: 'b', status: 1, checkins: [{ at: NOW, date: '2026-10-05' }] })
    ]
    const { stats } = buildPlanSummary(plans, NOW)
    expect(stats.weekCheckins).toBe(3)
    expect(stats.weekDays).toBe(2) // 10-13、10-14
  })

  it('优先级色条：按顶层计划分布，全 0 时不产出', () => {
    const plans = [
      plan({ priority: 2 }), plan({ priority: 2 }), plan({ priority: 1 }), plan({ priority: 0 })
    ]
    const { stats, priorityBar } = buildPlanSummary(plans, NOW)
    expect(stats.high).toBe(2)
    expect(stats.mid).toBe(1)
    expect(stats.low).toBe(1)
    expect(priorityBar.map(p => p.label)).toEqual(['紧急', '重要', '普通'])
    expect(priorityBar.map(p => p.pct)).toEqual([50, 25, 25])
    expect(buildPlanSummary([], NOW).priorityBar).toEqual([])
  })
})

describe('buildPlanSummary：分组与明细', () => {
  it('分组顺序：已过期 → 进行中 → 待开始 → 已完成；空组不产出', () => {
    const plans = [
      plan({ client_id: 'd', status: 2, title: '完成的' }),
      plan({ client_id: 'p', status: 0, title: '待开始的' }),
      plan({ client_id: 'a', status: 1, title: '在跑的' }),
      plan({ client_id: 'o', status: 1, title: '过期的', due_date: '2026-10-10' })
    ]
    const { groups } = buildPlanSummary(plans, NOW)
    expect(groups.map(g => g.key)).toEqual(['overdue', 'active', 'pending', 'done'])
    expect(groups[0].items[0].title).toBe('过期的')
    expect(groups[1].items[0].title).toBe('在跑的')
    expect(groups[2].items[0].title).toBe('待开始的')
    expect(groups[3].items[0].title).toBe('完成的')

    // 只留下过期的：其余组不产出
    const only = buildPlanSummary([plan({ client_id: 'o', status: 1, due_date: '2026-10-10' })], NOW)
    expect(only.groups.map(g => g.key)).toEqual(['overdue'])
  })

  it('逾期天数与状态文案；组内按优先级 → 截止 → 新建排序', () => {
    const plans = [
      plan({ client_id: 'low', status: 1, priority: 0, due_date: '2026-10-15' }),
      plan({ client_id: 'urgent', status: 1, priority: 2, due_date: '2026-10-16' }),
      plan({ client_id: 'mid', status: 1, priority: 1, due_date: '2026-10-14' })
    ]
    const { groups } = buildPlanSummary(plans, NOW)
    const overdue = groups[0]
    expect(overdue.items.map(i => i.clientId)).toEqual(['urgent', 'mid', 'low'])
    // 2026-10-16 逾期 1 天、10-14 逾期 3 天、10-15 逾期 2 天
    expect(overdue.items[0].lateDays).toBe(1)
    expect(overdue.items[0].overdue).toBe(true)
    expect(overdue.items[0].statusText).toBe('进行中')
    expect(overdue.items[0].priorityText).toBe('紧急')
  })

  it('元信息行合并时间 / 子计划 / 循环 / 冷藏 / 今日打卡', () => {
    const plans = [
      plan({
        client_id: 'a', status: 1, due_date: '2026-10-20', recur_type: 'weekly', recur_count: 3,
        checkins: [{ at: NOW, date: '2026-10-17' }]
      }),
      plan({ client_id: 'a1', parent_id: 'a', status: 2 }),
      plan({ client_id: 'a2', parent_id: 'a', status: 0 }),
      plan({ client_id: 'f', status: 0, frozen_at: NOW })
    ]
    const { groups } = buildPlanSummary(plans, NOW)
    const a = groups.find(g => g.key === 'active').items[0]
    expect(a.metaText).toContain('截止 10月20日')
    expect(a.metaText).toContain('子计划 1/2')
    expect(a.metaText).toContain('每周3次')
    expect(a.metaText).toContain('今日已打卡')

    const f = groups.find(g => g.key === 'pending').items[0]
    expect(f.metaText).toContain('已冷藏')
  })

  it('已完成分组截断到 DONE_LIMIT，其余记入 doneHidden（在办计划不截断）', () => {
    const plans = []
    for (let i = 0; i < DONE_LIMIT + 7; i++) plans.push(plan({ client_id: 'd' + i, status: 2 }))
    for (let i = 0; i < 40; i++) plans.push(plan({ client_id: 'a' + i, status: 1 }))
    const { groups, doneHidden, stats } = buildPlanSummary(plans, NOW)
    expect(stats.total).toBe(DONE_LIMIT + 7 + 40)
    expect(groups.find(g => g.key === 'done').items.length).toBe(DONE_LIMIT)
    expect(groups.find(g => g.key === 'active').items.length).toBe(40)
    expect(doneHidden).toBe(7)
  })

  it('空数据不炸：全 0 统计、无分组、无隐藏', () => {
    const r = buildPlanSummary([], NOW)
    expect(r.stats.total).toBe(0)
    expect(r.stats.rate).toBe(0)
    expect(r.groups).toEqual([])
    expect(r.doneHidden).toBe(0)
    // 脏数据（null / 非数组）也不炸
    expect(buildPlanSummary(null, NOW).stats.total).toBe(0)
  })
})
