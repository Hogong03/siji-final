/**
 * 计划详情拆分测试 · 动作线（3.5.7）
 *
 * 覆盖 usePlanChildActions（进度与子计划侧写）+ usePlanNextStep（下一步单卡）。
 * 表单线（utils/plan-child / usePlanForm）见 tests/plan-detail-form.test.js。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { resetPlanEnv, log, makePlan, makeRecurChild, mountChildren } from './helpers/plan-detail.js'
import { getPlanList } from '../utils/storage.js'
import { emptyPlanForm } from '../pages/plan/composables/usePlanForm.js'
import { usePlanNextStep } from '../pages/plan/composables/usePlanNextStep.js'

beforeEach(() => {
  resetPlanEnv()
})

describe('usePlanChildActions：进度与子计划侧写操作', () => {
  function formWith(children, status) {
    return ref(Object.assign(emptyPlanForm(), { status: status, childPlans: children }))
  }

  it('childProgress 只统计非循环子计划，循环子计划单独计入 recurSummary', () => {
    const form = formWith([
      { client_id: 'a', title: 'A', status: 2 },
      { client_id: 'b', title: 'B', status: 1 },
      { client_id: 'c', title: 'C', status: 1, recur_type: 'daily' }
    ], 1)
    const api = mountChildren(form, 'p1')
    expect(api.childProgress.value).toEqual({ total: 2, done: 1, pct: 50 })
    expect(api.recurSummary.value.total).toBe(1)
    expect(api.recurSummary.value.doneToday).toBe(0)
  })

  it('子计划全部完成时把主计划状态推到已完成（有循环子计划在跑则不推）', async () => {
    const form = formWith([{ client_id: 'a', title: 'A', status: 1 }], 1)
    mountChildren(form, 'p1')
    form.value.childPlans[0].status = 2
    await nextTick()
    expect(form.value.status).toBe(2)
    expect(log.toasts).toContain('所有子计划已完成')

    const form2 = formWith([
      { client_id: 'a', title: 'A', status: 1 },
      { client_id: 'r', title: 'R', status: 1, recur_type: 'daily' }
    ], 1)
    mountChildren(form2, 'p1')
    form2.value.childPlans[0].status = 2
    await nextTick()
    expect(form2.value.status).toBe(1)
  })

  it('refreshChildren 重新读盘并补 _subCount、刷新快照', () => {
    makePlan({ client_id: 'p1' })
    makeRecurChild({ client_id: 'c1', parent_id: 'p1' })
    makePlan({ client_id: 'g1', parent_id: 'c1', title: '孙计划' })
    const form = formWith([], 1)
    const initialSnapshot = ref('')
    const api = mountChildren(form, 'p1', { initialSnapshot, snapshotForm: () => 'snap' })
    api.refreshChildren()
    expect(form.value.childPlans.length).toBe(1)
    expect(form.value.childPlans[0]._subCount).toBe(1)
    expect(initialSnapshot.value).toBe('snap')
  })

  it('toggleChildSomeday 写 someday_at 并刷新列表', () => {
    makePlan({ client_id: 'p1' })
    makeRecurChild({ client_id: 'c1', parent_id: 'p1' })
    const form = formWith([], 1)
    const api = mountChildren(form, 'p1')
    api.toggleChildSomeday('c1', true)
    expect(getPlanList().find(p => p.client_id === 'c1').someday_at > 0).toBe(true)
    expect(log.toasts).toContain('已放到任意时间')
    api.toggleChildSomeday('c1', false)
    expect(log.toasts).toContain('已安排到今天')
  })

  it('checkinChild 给循环子计划打卡并给回执', () => {
    makePlan({ client_id: 'p1' })
    makeRecurChild({ client_id: 'c1', parent_id: 'p1' })
    const form = formWith([], 1)
    const api = mountChildren(form, 'p1')
    api.checkinChild('c1')
    expect(log.feedbacks).toContain('已打卡，今天完成')
    const stored = getPlanList().find(p => p.client_id === 'c1')
    expect(stored.checkins.length).toBe(1)
  })

  it('updateChildRecur 改循环设置 / 取消循环', () => {
    makePlan({ client_id: 'p1' })
    makeRecurChild({ client_id: 'c1', parent_id: 'p1' })
    const form = formWith([], 1)
    const api = mountChildren(form, 'p1')
    api.updateChildRecur({ clientId: 'c1', recur_type: 'weekly', recur_count: 3 })
    expect(getPlanList().find(p => p.client_id === 'c1').recur_type).toBe('weekly')
    expect(log.toasts).toContain('已设为循环任务')
    api.updateChildRecur({ clientId: 'c1', recur_type: '', recur_count: 1 })
    expect(log.toasts).toContain('已取消循环')
  })
})

describe('usePlanNextStep：下一步单卡', () => {
  function mountNext(form, selfRecurType, opts = {}) {
    return usePlanNextStep({
      form,
      isNew: ref(false),
      planId: ref('p1'),
      selfRecurType: ref(selfRecurType || ''),
      selfCheckins: ref(opts.selfCheckins || []),
      childSatisfiedToday: opts.childSatisfiedToday || (() => false),
      persistForm: opts.persistForm || (() => {}),
      snapshotForm: opts.snapshotForm || (() => 'snap'),
      initialSnapshot: opts.initialSnapshot || ref(''),
      planStreak: opts.planStreak || (() => 0),
      feedbackAfter: opts.feedbackAfter || ((rec, before, fallback) => { log.feedbacks.push(fallback) })
    })
  }

  it('取第一个未完成子计划；今天已满足的循环子计划跳过', () => {
    const form = ref(Object.assign(emptyPlanForm(), {
      title: '主计划',
      childPlans: [
        { client_id: 'a', title: 'A', status: 1, recur_type: 'daily' },
        { client_id: 'b', title: 'B', status: 1 }
      ]
    }))
    const api = mountNext(form, '', { childSatisfiedToday: (c) => c.client_id === 'a' })
    expect(api.nextStepItem.value.client_id).toBe('b')
    expect(api.nextStepItem.value._isRecur).toBe('')
  })

  it('没有子计划且自身非循环 → 指向自己', () => {
    const form = ref(Object.assign(emptyPlanForm(), { title: '一个人干', childPlans: [] }))
    const api = mountNext(form, '')
    expect(api.nextStepItem.value._self).toBe(true)
    expect(api.nextStepMetaText(api.nextStepItem.value).indexOf('分钟') > -1).toBe(true)
  })

  it('自身是循环任务时不显示「标记完成」入口', () => {
    const form = ref(Object.assign(emptyPlanForm(), { title: '每天走 6000 步', childPlans: [] }))
    const api = mountNext(form, 'daily')
    expect(api.nextStepItem.value).toBe(null)
  })

  it('冻结或已完成时不给下一步', () => {
    const form = ref(Object.assign(emptyPlanForm(), { status: 2, childPlans: [{ client_id: 'a', status: 1 }] }))
    expect(mountNext(form, '').nextStepItem.value).toBe(null)
    const frozen = ref(Object.assign(emptyPlanForm(), { frozen_at: 1, childPlans: [{ client_id: 'a', status: 1 }] }))
    expect(mountNext(frozen, '').nextStepItem.value).toBe(null)
  })

  it('completeNextStep：普通子计划标完成并落库', () => {
    let persisted = 0
    const form = ref(Object.assign(emptyPlanForm(), {
      title: '主计划',
      childPlans: [{ client_id: 'b', title: 'B', status: 1 }]
    }))
    const api = mountNext(form, '', { persistForm: () => { persisted += 1 } })
    api.completeNextStep()
    expect(form.value.childPlans[0].status).toBe(2)
    expect(persisted).toBe(1)
    expect(log.toasts).toContain('已完成这一步')
  })

  it('completeNextStep：循环子计划走打卡，不置完成', () => {
    makePlan({ client_id: 'c1', title: '背单词', status: 1, parent_id: 'p1', recur_type: 'daily', recur_count: 1 })
    const form = ref(Object.assign(emptyPlanForm(), {
      title: '主计划',
      childPlans: [{ client_id: 'c1', title: '背单词', status: 1, recur_type: 'daily', recur_count: 1 }]
    }))
    const initialSnapshot = ref('')
    const api = mountNext(form, '', { initialSnapshot })
    api.completeNextStep()
    expect(form.value.childPlans[0].status).toBe(1)
    expect(log.feedbacks).toContain('今天做了，已记录')
    expect(initialSnapshot.value).toBe('snap')
  })

  it('按钮文案与副文案按循环类型分流', () => {
    const form = ref(Object.assign(emptyPlanForm(), { childPlans: [] }))
    const api = mountNext(form, '')
    expect(api.nextStepButtonText({ _isRecur: 'daily' })).toBe('今日打卡')
    expect(api.nextStepButtonText({ _isRecur: 'weekly' })).toBe('今天打卡')
    expect(api.nextStepButtonText({})).toBe('标记完成')
    expect(api.nextStepMetaText({ _isRecur: 'daily', est_minutes: 20 }).indexOf('20') > -1).toBe(true)
  })
})
