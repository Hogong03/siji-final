/**
 * 思迹 全局状态管理 (Pinia) — 聚合入口
 *
 * 拆分为 5 个子 store：device / aiConfig / chat / theme / data
 * 本文件聚合所有子 store，导出 useAppStore 保持向后兼容
 *
 * 关键：使用 storeToRefs 保持响应性，方法直接透传
 */
import { defineStore, storeToRefs } from 'pinia'
import { logger } from '@/utils/logger.js'
import { invalidatePromptCache } from '@/utils/ai/prompt-builder.js'
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
    currentMode, conversationId, messages,
    modeLabel, conversations, activeConversationId, activeConversation, conversationCount,
  } = storeToRefs(chat)

  const {
    agents, activeAgentId, activeAgent, customAgents, agentCount,
  } = storeToRefs(agent)

  /**
   * 创建会话并绑定当前活跃 Agent（3.1 M3）
   * chat store 不依赖 agent store，由聚合层注入，避免循环依赖
   */
  function createConversationWithAgent(customTitle) {
    return chat.createConversation(customTitle, {
      agentId: agent.activeAgentId,
      agentName: agent.activeAgent ? agent.activeAgent.name : ''
    })
  }

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
      createConversationWithAgent()
    }
    // 监听网络恢复，自动消费离线队列
    if (typeof uni !== 'undefined' && uni.onNetworkStatusChange) {
      uni.onNetworkStatusChange((res) => {
        if (res.isConnected) {
          consumeOfflineQueue()
        }
      })
    }
  }

  /**
   * 延迟恢复非关键配置 — 首屏渲染完成后执行
   */
  function restoreNonCriticalFromStorage() {
    agent.restoreFromStorage()
    // 3.1：agent 晚于 chat 恢复——启动自动创建的首会话若仍为空，补绑实际活跃 Agent
    const first = chat.conversations.find(c => c.id === chat.activeConversationId)
    if (first && !first.agentId && (!first.messages || first.messages.length === 0)) {
      first.agentId = agent.activeAgentId
      first.agentName = agent.activeAgent ? agent.activeAgent.name : ''
      chat.persistHistory()
    }
    // 消费离线队列 — fallback.js 写入但无消费逻辑，此处补上
    consumeOfflineQueue()
    logger.log('[思迹] Non-critical storage restored')
  }

  /**
   * 消费离线队列 — 网络恢复后将离线暂存的操作同步执行
   * 队列格式：[{ type: 'bill', data: {...} }]
   */
  function consumeOfflineQueue() {
    try {
      const queueRaw = uni.getStorageSync('siji_offline_queue')
      if (!queueRaw) return
      const queue = JSON.parse(queueRaw)
      if (!Array.isArray(queue) || queue.length === 0) return

      logger.info(`[Offline Queue] 消费 ${queue.length} 条离线操作`)
      const remaining = []
      for (const item of queue) {
        if (item.type === 'bill' && item.data) {
          // 直接写入存储（不走 executeAction 避免触发 UI 更新）
          const bill = item.data
          const monthKey = bill.bill_date ? `bill_${bill.bill_date.substring(0, 7)}` : `bill_${new Date().toISOString().substring(0, 7)}`
          const bills = JSON.parse(uni.getStorageSync(monthKey) || '[]')
          bills.push(bill)
          uni.setStorageSync(monthKey, JSON.stringify(bills))
          logger.info(`[Offline Queue] 已同步离线账单: ${bill.category} ¥${bill.amount}`)
        } else {
          // 未知类型保留在队列中
          remaining.push(item)
        }
      }

      if (remaining.length > 0) {
        uni.setStorageSync('siji_offline_queue', JSON.stringify(remaining))
      } else {
        uni.removeStorageSync('siji_offline_queue')
      }

      // 失效 prompt 缓存（数据已变更）
      invalidatePromptCache()
    } catch (e) {
      logger.warn('[Offline Queue] 消费失败:', e.message)
    }
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
    currentMode, conversationId, messages,
    modeLabel, conversations, activeConversationId, activeConversation, conversationCount,
    setCurrentMode: chat.setCurrentMode,
    setConversationId: chat.setConversationId,
    createConversation: createConversationWithAgent,
    switchConversation: chat.switchConversation,
    pruneEmptyConversations: chat.pruneEmptyConversations,
    deleteConversation: chat.deleteConversation,
    renameConversation: chat.renameConversation,
    addTagToConversation: chat.addTagToConversation,
    removeTagFromConversation: chat.removeTagFromConversation,
    setConversationTags: chat.setConversationTags,
    addMessage: chat.addMessage,
    updateLastMessage: chat.updateLastMessage,
    updateLastMessageFor: chat.updateLastMessageFor,
    clearMessages: chat.clearMessages,
    persistHistory: chat.persistHistory,
    restoreHistory: chat.restoreHistory,
    flushPersist: chat.flushPersist,

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
