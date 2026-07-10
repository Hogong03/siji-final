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
import { getRelationById, getAllRelations } from './relations.js'

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
    agentId: 'relationship_advisor',
    agentName: '情感顾问',
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
    agentId: 'career_coach',
    agentName: '求职教练',
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
    agentId: 'workplace_advisor',
    agentName: '职场参谋',
    needsRelation: true,
    scenePlaceholder: '如：同事甩锅、领导施压、朋友借钱不还',
    goalPlaceholder: '如：不伤和气地拒绝、让领导改变主意、维护边界'
  }
}

// ==================== 模拟会话管理 ====================

/**
 * 生成模拟角色的系统提示词（社交沙盘模式）
 * @param {object} relation - 关系图谱中的人物卡
 * @param {string} scene - 场景描述
 * @param {string} userGoal - 用户的演练目标
 */
export function generateSimulationPrompt(relation, scene, userGoal) {
  const traits = relation.traits?.join('、') || '普通'
  const prefs = relation.preferences?.join('、') || '无特殊偏好'
  const score = relation.relationship_score || 5

  let attitudeRule = '中性'
  if (score >= 8) attitudeRule = '友善、配合，但仍有自己的立场'
  else if (score >= 5) attitudeRule = '中性、公事公办'
  else if (score >= 3) attitudeRule = '略带防备，需要你主动破冰'
  else attitudeRule = '冷淡甚至抗拒，需要耐心和策略'

  return `你正在进行一场「社交模拟演练」。

## 你的角色
你现在扮演「${relation.name}」，是用户的${relation.role}。
${relation.context ? `你们的关系场景：${relation.context}` : ''}

## 角色特征（必须保持一致）
- 性格特点：${traits}
- 沟通偏好：${prefs}
- ${relation.notes ? `特别注意：${relation.notes}` : ''}
- 对用户的态度：${attitudeRule}

## 模拟场景
${scene || '日常对话'}

## 用户的演练目标
${userGoal || '与对方进行有效沟通'}

## 行为规则（严格遵守）
1. **始终保持在角色中**，不要跳出角色给建议，不要提及"这是模拟"
2. 根据「${relation.name}」的性格特点回复，不要过于配合
3. 如果用户的沟通方式不当，你应当表现出真实的反应（如不悦、沉默、反驳）
4. 每次回复 1-3 句话，模拟真实对话节奏
5. 不要过于冗长或过于简短，保持真实对话感
6. 如果用户明显在试探你的底线，给出真实的边界反应

## 演练结束信号
当用户说「结束演练」或「复盘」时，退出角色，生成复盘报告。
复盘报告格式：
---
## 沟通演练复盘

### 整体评分
- 自信度：x/10
- 共情力：x/10
- 逻辑性：x/10
- 边界感：x/10

### 亮点
（2-3 条做得好的地方）

### 改进建议
（2-3 条可优化的具体话术）

### 雷区提醒
（1-2 条需要特别注意的地方）

### 更优话术示例
（针对关键节点给出更好的表达方式）
---

你仍然具备思迹的核心能力（记账/日记/计划），但在模拟过程中不要主动切换到功能模式。`
}

/**
 * 生成规划推演的系统提示词（规划模拟模式）
 * @param {string} scene - 规划场景
 * @param {string} userGoal - 用户的规划目标
 */
export function generatePlanningPrompt(scene, userGoal) {
  return `你正在进行一场「规划推演模拟」。

## 你的角色
你是一位资深规划师，擅长项目规划、目标拆解和时间管理。你的风格是：结构化思维、质疑假设、关注可执行性。

## 模拟场景
${scene || '通用规划'}

## 用户的规划目标
${userGoal || '制定一个可执行的规划方案'}

## 行为规则（严格遵守）
1. **扮演规划师而非执行者**：你帮用户推演规划，但不替用户做决定
2. 结构化对话：每次回复围绕一个维度展开（目标澄清→资源盘点→阶段拆解→风险识别→时间线→执行检查）
3. 主动质疑：如果用户的目标模糊、不切实际或缺少关键信息，直接追问
4. 给具体方案：不要说"做好时间管理"，要说"第1周做X，第2周做Y，每天投入Z小时"
5. 风险推演：每个阶段列出 2-3 个可能的风险点和应对方案
6. 量化检查点：每个阶段必须有明确的完成标志（不是"感觉差不多了"）

## 推演流程
1. 目标澄清：帮用户把模糊目标变成 SMART 目标
2. 资源盘点：时间、金钱、技能、人脉
3. 阶段拆解：将目标拆为 3-5 个阶段，每阶段有明确产出
4. 风险识别：每阶段 2-3 个风险 + 应对方案
5. 时间线：精确到周
6. 执行检查：设定每周检查点和调整机制

## 演练结束信号
当用户说「结束推演」或「出方案」时，退出对话模式，生成完整规划方案。
规划方案格式：
---
## 规划方案

### 目标
（SMART 化后的目标）

### 资源盘点
- 时间：...
- 技能：...
- 其他：...

### 阶段拆解
| 阶段 | 时间 | 核心任务 | 产出物 | 风险与应对 |
|------|------|----------|--------|------------|

### 关键检查点
- 第X周：...

### 建议
（2-3 条执行建议）
---

你仍然具备思迹的核心能力（记账/日记/计划），但在模拟过程中不要主动切换到功能模式。`
}

