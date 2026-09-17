/**
 * 计划详情表单（3.5.7：从 pages/plan/detail.vue 抽出）
 *
 * 职责：表单状态 + 选项常量 + 退出快照比对 + 存量计划换入 + 整体落库 + 冷藏/删除
 * 不依赖组件实例（不用生命周期），可直接在 node 环境跑测试
 * 子计划落库由外部注入的 saveChildren 负责（utils/plan-child.js 的 saveChildPlans）
 */
import { ref, computed } from 'vue'
import {
  getPlanList, savePlan, deletePlan, getChildPlans,
  buildChildrenSpecsFromLegacy, updateIndex, setPlanFrozen
} from '@/utils/storage.js'
import { generateEntityId } from '@/utils/uuid.js'
import { getPlanReminder, setPlanReminder, removePlanReminder } from '@/utils/reminder.js'
import { invalidatePromptCache } from '@/utils/ai/prompt-builder.js'
import { parseDateTime, combineDateTime } from '@/utils/datetime.js'
import { recurTypeOf, recurCountOf } from '@/utils/plan-recur.js'
import { buildTimeStrip } from '@/utils/plan-time.js'
import { buildChildPlanForm } from '@/utils/plan-child.js'
import { safeNavigateBack } from '@/utils/nav-helper.js'

/** 空表单（新建时的初值） */
export function emptyPlanForm() {
  return {
    title: '',
    description: '',
    priority: 0,
    status: 0,
    tags: [],
    due_date: '',
    due_time: '',
    estimated_time: '',
    estimated_time_value: '',
    start_time: '',
    end_time: '',
    parent_id: '',
    childPlans: [],
    ai_advice: '',
    recur_type: '',
    recur_count: 1
  }
}

