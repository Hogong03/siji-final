/**
 * Agent Store — 管理 AI Agent 配置
 *
 * Agent = 人设/系统提示词（性格、语气、行为规则）
 * 厂商/模型由全局 AI 配置统一管理，Agent 不绑定
 *
 * 内置 Agent：
 *   - siji（思迹助手）：默认生活助手，使用 api.js 内置系统提示词
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { asyncSetStorage, asyncSetStorageJSON } from '@/utils/store-helpers.js'
import { BUILTIN_AGENT_SKILLS } from '@/utils/ai/skills.js'

const STORAGE_KEY = 'siji_agents'
const ACTIVE_KEY = 'siji_active_agent'

/** 内置思迹 Agent */
const BUILTIN_SIJI = {
  id: 'siji',
  name: '思迹助手',
  avatar: '🤖',
  icon: '/static/icons/agent-siji.png',
  description: '默认生活助手，帮你记录生活、管理财务、制定计划',
  systemPrompt: '',  // 空字符串表示使用 api.js 内置的 buildSystemPrompt()
  skills: BUILTIN_AGENT_SKILLS['siji'].skills,
  builtin: true,
  createdAt: 0
}

/** 预设情境顾问 Agent */
const PRESET_AGENTS = [
  {
    id: 'workplace_advisor',
    name: '职场参谋',
    avatar: '💼',
    icon: '/static/icons/agent-workplace.png',
    description: '帮你分析职场关系、沟通策略、职业发展抉择',
    builtin: true,
    createdAt: 1,
    skills: BUILTIN_AGENT_SKILLS['workplace_advisor'].skills,
    systemPrompt: `你是一位资深职场顾问，拥有 15 年企业管理和人才培养经验。你的沟通风格是：直接但不冒犯、理性共情、注重可操作性。

## 你的核心能力
1. 职场关系分析：解读同事/上级行为背后的动机，提供应对策略
2. 沟通话术优化：帮用户设计具体的对话方案，包括开场白、关键论点、让步底线
3. 职业决策：用「机会成本-风险-时机」三维框架分析跳槽/转行/晋升等决策
4. 向上管理：帮用户理解上级诉求，设计汇报策略和预期管理方案

## 行为准则
- 先理解再建议：通过提问确认用户处境的关键细节，不急于给方案
- 给具体话术：不要说"好好沟通"，要给出"你可以这样开场：..."的具体表达
- 考虑多方利益：分析时必须考虑用户、对方、公司三方的利益诉求
- 风险预警：如果建议有潜在风险（如得罪人、影响考核），必须明确提示
- 避免站队：在职场冲突中保持中立分析，不帮用户「打败」谁，而是帮用户找到最优解

## 决策辅助
当用户面临职业决策时，引导用户考虑：
- 这件事 3 个月后会有什么影响？1 年呢？
- 最坏情况是什么？你能承受吗？
- 有没有第三选择？

你仍然具备思迹的核心能力（记账/记录/计划），当用户需要记录时正常执行。你也可以调用工具查询账单数据、总结记录周报、分析消费趋势，帮用户从数据中发现职场模式。

## 数据洞察
- 用户谈工作压力/加班时，可查记录与账单佐证（通勤、应酬、加班后消费），给出有据可依的建议
- 用户复盘绩效/晋升时，调用 summarize_diaries 生成工作记录摘要，帮用户梳理业绩证据链`
  },
  {
    id: 'relationship_advisor',
    name: '情感顾问',
    avatar: '💝',
    icon: '/static/icons/agent-relationship.png',
    description: '帮你理清感情困惑、改善亲密关系、处理人际矛盾',
    builtin: true,
    createdAt: 2,
    skills: BUILTIN_AGENT_SKILLS['relationship_advisor'].skills,
    systemPrompt: `你是一位温暖的情感顾问，融合心理学（依恋理论、非暴力沟通）和东方人际智慧。你的风格：温柔但不敷衍、有洞察力、尊重用户自主权。

## 你的核心能力
1. 情感解读：帮用户理解自己和对方情绪背后的真实需求
2. 沟通修复：用「观察-感受-需求-请求」非暴力沟通框架设计对话
3. 关系诊断：从信任度、沟通质量、共同目标三维度评估关系健康度
4. 边界设定：帮用户识别和建立健康的情感边界

## 行为准则
- 不评判：不给人贴标签（"他就是渣男""你太敏感了"），聚焦行为和模式
- 不替用户做决定："分手""原谅"等重大决定只帮分析，不替用户选择
- 看到双方：即使一方有明显问题，也尝试理解另一方的处境和感受
- 安全第一：如果涉及家庭暴力或精神虐待迹象，明确建议寻求专业帮助
- 具体可行：建议必须具体到"今晚可以试着说..."，而非"多沟通"

## 沟通原则
- 当用户情绪激动时，先用 1-2 句话接住情绪，再进入分析
- 用"你觉得...""有没有可能..."代替"你应该..."
- 允许沉默：有时候用户需要时间消化，不要急于填满对话

你仍然具备思迹的核心能力（记账/记录/计划），当用户需要记录时正常执行。你也可以制定关系改善计划、总结情感记录、分析互动模式，帮用户看见不易察觉的关系规律。

## 数据洞察
- 用户情绪低落/关系冲突时，可查记录中的心情数据找触发点，给出有据可依的沟通建议
- 用户提到纪念日/重要日期时，主动提出用计划功能设置提醒`
  },


export const useAgentStore = defineStore('agent', () => {
  // ==================== State ====================
  const agents = ref([BUILTIN_SIJI, ...PRESET_AGENTS])
  const activeAgentId = ref('siji')

  // ==================== Getters ====================
  const activeAgent = computed(() => agents.value.find(a => a.id === activeAgentId.value) || BUILTIN_SIJI)
  const customAgents = computed(() => agents.value.filter(a => !a.builtin))
  const agentCount = computed(() => agents.value.length)

  /**
   * 获取 Agent 的系统提示词
   * 返回空字符串表示使用默认思迹人设
   */
  function getAgentSystemPrompt(agentId) {
    const agent = agents.value.find(a => a.id === agentId) || BUILTIN_SIJI
    return agent.systemPrompt || ''
  }

  // ==================== Actions ====================

  /** 创建自定义 Agent */
  function createAgent(data) {
    const agent = {
      id: `agent_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: data.name || '新 Agent',
      avatar: data.avatar || '🤖',
      description: data.description || '',
      systemPrompt: data.systemPrompt || '',
      skills: data.skills || ['memory'],
      builtin: false,
      createdAt: Date.now()
    }
    agents.value = [...agents.value, agent]
    persist()
    return agent
  }

  /** 更新 Agent */
  function updateAgent(agentId, data) {
    const idx = agents.value.findIndex(a => a.id === agentId)
    if (idx < 0) return
    if (agents.value[idx].builtin) return false  // 内置 Agent 只读，禁止修改
    agents.value[idx] = { ...agents.value[idx], ...data, id: agentId, builtin: agents.value[idx].builtin }
    agents.value = [...agents.value]
    persist()
  }

  /** 获取 Agent 的技能列表 */
  function getAgentSkills(agentId) {
    const agent = agents.value.find(a => a.id === agentId)
    if (!agent) return ['memory']
    return agent.skills || ['memory']
  }

  /** 删除自定义 Agent */
  function deleteAgent(agentId) {
    const agent = agents.value.find(a => a.id === agentId)
    if (!agent || agent.builtin) return false
    agents.value = agents.value.filter(a => a.id !== agentId)
    if (activeAgentId.value === agentId) {
      activeAgentId.value = 'siji'
      asyncSetStorage(ACTIVE_KEY, 'siji')
    }
    persist()
    return true
  }

  /** 切换活跃 Agent */
  function setActiveAgent(agentId) {
    if (agents.value.find(a => a.id === agentId)) {
      activeAgentId.value = agentId
      asyncSetStorage(ACTIVE_KEY, agentId)
    }
  }

  /** 持久化 */
  function persist() {
    const custom = agents.value.filter(a => !a.builtin)
    asyncSetStorageJSON(STORAGE_KEY, custom)
  }

  /** 从 Storage 恢复 */
  function restoreFromStorage() {
    try {
      const raw = uni.getStorageSync(STORAGE_KEY)
      const custom = raw ? JSON.parse(raw) : []
      agents.value = [BUILTIN_SIJI, ...PRESET_AGENTS, ...custom]
    } catch {
      agents.value = [BUILTIN_SIJI, ...PRESET_AGENTS]
    }
    activeAgentId.value = uni.getStorageSync(ACTIVE_KEY) || 'siji'
    if (!agents.value.find(a => a.id === activeAgentId.value)) {
      activeAgentId.value = 'siji'
    }
  }

  return {
    // state
    agents, activeAgentId,
    // getters
    activeAgent, customAgents, agentCount,
    // actions
    getAgentSystemPrompt, createAgent, updateAgent, deleteAgent,
    setActiveAgent, restoreFromStorage, persist,
    getAgentSkills,
  }
})
