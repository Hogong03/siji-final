/**
 * 3.4.3 计划「今日一页」测试
 * 覆盖：
 *  - collectDailySuggestions：只收主计划直接子计划、可执行链过滤（冷藏/任意时间/已完成/已删除）
 *  - est_minutes 排序与多计划轮询、上限默认 3、无时长历史数据按 15 分钟兜底
 *  - collectPlanExecEvents：打卡 + 完成事件聚合倒序
 *  - setPlanSomeday：标记/清除、不动状态与执行字段、不刷 updated_at
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { resetStorage } from './setup.js'
import { savePlan, getPlanList, logPlanCheckIn, setPlanSomeday } from '../utils/storage.js'
import { collectDailySuggestions, collectPlanExecEvents } from '../utils/plan-daily.js'

beforeEach(() => {
  resetStorage()
})

const DAY = 24 * 60 * 60 * 1000
let seq = 0

/** 快速造一条计划记录（默认主计划、进行中） */
function mkPlan(over) {
  seq += 1
  const now = Date.now()
  return {
    client_id: 'p' + seq,
    title: '计划' + seq,
    status: 1,
    parent_id: '',
    est_minutes: 0,
    created_at: now,
    updated_at: now,
    is_deleted: 0,
    ...over
  }
}

function seedPlans(list) {
  global.uni.setStorageSync('plan_all', JSON.stringify(list))
}

