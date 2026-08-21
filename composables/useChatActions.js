/**
 * useChatActions - 对话辅助逻辑 composable
 *
 * 从 useChatEngine 拆出的非核心流程：
 *   - autoGenerateTitle: AI 自动生成对话标题
 *   - triggerSummaryIfNeeded: 异步触发对话摘要压缩
 *   - saveImageAsync: 图片保存到本地（含跨会话安全回写）
 */
import { generateConversationTitle, generateConversationSummary, isOnline, getProvider, getProviderVisionModel, supportsVision } from '@/utils/api.js'
import { autoExtractMemory, isMemoryEnabled } from '@/utils/memory.js'
import { saveImageToLocal } from '@/utils/image.js'
import { logger } from '@/utils/logger.js'
import { useAppStore } from '@/store/index.js'

/** AI 自动生成对话标题（异步，不阻塞，使用 cheapest model） */
export async function autoGenerateTitle(conv, store) {
  if (!conv || !conv.id) return
  const firstUser = (conv.messages || []).find(m => m.role === 'user')
  if (!firstUser) return

  try {
    const cfg = { provider: store.aiProvider, apiKey: store.providerKeys[store.aiProvider] || '' }
    const title = await generateConversationTitle(firstUser.content, cfg)
    if (title && conv.id) store.renameConversation(conv.id, title)
  } catch { /* AI 调用失败/超时 → 保持默认标题 */ }
}

/** 异步触发对话摘要压缩 */
export function triggerSummaryIfNeeded(store) {
  const conv = store.activeConversation
  if (!conv || conv.messages.length < 15) return
  if (conv.summary && conv.summaryIndex >= conv.messages.length - 8) return
  const toSummarize = conv.messages.slice(0, -6)
  if (toSummarize.length < 8) return
  generateConversationSummary(
    toSummarize.map(m => ({ role: m.role, content: m.content, aiReply: m.aiReply })),
    { provider: store.aiProvider, model: store.aiModel, apiKey: store.providerKeys[store.aiProvider] || '' }
  ).then(summary => {
    if (summary) store.updateConversationSummary(conv.id, summary, toSummarize.length)
  }).catch(() => {})
}

/**
 * 异步保存图片到本地文件系统（含跨会话安全回写）
 * @param {Object} imageData - { base64, width, height, size }
 * @param {Object} store - app store
 * @param {string} targetConvId - 发送时的会话 ID
 */
export function saveImageAsync(imageData, store, targetMsg) {
  if (!imageData?.base64) return
  saveImageToLocal(imageData.base64).then(localPath => {
    if (!localPath) return
    // 直接回写消息引用 — 跨会话切换也不受影响
    if (targetMsg && targetMsg.image) targetMsg.image.localPath = localPath
    store.persistConversations()
    logger.info('Image saved to', localPath)
  }).catch(e => logger.warn('saveImage failed', e))
}

/** 检查模型合法性并修正 */
export function validateModel(cfg, store) {
  const providerModels = getProvider(cfg.provider).models
  if (!providerModels?.some(m => m.id === cfg.model)) {
    cfg.model = providerModels[0]?.id || cfg.model
    store.aiModel = cfg.model
  }
}

/** 图片识别模型自动切换 */
export function checkVisionSupport(imageData, cfg, store) {
  if (!imageData) return null
  if (!supportsVision(cfg.provider)) {
    delete cfg.image
    const p = getProvider(cfg.provider)
    return `${p.name}不支持图片识别。请切到 DeepSeek(V4 Flash)、Moonshot(K2.5/2.6/2.7)、智谱 GLM(GLM-4V Flash)或通义千问(Qwen VL)后重试。`
  }
  if (!getProvider(cfg.provider).visionModels?.includes(cfg.model)) {
    const visionModel = getProviderVisionModel(cfg.provider)
    if (visionModel) {
      logger.info(`[Vision] Auto-switch model: ${cfg.model} → ${visionModel}`)
      cfg.model = visionModel
    }
  }
  return null
}

