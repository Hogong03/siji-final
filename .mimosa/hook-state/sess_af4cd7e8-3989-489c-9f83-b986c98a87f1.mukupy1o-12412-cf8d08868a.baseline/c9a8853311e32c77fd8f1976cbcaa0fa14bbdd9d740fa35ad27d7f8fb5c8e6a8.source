/**
 * 3.5.0 循环任务纯逻辑测试
 * 覆盖：类型/次数、连续打卡、本周计数、祖先窗口（最晚开始/最早结束）、
 *       窗口覆盖与自动收尾、today 满足语义、过期循环读取时自动完成
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { resetStorage } from './setup.js'
import {
  recurTypeOf,
  recurCountOf,
  calcCheckinStreak,
  weeklyDoneOf,
  startEndTsOf,
  windowCoversToday,
  shouldAutoCompleteRecurring,
  satisfiedToday,
  buildPlanIndex,
  collectCascadeCompletions,
  normalizeRecur,
  weekDayCells,
  backfillTargetOf,
  isBackfillable,
  backfillCandidates,
  MAX_BACKFILL_DAYS,
  streakMilestoneOf
} from '../utils/plan-recur.js'
import { getPlanList, savePlan, setPlanRecur } from '../utils/storage.js'

const DAY = 24 * 60 * 60 * 1000

beforeEach(() => {
  resetStorage()
})

function ymdOf(ts) {
  const d = new Date(ts)
  const pad = n => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

/** 2026-09-14 是周一，作为固定基准 */
const MONDAY = new Date(2026, 8, 14, 8, 0, 0).getTime()

describe('recurTypeOf / recurCountOf', () => {
  it('识别 daily/weekly，忽略其他值', () => {
    expect(recurTypeOf({ recur_type: 'daily' })).toBe('daily')
    expect(recurTypeOf({ recur_type: 'weekly' })).toBe('weekly')
    expect(recurTypeOf({ recur_type: 'monthly' })).toBe('')
    expect(recurTypeOf({})).toBe('')
    expect(recurCountOf({ recur_type: 'weekly', recur_count: '3' })).toBe(3)
    expect(recurCountOf({ recur_type: 'weekly', recur_count: 0 })).toBe(1)
    expect(recurCountOf({ recur_type: 'daily' })).toBe(1)
  })
})

describe('calcCheckinStreak', () => {
  it('今天+昨天+前天 → 3；今天未打但从昨天连续 → 从昨天计', () => {
    const nowTs = MONDAY
    const plan = { checkins: [
      { date: ymdOf(nowTs - 2 * DAY) },
      { date: ymdOf(nowTs - DAY) },
      { date: ymdOf(nowTs) }
    ] }
    expect(calcCheckinStreak(plan, nowTs)).toBe(3)
    plan.checkins.pop()
    expect(calcCheckinStreak(plan, nowTs)).toBe(2)
  })

  it('断档后重计，空/无打卡为 0', () => {
    const nowTs = MONDAY
    const plan = { checkins: [
      { date: ymdOf(nowTs - 4 * DAY) },
      { date: ymdOf(nowTs - 2 * DAY) },
      { date: ymdOf(nowTs - DAY) }
    ] }
    expect(calcCheckinStreak(plan, nowTs)).toBe(2)
    expect(calcCheckinStreak({}, nowTs)).toBe(0)
  })
})

describe('weeklyDoneOf：周一起算', () => {
  it('跨周日边界正确', () => {
    const plan = { checkins: [
      { date: '2026-09-13' }, // 周日 → 上一周
      { date: '2026-09-14' }, // 周一
      { date: '2026-09-16' }, // 周三
      { date: '2026-09-20' }  // 周日 → 本周
    ] }
    expect(weeklyDoneOf(plan, MONDAY)).toBe(3)
  })
})

