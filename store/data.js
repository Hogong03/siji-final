/**
 * 数据操作 Store — AI 自动执行、撤销机制、就地编辑、CRUD
 *
 * 执行器按领域拆分为 store/executors/{domain}.js 模块
 * 本文件仅做分发、撤销栈、cidCache、公共 API
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { logger } from '@/utils/logger.js'
import { generateEntityId } from '@/utils/uuid.js'
import { savePlan, getPlanList, updateIndex, rebuildIndex, exportJson, exportCsv, savePlanTemplate } from '@/utils/storage.js'
import { asyncSetStorageJSON } from '@/utils/store-helpers.js'

// ==================== 导入各领域 executor 工厂 ====================
import { createDiaryExecutors } from './executors/diary.js'
import { createBillExecutors } from './executors/bill.js'
import { createPlanExecutors } from './executors/plan.js'
import { createProfileExecutors } from './executors/profile.js'
import { createRelationExecutors } from './executors/relation.js'
import { createDecisionExecutors } from './executors/decision.js'
import { createSimulationExecutors } from './executors/simulation.js'
import { createFeedbackExecutors } from './executors/feedback.js'
import { createAgentExecutors } from './executors/agent.js'
import { createGlimmerExecutors } from './executors/glimmer.js'

export const useDataStore = defineStore('data', () => {
  // ==================== 撤销栈 ====================
  const undoStack = ref([])

  // ==================== clientId → storageKey 缓存 ====================
  const cidCache = { bill: {}, diary: {}, plan: {} }

  function _cacheCid(type, clientId, storageKey) {
    if (clientId && storageKey) cidCache[type][clientId] = storageKey
  }

  function _findStorageKeyByCid(type, clientId) {
    if (!clientId) return null
    if (cidCache[type][clientId]) return cidCache[type][clientId]
    const prefix = type === 'bill' ? 'bill_' : type === 'diary' ? 'diary_' : 'plan_'
    const allKeys = uni.getStorageInfoSync().keys || []
    for (const key of allKeys) {
      if (!key.startsWith(prefix)) continue
      const list = JSON.parse(uni.getStorageSync(key) || '[]')
      if (list.some(item => item.client_id === clientId)) {
        cidCache[type][clientId] = key
        return key
      }
    }
    return null
  }

  // ==================== 创建各领域 executor ====================
  const ctx = { undoStack, cidCache, generateEntityId, _cacheCid, _findStorageKeyByCid, logger }
  const { execCreateDiary, execUpdateDiary, execDeleteDiary, execQueryDiary, execSummarizeDiaries, execQueryCombined } = createDiaryExecutors(ctx)
  const { execCreateBill, execUpdateBill, execDeleteBill, execQueryBill, execQueryStat } = createBillExecutors(ctx)
  const { execCreatePlan, execUpdatePlan, execUpdatePlanPhase, execUpdatePlanSubtask, execLogPlanCheckIn, execDeletePlan, execQueryPlan, execCreatePlanTemplate } = createPlanExecutors(ctx)
  const { execUpdateProfile, execSmartUpdateProfile, execGetProfile, execClearProfile, execToggleProfile } = createProfileExecutors(ctx)
  const { execCreateRelation, execUpdateRelation, execDeleteRelation, execQueryRelation, execLogInteraction, execQueryInteraction } = createRelationExecutors(ctx)
  const { execCreateDecision, execUpdateDecision, execReviewDecision, execQueryDecision, execAnalyzeDecisions } = createDecisionExecutors(ctx)
  const { execStartSimulation, execEndSimulation } = createSimulationExecutors(ctx)
  const { execCreateFeedback, execUpdateFeedback, execDeleteFeedback, execQueryFeedback, execQueryFeedbackStats } = createFeedbackExecutors(ctx)
  const { execCreateAgent } = createAgentExecutors()
  const { execCreateGlimmer, execQueryGlimmers, execDeleteGlimmer } = createGlimmerExecutors()

  // ==================== AI 自动执行分发器（Map 路由）====================
  const ACTION_MAP = {
    create_diary:         execCreateDiary,
    create_bill:          execCreateBill,
    create_plan:          execCreatePlan,
    create_plan_phases:   execCreatePlan,
    update_plan:          execUpdatePlan,
    update_plan_phase:    execUpdatePlanPhase,
    update_plan_subtask:  execUpdatePlanSubtask,
    log_plan_checkin:     execLogPlanCheckIn,
    delete_plan:          execDeletePlan,
    update_bill:          execUpdateBill,
    delete_bill:          execDeleteBill,
    update_diary:         execUpdateDiary,
    delete_diary:         execDeleteDiary,
    create_plan_template: execCreatePlanTemplate,
    query_diary:          execQueryDiary,
    summarize_diaries:    execSummarizeDiaries,
    query_combined:       execQueryCombined,
    query_bill:           execQueryBill,
    query_plan:           execQueryPlan,
    query_stat:           execQueryStat,
    update_profile:       execUpdateProfile,
    smart_update_profile: execSmartUpdateProfile,
    get_profile:          execGetProfile,
    clear_profile:        execClearProfile,
    toggle_profile:       execToggleProfile,
    create_relation:      execCreateRelation,
    update_relation:      execUpdateRelation,
    delete_relation:      execDeleteRelation,
    query_relation:       execQueryRelation,
    log_interaction:      execLogInteraction,
    query_interaction:    execQueryInteraction,
    create_decision:      execCreateDecision,
    update_decision:      execUpdateDecision,
    review_decision:      execReviewDecision,
    query_decision:       execQueryDecision,
    analyze_decisions:    execAnalyzeDecisions,
    start_simulation:     execStartSimulation,
    end_simulation:       execEndSimulation,
    // Feedback
    create_feedback:      execCreateFeedback,
    update_feedback:      execUpdateFeedback,
    delete_feedback:      execDeleteFeedback,
    query_feedback:       execQueryFeedback,
    query_feedback_stats: execQueryFeedbackStats,
    // 微光本（3.4 M2）
    create_glimmer:       execCreateGlimmer,
    query_glimmers:       execQueryGlimmers,
    delete_glimmer:       execDeleteGlimmer,
    create_agent:         execCreateAgent,
  }

  /**
   * action 类型白名单校验（3.7.2）
   *
   * 模型会幻觉出不存在的动作类型（2026-09-16 实测返回过 type: 'batch'，它想表达复合意图）。
   * 拿假类型去 executeAction 只会得到「未知操作类型」，而且上层会把它当成「执行了但失败」，
   * 兜底与提示都接管不了 —— 于是那句「都记好了」既没落库也没人纠正。
   * 校验放在这里：ACTION_MAP 是唯一事实来源，别在别处再抄一份类型清单。
   * @param {string} type
   * @returns {boolean}
   */
  function isKnownActionType(type) {
    if (!type || type === 'none') return false
    if (type === 'undo_last' || type === 'multi') return true
    return Object.prototype.hasOwnProperty.call(ACTION_MAP, type)
  }

  function executeAction(action) {
    if (!action || !action.type || action.type === 'none') {
      return { success: false, message: '无需执行', detail: null }
    }

    const { type, payload } = action

    try {
      if (type === 'undo_last') return execUndo()
      if (type === 'multi') return { success: false, message: '复合意图请用 executeActions', detail: null }

      const handler = ACTION_MAP[type]
      if (handler) return handler(payload || {})
      return { success: false, message: '未知操作类型', detail: null }
    } catch (e) {
      return { success: false, message: `执行失败: ${e.message}`, detail: null }
    }
  }

  /** 执行复合意图 — 依次执行多个 action */
  function executeActions(actions) {
    if (!Array.isArray(actions) || actions.length === 0) {
      return { results: [], allSuccess: false, message: '无操作' }
    }
    try {
      const results = actions.map(a => executeAction(a))
      const allSuccess = results.every(r => r.success)
      const msgs = results.filter(r => r.success && r.message !== '无需执行').map(r => r.message)
      return {
        results,
        allSuccess,
        message: msgs.join('；'),
        detail: results.map(r => r.detail).filter(Boolean)
      }
    } catch (e) {
      logger.error('[executeActions] Fatal:', e.message)
      return { results: [], allSuccess: false, message: `批量执行失败: ${e.message}`, detail: null }
    }
  }

  // ==================== 撤销 ====================
  function execUndo() {
    if (undoStack.value.length === 0) {
      return { success: false, message: '没有可撤销的操作', detail: null }
    }

    const last = undoStack.value.pop()

    if (last.type === 'diary') {
      const now = new Date()
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const rawList = JSON.parse(uni.getStorageSync(`diary_${month}`) || '[]')
      const idx = rawList.findIndex(d => d.client_id === last.clientId)
      if (idx >= 0) {
        rawList[idx].is_deleted = 1
        rawList[idx].updated_at = Date.now()
        asyncSetStorageJSON(`diary_${month}`, rawList)
        return { success: true, message: '已撤销记录', detail: { type: 'undo', originalType: 'diary' } }
      }
    } else if (last.type === 'bill') {
      const month = last.month
      const rawList = JSON.parse(uni.getStorageSync(`bill_${month}`) || '[]')
      const idx = rawList.findIndex(b => b.client_id === last.clientId)
      if (idx >= 0) {
        rawList[idx].is_deleted = 1
        rawList[idx].updated_at = Date.now()
        asyncSetStorageJSON(`bill_${month}`, rawList)
        return { success: true, message: '已撤销记账', detail: { type: 'undo', originalType: 'bill' } }
      }
    } else if (last.type === 'plan') {
      const rawList = JSON.parse(uni.getStorageSync('plan_all') || '[]')
      const idx = rawList.findIndex(p => p.client_id === last.clientId)
      if (idx >= 0) {
        rawList[idx].is_deleted = 1
        rawList[idx].updated_at = Date.now()
        asyncSetStorageJSON('plan_all', rawList)
        return { success: true, message: '已撤销计划', detail: { type: 'undo', originalType: 'plan' } }
      }
    }

    return { success: false, message: '撤销失败：找不到原记录', detail: null }
  }

  function getUndoCount() {
    return undoStack.value.length
  }

  // ==================== 计划模板 ====================
  function createPlanFromTemplate(tpl) {
    const now = Date.now()
    const data = (tpl && tpl.plan_data) || {}
    const base = new Date()
    base.setHours(0, 0, 0, 0)
    const pad = n => String(n).padStart(2, '0')
    const fmtDate = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
    const offsetDate = off => {
      if (off == null) return ''
      const d = new Date(base.getTime())
      d.setDate(d.getDate() + (Number(off) || 0))
      return fmtDate(d)
    }
    // 3.5.0：模板可带相对天数（创建日=第 0 天），落库时换算成具体日期
    const rootStart = data.start_offset_days != null ? offsetDate(data.start_offset_days) : ''
    const rootEnd = data.deadline_offset_days != null
      ? offsetDate(data.deadline_offset_days)
      : (data.end_offset_days != null ? offsetDate(data.end_offset_days) : '')
    const plan = {
      client_id: generateEntityId('plan'),
      title: (tpl && tpl.name) || '新计划',
      description: (tpl && tpl.description) || '',
      priority: Math.min(2, Math.max(0, data.priority ?? 2)),
      status: 1,
      tags: Array.isArray(data.tags) ? data.tags : [],
      subtasks: [],
      phases: [],
      deadline: rootEnd,
      due_date: rootEnd,
      start_time: rootStart,
      estimated_time: rootStart,
      end_time: rootEnd,
      created_at: now,
      updated_at: now,
      is_deleted: 0
    }
    savePlan(plan)
    updateIndex('plan', plan)
    undoStack.value.push({ type: 'plan', clientId: plan.client_id, action: 'create' })

    // 模板子任务 → 子计划（新模型：递归两层+，子任务字段透传时长/循环/日期偏移）
    const persistSpecs = (specs, parentId, win) => {
      ;(Array.isArray(specs) ? specs : []).forEach(spec => {
        if (!spec) return
        const title = String(spec.title || spec.name || '').trim() || '子计划'
        const start = spec.start_offset_days != null
          ? offsetDate(spec.start_offset_days)
          : (spec.start_time || win.start || '')
        const end = spec.end_offset_days != null
          ? offsetDate(spec.end_offset_days)
          : (spec.end_time || spec.due_date || spec.deadline || win.end || '')
        const isWeekly = spec.recur_type === 'weekly'
        const child = {
          client_id: generateEntityId('plan'),
          title,
          description: spec.description || '',
          priority: spec.priority != null ? Math.min(2, Math.max(0, spec.priority)) : plan.priority,
          status: spec.done === true ? 2 : (spec.status != null ? spec.status : 0),
          tags: [],
          subtasks: [],
          phases: [],
          parent_id: parentId,
          deadline: end,
          due_date: end,
          estimated_time: start,
          start_time: start,
          end_time: end,
          est_minutes: spec.est_minutes != null ? (Number(spec.est_minutes) || 0) : 0,
          recur_type: spec.recur_type === 'daily' || isWeekly ? spec.recur_type : '',
          recur_count: isWeekly ? Math.max(1, Number(spec.recur_count) || 1) : 1,
          created_at: now,
          updated_at: now,
          is_deleted: 0
        }
        savePlan(child)
        updateIndex('plan', child)
        undoStack.value.push({ type: 'plan', clientId: child.client_id, action: 'create' })
        if (Array.isArray(spec.children) && spec.children.length > 0) {
          persistSpecs(spec.children, child.client_id, { start, end })
        }
      })
    }
    persistSpecs(data.subtasks, plan.client_id, { start: rootStart, end: rootEnd })
    return plan
  }
  // ==================== 就地编辑（公共 API）====================
  function updateBill(clientId, updates, month) {
    const m = month || (() => {
      const now = new Date()
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    })()
    const rawList = JSON.parse(uni.getStorageSync(`bill_${m}`) || '[]')
    const rawIdx = rawList.findIndex(b => b.client_id === clientId)
    if (rawIdx >= 0) {
      rawList[rawIdx] = { ...rawList[rawIdx], ...updates, updated_at: Date.now() }
      asyncSetStorageJSON(`bill_${m}`, rawList)
      return true
    }
    const cachedKey = _findStorageKeyByCid('bill', clientId)
    const keysToSearch = cachedKey ? [cachedKey] : (uni.getStorageInfoSync().keys || []).filter(k => k.startsWith('bill_'))
    for (const key of keysToSearch) {
      const list = JSON.parse(uni.getStorageSync(key) || '[]')
      const idx = list.findIndex(b => b.client_id === clientId)
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...updates, updated_at: Date.now() }
        asyncSetStorageJSON(key, list)
        _cacheCid('bill', clientId, key)
        return true
      }
    }
    logger.warn('[updateBill] 未找到账单:', clientId)
    return false
  }

  function updateDiary(clientId, updates, month) {
    const m = month || (() => {
      const now = new Date()
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    })()
    const rawList = JSON.parse(uni.getStorageSync(`diary_${m}`) || '[]')
    const rawIdx = rawList.findIndex(d => d.client_id === clientId)
    if (rawIdx >= 0) {
      rawList[rawIdx] = { ...rawList[rawIdx], ...updates, updated_at: Date.now() }
      asyncSetStorageJSON(`diary_${m}`, rawList)
      return true
    }
    const cachedKey = _findStorageKeyByCid('diary', clientId)
    const keysToSearch = cachedKey ? [cachedKey] : (uni.getStorageInfoSync().keys || []).filter(k => k.startsWith('diary_'))
    for (const key of keysToSearch) {
      const list = JSON.parse(uni.getStorageSync(key) || '[]')
      const idx = list.findIndex(d => d.client_id === clientId)
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...updates, updated_at: Date.now() }
        asyncSetStorageJSON(key, list)
        _cacheCid('diary', clientId, key)
        return true
      }
    }
    logger.warn('[updateDiary] 未找到日记:', clientId)
    return false
  }

  function updatePlan(clientId, updates) {
    const list = getPlanList()
    const idx = list.findIndex(p => p.client_id === clientId)
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...updates, updated_at: Date.now() }
      const rawList = JSON.parse(uni.getStorageSync('plan_all') || '[]')
      const rawIdx = rawList.findIndex(p => p.client_id === clientId)
      if (rawIdx >= 0) {
        rawList[rawIdx] = list[idx]
        asyncSetStorageJSON('plan_all', rawList)
      }
    }
  }

  return {
    executeAction, executeActions, isKnownActionType,
    updateBill, updateDiary, updatePlan,
    createPlanFromTemplate, execCreatePlanTemplate,
    getUndoCount,
    rebuildIndex, exportJson, exportCsv,
  }
})