/** 停止流式输出 */
export function stopStreaming(store, stopSignal) {
  if (stopSignal.value) stopSignal.value.stopped = true
  const lastMsg = store.messages[store.messages.length - 1]
  if (lastMsg && lastMsg.loading) {
    const partialText = lastMsg.content || ''
    store.updateLastMessage({
      content: partialText
        ? partialText + '\n\n▌已停止'
        : '已停止',
      loading: false,
      failed: !partialText
    })
  }
  stopSignal.value = null
}

/** 重试上一次发送（需要传入 handleSend 引用） */
export async function retryLastMessage(store, handleSend, options = {}, inputAreaRef, scrollToBottom, scrollHelpers) {
  const msgs = store.messages
  let lastUserMsg = null
  let lastUserIdx = -1
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === 'user') { lastUserMsg = msgs[i]; lastUserIdx = i; break }
  }
  if (!lastUserMsg) return

  const message = options.message || lastUserMsg.content
  const imageData = options.image || lastUserMsg.image || null

  const prevProvider = store.aiProvider
  const prevModel = store.aiModel
  if (options.provider) store.setAiProvider(options.provider)
  if (options.model) store.setAiModel(options.model)
  if (!store.hasApiKey) {
    if (options.provider) store.setAiProvider(prevProvider)
    if (options.model) store.setAiModel(prevModel)
    uni.showToast({ title: '当前模型未配置 API Key，请先配置', icon: 'none' })
    return
  }

  const conv = store.activeConversation
  if (conv && conv.messages.length > 0) {
    if (conv.messages[conv.messages.length - 1].role === 'assistant') conv.messages.pop()
    if (lastUserIdx >= 0 && conv.messages[lastUserIdx] && conv.messages[lastUserIdx].role === 'user') {
      conv.messages.splice(lastUserIdx, 1)
    }
  }

  await handleSend(message, inputAreaRef, scrollToBottom, imageData, scrollHelpers)
}

/** 离线检测并返回本地操作提示 */
export async function checkOfflineAndHint(message, store) {
  const online = await isOnline()
  if (online) return null
  const isLocalAction = /账|记|帐|bill|消费|花/.test(message) || /记录|日记|diary/.test(message) || /计划|plan/.test(message)
  if (isLocalAction) {
    return '当前无网络连接。记账、写记录、做计划可以直接操作，不需要联网。\n\n请直接告诉我，比如「记一笔午餐 35 元」「写个记录今天很开心」「建个计划明天交报告」'
  }
  return '当前无网络连接，AI 对话需要联网。\n\n记账、写记录、做计划可以离线使用。'
}

/** 确认待执行操作 */
export function handleConfirmAction(store, pendingAction, pendingActions, pendingReply) {
  let execResult = null
  if (pendingActions.value.length > 1) {
    const multiResult = store.executeActions(pendingActions.value)
    let content = pendingReply.value + `\n\n${multiResult.message}`
    execResult = { success: multiResult.allSuccess, message: multiResult.message, detail: multiResult.detail?.[0] }
    const successResults = multiResult.results.filter(r => r.success && r.detail)
    store.updateLastMessage({
      content, pendingAction: null, pendingActions: [],
      aiReply: pendingReply.value, execResult,
      execResults: successResults,
      actionCard: successResults.length > 0 ? { type: 'multi', payload: successResults.map(r => r.detail) } : null
    })
  } else if (pendingAction.value) {
    execResult = store.executeAction(pendingAction.value)
    let content = pendingReply.value + `\n\n${execResult.message}`
    store.updateLastMessage({
      content, pendingAction: null, aiReply: pendingReply.value,
      actionCard: execResult.success ? { type: pendingAction.value.type, payload: execResult.detail } : null,
      execResult
    })
  }
  if (execResult?.success) {
    try { autoExtractMemory(pendingReply.value, pendingReply.value, execResult) } catch { /* ignore */ }
  }
  pendingAction.value = null
  pendingActions.value = []
  pendingReply.value = ''
}

/** 取消待执行操作 */
export function handleCancelAction(store, pendingAction, pendingActions, pendingReply) {
  store.updateLastMessage({ content: pendingReply.value + '\n\n已取消', pendingAction: null, pendingActions: [] })
  pendingAction.value = null
  pendingActions.value = []
  pendingReply.value = ''
}
