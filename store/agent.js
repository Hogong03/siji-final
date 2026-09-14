/**
 * Agent Store — 管理 AI Agent 配置
 *
 * Agent = 人设/系统提示词（性格、语气、行为规则）
 * 厂商/模型由全局 AI 配置统一管理，Agent 不绑定
 *
 * 内置 Agent：仅 siji（思迹助手）；场景人设全部模板化（心理咨询师/情感顾问，见 agent-templates.js）
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { asyncSetStorage, asyncSetStorageJSON } from '@/utils/store-helpers.js'

const STORAGE_KEY = 'siji_agents'
const ACTIVE_KEY = 'siji_active_agent'

/** 内置思迹 Agent */
const BUILTIN_SIJI = {
  id: 'siji',
  name: '思迹助手',
  avatar: '🤖',
  icon: '/static/icons/agent-siji-v2.png',
  description: '默认生活助手，帮你记录生活、管理财务、制定计划',
  systemPrompt: '',  // 空字符串表示使用 api.js 内置的 buildSystemPrompt()
  starts: ['记一笔最近的账单', '帮我写今天的记录', '把我想法拆成下一步'],
  builtin: true,
  createdAt: 0
}

/** Agent Store（siji 内置 + 自定义模板 Agent） */
export const useAgentStore = defineStore('agent', () => {
  // ==================== State ====================
  const agents = ref([BUILTIN_SIJI])
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
      starts: Array.isArray(data.starts) ? data.starts.slice(0, 3) : [],
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
      agents.value = [BUILTIN_SIJI, ...custom]
    } catch {
      agents.value = [BUILTIN_SIJI]
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
  }
})
