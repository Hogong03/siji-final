/**
 * 情景模拟 — AI 角色扮演与场景推演引擎
 *
 * 三种模拟模式：
 * 1. social — 社交沙盘：AI 扮演关系图谱中的人物进行对话演练
 * 2. planning — 规划推演：AI 扮演规划师，帮用户做项目/时间/目标规划推演
 * 3. relationship — 关系处理：AI 扮演冲突中的对方，演练沟通与冲突解决
 *
 * 每种模式关联不同的预设 Agent，自动切换系统提示词
 * 会话标记：conversations[].type = 'simulation'
 */

import { logger } from './logger.js'
import { getRelationById, getAllRelations, logInteraction } from './relations.js'
import {
  generateSimulationPrompt,
  generatePlanningPrompt,
  generateRelationshipPrompt,
  generateSimPromptByMode
} from './simulation-prompts.js'

// re-export 供外部统一从 simulation.js 导入
export {
  generateSimulationPrompt,
  generatePlanningPrompt,
  generateRelationshipPrompt,
  generateSimPromptByMode
}

const SIM_STORAGE_KEY = 'siji_simulations'

// ==================== 模式定义 ====================

/**
 * 三种情景模拟模式
 */
export const SIM_MODES = {
  social: {
    id: 'social',
    title: '社交沙盘',
    icon: '',
    iconName: 'chat-bubble',
    desc: 'AI 扮演你身边的人进行对话演练',
    // 3.0：场景 Agent 已模板化，演练统一由思迹助手执行；角色人格由模式 prompt 控制
    agentId: 'siji',
    agentName: '思迹助手',
    needsRelation: true,
    scenePlaceholder: '如：年终绩效面谈、表白、拒绝请求',
    goalPlaceholder: '如：争取加薪、体面分手、说服对方同意'
  },
  planning: {
    id: 'planning',
    title: '规划推演',
    icon: '',
    iconName: 'plan',
    desc: 'AI 扮演规划师，推演项目/目标/时间规划',
    agentId: 'siji',
    agentName: '思迹助手',
    needsRelation: false,
    scenePlaceholder: '如：3个月减重10斤、转行做产品经理、筹备婚礼',
    goalPlaceholder: '如：制定可执行的阶段性计划、识别风险点'
  },
  relationship: {
    id: 'relationship',
    title: '关系处理',
    icon: '',
    iconName: 'relation',
    desc: 'AI 扮演冲突中的对方，演练沟通策略',
    // 3.0：场景 Agent 已模板化，演练统一由思迹助手执行；角色人格由模式 prompt 控制
    agentId: 'siji',
    agentName: '思迹助手',
    needsRelation: true,
    scenePlaceholder: '如：同事甩锅、领导施压、朋友借钱不还',
    goalPlaceholder: '如：不伤和气地拒绝、让领导改变主意、维护边界'
  }
}

// ==================== 模拟会话管理 ====================

export function createSimulation(params) {
  const now = Date.now()
  const mode = params.mode || 'social'
  const relation = params.relationId ? getRelationById(params.relationId) : null
  const relationName = relation?.name || params.relationName || (mode === 'planning' ? '规划师' : '模拟对象')

  const simulation = {
    id: `sim_${now}_${Math.random().toString(36).slice(2, 8)}`,
    mode: mode,
    agent_id: (SIM_MODES[mode] || SIM_MODES.social).agentId,
    relation_id: params.relationId || '',
    relation_name: relationName,
    scene: params.scene || '日常对话',
    goal: params.goal || '',
    status: 'active',    // active | completed
    conversation_id: '',  // 关联的聊天会话 ID
    messages: [],
    report: null,        // 复盘报告
    created_at: now,
    completed_at: null
  }

  // 保存
  const all = getRawSimulations()
  all.push(simulation)
  persistSimulations(all)

  return simulation
}

/**
 * 更新模拟记录
 */
export function updateSimulation(simId, updates) {
  const all = getRawSimulations()
  const idx = all.findIndex(s => s.id === simId)
  if (idx < 0) return false
  Object.assign(all[idx], updates)
  persistSimulations(all)
  return true
}

