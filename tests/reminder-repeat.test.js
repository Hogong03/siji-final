/**
 * 3.5.0 提醒重复触发纯逻辑测试
 * 覆盖：一次性提醒、daily/weekly/weekdays 循环的触发日计算、截止窗口、无基准时间
 */
import { describe, it, expect } from 'vitest'
import { computeReminderFire } from '../utils/reminder/scheduler.js'

const base = { client_id: 'p1', title: '听力', deadline: '2026-10-09' }
const cfg = (repeatType, customTime) => ({ enabled: true, repeatType, customTime, advanceMin: 30 })

function at(y, m, d, hh, mm) {
  return new Date(y, m - 1, d, hh || 0, mm || 0).getTime()
}

describe('computeReminderFire：一次性', () => {
  it('无重复沿用截止提前量，dateKey 为空（一次性）', () => {
    const plan = { client_id: 'p1', deadline: '2026-10-09 21:00' }
    const fire = computeReminderFire(plan, cfg('none', ''), at(2026, 10, 9, 20, 40))
    expect(fire).not.toBeNull()
    expect(fire.ts).toBe(at(2026, 10, 9, 20, 30))
    expect(fire.dateKey).toBe('')
  })
})

describe('computeReminderFire：daily', () => {
  it('每天同一时刻触发，dateKey 区分日期', () => {
    const plan = { client_id: 'p1', deadline: '2026-10-09' }
    const fire = computeReminderFire(plan, cfg('daily', '2026-09-09 21:00'), at(2026, 9, 9, 21, 30))
    expect(fire.ts).toBe(at(2026, 9, 9, 21, 0))
    expect(fire.dateKey).toBe('2026-09-09')
    const next = computeReminderFire(plan, cfg('daily', '2026-09-09 21:00'), at(2026, 9, 10, 21, 5))
    expect(next.dateKey).toBe('2026-09-10')
  })

  it('超过计划截止日不再触发', () => {
    const plan = { client_id: 'p1', deadline: '2026-10-09' }
    const fire = computeReminderFire(plan, cfg('daily', '2026-09-09 21:00'), at(2026, 10, 10, 21, 5))
    expect(fire).toBeNull()
  })

  it('当天还没到时刻不提前触发', () => {
    const plan = { client_id: 'p1', deadline: '2026-10-09' }
    const fire = computeReminderFire(plan, cfg('daily', '2026-09-09 21:00'), at(2026, 9, 10, 9, 0))
    expect(fire).toBeNull()
  })
})

describe('computeReminderFire：weekly / weekdays', () => {
  it('weekly 只在基准日同一星期触发（2026-09-12 是周六）', () => {
    const plan = { client_id: 'p1', deadline: '2026-12-12' }
    // 周一未命中
    expect(computeReminderFire(plan, cfg('weekly', '2026-09-12 21:00'), at(2026, 9, 14, 21, 5))).toBeNull()
    // 周六 21:05 触发
    const fire = computeReminderFire(plan, cfg('weekly', '2026-09-12 21:00'), at(2026, 9, 19, 21, 5))
    expect(fire.dateKey).toBe('2026-09-19')
  })

  it('weekdays 只命中周一至周五', () => {
    const plan = { client_id: 'p1', deadline: '2026-12-12' }
    // 2026-09-20 是周日 → 未到下一个工作日（周一 9/21），不提前触发
    expect(computeReminderFire(plan, cfg('weekdays', '2026-09-21 08:00'), at(2026, 9, 20, 8, 5))).toBeNull()
    const fire = computeReminderFire(plan, cfg('weekdays', '2026-09-21 08:00'), at(2026, 9, 21, 8, 5))
    expect(fire.dateKey).toBe('2026-09-21')
  })
})

describe('computeReminderFire：重复提醒无基准时刻', () => {
  it('repeatType 非 none 但没有 customTime → 不触发（UI 已提示需设置时刻）', () => {
    expect(computeReminderFire(base, cfg('daily', ''), Date.now())).toBeNull()
    expect(computeReminderFire(base, cfg('weekly', ''), Date.now())).toBeNull()
  })
})
