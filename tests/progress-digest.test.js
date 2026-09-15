/**
 * progress-digest.js 测试（3.5.13：给 AI 的「你不在时」动静摘要）
 *
 * 口径与进入总结卡片共用一对基线，只统计已发生的完成/打卡/新增记录：
 * 无内容必须返回空串（不占 token），未完成事项永不出现（铁律 8）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { resetStorage } from './setup.js'
import { buildProgressDigest } from '../utils/progress-digest.js'
import { CONFIRM_KEY, LEAVE_KEY } from '../utils/enter-summary.js'

const T0 = new Date(2026, 8, 14, 10, 0, 0).getTime()
const MIN = 60 * 1000
const DAY = 24 * 60 * 60 * 1000

function plan(over) {
  return Object.assign({
    client_id: 'p1',
    title: '晨跑',
    status: 1,
    is_deleted: 0,
    checkins: [],
    executions: []
  }, over)
}

function lines(text) {
  return text.split('\n').filter(l => l.startsWith('· '))
}

beforeEach(() => {
  resetStorage()
  vi.useFakeTimers()
  vi.setSystemTime(T0)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('buildProgressDigest：动静摘要', () => {
  it('什么都没有 → 空串（不注入、不占 token）', () => {
    expect(buildProgressDigest({ plans: [plan({})] })).toBe('')
  })

  it('基线以来的完成与打卡按计数汇总，窗口带时长', () => {
    uni.setStorageSync(CONFIRM_KEY, T0 - 3 * 60 * MIN)
    const plans = [
      plan({ client_id: 'a', executions: [{ action: 'done', at: T0 - 10 * MIN }] }),
      plan({ client_id: 'b', checkins: [{ at: T0 - 5 * MIN, date: '2026-09-14' }, { at: T0 - 4 * MIN, date: '2026-09-14' }] })
    ]
    const out = buildProgressDigest({ plans })
    expect(lines(out)).toEqual([
      '· 上次离开（3 小时）：完成 1 项、打卡 2 次',
      '· 今天：完成 1 项、打卡 2 次'
    ])
    expect(out).toContain('用户近期动静')
  })

  it('离开基线比确认基线更晚时以更晚的为准（已报过的不再重复）', () => {
    uni.setStorageSync(CONFIRM_KEY, T0 - 5 * DAY)
    uni.setStorageSync(LEAVE_KEY, T0 - 10 * MIN)
    const plans = [plan({ executions: [{ action: 'done', at: T0 - 3 * DAY }] })]
    expect(buildProgressDigest({ plans })).toBe('')
  })

  it('窗口外的旧事件与已删除计划都不计', () => {
    uni.setStorageSync(CONFIRM_KEY, T0 - 30 * MIN)
    const plans = [
      plan({ client_id: 'a', executions: [{ action: 'done', at: T0 - 2 * DAY }] }),
      plan({ client_id: 'b', is_deleted: 1, executions: [{ action: 'done', at: T0 - 5 * MIN }] }),
      plan({ client_id: 'c', executions: [{ action: 'undone', at: T0 - 5 * MIN }] })
    ]
    expect(buildProgressDigest({ plans })).toBe('')
  })

  it('未武装基线时只报今天', () => {
    const plans = [plan({ checkins: [{ at: T0 - 30 * MIN, date: '2026-09-14' }] })]
    const out = buildProgressDigest({ plans })
    expect(lines(out)).toEqual(['· 今天：打卡 1 次'])
  })

  it('今天新增的记录计入，连续打卡 >= 2 天单独一行', () => {
    const plans = [
      plan({ client_id: 'a', checkins: [{ at: T0 - MIN, date: '2026-09-14' }] }),
      plan({ client_id: 'b', checkins: [{ date: '2026-09-13' }] })
    ]
    uni.setStorageSync(CONFIRM_KEY, T0 - MIN)
    uni.setStorageSync('diary_2026-09', JSON.stringify([
      { client_id: 'd1', created_at: T0 - 20 * MIN, is_deleted: 0 },
      { client_id: 'd2', created_at: T0 - 20 * DAY, is_deleted: 0 },
      { client_id: 'd3', created_at: T0 - 10 * MIN, is_deleted: 1 }
    ]))
    const out = buildProgressDigest({ plans })
    expect(out).toContain('· 今天：打卡 1 次、新增记录 1 条')
    expect(out).toContain('· 连续打卡 2 天')
  })

  it('默认走 getPlanList（不传 plans 也不炸）', () => {
    uni.setStorageSync('plan_all', JSON.stringify([
      plan({ client_id: 'a', checkins: [{ at: T0 - MIN, date: '2026-09-14' }] })
    ]))
    expect(buildProgressDigest()).toContain('今天：打卡 1 次')
  })
})