function ymdOffset(offsetDays, baseTs) {
  const d = new Date(baseTs || Date.now())
  d.setDate(d.getDate() + offsetDays)
  const pad = n => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

/** 本周内、且不含今天的两个不同日期（保证任意星期几运行都稳定） */
function inWeekTwoDates() {
  const now = new Date()
  const mondayIndex = (now.getDay() + 6) % 7
  if (mondayIndex === 0) return [ymdOffset(1), ymdOffset(2)]
  if (mondayIndex === 1) return [ymdOffset(-1), ymdOffset(1)]
  return [ymdOffset(-1), ymdOffset(-2)]
}

describe('collectDailySuggestions：候选口径', () => {
  it('阶段容器下沉：主计划下含子计划的容器不占位，收集容器内最小叶子', () => {
    const root = mkPlan({ client_id: 'root', title: '恢复体力' })
    const kid = mkPlan({ client_id: 'kid', title: '散步 10 分钟', parent_id: 'root', est_minutes: 10 })
    const grand = mkPlan({ client_id: 'grand', title: '远足', parent_id: 'kid', est_minutes: 5 })
    const out = collectDailySuggestions([root, kid, grand])
    expect(out.map(x => x.client_id)).toEqual(['grand'])
    expect(out[0].sourceTitle).toBe('恢复体力')
  })

  it('普通直接叶子与深层叶子混合时全部可上今日条', () => {
    const root = mkPlan({ client_id: 'root', title: '学习' })
    const phase = mkPlan({ client_id: 'phase', title: '唤醒期', parent_id: 'root', start_time: ymdOffset(0), due_date: ymdOffset(30) })
    const daily = mkPlan({ client_id: 'daily', title: '听力 30 分钟', parent_id: 'phase', est_minutes: 30, recur_type: 'daily' })
    const direct = mkPlan({ client_id: 'direct', title: '打印准考证', parent_id: 'root', est_minutes: 5 })
    const out = collectDailySuggestions([root, phase, daily, direct], { limit: 5 })
    expect(out.map(x => x.client_id)).toEqual(['direct', 'daily'])
  })

  it('冷藏/已完成/任意时间/已删除 一律不参与', () => {
    const root = mkPlan({ client_id: 'root' })
    const a = mkPlan({ parent_id: 'root', client_id: 'a' })
    const b = mkPlan({ parent_id: 'root', client_id: 'b', frozen_at: Date.now() })
    const c = mkPlan({ parent_id: 'root', client_id: 'c', status: 2 })
    const d = mkPlan({ parent_id: 'root', client_id: 'd', someday_at: Date.now() })
    const e = mkPlan({ parent_id: 'root', client_id: 'e', is_deleted: 1 })
    const out = collectDailySuggestions([root, a, b, c, d, e])
    expect(out.map(x => x.client_id)).toEqual(['a'])
  })

  it('主计划已完成或冷藏时，其子计划不上今日条', () => {
    const root = mkPlan({ client_id: 'root', status: 2 })
    const kid = mkPlan({ client_id: 'kid', parent_id: 'root' })
    expect(collectDailySuggestions([root, kid])).toHaveLength(0)
    root.status = 1
    root.frozen_at = Date.now()
    expect(collectDailySuggestions([root, kid])).toHaveLength(0)
  })
})

describe('collectDailySuggestions：循环任务与阶段窗口', () => {
  it('daily 循环任务：窗口内未打卡出现，今日打卡后不再出现', () => {
    const root = mkPlan({ client_id: 'root', title: '六级备考' })
    const phase = mkPlan({ client_id: 'phase', parent_id: 'root', title: '唤醒期', start_time: ymdOffset(0), due_date: ymdOffset(30) })
    const listen = mkPlan({
      client_id: 'listen', title: '听力 30 分钟', parent_id: 'phase',
      est_minutes: 30, recur_type: 'daily', recur_count: 1,
      start_time: ymdOffset(0), due_date: ymdOffset(30)
    })
    expect(collectDailySuggestions([root, phase, listen]).map(x => x.client_id)).toEqual(['listen'])
    listen.checkins = [{ date: ymdOffset(0), at: Date.now(), note: '听了' }]
    expect(collectDailySuggestions([root, phase, listen])).toHaveLength(0)
  })

  it('daily 循环任务：阶段未开始或已结束都不出现（普通任务不受窗口限制）', () => {
    const root = mkPlan({ client_id: 'root', title: '六级备考' })
    const future = mkPlan({
      client_id: 'f', parent_id: 'root', title: '明天的听力', est_minutes: 30,
      recur_type: 'daily', start_time: ymdOffset(1), due_date: ymdOffset(30)
    })
    const expired = mkPlan({
      client_id: 'e', parent_id: 'root', title: '昨天结束的听力', est_minutes: 30,
      recur_type: 'daily', start_time: ymdOffset(-30), due_date: ymdOffset(-1)
    })
    const plain = mkPlan({ client_id: 'p', parent_id: 'root', title: '逾期小任务', est_minutes: 10, due_date: ymdOffset(-3) })
    const out = collectDailySuggestions([root, future, expired, plain], { limit: 5 })
    expect(out.map(x => x.client_id)).toEqual(['p'])
  })

  it('weekly 循环任务：展示本周进度，达标或当日已打后退出今日条', () => {
    const root = mkPlan({ client_id: 'root', title: '冲刺' })
    const [d1, d2] = inWeekTwoDates()
    const mock = mkPlan({
      client_id: 'mock', title: '完整模考', parent_id: 'root', est_minutes: 120,
      recur_type: 'weekly', recur_count: 3,
      checkins: [
        { date: d1, at: Date.now() - DAY, note: '' },
        { date: d2, at: Date.now() - DAY, note: '' }
      ]
    })
    const out = collectDailySuggestions([root, mock])
    expect(out[0].recurType).toBe('weekly')
    expect(out[0].progressText).toContain('/3')
    expect(out[0].progressText).toContain('2')
    // 今天再打一次 → 本周 3/3 达标，退出今日条
    mock.checkins.push({ date: ymdOffset(0), at: Date.now(), note: '' })
    expect(collectDailySuggestions([root, mock])).toHaveLength(0)
  })

  it('容器冷藏/任意时间时，其下循环叶子不下发', () => {
    const root = mkPlan({ client_id: 'root' })
    const phase = mkPlan({ client_id: 'phase', parent_id: 'root', frozen_at: Date.now() })
    const daily = mkPlan({ client_id: 'daily', parent_id: 'phase', est_minutes: 30, recur_type: 'daily' })
    expect(collectDailySuggestions([root, phase, daily])).toHaveLength(0)
  })
})

describe('collectDailySuggestions：排序与轮询', () => {
  it('同计划内按 est_minutes 升序，无时长按 15 分钟兜底排序', () => {
    const root = mkPlan({ client_id: 'root' })
    const kids = [
      mkPlan({ client_id: 'k30', parent_id: 'root', est_minutes: 30, created_at: 100 }),
      mkPlan({ client_id: 'k0', parent_id: 'root', est_minutes: 0, created_at: 200 }),
      mkPlan({ client_id: 'k5', parent_id: 'root', est_minutes: 5, created_at: 300 })
    ]
    const out = collectDailySuggestions([root, ...kids], { limit: 3 })
    expect(out.map(x => x.client_id)).toEqual(['k5', 'k0', 'k30'])
  })

  it('多计划轮询：每个主计划先出一件最小，避免单计划霸榜', () => {
    const r1 = mkPlan({ client_id: 'r1', title: '学习' })
    const r2 = mkPlan({ client_id: 'r2', title: '家务' })
    const kids = [
      mkPlan({ client_id: 'r1a', parent_id: 'r1', est_minutes: 5, created_at: 100 }),
      mkPlan({ client_id: 'r1b', parent_id: 'r1', est_minutes: 60, created_at: 200 }),
      mkPlan({ client_id: 'r2a', parent_id: 'r2', est_minutes: 10, created_at: 300 }),
      mkPlan({ client_id: 'r2b', parent_id: 'r2', est_minutes: 20, created_at: 400 })
    ]
    const out = collectDailySuggestions([r1, r2, ...kids], { limit: 3 })
    expect(out.map(x => x.client_id)).toEqual(['r1a', 'r2a', 'r1b'])
  })

  it('默认上限 3 件，limit 小于 1 时至少返回 1 件', () => {
    const root = mkPlan({ client_id: 'root' })
    const kids = [1, 2, 3, 4, 5].map(n => mkPlan({ client_id: 'k' + n, parent_id: 'root', est_minutes: n }))
    expect(collectDailySuggestions([root, ...kids])).toHaveLength(3)
    expect(collectDailySuggestions([root, ...kids], { limit: 0 })).toHaveLength(1)
    expect(collectDailySuggestions([], { limit: 3 })).toHaveLength(0)
  })
})

describe('collectPlanExecEvents：执行记录聚合', () => {
  it('打卡与完成事件合并按时间倒序，含计划标题', () => {
    const now = Date.now()
    seedPlans([
      mkPlan({
        client_id: 'root', title: '健身',
        checkins: [
          { date: '2026-09-07', at: now - DAY, note: '跑了十分钟' },
          { date: '2026-09-09', at: now, note: '深蹲三组' }
        ]
      }),
      mkPlan({ client_id: 'kid', title: '早睡', parent_id: 'root', executions: [{ action: 'done', at: now - 2 * DAY }] })
    ])
    const events = collectPlanExecEvents(getPlanList())
    expect(events).toHaveLength(3)
    expect(events[0].kind).toBe('checkin')
    expect(events[0].note).toBe('深蹲三组')
    expect(events[1].at).toBe(now - DAY)
    expect(events[2].kind).toBe('done')
    expect(events[2].title).toBe('早睡')
  })
})

describe('setPlanSomeday：任意时间标记', () => {
  it('标记后不清除状态与打卡，不刷 updated_at，可再安排回今天', () => {
    const p = mkPlan({ client_id: 'p1' })
    savePlan(p)
    logPlanCheckIn('p1', '做了一点')
    const before = getPlanList().find(x => x.client_id === 'p1')
    const rec = setPlanSomeday('p1', true)
    expect(rec.someday_at).toBeGreaterThan(0)
    const after = getPlanList().find(x => x.client_id === 'p1')
    expect(after.status).toBe(1)
    expect(after.checkins).toHaveLength(1)
    expect(after.updated_at).toBe(before.updated_at)
    setPlanSomeday('p1', false)
    expect(getPlanList().find(x => x.client_id === 'p1').someday_at).toBeNull()
  })

  it('未知计划返回 null', () => {
    expect(setPlanSomeday('nope', true)).toBeNull()
  })
})