describe('startEndTsOf：祖先窗口收敛', () => {
  const root = { client_id: 'root', title: '六级备考', start_time: '2026-09-01', deadline: '2026-12-12' }
  const phase = { client_id: 'phase', parent_id: 'root', title: '唤醒期', start_time: '2026-09-09', deadline: '2026-10-09' }
  const byId = buildPlanIndex([root, phase])

  it('叶子无日期时继承阶段窗口', () => {
    const leaf = { client_id: 'leaf', parent_id: 'phase', title: '听力', recur_type: 'daily' }
    const { startTs, endTs } = startEndTsOf(leaf, byId)
    expect(startTs).toBe(new Date(2026, 8, 9).getTime())
    expect(endTs).toBe(new Date(2026, 9, 9, 23, 59, 59, 999).getTime())
  })

  it('自身日期晚于祖先 → 取最晚开始；自身截止晚于祖先 → 取最早结束', () => {
    const leaf = {
      client_id: 'leaf2', parent_id: 'phase', title: '听力', recur_type: 'daily',
      start_time: '2026-09-20', deadline: '2026-12-01'
    }
    const { startTs, endTs } = startEndTsOf(leaf, byId)
    expect(startTs).toBe(new Date(2026, 8, 20).getTime())
    expect(endTs).toBe(new Date(2026, 9, 9, 23, 59, 59, 999).getTime())
  })
})

describe('windowCoversToday / shouldAutoCompleteRecurring', () => {
  const root = { client_id: 'root', start_time: '2026-09-01', deadline: '2026-12-12' }
  const phase = { client_id: 'phase', parent_id: 'root', start_time: '2026-09-09', deadline: '2026-10-09' }
  const byId = buildPlanIndex([root, phase])
  const after = new Date(2026, 9, 10, 8, 0, 0).getTime() // 2026-10-10

  it('窗口内覆盖、窗口外不覆盖', () => {
    const active = { client_id: 'a', parent_id: 'phase', recur_type: 'daily' }
    expect(windowCoversToday(active, byId, MONDAY)).toBe(true)
    expect(windowCoversToday(active, byId, after)).toBe(false)
  })

  it('过期循环应自动收尾；未开始/已完成的循环不收尾', () => {
    const expired = { client_id: 'e', parent_id: 'phase', recur_type: 'daily', status: 1 }
    expect(shouldAutoCompleteRecurring(expired, byId, after)).toBe(true)
    const future = { client_id: 'f', parent_id: 'phase', recur_type: 'daily', status: 1 }
    expect(shouldAutoCompleteRecurring(future, byId, MONDAY)).toBe(false)
    const done = { client_id: 'd', parent_id: 'phase', recur_type: 'daily', status: 2 }
    expect(shouldAutoCompleteRecurring(done, byId, after)).toBe(false)
  })
})

describe('satisfiedToday', () => {
  it('daily：今日已打卡即满足；weekly：本周达标或今日已打', () => {
    const daily = { recur_type: 'daily', checkins: [{ date: ymdOf(MONDAY) }] }
    expect(satisfiedToday(daily, MONDAY)).toBe(true)
    const weeklyDone = {
      recur_type: 'weekly', recur_count: 2,
      checkins: [{ date: '2026-09-14' }, { date: '2026-09-15' }]
    }
    expect(satisfiedToday(weeklyDone, MONDAY)).toBe(true)
    const weeklyOne = { recur_type: 'weekly', recur_count: 3, checkins: [{ date: ymdOf(MONDAY) }] }
    expect(satisfiedToday(weeklyOne, MONDAY)).toBe(true) // 今日已打但未达标，今天也算满足
  })
})

