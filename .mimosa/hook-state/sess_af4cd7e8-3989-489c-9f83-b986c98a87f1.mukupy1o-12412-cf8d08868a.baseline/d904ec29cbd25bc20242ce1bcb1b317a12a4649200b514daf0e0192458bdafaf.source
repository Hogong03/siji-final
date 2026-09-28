/**
 * useSimulationManager - 情景模拟管理 composable
 *
 * 从 useChatEngine.js 拆出，管理社交沙盘三模式的初始化、结束、复盘
 */
import { ref } from 'vue'
import { useAppStore } from '@/store/index.js'
import { logger } from '@/utils/logger.js'
import { getRelationById } from '@/utils/relations.js'
import { generateSimPromptByMode, saveReport as saveSimulationReport, updateSimulation, getSimulationById, SIM_MODES } from '@/utils/simulation.js'
import { chatRequest } from '@/utils/api.js'

export function useSimulationManager() {
  const store = useAppStore()
  const simulationMode = ref(null)  // { simId, mode, relationName, scene, goal, systemPrompt, previousAgentId }

  /** 初始化模拟模式(从页面 onLoad / onShow 事件传入) */
  function initSimulation(params) {
    if (!params || !params.simulation) return false
    if (!store.conversations) return false
    const mode = params.mode || 'social'
    const modeConfig = SIM_MODES[mode] || SIM_MODES.social
    const relation = params.relation_id ? getRelationById(params.relation_id) : null
    const relationData = relation || { name: params.name || '模拟对象', traits: [], preferences: [], relationship_score: 5 }

    const prompt = generateSimPromptByMode(mode, {
      relation: relationData,
      name: params.name,
      scene: params.scene,
      goal: params.goal
    })

    if (params.resume) {
      const simRecord = getSimulationById(params.simulation)
      if (simRecord?.conversation_id) {
        const targetConv = store.conversations.find(c => c.id === simRecord.conversation_id)
        if (targetConv) {
          store.switchConversation(simRecord.conversation_id)
        }
      }
    } else {
      const currentConv = store.activeConversation
      if (currentConv && currentConv.messages.length === 1 && currentConv.messages[0].role === 'assistant' && !currentConv.messages[0].execResult) {
        store.deleteConversation(currentConv.id)
      }
      const modeTitle = modeConfig.title || '模拟演练'
      const convTitle = `${modeTitle}·${params.name || params.scene?.slice(0, 6) || '演练'}`
      const newConv = store.createConversation(convTitle)
      updateSimulation(params.simulation, { conversation_id: newConv.id })
    }

    let previousAgentId = null
    if (modeConfig.agentId && store.activeAgentId !== modeConfig.agentId) {
      previousAgentId = store.activeAgentId
      store.setActiveAgent(modeConfig.agentId)
      if (store.activeAgentId !== modeConfig.agentId) {
        previousAgentId = null
      }
    }

    simulationMode.value = {
      simId: params.simulation,
      mode: mode,
      relationName: params.name || relation?.name || (mode === 'planning' ? '规划师' : '模拟对象'),
      scene: params.scene || '日常对话',
      goal: params.goal || '',
      systemPrompt: prompt,
      previousAgentId: previousAgentId
    }

    if (!params.resume) {
      let openingMsg = ''
      if (mode === 'planning') {
        openingMsg = `规划推演开始\n\n场景:${simulationMode.value.scene}\n${simulationMode.value.goal ? '目标:' + simulationMode.value.goal : ''}\n\n我会逐步引导你拆解目标、识别风险、制定时间线。说「结束推演」或「出方案」可随时生成完整规划方案。`
      } else if (mode === 'relationship') {
        openingMsg = `关系处理模拟开始\n\n场景:${simulationMode.value.scene}\n对方:${simulationMode.value.relationName}\n${simulationMode.value.goal ? '目标:' + simulationMode.value.goal : ''}\n\n我会扮演对方与你进行沟通演练。说「结束演练」或「复盘」可随时查看复盘报告。`
      } else {
        openingMsg = `模拟演练开始\n\n场景:${simulationMode.value.scene}\n对方:${simulationMode.value.relationName}\n${simulationMode.value.goal ? '目标:' + simulationMode.value.goal : ''}\n\n说「结束演练」或「复盘」可随时查看复盘报告。`
      }
      store.addMessage({
        role: 'assistant',
        content: openingMsg,
        aiReply: openingMsg
      })
    }
    return true
  }

  /** 检测结束演练信号，生成复盘报告 */
  async function handleSimulationEnd(message, cfg, chatHistory) {
    if (!simulationMode.value) return null
    if (!/结束演练|复盘|结束模拟|结束推演|出方案/.test(message)) return null

    let reportPrompt = '请根据以上对话,生成复盘报告。'
    if (simulationMode.value.mode === 'planning') {
      reportPrompt = '请根据以上对话,生成完整的规划方案。按规划方案格式输出。'
    }
    const simId = simulationMode.value.simId
    const reportResult = await chatRequest(
      reportPrompt, null, store.conversationId,
      cfg, chatHistory
    )

    // 恢复模拟前使用的 Agent
    const prevAgentId = simulationMode.value.previousAgentId
    simulationMode.value = null
    if (prevAgentId && store.activeAgentId !== prevAgentId) {
      store.setActiveAgent(prevAgentId)
    }

    return {
      reply: reportResult?.reply || '',
      simId
    }
  }

  return {
    simulationMode,
    initSimulation,
    handleSimulationEnd
  }
}
