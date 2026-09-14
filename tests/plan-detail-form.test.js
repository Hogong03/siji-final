/**
 * 计划详情拆分测试 · 表单线（3.5.7）
 *
 * 覆盖 utils/plan-child（子计划规格与落库）+ usePlanForm（快照 / 换入 / 旧数据迁移 / 落库 / 冷藏）。
 * 动作线（usePlanChildActions / usePlanNextStep）见 tests/plan-detail-actions.test.js。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { resetPlanEnv, log, makePlan, makeRecurChild, mountForm } from './helpers/plan-detail.js'
import { getPlanList } from '../utils/storage.js'
import { buildChildPlanForm, saveChildPlans } from '../utils/plan-child.js'
import { usePlanForm } from '../pages/plan/composables/usePlanForm.js'

beforeEach(() => {
  resetPlanEnv()
})

describe('utils/plan-child：子计划规格与落库', () => {
  it('buildChildPlanForm 递归生成子计划表单对象', () => {
    const spec = { title: '子A', status: 1, est_minutes: 30, children: [{ title: '孙A' }] }
    const form = buildChildPlanForm(spec, 2)
    expect(form.title).toBe('子A')
    expect(form.priority).toBe(2)
    expect(form.est_minutes).toBe(30)
    expect(form.client_id.length > 0).toBe(true)
    expect(form._subCount).toBe(0)
    expect(form.childPlans.length).toBe(1)
    expect(form.childPlans[0].title).toBe('孙A')
  })

  it('saveChildPlans 递归落库并逐层回填 parent_id（2 层共 3 条）', () => {
    const children = [
      { client_id: 'c1', title: '子1', _subCount: 5, childPlans: [{ client_id: 'g1', title: '孙1', childPlans: [] }] },
      { title: '子2', childPlans: [] }
    ]
    const n = saveChildPlans(children, 'root')
    expect(n).toBe(3)
    const list = getPlanList()
    const c1 = list.find(p => p.client_id === 'c1')
    expect(c1.parent_id).toBe('root')
    expect(c1._subCount).toBeUndefined()
    expect(c1.subtasks.length).toBe(0)
    const g1 = list.find(p => p.client_id === 'g1')
    expect(g1.parent_id).toBe('c1')
    const c2 = list.find(p => p.title === '子2')
    expect(c2.parent_id).toBe('root')
    expect(c2.client_id.length > 0).toBe(true)
  })
})

describe('usePlanForm：快照 / 换入 / 落库', () => {
  it('snapshotForm 忽略展示字段 _subCount', () => {
    const api = usePlanForm()
    api.form.value.childPlans = [{ client_id: 'c1', title: 'A', _subCount: 0 }]
    const snap1 = api.snapshotForm()
    api.form.value.childPlans[0]._subCount = 9
    expect(api.snapshotForm()).toBe(snap1)
    api.form.value.title = '改了'
    expect(api.snapshotForm() === snap1).toBe(false)
  })

  it('applyStoredItem 把存量计划拆进表单（日期/时间/标签/循环）', () => {
    const plan = makePlan({
      client_id: 'p2', tags: ['学习'], due_date: '2026-09-20 18:30',
      estimated_time: '2026-09-18 09:00', recur_type: 'weekly', recur_count: 3
    })
    const api = mountForm(plan)
    expect(api.form.value.tags).toEqual(['学习'])
    expect(api.form.value.due_date).toBe('2026-09-20')
    expect(api.form.value.due_time).toBe('18:30')
    expect(api.form.value.estimated_time).toBe('2026-09-18')
    expect(api.form.value.estimated_time_value).toBe('09:00')
    expect(api.selfRecurType.value).toBe('weekly')
    expect(api.selfRecurCount.value).toBe(3)
  })

  it('applyStoredItem 迁移旧数据：subtasks → 子计划并置迁移标记', () => {
    const plan = makePlan({
      client_id: 'p3',
      subtasks: [{ title: '旧子任务', done: true }, { title: '旧子任务2' }]
    })
    const api = mountForm(plan)
    expect(api.form.value.childPlans.length).toBe(2)
    expect(api.form.value.childPlans[0].title).toBe('旧子任务')
    expect(api.form.value.childPlans[0].status).toBe(2)
    expect(api.migratedLegacy.value).toBe(true)
  })

  it('persistForm 落库：标题去空格 + 截止冗余 + 循环次数归一 + 快照刷新', () => {
    const api = usePlanForm({ saveChildren: saveChildPlans })
    api.isNew.value = true
    api.form.value.title = '  新计划  '
    api.form.value.due_date = '2026-09-30'
    api.form.value.due_time = '20:00'
    api.form.value.recur_type = 'weekly'
    api.form.value.recur_count = 4
    const rec = api.persistForm()
    expect(rec.title).toBe('新计划')
    expect(rec.deadline).toBe('2026-09-30 20:00')
    expect(rec.recur_count).toBe(4)
    expect(api.saved.value).toBe(true)
    expect(api.initialSnapshot.value).toBe(api.snapshotForm())
    expect(getPlanList().find(p => p.client_id === rec.client_id)).toBeTruthy()
  })

  it('persistForm 非 weekly 时把循环次数压回 1', () => {
    const api = usePlanForm({ saveChildren: saveChildPlans })
    api.form.value.title = '每天做'
    api.form.value.recur_type = 'daily'
    api.form.value.recur_count = 5
    expect(api.persistForm().recur_count).toBe(1)
  })

  it('persistForm 主计划收尾时连循环子计划一起收尾', () => {
    const parent = makePlan({ client_id: 'p1' })
    makeRecurChild({ client_id: 'c1', status: 1 })
    const api = mountForm(parent)
    expect(api.form.value.childPlans.length).toBe(1)
    api.form.value.status = 2
    api.persistForm()
    const stored = getPlanList().find(p => p.client_id === 'c1')
    expect(stored.status).toBe(2)
  })

  it('toggleFrozen 只在存量计划上生效，并写回 frozen_at', () => {
    const plan = makePlan({ client_id: 'p4' })
    const api = mountForm(plan)
    api.toggleFrozen()
    expect(api.form.value.frozen_at > 0).toBe(true)
    expect(log.toasts).toContain('已先放一放')
    api.toggleFrozen()
    expect(api.form.value.frozen_at).toBe(null)
    expect(log.toasts).toContain('已恢复计划')
  })
})
