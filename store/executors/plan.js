import { savePlan, getPlanList, getChildPlans, deletePlan, updateIndex, savePlanTemplate, buildChildrenSpecsFromLegacy, convertSubtasksToChildPlans, logPlanCheckIn, getPlanCheckInStats } from '@/utils/storage.js'
import { invalidatePromptCache } from '@/utils/ai/prompt-builder.js'
import { removePlanReminder } from '@/utils/reminder.js'
import { inferHolidayFromText } from '@/utils/holidays.js'

/**
 * Plan 相关 executor 工厂函数
 * v2.3 模型：计划不再包含子任务/阶段，子任务与阶段统一转换为子计划（递归）
 * @param {{ undoStack, cidCache, generateEntityId }} ctx 上下文
 */
export function createPlanExecutors(ctx) {
  /** 日期字段清洗：只保留 YYYY-MM-DD 或 YYYY-MM-DD HH:mm[:ss]，其余置空（防止 AI 填 "5天" 之类脏值） */
  function cleanDateField(v) {
    if (!v) return ''
    return /^\d{4}-\d{1,2}-\d{1,2}( \d{1,2}:\d{2}(:\d{2})?)?$/.test(v) ? v : ''
  }
  /** 循环类型清洗：'' | daily | weekly */
  function cleanRecurType(v) {
    return v === 'daily' || v === 'weekly' ? v : ''
  }
  /** 循环次数清洗：weekly 至少 1 次，其余恒为 1 */
  function cleanRecurCount(v, type) {
    if (type !== 'weekly') return 1
    const n = parseInt(v, 10)
    return Number.isFinite(n) && n > 0 ? n : 1
  }
  // ==================== 子计划持久化 ====================

  /** 阶段数生成：AI 只给 phase_count 时产出空阶段骨架（schema 约束 2-6） */
  function buildPhaseSpecs(phaseCount) {
    if (phaseCount == null) return []
    const n = parseInt(phaseCount, 10)
    if (!Number.isFinite(n) || n <= 0) return []
    const count = Math.min(Math.max(n, 2), 6)
    return Array.from({ length: count }, (_, i) => ({
      title: '第' + (i + 1) + '阶段',
      description: '',
      status: 0,
      priority: 2,
      estimated_time: '',
      due_date: '',
      deadline: '',
      children: []
    }))
  }

  /** 递归创建子计划（规格 → 计划记录） */
  function persistChildSpecs(specs, parentId) {
    const saved = []
    for (const spec of specs) {
      const now = Date.now()
      const child = {
        client_id: ctx.generateEntityId('plan'),
        title: String(spec.title || '').trim() || '子计划',
        description: spec.description || '',
        priority: spec.priority != null ? spec.priority : 2,
        status: spec.status != null ? spec.status : 1,
        tags: [],
        subtasks: [],
        phases: [],
        parent_id: parentId,
        deadline: spec.deadline || '',
        due_date: spec.due_date || '',
        estimated_time: spec.estimated_time || '',
        start_time: spec.start_time || '',
        end_time: spec.end_time || '',
        est_minutes: spec.est_minutes != null ? (Number(spec.est_minutes) || 0) : 0,
        recur_type: cleanRecurType(spec.recur_type),
        recur_count: cleanRecurCount(spec.recur_count, cleanRecurType(spec.recur_type)),
        executions: [],
        plan_count: 0,
        created_at: now,
        updated_at: now,
        is_deleted: 0
      }
      savePlan(child)
      updateIndex('plan', child)
      ctx.undoStack.value.push({ type: 'plan', clientId: child.client_id, action: 'create' })
      saved.push(child)
      if (spec.children && spec.children.length > 0) {
        child._children = persistChildSpecs(spec.children, child.client_id)
      }
    }
    return saved
  }

  // ==================== 创建操作 ====================

  /**
   * 模型没给时间时按标题/描述里的节日补日期（3.10.1 确定性兜底）
   * 反馈里「本地深度游三日（中秋国庆）」的时间字段全是空的 —— 提示词加固之外，这里再保一层
   * @returns {{ start: string, end: string, name: string } | null}
   */
  function inferDatesFromText(title, description) {
    return inferHolidayFromText([title, description].filter(Boolean).join(' '))
  }

  function execCreatePlan(p) {
    const now = Date.now()
    const holiday = inferDatesFromText(p.title, p.description)
    const plan = {
      client_id: ctx.generateEntityId('plan'),
      title: p.title || '新计划',
      description: p.description || '',
      priority: p.priority != null ? p.priority : 2,
      status: p.status != null ? p.status : 1,
      tags: Array.isArray(p.tags) ? p.tags : [],
      subtasks: [],
      phases: [],
      // 父计划ID — 支持计划嵌套
      parent_id: p.parent_id || '',
      // 精确到秒的时间（YYYY-MM-DD HH:mm:ss 格式）
      deadline: cleanDateField(p.deadline) || (holiday ? holiday.end : ''),           // 截止时间（精确到秒）
      due_date: cleanDateField(p.due_date || p.deadline) || (holiday ? holiday.end : ''),  // 兼容字段
      estimated_time: cleanDateField(p.estimated_time || p.plan_date) || (holiday ? holiday.start : ''),  // 预计开始时间（精确到秒）
      start_time: cleanDateField(p.start_time || p.estimated_time) || (holiday ? holiday.start : ''),  // 开始时间（精确到秒）
      end_time: cleanDateField(p.end_time || p.deadline) || (holiday ? holiday.end : ''),            // 结束时间（精确到秒）
      recur_type: cleanRecurType(p.recur_type),
      recur_count: cleanRecurCount(p.recur_count, cleanRecurType(p.recur_type)),
      plan_count: 1,
      executions: [],
      created_at: now,
      updated_at: now,
      is_deleted: 0
    }
    savePlan(plan)
    updateIndex('plan', plan)
    ctx.undoStack.value.push({ type: 'plan', clientId: plan.client_id, action: 'create' })

    // 子任务/阶段 → 子计划（新模型统一为子计划）
    let childSpecs = []
    if (Array.isArray(p.subtasks) && p.subtasks.length > 0) {
      childSpecs = buildChildrenSpecsFromLegacy({
        subtasks: p.subtasks,
        priority: plan.priority,
        estimated_time: plan.estimated_time,
        due_date: plan.due_date,
        deadline: plan.deadline
      })
    } else if (Array.isArray(p.phases) && p.phases.length > 0) {
      childSpecs = buildChildrenSpecsFromLegacy({ phases: p.phases })
    } else if (p.phase_count != null) {
      childSpecs = buildPhaseSpecs(p.phase_count)
    }
    const children = persistChildSpecs(childSpecs, plan.client_id)

    invalidatePromptCache()
    return {
      success: true,
      message: plan.parent_id ? '子计划已创建' : (children.length > 0 ? '计划已创建（含' + children.length + '个子计划）' : '计划已创建'),
      detail: {
        type: 'plan', id: plan.client_id,
        title: plan.title, description: plan.description,
        priority: plan.priority, tags: plan.tags,
        childCount: children.length,
        children: children.slice(0, 5),
        parent_id: plan.parent_id,
        deadline: plan.deadline,
        due_date: plan.due_date,
        estimated_time: plan.estimated_time,
        start_time: plan.start_time,
        end_time: plan.end_time,
        created_at: plan.created_at
      }
    }
  }

  function execUpdatePlan(p) {
    // 3.10.1：改计划时若仍没有任何时间、而标题/描述里提到节日，按节日补日期区间
    if (!p.deadline && !p.due_date && !p.start_time && !p.end_time && !p.estimated_time) {
      const found = getPlanList().find(x => x && x.client_id === (p.client_id || p.id))
      const title = p.title || (found && found.title) || ''
      const desc = p.description || (found && found.description) || ''
      const holiday = inferHolidayFromText(title + ' ' + desc)
      if (holiday) {
        p = Object.assign({}, p, {
          start_time: holiday.start,
          end_time: holiday.end,
          deadline: holiday.end,
          due_date: holiday.end
        })
      }
    }
    if (!p.client_id && !p.id) {
      return { success: false, message: '缺少计划ID', detail: null }
    }
    const clientId = p.client_id || p.id
    const list = getPlanList()
    const idx = list.findIndex(item => item.client_id === clientId)
    if (idx < 0) {
      return { success: false, message: '计划不存在', detail: null }
    }
    const old = list[idx]
    const updates = {}
    if (p.title != null) updates.title = p.title
    if (p.description != null) updates.description = p.description
    if (p.priority != null) updates.priority = p.priority
    if (p.status != null) updates.status = p.status
    if (Array.isArray(p.tags)) updates.tags = p.tags
    if (p.deadline != null) { updates.deadline = cleanDateField(p.deadline); updates.due_date = cleanDateField(p.deadline) }
    if (p.due_date != null) updates.due_date = cleanDateField(p.due_date)
    if (p.estimated_time != null) updates.estimated_time = cleanDateField(p.estimated_time)
    if (p.start_time != null) updates.start_time = cleanDateField(p.start_time)
    if (p.end_time != null) updates.end_time = cleanDateField(p.end_time)
    if (p.recur_type != null || p.recur_count != null) {
      const type = p.recur_type != null ? cleanRecurType(p.recur_type) : (old.recur_type || '')
      updates.recur_type = type
      updates.recur_count = cleanRecurCount(p.recur_count != null ? p.recur_count : (old.recur_count || 1), type)
    }
    if (p.parent_id != null) updates.parent_id = p.parent_id
    // 3.4 M3：冷藏（先放一放）只是标记 — 不删除、不改状态、不累计 plan_count
    if (p.frozen != null) updates.frozen_at = p.frozen ? Date.now() : null

    // 子任务/阶段 → 增量创建子计划（按标题去重，避免重复生成）
    let createdChildren = []
    if (Array.isArray(p.subtasks) || Array.isArray(p.phases)) {
      const specs = buildChildrenSpecsFromLegacy({
        subtasks: p.subtasks,
        phases: p.phases,
        priority: p.priority != null ? p.priority : old.priority,
        estimated_time: p.estimated_time || old.estimated_time || '',
        due_date: p.due_date || old.due_date || old.deadline || '',
        deadline: p.deadline || old.deadline || ''
      })
      const existing = getChildPlans(clientId)
      const existingTitles = new Set(existing.map(c => (c.title || '').trim()))
      const missing = specs.filter(s => !existingTitles.has(s.title))
      createdChildren = persistChildSpecs(missing, clientId)
    }

    const structuralUpdate = Object.keys(updates).some(k => k !== 'status' && k !== 'frozen_at' && k !== 'updated_at')
    const updated = { ...old, ...updates, plan_count: (old.plan_count || 0) + (structuralUpdate ? 1 : 0), updated_at: Date.now() }
    savePlan(updated)

    const changedFields = Object.keys(updates).filter(k => k !== 'updated_at')
    const fieldLabels = {
      title: '标题', description: '描述', priority: '优先级', status: '状态',
      tags: '标签', deadline: '截止日期', due_date: '截止日期',
      estimated_time: '预计时间', start_time: '开始时间', end_time: '结束时间',
      parent_id: '父计划',
      frozen_at: '冷藏状态'
    }
    const changedText = changedFields.map(k => fieldLabels[k] || k).join('、')

    invalidatePromptCache()
    return {
      success: true,
      message: createdChildren.length > 0
        ? '已更新计划（' + changedText + '，新增' + createdChildren.length + '个子计划）'
        : (changedText ? '已更新计划（' + changedText + '）' : '计划已更新'),
      detail: {
        type: 'plan', id: updated.client_id,
        title: updated.title, description: updated.description,
        priority: updated.priority, tags: updated.tags,
        childCount: createdChildren.length,
        children: createdChildren.slice(0, 5),
        deadline: updated.deadline,
        due_date: updated.due_date,
        estimated_time: updated.estimated_time,
        updatedFields: changedFields,
        created_at: updated.created_at
      }
    }
  }

  /** 更新子计划（原 update_plan_phase 语义：phase_id 即子计划 client_id，兼容按标题匹配） */
  function execUpdatePlanPhase(p) {
    if (!p.client_id && !p.phase_id && !p.id) {
      return { success: false, message: '缺少计划ID', detail: null }
    }
    const parentId = p.client_id
    const childId = p.phase_id || p.id
    const list = getPlanList()
    let child = list.find(pl => pl.client_id === childId)
    if (!child && parentId) {
      child = getChildPlans(parentId).find(c => c.client_id === childId || (c.title || '') === String(childId))
    }
    if (!child) {
      return { success: false, message: '子计划不存在', detail: null }
    }

    const updates = {}
    if (p.title != null) updates.title = p.title
    if (p.description != null) updates.description = p.description
    if (p.start_date != null) { updates.estimated_time = p.start_date; updates.start_time = p.start_date }
    if (p.end_date != null) { updates.due_date = p.end_date; updates.deadline = p.end_date; updates.end_time = p.end_date }
    if (p.status != null) updates.status = p.status
    if (Array.isArray(p.milestones) && p.milestones.length > 0) {
      const msText = p.milestones.filter(m => m && typeof m === 'string').map((m, i) => '里程碑' + (i + 1) + '：' + m).join('\n')
      if (msText) {
        const baseDesc = p.description != null ? p.description : (child.description || '')
        updates.description = baseDesc ? baseDesc + '\n' + msText : msText
      }
    }
    const structuralUpdate = Object.keys(updates).some(k => k !== 'status' && k !== 'updated_at')
    const updated = { ...child, ...updates, plan_count: (child.plan_count || 0) + (structuralUpdate ? 1 : 0), updated_at: Date.now() }
    savePlan(updated)

    // 子任务 → 下一级子计划（增量创建）
    let grandchildren = []
    if (Array.isArray(p.subtasks)) {
      const specs = convertSubtasksToChildPlans(p.subtasks, {
        priority: updated.priority,
        estimated_time: updated.estimated_time || '',
        due_date: updated.due_date || '',
        deadline: updated.deadline || ''
      })
      const existing = getChildPlans(child.client_id)
      const existingTitles = new Set(existing.map(c => (c.title || '').trim()))
      grandchildren = persistChildSpecs(specs.filter(s => !existingTitles.has(s.title)), child.client_id)
    }

    invalidatePromptCache()
    return {
      success: true,
      message: '子计划「' + updated.title + '」已更新',
      detail: {
        type: 'plan', id: updated.client_id,
        title: updated.title, description: updated.description,
        priority: updated.priority,
        childCount: grandchildren.length,
        children: grandchildren.slice(0, 5),
        due_date: updated.due_date,
        estimated_time: updated.estimated_time,
        updatedFields: Object.keys(updates),
        created_at: updated.created_at
      }
    }
  }

  function execUpdatePlanSubtask(p) {
    if (!p.client_id && !p.id) {
      return { success: false, message: '缺少计划ID', detail: null }
    }
    const clientId = p.client_id || p.id
    const list = getPlanList()
    const idx = list.findIndex(item => item.client_id === clientId)
    if (idx < 0) {
      return { success: false, message: '计划不存在', detail: null }
    }
    const plan = list[idx]
    const subtaskId = parseInt(p.subtask_id)
    const subtask = plan.subtasks?.find(s => s.id === subtaskId)
    if (!subtask) {
      return { success: false, message: '子任务不存在', detail: null }
    }
    subtask.done = p.done === true
    plan.plan_count = (plan.plan_count || 0) + 1
    plan.updated_at = Date.now()
    savePlan(plan)

    const doneCount = plan.subtasks.filter(s => s.done).length
    invalidatePromptCache()
    return {
      success: true,
      message: '子任务「' + subtask.title + '」已标记为' + (p.done ? '完成' : '未完成'),
      detail: {
        type: 'plan', id: plan.client_id,
        title: plan.title,
        subtaskCount: plan.subtasks.length,
        subtaskDoneCount: doneCount,
        subtasks: plan.subtasks,
        updatedFields: ['subtasks']
      }
    }
  }

  /** 3.4.1 B：计划打卡（轻记录，同日幂等；不改状态/plan_count/executions） */
  function execLogPlanCheckIn(p) {
    if (!p.client_id && !p.id) {
      return { success: false, message: '缺少计划ID', detail: null }
    }
    const clientId = p.client_id || p.id
    const list = getPlanList()
    const plan = list.find(item => item.client_id === clientId)
    if (!plan) {
      return { success: false, message: '计划不存在', detail: null }
    }
    if (plan.frozen_at) {
      return { success: false, message: '计划已冷藏（先放一放），暂不打卡', detail: null }
    }
    if (plan.status === 2) {
      return { success: false, message: '计划已完成，无需打卡', detail: null }
    }
    const noteText = typeof p.note === 'string' ? p.note.trim() : ''
    const before = getPlanCheckInStats(plan)
    if (before.todayDone) {
      const rec = logPlanCheckIn(clientId, noteText)
      const st = rec ? getPlanCheckInStats(rec) : before
      return {
        success: true,
        message: noteText ? '已更新今天的打卡描述' : '今天已打过卡，不重复记录',
        detail: { type: 'plan', id: clientId, totalDays: st.days, todayDone: true, note: noteText }
      }
    }
    const record = logPlanCheckIn(clientId, noteText)
    const after = record ? getPlanCheckInStats(record) : before
    return {
      success: true,
      message: noteText ? '已记录「今天做了」，描述：' + noteText : '已记录「今天做了」',
      detail: { type: 'plan', id: clientId, totalDays: after.days, todayDone: after.todayDone, note: noteText }
  }
    }

  function execDeletePlan(p) {
    if (!p.client_id && !p.id) {
      return { success: false, message: '缺少计划ID', detail: null }
    }
    const clientId = p.client_id || p.id
    const children = getChildPlans(clientId)
    deletePlan(clientId)
    removePlanReminder(clientId)
    children.forEach(c => removePlanReminder(c.client_id))
    invalidatePromptCache()
    return {
      success: true,
      message: children.length > 0 ? '已删除计划（含' + children.length + '个子计划）' : '已删除计划',
      detail: { type: 'plan', id: clientId, deleted: true }
    }
  }

  // ==================== 查询操作 ====================

  function execQueryPlan(p) {
    let list = getPlanList()
    if (p.status === 'active') list = list.filter(pl => pl.status === 1)
    else if (p.status === 'completed') list = list.filter(pl => pl.status === 2)
    const sorted = [...list].sort((a, b) => {
      const ad = a.due_date || a.deadline || ''
      const bd = b.due_date || b.deadline || ''
      if (ad && bd && ad !== bd) return ad.localeCompare(bd)
      if (ad && !bd) return -1
      if (!ad && bd) return 1
      return (b.created_at || 0) - (a.created_at || 0)
    })
    const items = sorted.slice(0, 5)
    let message = '共 ' + list.length + ' 个计划' + (p.status === 'active' ? '（进行中）' : p.status === 'completed' ? '（已完成）' : '')
    if (list.length > items.length) message += '，展示前 5 个'
    return {
      success: true,
      message,
      detail: { type: 'query_plan', count: list.length, items }
    }
  }

  // ==================== 计划模板 ====================

  function execCreatePlanTemplate(p) {
    const now = Date.now()
    const tpl = {
      client_id: ctx.generateEntityId('tpl'),
      name: p.name || '自定义模板',
      icon: p.icon || '📋',
      color: p.color || '#18181B',
      description: p.description || '',
      plan_data: {
        priority: p.priority || 2,
        subtasks: Array.isArray(p.subtasks) ? p.subtasks.map(s => ({
          title: typeof s === 'string' ? s : (s.title || s)
        })) : []
      },
      created_at: now,
      updated_at: now,
      is_deleted: 0
    }
    savePlanTemplate(tpl)
    invalidatePromptCache()
    return {
      success: true,
      message: '模板「' + tpl.name + '」已保存',
      detail: { type: 'plan_template', id: tpl.client_id, name: tpl.name, subtaskCount: tpl.plan_data.subtasks.length }
    }
  }

  return { execCreatePlan, execUpdatePlan, execUpdatePlanPhase, execUpdatePlanSubtask, execLogPlanCheckIn, execDeletePlan, execQueryPlan, execCreatePlanTemplate }
}
