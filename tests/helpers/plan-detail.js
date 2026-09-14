/**
 * 计划详情测试公共装置
 *
 * 提供存储重置 + uni mock 记录（toasts / modals / feedbacks）+ 计划工厂 + 组合式函数挂载器，
 * 被 tests/plan-detail-form.test.js 与 tests/plan-detail-actions.test.js 共用。
 */
import { ref } from 'vue'
import { resetStorage } from '../setup.js'
import { savePlan } from '../../utils/storage.js'
import { saveChildPlans } from '../../utils/plan-child.js'
import { usePlanForm } from '../../pages/plan/composables/usePlanForm.js'
import { usePlanChildActions } from '../../pages/plan/composables/usePlanChildActions.js'

/** 每次用例前重建的 mock 记录，断言直接读 log.toasts / log.modals / log.feedbacks */
export const log = { toasts: [], modals: [], feedbacks: [] }

/** 清空存储与 mock 记录，并把 uni 能力换成记录器（用例 beforeEach 调用） */
export function resetPlanEnv() {
  resetStorage()
  log.toasts = []
  log.modals = []
  log.feedbacks = []
  uni.showToast = ({ title }) => { log.toasts.push(title) }
  uni.showModal = (opt) => { log.modals.push(opt ? opt.title : '') }
  uni.navigateBack = () => {}
  uni.reLaunch = () => {}
}

/** 写一条计划并返回（默认 p1 六级备考） */
export function makePlan(extra = {}) {
  const plan = Object.assign({
    client_id: 'p1', title: '六级备考', status: 1, priority: 0, is_deleted: 0
  }, extra)
  savePlan(plan)
  return plan
}

/** 写一条循环子计划（parent_id 默认 p1） */
export function makeRecurChild(extra = {}) {
  return makePlan(Object.assign({
    client_id: 'c1', title: '每天背单词', parent_id: 'p1', recur_type: 'daily', recur_count: 1
  }, extra))
}

/** 挂载 usePlanForm；传入 plan 时按存量计划换入 */
export function mountForm(plan) {
  const api = usePlanForm({ saveChildren: saveChildPlans })
  if (plan) {
    api.isNew.value = false
    api.planId.value = plan.client_id
    api.applyStoredItem(plan)
  }
  return api
}

/** 挂载 usePlanChildActions，未指定的回调走默认桩 */
export function mountChildren(form, planId, opts = {}) {
  return usePlanChildActions({
    form,
    isNew: ref(false),
    planId: ref(planId),
    initialSnapshot: opts.initialSnapshot || ref(''),
    snapshotForm: opts.snapshotForm || (() => 'snap'),
    planStreak: opts.planStreak || (() => 0),
    feedbackAfter: opts.feedbackAfter || ((rec, before, fallback) => { log.feedbacks.push(fallback) }),
    onSaved: opts.onSaved || (() => {})
  })
}
