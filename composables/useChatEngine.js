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
import { mergeSuggestions } from '@/utils/ai/chat-suggestion.js'
import { pickNextStep, shouldOfferNextStep, markNextStepShown } from '@/utils/next-step.js'
import { pendingConfirmations } from '@/utils/ai/confirm-gate.js'
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
import { buildFileContext, composeFileMessage } from '@/utils/files/file-text.js'

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
  // 3.5.13：对话收尾的最小行动单卡（每天最多一次，可关）
  const nextStep = ref(null)
  const sendStage = ref('idle')
  const sendElapsedMs = ref(0)
  let _sendTimer = null

  /** 发送状态行：思考中 → 流式中；计时 1s 步进，finally 统一停止 */
  function startSendTimer() {
    sendElapsedMs.value = 0
    stopSendTimer()
    sendStage.value = 'thinking'
    _sendTimer = setInterval(() => { sendElapsedMs.value += 1000 }, 1000)
  }
  function stopSendTimer() {
    if (_sendTimer) { clearInterval(_sendTimer); _sendTimer = null }
  }

  /** suggestions 归一：AI 给了原样透传；执行了写操作不补本地兜底 */
  function pickSuggestions(result, reply) {
    const aiList = Array.isArray(result.suggestions)
      ? result.suggestions.slice(0, 3).map(s => String(s)).filter(Boolean)
      : []
    const didWrite = result._agentExecuted === true ||
      !!(result.action && result.action.type && result.action.type !== 'none') ||
      (Array.isArray(result.actions) && result.actions.length > 0)
    return mergeSuggestions(aiList, (didWrite || simulationMode.value) ? '' : reply)
  }

  const { simulationMode, initSimulation, handleSimulationEnd } = useSimulationManager()
  const { getWelcomeMessage } = useWelcomeMessage()

  /** 发送消息 */
  /**
   * 对话收尾给一个可点的下一步（3.5.13）
   * 条件：本轮没有待确认操作、没有轻追问 chips、非模拟演练、今天还没给过、确实有候选
   */
  function offerNextStep() {
    if (nextStep.value) return
    if (simulationMode.value) return
    if (currentSuggestions.value.length > 0) return
    try {
      if (!shouldOfferNextStep()) return
      const item = pickNextStep()
      if (!item) return
      nextStep.value = item
      markNextStepShown()
    } catch (e) {
      /* 保守：单卡失败不影响对话 */
    }
  }

  /** 用户点掉单卡 */
  function clearNextStep() {
    nextStep.value = null
  }

  async function handleSend(text, inputAreaRef, scrollToBottom, imageData, scrollHelpers, sendOpts = {}) {
    const message = text || ''
    if (!message || isSending.value) return
    const sendInstr = (sendOpts && sendOpts.appendInstruction && typeof sendOpts.appendInstruction === 'string')
      ? sendOpts.appendInstruction.trim()
      : ''
    // 3.6.0 读文件：正文只进本次请求与消息的 fileText 字段，不写进 content（气泡里用户原话保持原样）
    const fileInfo = (sendOpts && sendOpts.file && sendOpts.file.ok && sendOpts.file.text) ? sendOpts.file : null
    const fileContext = fileInfo ? buildFileContext(fileInfo) : ''
    const fileMeta = fileInfo
      ? { name: fileInfo.name || '文件', sizeText: fileInfo.sizeText || '', lines: fileInfo.lines || 0, truncated: !!fileInfo.truncated }
      : null
    const plainMessage = composeFileMessage(fileContext, sendInstr ? `${message}\n\n${sendInstr}` : message)
    currentSuggestions.value = []
    nextStep.value = null
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
    sendStage.value = 'thinking'
    sendElapsedMs.value = 0
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

    const userMsg = store.addMessage({
      role: 'user', content: message, image: imageData || undefined,
      file: fileMeta || undefined, fileText: fileContext || undefined
    })
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

    // P1 发送中状态行：开始计时（try 内所有出口都会在 finally 停止）
    startSendTimer()

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
            const labels = { query_stat: '查询统计', query_bill: '查询账单', query_diary: '查询记录', query_plan: '查询计划', query_relation: '查询关系', query_decision: '查询决策', query_combined: '跨类型查询', summarize_diaries: '生成总结', get_profile: '读取画像', create_diary: '创建记录', create_bill: '创建账单', create_plan: '创建计划', create_plan_phases: '创建阶段计划', update_diary: '修改记录', update_bill: '修改账单', update_plan: '修改计划', update_plan_phase: '更新阶段', update_plan_subtask: '更新子项', create_relation: '创建关系', update_relation: '修改关系', log_interaction: '记录互动', create_decision: '创建决策', update_decision: '更新决策', smart_update_profile: '更新画像', create_feedback: '提交反馈', add_tag: '添加标签', update_tag_category: '修改标签分类', remove_tag: '删除标签', create_agent: '创建 Agent', undo_last: '撤销操作', web_search: '联网搜索', read_url: '读网页' }
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
      // 仅当用户选中的对话模型不支持视觉时启用两步组合；选中模型本身支持视觉时
      // 直接把图片发给它（单步），避免纯视觉模型收到纯文本请求后返回空内容
      const userSelectedModel = store.aiModel
      const userModelSupportsVision = !!getProvider(cfg.provider).visionModels?.includes(userSelectedModel)
      let combinedMessage = plainMessage
      let visionCombined = false
      if (imageData && message && !userModelSupportsVision) {
        // 用户同时输入了图片和有意义的文字 → 两步组合
        logger.info('[ChatEngine] 图片+文字组合模式，先识别图片')
        safeUpdate({ content: '正在识别图片…', loading: true })

        const imageDesc = await recognizeImage(imageData, message, cfg)
        if (imageDesc) {
          // 拼接：用户原始文字 + 图片识别结果
          combinedMessage = `${plainMessage}\n\n[图片识别结果]\n${imageDesc}`
          visionCombined = true
          // 回切到用户选中的文字模型处理「图片描述+指令」，避免纯视觉模型对纯文本请求返回空
          cfg.model = userSelectedModel
          logger.info('[ChatEngine] 图片识别完成，组合消息长度:', combinedMessage.length)
        } else {
          // 识别失败，降级为原单步模式（vision 模型直接处理）
          logger.warn('[ChatEngine] 图片识别失败，降级为单步 vision 模式')
        }
      }
      // 两步组合后不再传 image 给文字模型（已转为文本描述）
      if (imageData && visionCombined) {
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
              sendStage.value = 'streaming'
              if (!rafId) rafId = raf(pumpDisplay)
            }
          },
          chatHistory
        ),
        // 图片+文字两步组合时用组合消息（含识别结果）作为请求与重试基准，
        // 否则首次请求/重试会退回原始文本，丢失图片描述导致模型“看不到图片”
        combinedMessage,
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
          content: result._error
            ? `请求失败：${result._error}`
            : (isTimeout
                ? 'AI 响应超时，可能网络不稳定或服务繁忙。'
                : 'AI 走神了，要不要再试一次？'),
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
      // 4.3.1：回复被输出上限截断 → 气泡上给「继续写完」。静默给半截是最坏的情况
      safeUpdate({ _truncated: result.truncated === true })

      let needConfirm = !!(result.action && result.action.needConfirm)
      // 3.0 M3 / 3.7.3：JSON 兜底路径的写操作同样受「写操作默认需确认」约束
      // 判定抽到 utils/ai/confirm-gate.js —— 自检页面用同一份，避免两处逻辑漂移
      const pendingActs = pendingConfirmations(result)
      if (pendingActs.length > 0) needConfirm = true

      if (needConfirm) {
        const aiMulti = result.action?.type === 'multi' && (result.actions || []).length > 1
        const isMulti = pendingActs.length > 1 || aiMulti
        const confirmAction = pendingActs.length === 1
          ? pendingActs[0]
          : (isMulti ? { type: 'multi', payload: null, needConfirm: true } : result.action)
        const confirmActs = pendingActs.length > 0 ? pendingActs : (aiMulti ? result.actions : [])
        const confirmText = isMulti ? `${confirmActs.length} 个操作需要确认` : '需要你确认一下'
        const alreadyAsks = /我需要确认|确认执行|确认吗/.test(reply || '')
        safeUpdate({
          content: alreadyAsks ? reply : reply + `\n\n${confirmText}:`,
          loading: false,
          pendingAction: confirmAction,
          pendingActions: confirmActs
        })
        pendingAction.value = confirmAction
        pendingActions.value = confirmActs
        pendingReply.value = reply
        currentSuggestions.value = []
      } else {
        if (result._agentMode) {
          // Agent 模式：工具已在循环内执行，不再二次执行，仅渲染结果卡片
          renderAgentResults(store, result, reply, message)
          currentSuggestions.value = pickSuggestions(result, reply)
        } else {
          autoExecuteAndDisplay(store, result, reply, message)
          currentSuggestions.value = pickSuggestions(result, reply)
        }
      }
      offerNextStep()
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
      sendStage.value = 'idle'
      stopSendTimer()
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
    isSending, stopSignal, sendStage, sendElapsedMs, pendingAction, pendingActions, pendingReply, currentSuggestions,
    nextStep, clearNextStep,
    simulationMode,
    getWelcomeMessage, handleSend, handleStop, handleRetry,
    handleConfirmAction, handleCancelAction, initSimulation
  }
}
