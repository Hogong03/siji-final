/**
 * 思迹 全局状态管理 (Pinia) — 聚合入口
 *
 * 拆分为 5 个子 store：device / aiConfig / chat / theme / data
 * 本文件聚合所有子 store，导出 useAppStore 保持向后兼容
 *
 * 关键：使用 storeToRefs 保持响应性，方法直接透传
 */
import { defineStore } from 'pinia'
import { storeToRefs } from 'pinia'
import { logger } from '@/utils/logger.js'
import { useDeviceStore } from './device.js'
import { useAiConfigStore } from './aiConfig.js'
import { useChatStore } from './chat.js'
import { useDataStore } from './data.js'
import { useAgentStore } from './agent.js'

export const useAppStore = defineStore('app', () => {
  const device = useDeviceStore()
  const aiConfig = useAiConfigStore()
  const chat = useChatStore()
  const data = useDataStore()
  const agent = useAgentStore()

  // 解构响应式状态（保持 ref/computed 的响应性）
  const {
    deviceId, registered, isOnline,
  } = storeToRefs(device)

  const {
    providerKeys, aiProvider, aiModel,
    hasApiKey, currentProviderName, modelLabel, modelName, aiConfig: aiConfigRef,
  } = storeToRefs(aiConfig)

  const {
    currentMode, conversationId, messages, isStreaming,
    modeLabel, conversations, activeConversationId, activeConversation, conversationCount,
  } = storeToRefs(chat)

  const {
    agents, activeAgentId, activeAgent, customAgents, agentCount,
  } = storeToRefs(agent)

  /**
   * 从 Storage 恢复关键配置 — 启动时同步执行，不阻塞首屏
   * 调用时机：App.vue onLaunch
   */
  function restoreCriticalFromStorage() {
    device.setDeviceId()
    aiConfig.restoreFromStorage()
    chat.restoreHistory()
    // 如果没有会话，自动创建一个
    if (chat.conversations.length === 0) {
      chat.createConversation()
    }
  }

  /**
   * 延迟恢复非关键配置 — 首屏渲染完成后执行
   */
  function restoreNonCriticalFromStorage() {
    agent.restoreFromStorage()
    logger.log('[思迹] Non-critical storage restored')
  }

  /**
   * 从 Storage 恢复所有配置（兼容旧调用）
   */
  function restoreFromStorage() {
    restoreCriticalFromStorage()
    restoreNonCriticalFromStorage()
  }

  return {
    // ==================== 设备 & 注册 ====================
    deviceId, registered, isOnline,
    setDeviceId: device.setDeviceId,
    setRegistered: device.setRegistered,
    setOnline: device.setOnline,

    // ==================== AI 配置 ====================
    providerKeys, aiProvider, aiModel,
    hasApiKey, currentProviderName, modelLabel, modelName,
    aiConfig: aiConfigRef,
    setProviderKey: aiConfig.setProviderKey,
    setAiProvider: aiConfig.setAiProvider,
    setAiModel: aiConfig.setAiModel,
    setCustomModel: aiConfig.setCustomModel,
    getCustomModel: aiConfig.getCustomModel,
    getAvailableModels: aiConfig.getAvailableModels,

    // ==================== 对话状态 ====================
    currentMode, conversationId, messages, isStreaming,
    modeLabel, conversations, activeConversationId, activeConversation, conversationCount,
    setCurrentMode: chat.setCurrentMode,
    setConversationId: chat.setConversationId,
    createConversation: chat.createConversation,
    switchConversation: chat.switchConversation,
    deleteConversation: chat.deleteConversation,
    renameConversation: chat.renameConversation,
    addMessage: chat.addMessage,
    updateLastMessage: chat.updateLastMessage,
    clearMessages: chat.clearMessages,
    persistHistory: chat.persistHistory,
    restoreHistory: chat.restoreHistory,

    // ==================== Agent ====================
    agents, activeAgentId, activeAgent, customAgents, agentCount,
    getAgentSystemPrompt: agent.getAgentSystemPrompt,
    createAgent: agent.createAgent,
    updateAgent: agent.updateAgent,
    deleteAgent: agent.deleteAgent,
    setActiveAgent: agent.setActiveAgent,
    restoreAgentFromStorage: agent.restoreFromStorage,

    // ==================== 数据操作 ====================
    executeAction: data.executeAction,
    executeActions: data.executeActions,
    getUndoCount: data.getUndoCount,
    createPlanFromTemplate: data.createPlanFromTemplate,
    execCreatePlanTemplate: data.execCreatePlanTemplate,
    updateBill: data.updateBill,
    updateDiary: data.updateDiary,
    updatePlan: data.updatePlan,
    rebuildIndex: data.rebuildIndex,
    exportJson: data.exportJson,
    exportCsv: data.exportCsv,

    // ==================== 聚合 ====================
    restoreFromStorage,
    restoreCriticalFromStorage,
    restoreNonCriticalFromStorage,
  }
})
