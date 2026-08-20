import { savePlan, getPlanList, updateIndex, savePlanTemplate } from '@/utils/storage.js'
import { asyncSetStorageJSON } from '@/utils/store-helpers.js'
import { invalidatePromptCache } from '@/utils/ai/prompt-builder.js'

/**
 * Plan 相关 executor 工厂函数
 * @param {{ undoStack, cidCache, generateEntityId }} ctx 上下文
 */
export function createPlanExecutors(ctx) {
  // ==================== 创建操作 ====================

  // 阶段数生成：AI 只给 phase_count 时产出空阶段骨架（schema 约束 2-6）
  function buildPhases(phaseCount) {
    if (phaseCount == null) return []
    const n = parseInt(phaseCount, 10)
    if (!Number.isFinite(n) || n <= 0) return []
    const count = Math.min(Math.max(n, 2), 6)
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      title: `第${i + 1}阶段`,
      description: '',
      start_date: '',
      end_date: '',
      milestones: [],
      subtasks: []
    }))
  }
  function execCreatePlan(p) {
    const now = Date.now()
    const plan = {
      client_id: ctx.generateEntityId('plan'),
      title: p.title || '新计划',
      description: p.description || '',
      priority: p.priority != null ? p.priority : 2,
      status: p.status != null ? p.status : 1,
      tags: Array.isArray(p.tags) ? p.tags : [],
      subtasks: Array.isArray(p.subtasks) ? p.subtasks.map((s, i) => ({
        id: i + 1,
        title: s.title || s,
        done: false
      })) : [],
      phases: Array.isArray(p.phases) ? p.phases.map((ph, i) => ({
        id: ph.id || i + 1,
        title: ph.title || `第${i + 1}阶段`,
        description: ph.description || '',
        start_date: ph.start_date || '',
        end_date: ph.end_date || '',
        milestones: Array.isArray(ph.milestones) ? ph.milestones.filter(m => m) : [],
        subtasks: Array.isArray(ph.subtasks) ? ph.subtasks.map((s, j) => ({
          id: s.id || j + 1,
          title: typeof s === 'string' ? s : (s.title || s || ''),
          done: false
        })) : []
      })) : buildPhases(p.phase_count),
      // 父计划ID — 支持计划嵌套
      parent_id: p.parent_id || '',
      // 精确到秒的时间（YYYY-MM-DD HH:mm:ss 格式）
      deadline: p.deadline || '',           // 截止时间（精确到秒）
      due_date: p.due_date || p.deadline || '',  // 兼容字段
      estimated_time: p.estimated_time || p.plan_date || '',  // 预计开始时间（精确到秒）
      start_time: p.start_time || p.estimated_time || '',  // 开始时间（精确到秒）
      end_time: p.end_time || p.deadline || '',            // 结束时间（精确到秒）
      created_at: now,
      updated_at: now,
      is_deleted: 0
    }
    savePlan(plan)
    updateIndex('plan', plan)
    ctx.undoStack.value.push({ type: 'plan', clientId: plan.client_id, action: 'create' })
    invalidatePromptCache()
    return {
      success: true,
      message: plan.parent_id ? '子计划已创建' : '计划已创建',
      detail: {
        type: 'plan', id: plan.client_id,
        title: plan.title, description: plan.description,
        priority: plan.priority, tags: plan.tags,
        subtaskCount: plan.subtasks.length,
        subtasks: plan.subtasks,
        phaseCount: plan.phases.length,
        phases: plan.phases,
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
    if (p.deadline != null) { updates.deadline = p.deadline; updates.due_date = p.deadline }
    if (p.due_date != null) updates.due_date = p.due_date
    if (p.estimated_time != null) updates.estimated_time = p.estimated_time
    if (p.start_time != null) updates.start_time = p.start_time
    if (p.end_time != null) updates.end_time = p.end_time
    if (p.parent_id != null) updates.parent_id = p.parent_id
    if (Array.isArray(p.subtasks)) updates.subtasks = p.subtasks
    if (Array.isArray(p.phases)) updates.phases = p.phases

    const updated = { ...old, ...updates, updated_at: Date.now() }
    savePlan(updated)

    const changedFields = Object.keys(updates).filter(k => k !== 'updated_at')
    const fieldLabels = {
      title: '标题', description: '描述', priority: '优先级', status: '状态',
      tags: '标签', deadline: '截止日期', due_date: '截止日期',
      estimated_time: '预计时间', subtasks: '子任务'
    }
    const changedText = changedFields.map(k => fieldLabels[k] || k).join('、')

    invalidatePromptCache()
    return {
      success: true,
      message: changedText ? `已更新计划（${changedText}）` : '计划已更新',
      detail: {
        type: 'plan', id: updated.client_id,
        title: updated.title, description: updated.description,
        priority: updated.priority, tags: updated.tags,
        subtaskCount: updated.subtasks.length,
        subtasks: updated.subtasks,
        deadline: updated.deadline,
        due_date: updated.due_date,
        estimated_time: updated.estimated_time,
        updatedFields: changedFields,
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
    plan.updated_at = Date.now()
    savePlan(plan)

    const doneCount = plan.subtasks.filter(s => s.done).length
    invalidatePromptCache()
    return {
      success: true,
      message: `子任务「${subtask.title}」已标记为${p.done ? '完成' : '未完成'}`,
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

  function execDeletePlan(p) {
    if (!p.client_id && !p.id) {
      return { success: false, message: '缺少计划ID', detail: null }
    }
    const clientId = p.client_id || p.id
    const rawList = JSON.parse(uni.getStorageSync('plan_all') || '[]')
    const idx = rawList.findIndex(p => p.client_id === clientId)
    if (idx < 0) {
      return { success: false, message: '计划不存在', detail: null }
    }
    rawList[idx].is_deleted = 1
    rawList[idx].updated_at = Date.now()
    asyncSetStorageJSON('plan_all', rawList)
    invalidatePromptCache()
    return {
      success: true,
      message: '已删除计划',
      detail: { type: 'plan', id: clientId, deleted: true }
    }
  }

  // ==================== 查询操作 ====================

  function execQueryPlan(p) {
    let list = getPlanList()
    if (p.status === 'active') list = list.filter(pl => pl.status === 1)
    else if (p.status === 'completed') list = list.filter(pl => pl.status === 2)
    return {
      success: true,
      message: `共 ${list.length} 个计划${p.status === 'active' ? '（进行中）' : p.status === 'completed' ? '（已完成）' : ''}`,
      detail: { type: 'query_plan', count: list.length, items: list.slice(0, 5) }
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
      message: `模板「${tpl.name}」已保存`,
      detail: { type: 'plan_template', id: tpl.client_id, name: tpl.name, subtaskCount: tpl.plan_data.subtasks.length }
    }
  }

  return { execCreatePlan, execUpdatePlan, execUpdatePlanSubtask, execDeletePlan, execQueryPlan, execCreatePlanTemplate }
}