describe('存储读取：过期循环自动收尾', () => {
  it('截止日已过的 daily 循环任务在 getPlanList 时自动置为完成', () => {
    const now = new Date()
    const past = new Date(now.getTime() - 2 * DAY)
    const pad = n => String(n).padStart(2, '0')
    const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
    const expired = {
      client_id: 'expired_plan',
      title: '昨天结束的听力',
      status: 1,
      parent_id: '',
      recur_type: 'daily',
      recur_count: 1,
      due_date: ymd(past),
      deadline: ymd(past),
      est_minutes: 30,
      created_at: Date.now(),
      updated_at: Date.now(),
      is_deleted: 0
    }
    savePlan(expired)
    const after = getPlanList().find(p => p.client_id === 'expired_plan')
    expect(after.status).toBe(2)
    expect((after.executions || []).some(e => e.action === 'done')).toBe(true)
    // 已完成不再重复写执行日志
    const again = getPlanList().find(p => p.client_id === 'expired_plan')
    expect((again.executions || []).filter(e => e.action === 'done')).toHaveLength(1)
  })
})

describe('collectCascadeCompletions：父级级联收尾', () => {
  it('子计划全部完成 → 先收阶段再收主计划（层级升序）', () => {
    const plans = [
      { client_id: 'root', status: 1 },
      { client_id: 'a', parent_id: 'root', status: 2 },
      { client_id: 'b', parent_id: 'root', status: 2 }
    ]
    expect(collectCascadeCompletions(plans)).toEqual(['root'])
  })

  it('两层结构：叶子全完成 → 阶段收尾，三个阶段收尾后主计划再收尾', () => {
    const plans = [
      { client_id: 'root', status: 1 },
      { client_id: 'phase1', parent_id: 'root', status: 1 },
      { client_id: 'leaf1', parent_id: 'phase1', status: 2 },
      { client_id: 'phase2', parent_id: 'root', status: 2 },
      { client_id: 'phase3', parent_id: 'root', status: 2 }
    ]
    const ids = collectCascadeCompletions(plans)
    expect(ids.indexOf('phase1')).toBeGreaterThanOrEqual(0)
    expect(ids.indexOf('root')).toBeGreaterThan(ids.indexOf('phase1'))
  })

  it('仍有未结束子计划 / 无子计划 / 已完成的父级都不收尾', () => {
    expect(collectCascadeCompletions([
      { client_id: 'root', status: 1 },
      { client_id: 'a', parent_id: 'root', status: 2 },
      { client_id: 'b', parent_id: 'root', status: 1 }
    ])).toEqual([])
    expect(collectCascadeCompletions([{ client_id: 'lonely', status: 1 }])).toEqual([])
    expect(collectCascadeCompletions([
      { client_id: 'root', status: 2 },
      { client_id: 'a', parent_id: 'root', status: 2 }
    ])).toEqual([])
  })

  it('子计划冷藏/任意时间时不算结束，父级不收尾', () => {
    const base = [
      { client_id: 'root', status: 1 },
      { client_id: 'a', parent_id: 'root', status: 2 }
    ]
    expect(collectCascadeCompletions([...base, { client_id: 'b', parent_id: 'root', status: 2, frozen_at: 1 }])).toEqual([])
    expect(collectCascadeCompletions([...base, { client_id: 'b', parent_id: 'root', status: 2, someday_at: 1 }])).toEqual([])
  })

  it('父级自身冷藏/任意时间/已删除时不收尾，已删除子计划不参与判断', () => {
    expect(collectCascadeCompletions([
      { client_id: 'root', status: 1, frozen_at: 1 },
      { client_id: 'a', parent_id: 'root', status: 2 }
    ])).toEqual([])
    expect(collectCascadeCompletions([
      { client_id: 'root', status: 1 },
      { client_id: 'a', parent_id: 'root', status: 2 },
      { client_id: 'ghost', parent_id: 'root', status: 1, is_deleted: 1 }
    ])).toEqual(['root'])
  })
})

