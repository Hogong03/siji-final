/**
 * useChatEngine - 聊天核心逻辑 composable
 * 拆分: chatHistoryBuilder / streamRetry / autoExecutor / stream-parser / useChatActions / useWelcomeMessage / useSimulationManager
 */
import { ref } from 'vue'
import { useAppStore } from '@/store/index.js'
import { chatRequestStream, getProvider } from '@/utils/api.js'
import { autoExtractMemory, aiSummarizeConversation, isMemoryEnabled } from '@/utils/memory.js'
import { logger } from '@/utils/logger.js'
import { useSimulationManager } from '@/composables/useSimulationManager.js'
import { buildChatHistory } from '@/utils/ai/chatHistoryBuilder.js'
import { retryStreamWithBackoff } from '@/utils/ai/streamRetry.js'
import { autoExecuteAndDisplay } from '@/utils/ai/autoExecutor.js'
import { extractReplyFromStream, resetStreamParser } from '@/utils/ai/stream-parser.js'
import { saveReport as saveSimulationReport } from '@/utils/simulation.js'
import { useWelcomeMessage } from '@/composables/useWelcomeMessage.js'
import {
  autoGenerateTitle,
  triggerSummaryIfNeeded as _triggerSummary,
  saveImageAsync,
  validateModel,
  checkVisionSupport,
  checkOfflineAndHint,
  retryLastMessage,
  stopStreaming,
  handleConfirmAction as _handleConfirmAction,
  handleCancelAction as _handleCancelAction
} from '@/composables/useChatActions.js'
import { recognizeImage } from '@/utils/ai/vision-bridge.js'

