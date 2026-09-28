/**
 * 3.3 A/B 计划执行闭环测试
 * 覆盖：
 *  - storage.savePlan 完成态自动入账（done_at + executions，重复保存不重复记）
 *  - executor 结构性更新累计 plan_count（纯状态切换不计）
 *  - collectPlanExecutions 聚合多代子计划
 *  - findProcrastinationCandidates 逃避候选规则（D4=A）
 *  - buildPlanContext 命中注入 + 点破模板口径（非评判、无禁止词）
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useDataStore } from '../store/data.js'
import { resetStorage } from './setup.js'
import { savePlan, getPlanList, setPlanFrozen, logPlanCheckIn, getPlanCheckInStats, getPlanCheckInRecords } from '../utils/storage.js'
import {
  collectPlanExecutions, findProcrastinationCandidates, buildPlanContext
} from '../utils/plan-context.js'

const DAY = 24 * 60 * 60 * 1000
let store
beforeEach(() => {
  resetStorage()
  setActivePinia(createPinia())
  store = useDataStore()
})

function seedPlans(list) {
  global.uni.setStorageSync('plan_all', JSON.stringify(list))
}

describe('A: 完成入账（storage.savePlan）', () => {
  it('status 0→2 自动写 done_at 并追加 executions', () => {
    const plan = { client_id: 'p1', title: '读一本书', status: 0, parent_id: '', created_at: Date.now(), updated_at: Date.now(), is_deleted: 0 }
    savePlan(plan)
    savePlan({ client_id: 'p1', status: 2 })
    const saved = getPlanList().find(p => p.client_id === 'p1')
    expect(saved.status).toBe(2)
    expect(saved.done_at).toBeGreaterThan(0)
    expect(saved.executions).toHaveLength(1)
    expect(saved.executions[0].action).toBe('done')
  })

  it('重复保存已完成状态不再追加日志', () => {
    const plan = { client_id: 'p1', title: 'x', status: 0, parent_id: '', created_at: Date.now(), updated_at: Date.now(), is_deleted: 0 }
    savePlan(plan)
    savePlan({ client_id: 'p1', status: 2 })
    savePlan({ client_id: 'p1', status: 2, description: '再编辑一次' })
    const saved = getPlanList().find(p => p.client_id === 'p1')
    expect(saved.executions).toHaveLength(1)
  })

  it('executor 创建计划后把子计划置完成 → 子计划自动入账', () => {
    const r = store.executeAction({ type: 'create_plan', payload: { title: '健身', subtasks: [{ title: '跑 5 分钟' }] } })
    expect(r.success).toBe(true)
    const kids = getPlanList().filter(p => p.parent_id === r.detail.id)
    expect(kids).toHaveLength(1)
    const kid = kids[0]
    store.executeAction({ type: 'update_plan_phase', payload: { client_id: r.detail.id, phase_id: kid.client_id, status: 2 } })
    const savedKid = getPlanList().find(p => p.client_id === kid.client_id)
    expect(savedKid.done_at).toBeGreaterThan(0)
    expect(savedKid.executions).toHaveLength(1)
  })

  it('AI subtasks 带 est_minutes → 子计划保留该字段', () => {
    const r = store.executeAction({ type: 'create_plan', payload: { title: '整理桌面', subtasks: [{ title: '清空废纸', est_minutes: 5 }, { title: '擦灰', est_minutes: 10 }] } })
    const kids = getPlanList().filter(p => p.parent_id === r.detail.id)
    expect(kids.map(k => k.est_minutes).sort((a, b) => a - b)).toEqual([5, 10])
  })
})

describe('A: plan_count（AI 结构性规划次数）', () => {
  it('创建为 1；结构性更新 +1；纯状态切换不计', () => {
    const r = store.executeAction({ type: 'create_plan', payload: { title: '学吉他', subtasks: [{ title: '调音' }] } })
    const pid = r.detail.id
    expect(getPlanList().find(p => p.client_id === pid).plan_count).toBe(1)
    store.executeAction({ type: 'update_plan', payload: { client_id: pid, description: '每周两次' } })
    expect(getPlanList().find(p => p.client_id === pid).plan_count).toBe(2)
    store.executeAction({ type: 'update_plan', payload: { client_id: pid, status: 1 } })
    expect(getPlanList().find(p => p.client_id === pid).plan_count).toBe(2)
  })
})

describe('A: collectPlanExecutions 聚合', () => {
  it('聚合多代子计划的执行日志并倒序', () => {
    const now = Date.now()
    seedPlans([
      { client_id: 'root', title: 'R', status: 1, parent_id: '', plan_count: 1, executions: [{ action: 'done', at: now - 1000 }], created_at: now - 100 * DAY, updated_at: now - 5 * DAY, is_deleted: 0 },
      { client_id: 'c1', title: 'C1', status: 2, parent_id: 'root', plan_count: 1, executions: [{ action: 'done', at: now - 2 * DAY }], done_at: now - 2 * DAY, created_at: now - 90 * DAY, updated_at: now - 2 * DAY, is_deleted: 0 },
      { client_id: 'c2', title: 'C2', status: 1, parent_id: 'root', plan_count: 1, executions: [], created_at: now - 90 * DAY, updated_at: now - 6 * DAY, is_deleted: 0 },
      { client_id: 'g1', title: 'G1', status: 2, parent_id: 'c2', plan_count: 1, executions: [{ action: 'done', at: now - DAY }], done_at: now - DAY, created_at: now - 80 * DAY, updated_at: now - DAY, is_deleted: 0 }
    ])
    const logs = collectPlanExecutions('root')
    expect(logs).toHaveLength(3)
    expect(logs[0].at).toBe(now - 1000)
    expect(logs[1].at).toBe(now - DAY)
  })
})

describe('B: 逃避候选检测（D4=A）', () => {
  const base = (over) => {
    const now = Date.now()
    return {
      client_id: 'p1', title: '准备考试', status: 0, parent_id: '',
      plan_count: 3, executions: [], created_at: now - 20 * DAY,
      updated_at: now - 4 * DAY, is_deleted: 0, ...over
    }
  }
  it('plan_count>=3 + 无执行 + 超 3 天 → 候选', () => {
    seedPlans([base({})])
    const cands = findProcrastinationCandidates()
    expect(cands).toHaveLength(1)
    expect(cands[0].plan.title).toBe('准备考试')
  })
  it('plan_count=2 → 不候选', () => {
    seedPlans([base({ plan_count: 2 })])
    expect(findProcrastinationCandidates()).toHaveLength(0)
  })
  it('已有执行记录 → 不候选', () => {
    seedPlans([base({ executions: [{ action: 'done', at: Date.now() - DAY }] })])
    expect(findProcrastinationCandidates()).toHaveLength(0)
  })
  it('最近 3 天内刚规划 → 不候选', () => {
    seedPlans([base({ updated_at: Date.now() - DAY })])
    expect(findProcrastinationCandidates()).toHaveLength(0)
  })
  it('已完成计划与子计划不计入', () => {
    const now = Date.now()
    seedPlans([
      base({ client_id: 'p1', status: 2 }),
      base({ client_id: 'p2', parent_id: 'p1', plan_count: 9, updated_at: now - 10 * DAY })
    ])
    expect(findProcrastinationCandidates()).toHaveLength(0)
  })
})

describe('B: buildPlanContext（对话内点破）', () => {
  const now = Date.now()
  function seedCandidate() {
    seedPlans([{
      client_id: 'p1', title: '每天早起跑步', status: 0, parent_id: '',
      plan_count: 4, executions: [], created_at: now - 30 * DAY,
      updated_at: now - 5 * DAY, is_deleted: 0
    }])
  }
  it('消息未点名计划 → 不注入', () => {
    seedCandidate()
    expect(buildPlanContext('今天天气不错')).toBe('')
  })
  it('消息点名候选计划 → 注入观察 + 可选项，且无催促评判词', () => {
    seedCandidate()
    const ctx = buildPlanContext('我那个每天早起跑步的计划怎么办')
    expect(ctx).toContain('每天早起跑步')
    expect(ctx).toContain('还没有执行记录')
    expect(ctx).toContain('缩小范围')
    expect(ctx).not.toContain('你应该')
    expect(ctx).not.toContain('加油')
    expect(ctx).not.toContain('又没做')
  })
  it('已有执行记录的计划 → 注入执行摘要而非点破', () => {
    seedPlans([{
      client_id: 'p2', title: '练字计划', status: 1, parent_id: '',
      plan_count: 2, created_at: now - 10 * DAY, updated_at: now - DAY, is_deleted: 0,
      executions: [{ action: 'done', at: now - 2 * DAY }]
    }])
    const ctx = buildPlanContext('练字计划进度如何')
    expect(ctx).toContain('最近执行 1 次')
    expect(ctx).toContain('练字计划')
    expect(ctx).not.toContain('缩小范围')
  })
})
describe('3.4 M3: 计划冷藏（先放一放）', () => {
  it('冷藏计划不进逃避候选', () => {
    const now = Date.now()
    seedPlans([{
      client_id: 'fp1', title: '准备考试', status: 0, parent_id: '',
      plan_count: 4, executions: [], frozen_at: now - 2 * DAY,
      created_at: now - 30 * DAY, updated_at: now - 10 * DAY, is_deleted: 0
    }])
    const cands = findProcrastinationCandidates()
    expect(cands).toHaveLength(0)
  })

  it('buildPlanContext 不注入冷藏计划的执行摘要与点破', () => {
    const now = Date.now()
    seedPlans([{
      client_id: 'fp2', title: '早起跑步', status: 1, parent_id: '',
      plan_count: 3, executions: [], frozen_at: now - DAY,
      created_at: now - 30 * DAY, updated_at: now - 10 * DAY, is_deleted: 0
    }])
    const ctx = buildPlanContext('我那个早起跑步的计划怎么办')
    expect(ctx).toBe('')
  })

  it('executor update_plan frozen=true 只标记、不累计 plan_count；false 恢复', () => {
    const r = store.executeAction({ type: 'create_plan', payload: { title: '整理房间', subtasks: [{ title: '叠被子' }] } })
    const pid = r.detail.id
    expect(getPlanList().find(p => p.client_id === pid).plan_count).toBe(1)
    const before = getPlanList().find(p => p.client_id === pid)
    store.executeAction({ type: 'update_plan', payload: { client_id: pid, frozen: true } })
    const frozen = getPlanList().find(p => p.client_id === pid)
    expect(frozen.frozen_at).toBeGreaterThan(0)
    expect(frozen.plan_count).toBe(1)
    expect(frozen.status).toBe(before.status)
    expect((frozen.executions || [])).toHaveLength(0)
    store.executeAction({ type: 'update_plan', payload: { client_id: pid, frozen: false } })
    const restored = getPlanList().find(p => p.client_id === pid)
    expect(restored.frozen_at).toBeNull()
    expect(restored.plan_count).toBe(1)
    expect(restored.status).toBe(before.status)
  })

  it('setPlanFrozen 直接调用不写 executions/不刷 updated_at', () => {
    const now = Date.now()
    seedPlans([{
      client_id: 'fp3', title: '学吉他', status: 0, parent_id: '',
      executions: [], created_at: now - 20 * DAY, updated_at: now - 5 * DAY, is_deleted: 0
    }])
    const rec = setPlanFrozen('fp3', true)
    expect(rec.frozen_at).toBeGreaterThan(0)
    const saved = getPlanList().find(p => p.client_id === 'fp3')
    expect(saved.updated_at).toBe(now - 5 * DAY)
    expect(saved.executions || []).toHaveLength(0)
  })
})

describe('3.4.1 A: AI 拆解带细节（description 透传）', () => {
  it('create_plan subtasks 带 description → 子计划保留', () => {
    const r = store.executeAction({ type: 'create_plan', payload: { title: '恢复精力', subtasks: [{ title: '早睡', description: '23:00 前放下手机躺下', est_minutes: 5 }] } })
    expect(r.success).toBe(true)
    const kids = getPlanList().filter(p => p.parent_id === r.detail.id)
    expect(kids[0].description).toBe('23:00 前放下手机躺下')
  })

  it('create_plan_phases phases 带 description → 阶段子计划保留', () => {
    const r = store.executeAction({ type: 'create_plan_phases', payload: { title: '恢复计划', phases: [{ title: '阶段1', description: '第一周只做早睡' }, { title: '阶段2', description: '第二周加散步' }] } })
    expect(r.success).toBe(true)
    const kids = getPlanList().filter(p => p.parent_id === r.detail.id)
    expect(kids).toHaveLength(2)
    expect(kids.map(k => k.description)).toEqual(['第一周只做早睡', '第二周加散步'])
  })
})

describe('3.4.1 B: 计划打卡（轻记录）', () => {
  function seedPlan(over) {
    const plan = { client_id: 'ci1', title: '每天读一页书', status: 1, parent_id: '', plan_count: 1, executions: [], created_at: Date.now(), updated_at: Date.now(), is_deleted: 0, ...over }
    seedPlans([plan])
    return plan
  }

  it('logPlanCheckIn 当日记录一次，同日幂等不重复', () => {
    seedPlan()
    const r1 = logPlanCheckIn('ci1')
    expect(r1.checkins).toHaveLength(1)
    const r2 = logPlanCheckIn('ci1')
    expect(r2.checkins).toHaveLength(1)
    expect(getPlanCheckInStats(r2).days).toBe(1)
    expect(getPlanCheckInStats(r2).todayDone).toBe(true)
  })

  it('跨日累计天数，最近日期为最新打卡日', () => {
    const y = new Date(Date.now() - DAY)
    const pad = n => String(n).padStart(2, '0')
    const yStr = y.getFullYear() + '-' + pad(y.getMonth() + 1) + '-' + pad(y.getDate())
    seedPlan({ checkins: [{ date: yStr, at: y.getTime() }] })
    const rec = logPlanCheckIn('ci1')
    const stats = getPlanCheckInStats(rec)
    expect(stats.days).toBe(2)
    expect(stats.lastDate).not.toBe(yStr)
  })

  it('打卡不动 status/plan_count/executions/updated_at', () => {
    const base = seedPlan()
    const rec = logPlanCheckIn('ci1')
    expect(rec.status).toBe(base.status)
    expect(rec.plan_count).toBe(1)
    expect(rec.executions || []).toHaveLength(0)
    expect(rec.updated_at).toBe(base.updated_at)
  })

  it('冷藏/已完成计划禁打卡', () => {
    seedPlan()
    setPlanFrozen('ci1', true)
    expect(logPlanCheckIn('ci1')).toBeNull()
    seedPlan({ status: 2 })
    expect(logPlanCheckIn('ci1')).toBeNull()
  })

  it('executor log_plan_checkin 接线成功且当日幂等', () => {
    seedPlan()
    const r = store.executeAction({ type: 'log_plan_checkin', payload: { client_id: 'ci1' } })
    expect(r.success).toBe(true)
    expect(r.detail.todayDone).toBe(true)
    expect(r.detail.totalDays).toBe(1)
    expect(getPlanList().find(p => p.client_id === 'ci1').checkins).toHaveLength(1)
    const r2 = store.executeAction({ type: 'log_plan_checkin', payload: { client_id: 'ci1' } })
    expect(r2.success).toBe(true)
    expect(r2.message).toContain('不重复')
    expect(getPlanList().find(p => p.client_id === 'ci1').checkins).toHaveLength(1)
  })

  it('executor 缺 ID / 计划不存在 / 冷藏 报错不落库', () => {
    expect(store.executeAction({ type: 'log_plan_checkin', payload: {} }).success).toBe(false)
    expect(store.executeAction({ type: 'log_plan_checkin', payload: { client_id: 'nope' } }).success).toBe(false)
    seedPlan()
    setPlanFrozen('ci1', true)
    const r = store.executeAction({ type: 'log_plan_checkin', payload: { client_id: 'ci1' } })
    expect(r.success).toBe(false)
  })
})


describe('3.4.1 B2: 打卡描述与明细', () => {
  function seedPlan(over) {
    const plan = { client_id: 'ci2', title: '每天散步', status: 1, parent_id: '', plan_count: 1, executions: [], created_at: Date.now(), updated_at: Date.now(), is_deleted: 0, ...over }
    seedPlans([plan])
    return plan
  }

  it('logPlanCheckIn 带 note 存储，同日补写覆盖描述', () => {
    seedPlan()
    const r1 = logPlanCheckIn('ci2', '散步 20 分钟')
    expect(r1.checkins[0].note).toBe('散步 20 分钟')
    const r2 = logPlanCheckIn('ci2', '改为夜跑 10 分钟')
    expect(r2.checkins).toHaveLength(1)
    expect(r2.checkins[0].note).toBe('改为夜跑 10 分钟')
  })

  it('getPlanCheckInRecords 返回倒序明细（时刻/note/今日标记）', () => {
    const y = new Date(Date.now() - DAY)
    const pad = n => String(n).padStart(2, '0')
    const yStr = y.getFullYear() + '-' + pad(y.getMonth() + 1) + '-' + pad(y.getDate())
    seedPlan({ checkins: [{ date: yStr, at: y.getTime(), note: '昨天散步' }] })
    const rec = logPlanCheckIn('ci2', '今天也散步了')
    const list = getPlanCheckInRecords(rec, 5)
    expect(list).toHaveLength(2)
    expect(list[0].note).toBe('今天也散步了')
    expect(list[0].isToday).toBe(true)
    expect(list[1].date).toBe(yStr)
    expect(list[1].timeText).toMatch(/^[0-9]{2}:[0-9]{2}$/)
  })

  it('executor log_plan_checkin 透传 note', () => {
    seedPlan()
    const r = store.executeAction({ type: 'log_plan_checkin', payload: { client_id: 'ci2', note: '晨跑 20 分钟' } })
    expect(r.success).toBe(true)
    expect(r.message).toContain('晨跑 20 分钟')
    expect(getPlanList().find(p => p.client_id === 'ci2').checkins[0].note).toBe('晨跑 20 分钟')
  })

  it('3.5.4 补记：指定过去日期落库，未来/非法日期回落到今天', () => {
    seedPlan()
    const y = new Date(Date.now() - DAY)
    const pad = n => String(n).padStart(2, '0')
    const yStr = y.getFullYear() + '-' + pad(y.getMonth() + 1) + '-' + pad(y.getDate())
    const r1 = logPlanCheckIn('ci2', '补昨天的散步', yStr)
    expect(r1.checkins.map(c => c.date)).toEqual([yStr])
    expect(r1.checkins[0].note).toBe('补昨天的散步')

    const t = new Date()
    const tStr = t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate())
    const tomorrow = new Date(Date.now() + DAY)
    const tomStr = tomorrow.getFullYear() + '-' + pad(tomorrow.getMonth() + 1) + '-' + pad(tomorrow.getDate())

    const r2 = logPlanCheckIn('ci2', '', tomStr) // 未来日期 → 今天
    expect(r2.checkins.map(c => c.date)).toEqual([yStr, tStr])
    const r3 = logPlanCheckIn('ci2', '', '2026/09/01') // 非法格式 → 今天
    expect(r3.checkins.map(c => c.date)).toEqual([yStr, tStr])
  })
})

describe('3.4.1 B2: AI 子计划带时间', () => {
  it('create_plan subtasks 带 start_time/end_time → 子计划保留', () => {
    const r = store.executeAction({ type: 'create_plan', payload: { title: '一周恢复', subtasks: [{ title: '早睡', description: '23 点前睡', est_minutes: 5, start_time: '2026-09-10', end_time: '2026-09-10' }, { title: '散步', description: '出门走 20 分钟', est_minutes: 10, start_time: '2026-09-11' }] } })
    expect(r.success).toBe(true)
    const kids = getPlanList().filter(p => p.parent_id === r.detail.id)
    expect(kids.map(k => k.start_time)).toEqual(['2026-09-10', '2026-09-11'])
    expect(kids.map(k => k.end_time)).toEqual(['2026-09-10', ''])
  })
})
