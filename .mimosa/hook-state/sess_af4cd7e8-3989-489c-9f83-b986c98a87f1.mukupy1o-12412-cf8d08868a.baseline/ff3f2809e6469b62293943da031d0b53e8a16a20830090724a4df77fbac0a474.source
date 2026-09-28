/**
 * 子计划动作（3.5.7：从 pages/plan/detail.vue 抽出）
 *
 * 职责：进度统计 + 子计划列表刷新 + 子计划侧写操作（任意时间 / 打卡 / 循环设置）
 * 依赖（打卡连续与回执）由调用方注入，本文件不直接创建 checkin 状态
 */
import { computed, watch } from 'vue'
import { getChildPlans, setPlanSomeday, setPlanRecur, logPlanCheckIn } from '@/utils/storage.js'
import { recurTypeOf, satisfiedToday } from '@/utils/plan-recur.js'
import { invalidatePromptCache } from '@/utils/ai/prompt-builder.js'

export function usePlanChildActions({ form, isNew, planId, initialSnapshot, snapshotForm, planStreak, feedbackAfter, onSaved }) {
  /** 子计划进度（子计划全部完成时自动将状态改为已完成；循环任务不计入，避免永远 0/N） */
  const childProgress = computed(() => {
    const list = (form.value.childPlans || []).filter(c => !recurTypeOf(c))
    if (list.length === 0) return { total: 0, done: 0, pct: 0 }
    const done = list.filter(c => c.status === 2).length
    return { total: list.length, done, pct: Math.round(done / list.length * 100) }
  })

  // 3.5.1：循环子计划单独统计（今日已满足 / 总数），与一次性子计划进度分开显示
  const recurSummary = computed(() => {
    const list = (form.value.childPlans || []).filter(c => recurTypeOf(c) && c.status !== 2)
    const doneToday = list.filter(c => satisfiedToday(c)).length
    return { total: list.length, doneToday }
  })

  watch(() => childProgress.value, (prog) => {
    // 还有「在跑」的循环子计划时不自动收尾（等循环窗口结束由存储层级联收尾，或用户手动完成）
    const openRecur = (form.value.childPlans || []).some(c => recurTypeOf(c) && c.status !== 2)
    if (prog.total > 0 && prog.done === prog.total && !openRecur && form.value.status !== 2) {
      form.value.status = 2
      uni.showToast({ title: '所有子计划已完成', icon: 'none' })
    } else if (prog.total > 0 && prog.done < prog.total && form.value.status === 2) {
      form.value.status = 1
    }
  }, { deep: true })

  /** 子计划今天是否已满足（循环子计划用） */
  function childSatisfiedToday(child) {
    if (!recurTypeOf(child)) return false
    return satisfiedToday(child)
  }

  /** 重新载入子计划列表并同步编辑快照（打卡 / 循环设置 / 任意时间变更后共用） */
  function refreshChildren() {
    form.value.childPlans = getChildPlans(planId.value).map(ch => {
      const item = { ...ch }
      item._subCount = getChildPlans(ch.client_id).length
      return item
    })
    if (initialSnapshot && typeof snapshotForm === 'function') {
      initialSnapshot.value = snapshotForm()
    }
  }

  /** 3.4.3：子计划「任意时间」— 今天不做 / 安排到今天（只标记 someday_at，不污染表单编辑流） */
  function toggleChildSomeday(clientId, someday) {
    if (isNew.value || !planId.value) return
    const rec = setPlanSomeday(clientId, someday)
    if (!rec) return
    refreshChildren()
    if (typeof onSaved === 'function') onSaved()
    invalidatePromptCache()
    uni.showToast({ title: someday ? '已放到任意时间' : '已安排到今天', icon: 'none' })
  }

  /** 3.5.1：阶段页直接给循环子计划打卡，不必进入子计划详情 */
  function checkinChild(clientId) {
    if (isNew.value || !planId.value) return
    const before = typeof planStreak === 'function' ? planStreak(clientId) : 0
    const rec = logPlanCheckIn(clientId, '')
    if (!rec) {
      uni.showToast({ title: '当前状态暂不能打卡', icon: 'none' })
      return
    }
    refreshChildren()
    const fb = typeof feedbackAfter === 'function' ? feedbackAfter : null
    if (fb) fb(rec, before, '已打卡，今天完成')
    else uni.showToast({ title: '已打卡，今天完成', icon: 'none' })
  }

  /** 3.5.2：子计划卡内联改循环设置（每天 / 每周 N 次 / 取消循环） */
  function updateChildRecur(payload) {
    if (isNew.value || !planId.value || !payload || !payload.clientId) return
    const rec = setPlanRecur(payload.clientId, payload.recur_type, payload.recur_count)
    if (!rec) {
      uni.showToast({ title: '子计划不存在', icon: 'none' })
      return
    }
    refreshChildren()
    invalidatePromptCache()
    uni.showToast({ title: rec.recur_type ? '已设为循环任务' : '已取消循环', icon: 'none' })
  }

  return {
    childProgress, recurSummary, childSatisfiedToday,
    refreshChildren, toggleChildSomeday, checkinChild, updateChildRecur
  }
}