describe('存储读取：循环项收尾后父级级联收尾', () => {
  it('阶段截止后：循环叶子自动完成 → 阶段完成 → 主计划完成，且各只写一次', () => {
    const pad = n => String(n).padStart(2, '0')
    const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
    const past = new Date(Date.now() - 2 * DAY)
    const future = new Date(Date.now() + 30 * DAY)
    const base = {
      status: 1, parent_id: '', recur_type: '', recur_count: 1,
      created_at: Date.now(), updated_at: Date.now(), is_deleted: 0
    }
    savePlan({ ...base, client_id: 'c6_root', title: '六级备考', start_time: ymd(past), deadline: ymd(future) })
    savePlan({ ...base, client_id: 'c6_phase', title: '唤醒期', parent_id: 'c6_root', start_time: ymd(past), deadline: ymd(past) })
    savePlan({ ...base, client_id: 'c6_leaf', title: '每天背词', parent_id: 'c6_phase', recur_type: 'daily' })

    const list = getPlanList()
    expect(list.find(p => p.client_id === 'c6_leaf').status).toBe(2)
    expect(list.find(p => p.client_id === 'c6_phase').status).toBe(2)
    expect(list.find(p => p.client_id === 'c6_root').status).toBe(2)

    const again = getPlanList()
    expect((again.find(p => p.client_id === 'c6_root').executions || []).filter(e => e.action === 'done')).toHaveLength(1)
  })

  it('阶段内仍有未完成的一次性子计划时，阶段与主计划保持进行中', () => {
    const pad = n => String(n).padStart(2, '0')
    const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
    const past = new Date(Date.now() - 2 * DAY)
    const base = {
      status: 1, parent_id: '', recur_type: '', recur_count: 1,
      created_at: Date.now(), updated_at: Date.now(), is_deleted: 0
    }
    savePlan({ ...base, client_id: 'r2', title: '主计划', deadline: ymd(past) })
    savePlan({ ...base, client_id: 'p2', title: '阶段', parent_id: 'r2', deadline: ymd(past) })
    savePlan({ ...base, client_id: 'l2a', title: '每日听力', parent_id: 'p2', recur_type: 'daily' })
    savePlan({ ...base, client_id: 'l2b', title: '写一篇作文', parent_id: 'p2' })

    const list = getPlanList()
    expect(list.find(p => p.client_id === 'l2a').status).toBe(2)
    expect(list.find(p => p.client_id === 'l2b').status).toBe(1)
    expect(list.find(p => p.client_id === 'p2').status).toBe(1)
    expect(list.find(p => p.client_id === 'r2').status).toBe(1)
  })
})

describe('normalizeRecur：循环字段规范化', () => {
  it('非法类型归一为不循环，daily 恒为 1 次，weekly 收敛到 1-30', () => {
    expect(normalizeRecur('monthly', 3)).toEqual({ recur_type: '', recur_count: 1 })
    expect(normalizeRecur('daily', 5)).toEqual({ recur_type: 'daily', recur_count: 1 })
    expect(normalizeRecur('weekly', '3')).toEqual({ recur_type: 'weekly', recur_count: 3 })
    expect(normalizeRecur('weekly', 0)).toEqual({ recur_type: 'weekly', recur_count: 1 })
    expect(normalizeRecur('weekly', 'abc')).toEqual({ recur_type: 'weekly', recur_count: 1 })
    expect(normalizeRecur('weekly', 99)).toEqual({ recur_type: 'weekly', recur_count: 30 })
  })
})