export function useChatEngine() {
  const store = useAppStore()

  /**
   * Agent 模式结果渲染 — 通过 autoExecuteAndDisplay 统一入口，传 source='agent' 跳过执行步骤
   */
  function renderAgentResults(store, result, reply, userMessage = '') {
    autoExecuteAndDisplay(store, result, reply, userMessage, { source: 'agent' })
  }

  const isSending = ref(false)
  const stopSignal = ref(null)
  const pendingAction = ref(null)
  const pendingActions = ref([])
  const pendingReply = ref('')
  const currentSuggestions = ref([])

  const { simulationMode, initSimulation, handleSimulationEnd } = useSimulationManager()
  const { getWelcomeMessage } = useWelcomeMessage()

  /** 发送消息 */
  async function handleSend(text, inputAreaRef, scrollToBottom, imageData, scrollHelpers) {
    const message = text || ''
    if (!message || isSending.value) return
    currentSuggestions.value = []
    if (!store.hasApiKey) {
      uni.showToast({ title: '请先在设置中配置 API Key', icon: 'none' })
      return
    }

    // 首次发送时自动清除欢迎语
    const conv = store.activeConversation
    if (conv && conv.messages.some(m => m._isWelcome)) {
      conv.messages = conv.messages.filter(m => !m._isWelcome)
    }

    isSending.value = true
    stopSignal.value = { stopped: false }
    const sendConvId = store.activeConversationId

    // 会话锁定 — 流式期间切换会话时中止请求并丢弃增量，防止回复写入错误会话
    const safeUpdate = (partial) => {
      if (store.activeConversationId !== sendConvId) {
        if (stopSignal.value) stopSignal.value.stopped = true
        return
      }
      store.updateLastMessage(partial)
    }

    const startStream = scrollHelpers?.startStreamScroll
    const stopStream = scrollHelpers?.stopStreamScroll
    const chatHistory = buildChatHistory(store.messages)

    const userMsg = store.addMessage({ role: 'user', content: message, image: imageData || undefined })
    // 图片保存（异步，不阻塞发送）— 传消息引用，避免跨会话回写找错消息
    if (imageData?.base64 && userMsg) saveImageAsync(imageData, store, userMsg)
    inputAreaRef?.value?.reset()
    scrollToBottom()
    store.addMessage({ role: 'assistant', content: '', loading: true })
    scrollToBottom()

    // 离线检测
    const offlineHint = await checkOfflineAndHint(message, store)
    if (offlineHint) {
      safeUpdate({ content: offlineHint, loading: false })
      isSending.value = false
      return
    }

    // 流式渲染状态（提前声明，finally 块需要访问）
    let streamedText = ''
    let lastDisplayed = ''
    let displayQueue = ''
    let queuedTotal = 0
    let rafId = null
    const raf = typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame : (fn) => setTimeout(fn, 16)
    const caf = typeof cancelAnimationFrame !== 'undefined' ? cancelAnimationFrame : (id) => clearTimeout(id)

    try {
      const agentSystemPrompt = simulationMode.value
        ? simulationMode.value.systemPrompt
        : store.getAgentSystemPrompt(store.activeAgentId)

      const activeConv = store.activeConversation
      const cfg = {
        provider: store.aiProvider,
        model: store.aiModel,
        apiKey: store.providerKeys[store.aiProvider] || '',
        systemPrompt: agentSystemPrompt,
        temperature: 0.8,
        stopSignal: stopSignal.value,
        convSummary: activeConv?.summary || null,
        summaryIndex: activeConv?.summaryIndex || 0,
        image: imageData || null,
        store: store,
        onStatus: (toolNames) => {
          // 工具执行进度反馈 — 更新当前消息的临时状态
          if (toolNames && toolNames.length > 0) {
            const labels = { query_stat: '查询统计', query_bill: '查询账单', query_diary: '查询记录', query_plan: '查询计划', query_relation: '查询关系', query_decision: '查询决策', query_combined: '跨类型查询', summarize_diaries: '生成总结', get_profile: '读取画像', create_diary: '创建记录', create_bill: '创建账单', create_plan: '创建计划', create_plan_phases: '创建阶段计划', update_diary: '修改记录', update_bill: '修改账单', update_plan: '修改计划', create_relation: '创建关系', log_interaction: '记录互动', create_decision: '创建决策', update_decision: '更新决策', smart_update_profile: '更新画像', undo_last: '撤销操作' }
            const label = toolNames.map(n => labels[n] || n).join('、')
            safeUpdate({ loading: true, statusHint: `正在${label}…` })
          }
        }
      }

      validateModel(cfg, store)

      // 提到识别图片但未附带图片 → 本地引导，不发无意义请求
      if (!imageData && /(?:识别|分析)(?:并)?(?:一下|这张|这个)?(?:截图|图片|照片|图中的|图片中的)|(?:这张|这个)(?:截图|图片|照片)(?:中|里)?/.test(message)) {
        safeUpdate({
          content: '这条消息没有附带图片，请点击输入框旁的图片按钮选择或拍摄图片后再发送。',
          loading: false
        })
        isSending.value = false
        return
      }

      // 图片识别:模型不支持时提前退出
      const visionError = checkVisionSupport(imageData, cfg, store)
      if (visionError) {
        safeUpdate({ content: visionError, loading: false })
        isSending.value = false
        return
      }

      // === 两步组合模式：图片+文字同时输入时，先识别图片再走文字模型 ===
      // Step 1: vision 模型识别图片内容，返回纯文本描述
      // Step 2: 把「图片描述 + 用户文字」拼接，走文字模型处理（action/工具调用）
      let combinedMessage = message
      if (imageData && message && message !== '请识别并分析这张截图') {
        // 用户同时输入了图片和有意义的文字 → 两步组合
        logger.info('[ChatEngine] 图片+文字组合模式，先识别图片')
        safeUpdate({ content: '正在识别图片…', loading: true })

        const imageDesc = await recognizeImage(imageData, message, cfg)
        if (imageDesc) {
          // 拼接：用户原始文字 + 图片识别结果
          combinedMessage = `${message}\n\n[图片识别结果]\n${imageDesc}`
          logger.info('[ChatEngine] 图片识别完成，组合消息长度:', combinedMessage.length)
        } else {
          // 识别失败，降级为原单步模式（vision 模型直接处理）
          logger.warn('[ChatEngine] 图片识别失败，降级为单步 vision 模式')
        }
      }
      // 两步组合后不再传 image 给文字模型（已转为文本描述）
      if (imageData && combinedMessage !== message) {
        delete cfg.image
      }

      // 检测结束演练信号
      const simEnd = await handleSimulationEnd(message, cfg, chatHistory)
      if (simEnd) {
        if (simEnd.reply) {
          saveSimulationReport(simEnd.simId, simEnd.reply)
          safeUpdate({ content: simEnd.reply, aiReply: simEnd.reply, loading: false })
        }
        isSending.value = false
        return
      }

      // === 流式请求 + 空回复重试 ===
      resetStreamParser()
      // 流式期间不做 startStreamScroll（旧方案盲加 400px 不可靠），
      // 改为 pumpDisplay 每帧后调 scrollToBottomAnchor 走锚点定位

      // 逐字推送函数 — 用 rAF 节流，每帧推一个字符组
      let scrollTickCounter = 0
      function pumpDisplay() {
        if (!displayQueue) { rafId = null; return }
        // 每帧推送 1-3 个字符（模拟打字机效果）
        const n = displayQueue.length > 800 ? 16 : displayQueue.length > 400 ? 10 : displayQueue.length > 200 ? 6 : displayQueue.length > 50 ? 3 : 1
        lastDisplayed += displayQueue.slice(0, n)
        displayQueue = displayQueue.slice(n)
        safeUpdate({ content: lastDisplayed, loading: true })
        // 每 3 帧滚一次到底部（避免每帧 scrollIntoView 性能开销）
        scrollTickCounter++
        if (scrollTickCounter % 3 === 0 && scrollHelpers?.scrollToBottomAnchor) {
          scrollHelpers.scrollToBottomAnchor(false)
        }
        if (displayQueue) {
          rafId = raf(pumpDisplay)
        } else {
          rafId = null
        }
      }

      // 整体超时保护：90s
      const overallTimeout = 90000
      let overallTimedOut = false
      const overallTimer = setTimeout(() => {
        overallTimedOut = true
        logger.warn('[ChatEngine] Overall timeout (90s), forcing abort')
        if (stopSignal.value) stopSignal.value.stopped = true
      }, overallTimeout)

      const { result, streamedText: retryText } = await retryStreamWithBackoff(
        (msg) => chatRequestStream(
          msg || combinedMessage, store.conversationId, cfg,
          (chunk) => {
            streamedText += chunk
            // 每次 chunk 到达都尝试提取
            const displayText = extractReplyFromStream(streamedText)
            // 把新增部分加入队列（用 queuedTotal 而非 lastDisplayed.length，避免队列中未推出内容被重复 append）
            if (displayText.length > queuedTotal) {
              displayQueue += displayText.slice(queuedTotal)
              queuedTotal = displayText.length
              if (!rafId) rafId = raf(pumpDisplay)
            }
          },
          chatHistory
        ),
        message,
        safeUpdate,
        stopSignal.value,
        () => {  // onRetry — 重置流式状态
          streamedText = ''
          lastDisplayed = ''
          displayQueue = ''
          queuedTotal = 0
          if (rafId) { caf(rafId); rafId = null }
        }
      )
      clearTimeout(overallTimer)

      // 最后刷新 — 把剩余队列全部推出
      if (rafId) { caf(rafId); rafId = null }
      const finalText = extractReplyFromStream(streamedText)
      lastDisplayed = finalText
      queuedTotal = finalText.length
      safeUpdate({ content: finalText, loading: true })
      if (retryText) streamedText = retryText

      // 整体超时强制中止
      if (overallTimedOut && (!streamedText || result._emptyReply)) {
        safeUpdate({
          content: 'AI 响应超时，可能网络不稳定或服务繁忙。',
          loading: false, failed: true
        })
        isSending.value = false
        return
      }

      // 空回复失败处理
      if (result._emptyReply && !streamedText && !result._aborted) {
        const isTimeout = result._timeout
        safeUpdate({
          content: isTimeout
            ? 'AI 响应超时，可能网络不稳定或服务繁忙。'
            : 'AI 走神了，要不要再试一次？',
          loading: false, failed: true
        })
        isSending.value = false
        return
      }

      // 强制覆盖流式过程中的原始 JSON 文本
      if (result.reply && result.reply.trim()) {
        safeUpdate({ content: result.reply, loading: true })
      }

      // 用户停止（agent 循环 / 流式）— 保留 stopStreaming 已写入的“已停止”状态，不覆盖
      if (result._stopped || (result._aborted && !result.reply && !streamedText)) {
        if (result._agentMode && result.execResults && result.execResults.length > 0) {
          renderAgentResults(store, result, streamedText || '已停止')
        }
        isSending.value = false
        return
      }

      // 流式中止且无首块（30s 无响应）— 显示超时提示
      if (result._aborted && result._timeout && !streamedText) {
        safeUpdate({ content: 'AI 响应超时，可能网络不稳定或服务繁忙。', loading: false, failed: true })
        isSending.value = false
        return
      }

      const reply = result.reply || streamedText || '(AI 未返回有效响应)'
      if (!result.reply && !streamedText) {
        logger.warn('AI 返回空 reply', JSON.stringify(result))
      }

      const needConfirm = result.action && result.action.needConfirm

      if (needConfirm) {
        const isMulti = result.action.type === 'multi' && result.actions.length > 1
        const confirmText = isMulti ? `${result.actions.length} 个操作需要确认` : '需要你确认一下'
        safeUpdate({
          content: reply + `\n\n${confirmText}:`,
          loading: false,
          pendingAction: result.action,
          pendingActions: result.actions
        })
        pendingAction.value = result.action
        pendingActions.value = result.actions
        pendingReply.value = reply
        currentSuggestions.value = []
      } else {
        if (result._agentMode) {
          // Agent 模式：工具已在循环内执行，不再二次执行，仅渲染结果卡片
          renderAgentResults(store, result, reply, message)
          currentSuggestions.value = result.suggestions || []
        } else {
          autoExecuteAndDisplay(store, result, reply, message)
          currentSuggestions.value = result.suggestions || []
        }
      }
      if (result.conversation_id) store.setConversationId(result.conversation_id)

      // 长期记忆
      if (isMemoryEnabled() && !needConfirm) {
        try {
          const lastMsg = store.messages[store.messages.length - 1]
          // AI 走神/超时/失败的回复不提取记忆
          const isFailedReply = !reply || reply.includes('AI 走神') || reply.includes('AI 响应超时') || reply.includes('AI 未返回有效响应') || reply.includes('请求失败') || result._emptyReply
          if (!isFailedReply) {
            autoExtractMemory(message, reply, lastMsg?.execResult)
          }
          const conv = store.activeConversation
          const unsavedCount = conv ? conv.messages.length - (conv.summaryIndex || 0) : 0
          if (conv && unsavedCount >= 15) {
            await aiSummarizeConversation(conv.messages, {
              provider: store.aiProvider, model: store.aiModel,
              apiKey: store.providerKeys[store.aiProvider] || '', systemPrompt: agentSystemPrompt
            })
            if (result) conv.summaryIndex = conv.messages.length
          }
        } catch (e) { logger.warn('记忆提取失败', e) }
      }

      store.persistHistory()
      _triggerSummary(store)

      // AI 自动生成对话标题
      try {
        const conv = store.activeConversation
        const isDefaultTitle = conv && /^(对话|新对话)\d*$/.test(conv.title || '')
        if (isDefaultTitle && conv.messages.length === 3) {
          autoGenerateTitle(conv, store).catch(() => {})
        }
      } catch { /* ignore */ }
    } catch (e) {
      logger.error('handleSend error', e)
      const msg = e.message || ''
      const isKeyError = msg.includes('API Key') || msg.includes('Access denied') || msg.includes('401') || msg.includes('403')
      safeUpdate({
        content: isKeyError
          ? `${msg}。请到设置页检查 AI 配置（厂商/模型/Key 权限）。`
          : `请求失败: ${msg || '未知错误'}。`,
        loading: false, failed: true
      })
    } finally {
      if (rafId) { caf(rafId); rafId = null }
      // 流式期间会话被切换 — 将已生成内容回写原会话，避免残留 loading 气泡
      if (store.activeConversationId !== sendConvId) {
        const partialContent = lastDisplayed || streamedText || ''
        store.updateLastMessageFor(sendConvId, {
          content: partialContent || '（已中断）',
          loading: false,
          failed: !partialContent
        })
      }
      isSending.value = false
      stopSignal.value = null
      if (stopStream) stopStream()
      scrollToBottom()
    }
  }

  /** 重试上一次发送 */
  const handleRetry = (options = {}, inputAreaRef, scrollToBottom, scrollHelpers) =>
    retryLastMessage(store, handleSend, options, inputAreaRef, scrollToBottom, scrollHelpers)

  function handleStop() {
    stopStreaming(store, stopSignal)
    isSending.value = false
  }

  /** 确认待执行操作 */
  function handleConfirmAction() {
    _handleConfirmAction(store, pendingAction, pendingActions, pendingReply)
  }

  /** 取消待执行操作 */
  function handleCancelAction() {
    _handleCancelAction(store, pendingAction, pendingActions, pendingReply)
  }

  return {
    isSending, stopSignal, pendingAction, pendingActions, pendingReply, currentSuggestions,
    simulationMode,
    getWelcomeMessage, handleSend, handleStop, handleRetry,
    handleConfirmAction, handleCancelAction, initSimulation
  }
}