/**
 * 根据 ID 获取模拟记录
 */
export function getSimulationById(simId) {
  const all = getRawSimulations()
  return all.find(s => s.id === simId) || null
}

/**
 * 保存复盘报告
 * 改动2：模拟结束时自动回写关系互动记录
 */
export function saveReport(simId, report) {
  const all = getRawSimulations()
  const idx = all.findIndex(s => s.id === simId)
  if (idx < 0) return false
  all[idx].report = report
  all[idx].status = 'completed'
  all[idx].completed_at = Date.now()
  persistSimulations(all)

  // 改动2：回写关系互动记录 — 模拟演练结果应反映到关系图谱
  const sim = all[idx]
  if (sim.relation_id) {
    try {
      const modeLabel = (SIM_MODES[sim.mode] || SIM_MODES.social).title
      logInteraction({
        relation_id: sim.relation_id,
        relation_name: sim.relation_name,
        scene: `情景模拟[${modeLabel}]：${sim.scene}`,
        content: `目标：${sim.goal || '未设定'}；模式：${sim.mode}`,
        result: report?.summary || report?.score || '模拟演练完成',
        emotion: report?.emotion || '',
        date: Date.now()
      })
      logger.log('[simulation] 回写关系互动记录:', sim.relation_name)
    } catch (e) {
      logger.warn('[simulation] 回写关系互动记录失败:', e)
    }
  }

  return true
}

/**
 * 获取所有模拟记录
 */
export function getAllSimulations() {
  try {
    const raw = uni.getStorageSync(SIM_STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw)
      .filter(s => s.is_deleted !== 1)
      .sort((a, b) => b.created_at - a.created_at)
  } catch {
    return []
  }
}

/**
 * 获取模拟统计
 */
export function getSimulationStats() {
  const all = getAllSimulations()
  return {
    total: all.length,
    active: all.filter(s => s.status === 'active').length,
    completed: all.filter(s => s.status === 'completed').length,
    byMode: {
      social: all.filter(s => (s.mode || 'social') === 'social').length,
      planning: all.filter(s => s.mode === 'planning').length,
      relationship: all.filter(s => s.mode === 'relationship').length
    },
    topRelations: getTopSimulatedRelations(all)
  }
}

function getTopSimulatedRelations(simulations) {
  const map = {}
  simulations.forEach(s => {
    if (s.relation_name) {
      map[s.relation_name] = (map[s.relation_name] || 0) + 1
    }
  })
  return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 3)
}

// ==================== 内部 ====================

/**
 * 删除模拟记录
 * @param {string} simId - 模拟记录 ID
 */
export function deleteSimulation(simId) {
  const all = getRawSimulations()
  const sim = all.find(s => s.id === simId)
  if (!sim) return false
  const filtered = all.filter(s => s.id !== simId)
  persistSimulations(filtered)
  // 同时删除关联的对话会话
  if (sim.conversation_id) {
    try {
      const raw = uni.getStorageSync('siji_conversations')
      const list = raw ? JSON.parse(raw) : []
      const newList = list.filter(c => c.id !== sim.conversation_id)
      if (newList.length !== list.length) {
        uni.setStorageSync('siji_conversations', JSON.stringify(newList))
      }
      // 如果删除的是当前活跃会话，切换到最后一个
      const activeId = uni.getStorageSync('siji_active_conversation')
      if (activeId === sim.conversation_id) {
        const newActiveId = newList.length > 0 ? newList[newList.length - 1].id : ''
        uni.setStorageSync('siji_active_conversation', newActiveId)
      }
    } catch (e) { /* 忽略存储错误 */ }
  }
  return true
}

function getRawSimulations() {
  try {
    return JSON.parse(uni.getStorageSync(SIM_STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function persistSimulations(list) {
  try {
    uni.setStorageSync(SIM_STORAGE_KEY, JSON.stringify(list))
  } catch { /* ignore */ }
}