describe('weekDayCells：周历格子', () => {
  it('周一起共 7 格，标记已打卡 / 今天 / 未来', () => {
    const cells = weekDayCells({ checkins: [{ date: '2026-09-14' }, { date: '2026-09-16' }] }, MONDAY)
    expect(cells).toHaveLength(7)
    expect(cells[0].label).toBe('一')
    expect(cells[6].label).toBe('日')
    expect(cells[0].date).toBe('2026-09-14')
    expect(cells[0].day).toBe(14)
    expect(cells[0].done).toBe(true)
    expect(cells[0].isToday).toBe(true)
    expect(cells[2].done).toBe(true) // 周三 2026-09-16
    expect(cells[1].done).toBe(false)
    expect(cells[1].isFuture).toBe(true) // 周二在周一之后
    expect(cells[6].isFuture).toBe(true)
  })

  it('以周三为今天时，周一/周二算过去而非未来', () => {
    const wednesday = new Date(2026, 8, 16, 9, 0, 0).getTime()
    const cells = weekDayCells({}, wednesday)
    expect(cells[2].isToday).toBe(true)
    expect(cells[0].isToday).toBe(false)
    expect(cells[0].isFuture).toBe(false)
    expect(cells[1].isFuture).toBe(false)
    expect(cells[3].isFuture).toBe(true)
  })

  it('无打卡数据时全为未打卡', () => {
    const cells = weekDayCells({}, MONDAY)
    expect(cells.filter(c => c.done)).toHaveLength(0)
    expect(cells.filter(c => c.isToday)).toHaveLength(1)
  })
})

describe('setPlanRecur：内联改循环设置', () => {
  function seedPlan(id) {
    savePlan({
      client_id: id, title: '听力', status: 1, parent_id: '', est_minutes: 15,
      created_at: Date.now(), updated_at: Date.now(), is_deleted: 0,
      checkins: [{ date: '2026-09-14', at: Date.now(), note: '做了一篇' }]
    })
  }

  it('设为 weekly 收敛次数，保留状态与打卡；取消循环回到空类型', () => {
    seedPlan('recur_edit')
    const r1 = setPlanRecur('recur_edit', 'weekly', 3)
    expect(r1.recur_type).toBe('weekly')
    expect(r1.recur_count).toBe(3)
    expect(r1.status).toBe(1)

    const r2 = setPlanRecur('recur_edit', 'nope', 9)
    expect(r2.recur_type).toBe('')
    expect(r2.recur_count).toBe(1)

    const got = getPlanList().find(p => p.client_id === 'recur_edit')
    expect(got.status).toBe(1)
    expect(got.checkins).toHaveLength(1)
    expect(got.checkins[0].note).toBe('做了一篇')
  })

  it('未知计划返回 null', () => {
    expect(setPlanRecur('nope', 'daily', 1)).toBeNull()
  })
})

describe('backfillTargetOf：温和补记昨天（3.5.4）', () => {
  const now = new Date(2026, 8, 16, 9, 0, 0).getTime()
  const ymd = offsetDays => {
    const d = new Date(now - offsetDays * DAY)
    const pad = n => String(n).padStart(2, '0')
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
  }

  it('窗口内的循环任务昨天没打卡 → 返回昨天', () => {
    const plan = { client_id: 'a', recur_type: 'daily', status: 1 }
    expect(backfillTargetOf(plan, buildPlanIndex([plan]), now)).toBe(ymd(1))
  })

  it('昨天已打卡 / 非循环 / 已完成 / 冷藏 → 不给补', () => {
    const checked = { client_id: 'b', recur_type: 'daily', status: 1, checkins: [{ date: ymd(1) }] }
    expect(backfillTargetOf(checked, buildPlanIndex([checked]), now)).toBe('')
    const plain = { client_id: 'c', recur_type: '', status: 1 }
    expect(backfillTargetOf(plain, buildPlanIndex([plain]), now)).toBe('')
    const done = { client_id: 'd', recur_type: 'daily', status: 2 }
    expect(backfillTargetOf(done, buildPlanIndex([done]), now)).toBe('')
    const frozen = { client_id: 'e', recur_type: 'daily', status: 1, frozen_at: 1 }
    expect(backfillTargetOf(frozen, buildPlanIndex([frozen]), now)).toBe('')
  })

  it('窗口昨天之前已结束 / 今天才开始 → 不给补', () => {
    const ended = { client_id: 'f', recur_type: 'daily', status: 1, deadline: ymd(3) }
    expect(backfillTargetOf(ended, buildPlanIndex([ended]), now)).toBe('')
    const startsToday = { client_id: 'g', recur_type: 'daily', status: 1, start_time: ymd(0) }
    expect(backfillTargetOf(startsToday, buildPlanIndex([startsToday]), now)).toBe('')
  })

  it('祖先窗口覆盖昨天时，叶子循环任务可补记', () => {
    const root = { client_id: 'root', start_time: ymd(10), deadline: ymd(-20) }
    const leaf = { client_id: 'leaf', parent_id: 'root', recur_type: 'daily', status: 1 }
    const byId = buildPlanIndex([root, leaf])
    expect(backfillTargetOf(leaf, byId, now)).toBe(ymd(1))
    const endedRoot = { client_id: 'root2', start_time: ymd(10), deadline: ymd(3) }
    const leaf2 = { client_id: 'leaf2', parent_id: 'root2', recur_type: 'daily', status: 1 }
    expect(backfillTargetOf(leaf2, buildPlanIndex([endedRoot, leaf2]), now)).toBe('')
  })
})

