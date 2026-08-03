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
  const { execCreatePlan, execUpdatePlan, execUpdatePlanSubtask, execDeletePlan, execQueryPlan, execCreatePlanTemplate } = createPlanExecutors(ctx)
  const { execUpdateProfile, execSmartUpdateProfile, execGetProfile, execClearProfile, execToggleProfile } = createProfileExecutors(ctx)
  const { execCreateRelation, execUpdateRelation, execDeleteRelation, execQueryRelation, execLogInteraction, execQueryInteraction } = createRelationExecutors(ctx)
  const { execCreateDecision, execUpdateDecision, execReviewDecision, execQueryDecision, execAnalyzeDecisions } = createDecisionExecutors(ctx)
  const { execStartSimulation, execEndSimulation } = createSimulationExecutors(ctx)

  // ==================== AI 自动执行分发器 ====================
  function executeAction(action) {
    if (!action || !action.type || action.type === 'none') {
      return { success: false, message: '无需执行', detail: null }
    }

    const { type, payload } = action
    const p = payload || {}

    try {
      if (type === 'undo_last') return execUndo()
      if (type === 'multi') return { success: false, message: '复合意图请用 executeActions', detail: null }

      switch (type) {
        case 'create_diary':       return execCreateDiary(p)
        case 'create_bill':        return execCreateBill(p)
        case 'create_plan':        return execCreatePlan(p)
        case 'update_plan':        return execUpdatePlan(p)
        case 'update_plan_subtask': return execUpdatePlanSubtask(p)
        case 'delete_plan':        return execDeletePlan(p)
        case 'update_bill':        return execUpdateBill(p)
        case 'delete_bill':        return execDeleteBill(p)
        case 'update_diary':       return execUpdateDiary(p)
        case 'delete_diary':       return execDeleteDiary(p)
        case 'create_plan_template': return execCreatePlanTemplate(p)
        case 'query_diary':        return execQueryDiary(p)
        case 'summarize_diaries':   return execSummarizeDiaries(p)
        case 'query_combined':      return execQueryCombined(p)
        case 'query_bill':         return execQueryBill(p)
        case 'query_plan':         return execQueryPlan(p)
        case 'query_stat':         return execQueryStat(p)
        case 'update_profile':     return execUpdateProfile(p)
        case 'smart_update_profile': return execSmartUpdateProfile(p)
        case 'get_profile':        return execGetProfile(p)
        case 'clear_profile':      return execClearProfile(p)
        case 'toggle_profile':     return execToggleProfile(p)
        // ===== 关系图谱 =====
        case 'create_relation':    return execCreateRelation(p)
        case 'update_relation':    return execUpdateRelation(p)
        case 'delete_relation':    return execDeleteRelation(p)
        case 'query_relation':     return execQueryRelation(p)
        case 'log_interaction':    return execLogInteraction(p)
        case 'query_interaction':  return execQueryInteraction(p)
        // ===== 决策日志 =====
        case 'create_decision':    return execCreateDecision(p)
        case 'update_decision':    return execUpdateDecision(p)
        case 'review_decision':    return execReviewDecision(p)
        case 'query_decision':     return execQueryDecision(p)
        case 'analyze_decisions':  return execAnalyzeDecisions(p)
        // ===== 社交沙盘 =====
        case 'start_simulation':   return execStartSimulation(p)
        case 'end_simulation':     return execEndSimulation(p)
        default:                   return { success: false, message: '未知操作类型', detail: null }
      }
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
    const plan = {
      client_id: generateEntityId('plan'),
      title: tpl.name || '新计划',
      description: tpl.description || '',
      priority: tpl.plan_data?.priority || 2,
      status: 1,
      tags: Array.isArray(tpl.plan_data?.tags) ? tpl.plan_data.tags : [],
      subtasks: (tpl.plan_data?.subtasks || []).map((s, i) => ({
        id: i + 1,
        title: s.title || s,
        done: false
      })),
      deadline: '',
      created_at: now,
      updated_at: now,
      is_deleted: 0
    }
    savePlan(plan)
    updateIndex('plan', plan)
    undoStack.value.push({ type: 'plan', clientId: plan.client_id, action: 'create' })
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
    executeAction, executeActions,
    updateBill, updateDiary, updatePlan,
    createPlanFromTemplate, execCreatePlanTemplate,
    getUndoCount,
    rebuildIndex, exportJson, exportCsv,
  }
})