export function usePlanForm({ saveChildren } = {}) {
  const isNew = ref(true)
  const planId = ref('')
  const originalCreatedAt = ref(null)
  const saved = ref(false)
  const migratedLegacy = ref(false)
  const initialSnapshot = ref('')
  const showTimeEditor = ref(false) // 3.2 M4：时间区折叠（默认收起）
  const form = ref(emptyPlanForm())

  // 提醒设置
  const reminderEnabled = ref(false)
  const reminderAdvanceMin = ref(30)
  const reminderCustomDate = ref('')
  const reminderCustomTimeValue = ref('')
  const repeatType = ref('none') // none / daily / weekly / weekdays

  // 3.5.0：自身是否为循环任务（字段在 form 上，便于新计划直接选择）
  const selfRecurType = computed(() => recurTypeOf({ recur_type: form.value.recur_type }))
  const selfRecurCount = computed(() => recurCountOf({ recur_type: form.value.recur_type, recur_count: form.value.recur_count }))

  /** 父计划信息 */
  const parentPlan = computed(() => {
    if (!form.value.parent_id) return null
    return getPlanList().find(p => p.client_id === form.value.parent_id) || null
  })

  /** 时间刻度预览数据（3.2 M4） */
  const timeStrip = computed(() => {
    const start = (form.value.start_time || form.value.estimated_time || '').trim()
    const end = (form.value.end_time || form.value.due_date || '').trim()
    return buildTimeStrip(
      {
        start_time: start,
        end_time: end,
        estimated_time: (form.value.estimated_time || '').trim(),
        due_date: (form.value.due_date || '').trim()
      },
      form.value.childPlans || []
    )
  })

  const timeSummary = computed(() => {
    const dates = []
    const start = (form.value.start_time || form.value.estimated_time || '').trim().slice(0, 10)
    const end = (form.value.end_time || form.value.due_date || '').trim().slice(0, 10)
    if (start) dates.push(start)
    if (end && end !== start) dates.push(end)
    if (dates.length === 0) return '未设置时间'
    return dates.join(' ~ ')
  })

  /** 循环任务提示文案 */
  function recurHintText() {
    const t = form.value.recur_type
    if (t === 'daily') return '每天自动出现在「今日行动」，打卡一次算当天完成，明天继续；到所属阶段截止日自动结束。'
    if (t === 'weekly') return '每周任意 ' + (Number(form.value.recur_count) || 1) + ' 天打卡即达标，本周达标后不再提醒；到所属阶段截止日自动结束。'
    return '循环任务适合「每天/每周固定动作」：做完打卡、不标记完成，不产生逾期压力。'
  }

  /** 生成表单快照（剔除展示字段 _subCount），用于退出时判断是否有未保存修改 */
  function snapshotForm() {
    const f = JSON.parse(JSON.stringify(form.value))
    if (Array.isArray(f.childPlans)) {
      f.childPlans.forEach(ch => { delete ch._subCount })
    }
    return JSON.stringify({
      f,
      reminderEnabled: reminderEnabled.value,
      reminderAdvanceMin: reminderAdvanceMin.value,
      repeatType: repeatType.value,
      reminderCustomDate: reminderCustomDate.value,
      reminderCustomTimeValue: reminderCustomTimeValue.value
    })
  }

  function markSaved() {
    saved.value = true
  }

  /** 记录当前状态为「未修改基线」 */
  function markSnapshot() {
    initialSnapshot.value = snapshotForm()
  }

  /** 提醒配置换入表单 */
  function loadReminder(id) {
    const rem = getPlanReminder(id)
    if (rem) {
      reminderEnabled.value = rem.enabled !== false
      reminderAdvanceMin.value = rem.advanceMin ?? 30
      repeatType.value = rem.repeatType || 'none'
      if (rem.customTime) {
        const parts = parseDateTime(rem.customTime)
        reminderCustomDate.value = parts.date
        reminderCustomTimeValue.value = parts.time ? parts.time.substring(0, 5) : ''
      }
    } else {
      reminderEnabled.value = false
    }
  }

  /** 存量计划 → 表单（含子计划与旧数据迁移，不含快照与打卡区） */
  function applyStoredItem(item) {
    if (!item) return
    originalCreatedAt.value = item.created_at || null
    const dueParts = parseDateTime(item.due_date || item.deadline || '')
    const estParts = parseDateTime(item.estimated_time || '')
    form.value = {
      title: item.title || '',
      description: item.description || '',
      priority: item.priority ?? 0,
      status: item.status ?? 0,
      tags: Array.isArray(item.tags) ? item.tags : [],
      due_date: dueParts.date,
      due_time: dueParts.time,
      estimated_time: estParts.date,
      estimated_time_value: estParts.time,
      start_time: item.start_time || '',
      end_time: item.end_time || '',
      parent_id: item.parent_id || '',
      frozen_at: item.frozen_at || null,
      childPlans: getChildPlans(item.client_id),
      ai_advice: item.ai_advice || '',
      recur_type: item.recur_type || '',
      recur_count: item.recur_count || 1
    }
    // 旧数据迁移：子任务/阶段 → 子计划（新模型统一为子计划，保存时落库）
    if (form.value.childPlans.length === 0) {
      const legacySpecs = buildChildrenSpecsFromLegacy(item)
      if (legacySpecs.length > 0) {
        form.value.childPlans = legacySpecs.map(spec => buildChildPlanForm(spec, item.priority ?? 2))
        migratedLegacy.value = true
      }
    }
    loadReminder(item.client_id)
  }

  /** 整体落库当前表单（保存 / 完成一步共用） */
  function persistForm() {
    const plan = {
      client_id: isNew.value ? generateEntityId('plan') : planId.value,
      title: form.value.title.trim(),
      description: form.value.description.trim(),
      priority: form.value.priority,
      status: form.value.status,
      tags: [...form.value.tags],
      due_date: combineDateTime(form.value.due_date, form.value.due_time),
      deadline: combineDateTime(form.value.due_date, form.value.due_time),
      estimated_time: combineDateTime(form.value.estimated_time, form.value.estimated_time_value),
      // 3.10.0 修「时间改不动」：原来旧值优先（form.start_time || 新值），
      // 计划一旦有过 start_time，用户在界面上改开始时间就永远不生效 —— 改成编辑值优先、旧值兜底
      start_time: combineDateTime(form.value.estimated_time, form.value.estimated_time_value) || form.value.start_time,
      end_time: combineDateTime(form.value.due_date, form.value.due_time) || form.value.end_time,
      parent_id: form.value.parent_id || '',
      recur_type: form.value.recur_type || '',
      recur_count: form.value.recur_type === 'weekly' ? (Number(form.value.recur_count) || 1) : 1,
      ai_advice: form.value.ai_advice,
      created_at: isNew.value ? Date.now() : (originalCreatedAt.value || Date.now()),
      updated_at: Date.now(),
      is_deleted: 0
    }
    // 旧数据已迁移为子计划时，清理父计划上的历史子任务/阶段字段
    if (migratedLegacy.value) {
      plan.subtasks = []
      plan.phases = []
    }

    savePlan(plan)
    updateIndex('plan', plan)
    if (typeof saveChildren === 'function') saveChildren(form.value.childPlans, plan.client_id)
    // 3.5.0：主计划手动收尾（状态→已完成）时，其循环子计划一并收尾
    if (plan.status === 2) {
      ;(form.value.childPlans || []).forEach(ch => {
        if (ch.status !== 2 && recurTypeOf(ch)) {
          const child = { ...ch, status: 2, parent_id: plan.client_id }
          delete child._subCount
          delete child.childPlans
          savePlan(child)
        }
      })
    }

    if (reminderEnabled.value && (form.value.due_date || reminderCustomDate.value)) {
      const customTime = reminderCustomDate.value
        ? combineDateTime(reminderCustomDate.value, reminderCustomTimeValue.value ? reminderCustomTimeValue.value + ':00' : '')
        : ''
      setPlanReminder(plan.client_id, {
        enabled: true,
        advanceMin: reminderAdvanceMin.value,
        customTime,
        repeatType: repeatType.value
      })
    } else {
      removePlanReminder(plan.client_id)
    }

    saved.value = true
    initialSnapshot.value = snapshotForm()
    return plan
  }

  /** 3.4 M3：冷藏/恢复（先放一放）— 只标记 frozen_at；同步暂停/恢复本地提醒（保留提醒配置） */
  function toggleFrozen() {
    if (isNew.value || !planId.value) return
    const frozen = !form.value.frozen_at
    const rec = setPlanFrozen(planId.value, frozen)
    if (!rec) return
    form.value.frozen_at = rec.frozen_at || null
    const rem = getPlanReminder(planId.value)
    if (rem) {
      setPlanReminder(planId.value, { ...rem, enabled: !frozen })
    }
    invalidatePromptCache()
    saved.value = true
    uni.showToast({ title: frozen ? '已先放一放' : '已恢复计划', icon: 'none' })
  }

  function handleSave() {
    if (!form.value.title.trim()) {
      uni.showToast({ title: '请输入计划标题', icon: 'none' })
      return
    }
    persistForm()
    uni.showToast({ title: '已保存', icon: 'success' })
    setTimeout(() => {
      safeNavigateBack({ fallback: '/pages/functions/index' })
    }, 800)
  }

  function handleDelete() {
    uni.showModal({
      title: '删除计划',
      content: '确定要删除这个计划吗？',
      success(res) {
        if (res.confirm) {
          deletePlan(planId.value)
          removePlanReminder(planId.value)
          saved.value = true
          uni.showToast({ title: '已删除', icon: 'success' })
          setTimeout(() => {
            safeNavigateBack({ fallback: '/pages/functions/index' })
          }, 800)
        }
      }
    })
  }

  return {
    isNew, planId, originalCreatedAt, saved, migratedLegacy, initialSnapshot, showTimeEditor,
    form, selfRecurType, selfRecurCount, parentPlan, timeStrip, timeSummary,
    reminderEnabled, reminderAdvanceMin, reminderCustomDate, reminderCustomTimeValue, repeatType,
    snapshotForm, markSaved, markSnapshot, loadReminder, applyStoredItem, persistForm,
    toggleFrozen, handleSave, handleDelete, recurHintText
  }
}
