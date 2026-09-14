/**
 * 最小行动「下一步」单卡（3.5.7：从 pages/plan/detail.vue 抽出，3.3 A 起的功能）
 *
 * 职责：执行日志 → 下一步候选 → 一键完成 / 循环打卡 / 文案
 * 打卡连续与回执由 usePlanCheckin 注入，落库由 usePlanForm 注入
 */
import { ref, computed } from 'vue'
import { getChildPlans, logPlanCheckIn } from '@/utils/storage.js'
import { recurTypeOf, recurCountOf, weeklyDoneOf, weekDayCells } from '@/utils/plan-recur.js'

export function usePlanNextStep({
  form, isNew, planId, selfRecurType,
  selfCheckins, childSatisfiedToday, persistForm, snapshotForm, initialSnapshot,
  planStreak, feedbackAfter
}) {
  const planExecLogs = ref([])

  const nextStepItem = computed(() => {
    if (isNew.value || form.value.status === 2 || form.value.frozen_at) return null
    const kids = form.value.childPlans || []
    // 循环子计划今天已满足的不再当作「下一步」
    const pending = kids.find(c => c.status !== 2 && !childSatisfiedToday(c))
    if (pending) {
      const rt = recurTypeOf(pending)
      return { ...pending, _isRecur: rt, _recurCount: recurCountOf(pending) }
    }
    // 自身为循环任务：打卡卡承担主入口，不显示「标记完成」
    if (kids.length === 0 && !selfRecurType.value) {
      return { _self: true, client_id: planId.value, title: form.value.title, est_minutes: 0 }
    }
    return null
  })

  const lastExecText = computed(() => {
    const done = (planExecLogs.value || []).filter(l => l.action === 'done')
    if (done.length === 0) return ''
    return fmtPlanTime(done[0].at)
  })

  /** 3.5.2：周任务周历（本周七天打卡格子，仅 weekly 循环任务展示） */
  const weekCells = computed(() => weekDayCells({ checkins: selfCheckins.value }))

  function fmtPlanTime(ts) {
    if (!ts) return ''
    const d = new Date(ts)
    if (isNaN(d.getTime())) return ''
    const pad = n => String(n).padStart(2, '0')
    return pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
  }

  /** 执行日志换入（自身 + 直接子计划，倒序，供「上次执行」展示） */
  function loadExecLogs(item) {
    const childExecs = getChildPlans(planId.value).reduce((acc, c) => {
      if (Array.isArray(c.executions)) acc.push(...c.executions)
      return acc
    }, [])
    planExecLogs.value = [...(Array.isArray(item && item.executions) ? item.executions : []), ...childExecs]
      .sort((a, b) => (b.at || 0) - (a.at || 0))
  }

  /** 标记完成下一步：本地改状态后整体落库（storage.savePlan 自动写 done_at + executions） */
  function completeNextStep() {
    const target = nextStepItem.value
    if (!target) return
    if (target._isRecur && target.client_id) {
      // 循环子计划：今天做了 → 打卡轻记录，不置完成
      const before = planStreak(target.client_id)
      const rec = logPlanCheckIn(target.client_id, '')
      if (!rec) {
        uni.showToast({ title: '当前状态暂不能打卡', icon: 'none' })
        return
      }
      form.value.childPlans = getChildPlans(planId.value)
      initialSnapshot.value = snapshotForm()
      feedbackAfter(rec, before, '今天做了，已记录')
      return
    }
    if (target._self) {
      form.value.status = 2
    } else if (target.client_id) {
      const c = form.value.childPlans.find(x => x.client_id === target.client_id)
      if (c) c.status = 2
    }
    persistForm()
    planExecLogs.value.unshift({ action: 'done', at: Date.now() })
    uni.showToast({ title: '已完成这一步', icon: 'success' })
  }

  /** 循环子计划下一步按钮文案 */
  function nextStepButtonText(item) {
    if (item && item._isRecur) {
      return item._isRecur === 'weekly' ? '今天打卡' : '今日打卡'
    }
    return '标记完成'
  }

  /** 循环子计划下一步卡片副文案 */
  function nextStepMetaText(item) {
    if (!item) return ''
    if (item._isRecur === 'daily') return '每天循环 · 约 ' + (item.est_minutes || 15) + ' 分钟，打卡即算今天完成'
    if (item._isRecur === 'weekly') return '每周 ' + item._recurCount + ' 次 · 本周已做 ' + weeklyDoneOf(item) + ' 次，今天有空就打卡'
    return item.est_minutes ? '约 ' + item.est_minutes + ' 分钟' : (lastExecText.value ? '上次执行 ' + lastExecText.value : '5-15 分钟就能完成')
  }

  return {
    planExecLogs, nextStepItem, lastExecText, weekCells,
    loadExecLogs, completeNextStep, nextStepButtonText, nextStepMetaText, fmtPlanTime
  }
}