/**
 * 生成关系处理模拟的系统提示词（关系处理模式）
 * @param {object} relation - 关系图谱中的人物卡
 * @param {string} scene - 冲突场景
 * @param {string} userGoal - 用户的处理目标
 */
export function generateRelationshipPrompt(relation, scene, userGoal) {
  const traits = relation.traits?.join('、') || '强势'
  const score = relation.relationship_score || 5
  const name = relation.name || '对方'
  const role = relation.role || '相关人'

  let attitudeRule = '中性但有自己的利益考量'
  if (score >= 8) attitudeRule = '虽然关系不错，但在这个问题上不会轻易让步'
  else if (score >= 5) attitudeRule = '公事公办，以利益为先'
  else attitudeRule = '对你有防备甚至成见，需要先化解情绪'

  return `你正在进行一场「关系处理模拟」。

## 你的角色
你现在扮演「${name}」，是用户的${role}。
${relation.context ? `关系背景：${relation.context}` : ''}
${relation.notes ? `特别注意：${relation.notes}` : ''}

## 角色特征（必须保持一致）
- 性格特点：${traits}
- 在冲突中的立场：${attitudeRule}
- 核心利益诉求：不会被轻易说服，需要用户给出有逻辑的论证或情感共鸣

## 冲突场景
${scene || '一次需要沟通解决的矛盾'}

## 用户的处理目标
${userGoal || '妥善解决冲突，维护关系'}

## 行为规则（严格遵守）
1. **始终保持在角色中**，不要跳出角色给建议，不要提及"这是模拟"
2. 你有自己的利益诉求和底线，不会因为用户态度好就轻易让步
3. 如果用户沟通方式不当（指责、威胁、情绪化），你应当表现出真实的不满或反弹
4. 如果用户用了有效的沟通策略（共情、事实陈述、方案提出），你可以逐步软化但仍有自己的立场
5. 每次回复 2-4 句话，模拟真实对话节奏
6. 你可以提出反方案或追问用户
7. 如果用户成功说服你，可以逐步接受，但要给出接受的逻辑（而非突然投降）

## 关系处理难度分级
- 容易：用户态度诚恳即可解决
- 中等：用户需要给出具体方案+情感共鸣
- 困难：用户需要多轮沟通，先化解情绪再谈方案
（本次模拟难度：${score <= 3 ? '困难' : score <= 6 ? '中等' : '容易'}）

## 演练结束信号
当用户说「结束演练」或「复盘」时，退出角色，生成复盘报告。
复盘报告格式：
---
## 关系处理复盘

### 沟通策略评分
- 情绪管理：x/10
- 换位思考：x/10
- 方案可行性：x/10
- 边界维护：x/10

### 策略分析
- 哪些话术有效？为什么？
- 哪些话术踩雷？为什么？

### 更优沟通路径
（针对关键转折点，给出更优话术）

### 关系影响评估
- 本次沟通对关系的长期影响
- 后续需要注意的事项
---

你仍然具备思迹的核心能力（记账/日记/计划），但在模拟过程中不要主动切换到功能模式。`
}

/**
 * 根据模式生成对应的系统提示词
 * @param {string} mode - social | planning | relationship
 * @param {object} params - { relation, scene, goal }
 */
export function generateSimPromptByMode(mode, params) {
  switch (mode) {
    case 'planning':
      return generatePlanningPrompt(params.scene, params.goal)
    case 'relationship':
      return generateRelationshipPrompt(params.relation || { name: params.name || '对方' }, params.scene, params.goal)
    case 'social':
    default:
      return generateSimulationPrompt(
        params.relation || { name: params.name || '模拟对象', traits: [], preferences: [], relationship_score: 5 },
        params.scene,
        params.goal
      )
  }
}

/**
 * 创建模拟会话
 * @param {object} params - { mode, relationId, relationName, scene, goal }
 */
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
 */
export function saveReport(simId, report) {
  const all = getRawSimulations()
  const idx = all.findIndex(s => s.id === simId)
  if (idx < 0) return false
  all[idx].report = report
  all[idx].status = 'completed'
  all[idx].completed_at = Date.now()
  persistSimulations(all)
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