describe('isBackfillable：任意历史日补记（3.5.5）', () => {
  const now = new Date(2026, 8, 16, 9, 0, 0).getTime()
  const ymd = offsetDays => {
    const d = new Date(now - offsetDays * DAY)
    const pad = n => String(n).padStart(2, '0')
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
  }
  const daily = extra => Object.assign({ client_id: 'x', recur_type: 'daily', status: 1 }, extra)

  it('今天与未来不给补（走正常打卡）', () => {
    const plan = daily()
    const byId = buildPlanIndex([plan])
    expect(isBackfillable(plan, byId, ymd(0), now)).toBe(false)
    expect(isBackfillable(plan, byId, ymd(-1), now)).toBe(false)
  })

  it('窗口内的历史日可补（前天、上周都行）', () => {
    const plan = daily()
    const byId = buildPlanIndex([plan])
    expect(isBackfillable(plan, byId, ymd(1), now)).toBe(true)
    expect(isBackfillable(plan, byId, ymd(7), now)).toBe(true)
  })

  it('超出回溯上限（>30 天）不给补，第 30 天仍可补', () => {
    const plan = daily()
    const byId = buildPlanIndex([plan])
    expect(isBackfillable(plan, byId, ymd(MAX_BACKFILL_DAYS), now)).toBe(true)
    expect(isBackfillable(plan, byId, ymd(MAX_BACKFILL_DAYS + 1), now)).toBe(false)
    expect(isBackfillable(plan, byId, ymd(90), now)).toBe(false)
  })

  it('非循环 / 已完成 / 冷藏 / 任意时间 → 不给补', () => {
    const plain = daily({ client_id: 'p', recur_type: '' })
    expect(isBackfillable(plain, buildPlanIndex([plain]), ymd(1), now)).toBe(false)
    const done = daily({ client_id: 'd', status: 2 })
    expect(isBackfillable(done, buildPlanIndex([done]), ymd(1), now)).toBe(false)
    const frozen = daily({ client_id: 'f', frozen_at: 1 })
    expect(isBackfillable(frozen, buildPlanIndex([frozen]), ymd(1), now)).toBe(false)
    const someday = daily({ client_id: 's', someday_at: 1 })
    expect(isBackfillable(someday, buildPlanIndex([someday]), ymd(1), now)).toBe(false)
  })

  it('窗口外的日子不给补（开始之前 / 结束之后）', () => {
    const startsToday = daily({ client_id: 's', start_time: ymd(0) })
    expect(isBackfillable(startsToday, buildPlanIndex([startsToday]), ymd(1), now)).toBe(false)
    const ended = daily({ client_id: 'e', deadline: ymd(3) })
    const byId = buildPlanIndex([ended])
    expect(isBackfillable(ended, byId, ymd(1), now)).toBe(false)
    expect(isBackfillable(ended, byId, ymd(4), now)).toBe(true)
  })

  it('该天已打卡 / 日期格式不对 → 不给补', () => {
    const checked = daily({ client_id: 'c', checkins: [{ date: '2026-09-15' }] })
    expect(isBackfillable(checked, buildPlanIndex([checked]), '2026-09-15', now)).toBe(false)
    const plan = daily({ client_id: 'ok' })
    const byId = buildPlanIndex([plan])
    expect(isBackfillable(plan, byId, '2026-9-1', now)).toBe(false)
    expect(isBackfillable(plan, byId, '', now)).toBe(false)
    expect(isBackfillable(plan, byId, '昨天', now)).toBe(false)
  })

  it('祖先窗口收缩后，叶子循环任务按祖先窗口判定', () => {
    const root = { client_id: 'root', start_time: ymd(10), deadline: ymd(2) }
    const leaf = { client_id: 'leaf', parent_id: 'root', recur_type: 'daily', status: 1 }
    const byId = buildPlanIndex([root, leaf])
    expect(isBackfillable(leaf, byId, ymd(5), now)).toBe(true)
    expect(isBackfillable(leaf, byId, ymd(1), now)).toBe(false)
  })
})

describe('backfillCandidates：长按某天的候选清单（3.5.5）', () => {
  const now = new Date(2026, 8, 16, 9, 0, 0).getTime()
  const ymd = offsetDays => {
    const d = new Date(now - offsetDays * DAY)
    const pad = n => String(n).padStart(2, '0')
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
  }

  it('只返回当天可补的循环任务', () => {
    const list = [
      { client_id: 'a', title: '每天听 30 分钟', recur_type: 'daily', status: 1 },
      { client_id: 'b', title: '已打卡', recur_type: 'daily', status: 1, checkins: [{ date: ymd(1) }] },
      { client_id: 'c', title: '已结束', recur_type: 'daily', status: 1, deadline: ymd(3) },
      { client_id: 'd', title: '一次性计划', recur_type: '', status: 1 }
    ]
    expect(backfillCandidates(list, ymd(1), now).map(c => c.client_id)).toEqual(['a'])
  })

  it('已删除计划排除，标题缺失兜底「未命名计划」', () => {
    const list = [
      { client_id: 'x', title: '删掉的', recur_type: 'daily', status: 1, is_deleted: 1 },
      { client_id: 'y', recur_type: 'weekly', recur_count: 3, status: 1 }
    ]
    const out = backfillCandidates(list, ymd(1), now)
    expect(out.map(c => c.client_id)).toEqual(['y'])
    expect(out[0].title).toBe('未命名计划')
    expect(out[0].recur_type).toBe('weekly')
  })

  it('无可补任务时返回空数组', () => {
    expect(backfillCandidates([], ymd(1), now)).toEqual([])
    expect(backfillCandidates(null, ymd(1), now)).toEqual([])
  })
})

describe('streakMilestoneOf：连续里程碑只在跨过时返回（3.5.5）', () => {
  it('刚好跨过 3 / 7 / 30 就给到对应天数', () => {
    expect(streakMilestoneOf(3, 2)).toBe(3)
    expect(streakMilestoneOf(7, 6)).toBe(7)
    expect(streakMilestoneOf(30, 29)).toBe(30)
  })

  it('没跨过、持平、下降都是 0', () => {
    expect(streakMilestoneOf(4, 3)).toBe(0)
    expect(streakMilestoneOf(7, 7)).toBe(0)
    expect(streakMilestoneOf(2, 5)).toBe(0)
    expect(streakMilestoneOf(0, 0)).toBe(0)
  })

  it('一次跳过多档时取最大命中', () => {
    expect(streakMilestoneOf(31, 2)).toBe(30)
    expect(streakMilestoneOf(200, 0)).toBe(100)
  })

  it('非法输入按 0 处理', () => {
    expect(streakMilestoneOf(undefined, undefined)).toBe(0)
    expect(streakMilestoneOf(3, null)).toBe(3)
  })
})
