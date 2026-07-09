/**
 * useChatEngine — 聊天核心逻辑 composable
 *
 * 从 chat/index.vue 抽取的 AI 调用、执行、摘要、兜底逻辑
 * 页面只需关注 UI 渲染和事件路由
 */
import { ref, nextTick } from 'vue'
import { useAppStore } from '@/store/index.js'
import { chatRequest, chatRequestStream, generateConversationSummary, isOnline } from '@/utils/api.js'
import { autoExtractMemory, aiSummarizeConversation, isMemoryEnabled } from '@/utils/memory.js'
import { logger } from '@/utils/logger.js'

export function useChatEngine() {
  const store = useAppStore()
  const isSending = ref(false)
  const stopSignal = ref(null)
  const pendingAction = ref(null)
  const pendingActions = ref([])
  const pendingReply = ref('')
  const currentSuggestions = ref([])

  /** 生成智能欢迎语 */
  function getWelcomeMessage() {
    const now = new Date()
    const hour = now.getHours()
    let greeting = '你好'
    if (hour < 6) greeting = '夜深了'
    else if (hour < 11) greeting = '早上好'
    else if (hour < 14) greeting = '中午好'
    else if (hour < 18) greeting = '下午好'
    else if (hour < 22) greeting = '晚上好'
    else greeting = '夜深了'

    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    let tips = []
    try {
      const bills = JSON.parse(uni.getStorageSync(`bill_${month}`) || '[]').filter(b => b.is_deleted !== 1)
      const expense = bills.filter(b => b.type === 'expense').reduce((s, b) => s + b.amount, 0)
      if (expense > 0) tips.push(`本月已支出 ¥${expense.toFixed(0)}`)

      const plans = JSON.parse(uni.getStorageSync('plan_all') || '[]').filter(p => p.is_deleted !== 1 && p.status === 1)
      if (plans.length > 0) tips.push(`${plans.length} 个计划进行中`)

      const diaries = JSON.parse(uni.getStorageSync(`diary_${month}`) || '[]').filter(d => d.is_deleted !== 1)
      if (diaries.length > 0) tips.push(`本月写了 ${diaries.length} 篇日记`)
    } catch { /* ignore */ }

    let msg = `${greeting}，我是思迹。`
    if (tips.length > 0) msg += `\n${tips.join(' · ')}`
    msg += '\n\n跟我说什么都行，我可以帮你：'
    msg += '\n¥ 记账 — "午饭花了35"'
    msg += '\n✎ 日记 — "今天心情不错"'
    msg += '\n✓ 计划 — "下周完成报告"'
    msg += '\n✎ 改 — "把那笔餐费改成30""计划截止改到周五"'
    msg += '\n? 查 — "这个月花了多少"'
    msg += '\n\n也能一句话同时做几件事，或者直接跟我聊天。'
    return msg
  }

  /** 构建聊天历史（含执行结果摘要） */
  function buildChatHistory() {
    let chatHistory = store.messages
      .filter(m => {
        if (m.role === 'user') return m.content && m.content.trim()
        if (m.role === 'assistant') return !m.loading && (m.aiReply || m.content)
        return false
      })
      .slice(-15)
      .map(m => {
        let content = m.aiReply || m.content
        if (m.role === 'assistant' && m.execResult) {
          const er = m.execResult
          if (er.success && er.detail) {
            const d = er.detail
            if (d.type === 'bill') {
              content += `\n[执行结果: 已记账 ${d.billType === 'expense' ? '-' : '+'}¥${d.amount} ${d.category} ${d.bill_date} ID=${d.id}]`
            } else if (d.type === 'diary') {
              content += `\n[执行结果: 已保存日记《${d.title}》心情:${d.mood} ID=${d.id}]`
            } else if (d.type === 'plan') {
              content += `\n[执行结果: ${er.message} ID=${d.id}]`
            } else if (d.type === 'query_bill' || d.type === 'query_diary' || d.type === 'query_plan' || d.type === 'query_stat') {
              if (d.items && d.items.length > 0) {
                const itemIds = d.items.slice(0, 10).map(item => {
                  if (d.type === 'query_bill') return `${item.category}¥${item.amount}(ID=${item.client_id})`
                  if (d.type === 'query_diary') return `《${item.title}》(ID=${item.client_id})`
                  if (d.type === 'query_plan') return `《${item.title}》(ID=${item.client_id})`
                  return ''
                }).filter(Boolean)
                content += `\n[执行结果: ${er.message} 包含: ${itemIds.join(', ')}]`
              } else {
                content += `\n[执行结果: ${er.message}]`
              }
            } else if (d.deleted) {
              content += `\n[执行结果: ${er.message}]`
            } else if (d.updatedFields && d.updatedFields.length > 0) {
              content += `\n[执行结果: ${er.message} ID=${d.id}]`
            }
          } else if (er.success && er.message && er.message !== '无需执行') {
            content += `\n[执行结果: ${er.message}]`
          }
        }
        if (m.role === 'assistant' && m.execResults && m.execResults.length > 0) {
          const summaries = m.execResults.map(r => {
            const d = r.detail || r
            if (d.type === 'bill') return `记账${d.billType === 'expense' ? '-' : '+'}¥${d.amount}(ID=${d.id})`
            if (d.type === 'diary') return `日记《${d.title}》(ID=${d.id})`
            if (d.type === 'plan') return `计划《${d.title}》(ID=${d.id})`
            return r.message || ''
          }).filter(Boolean)
          if (summaries.length > 0) content += `\n[执行结果: ${summaries.join('；')}]`
        }
        return { role: m.role, content }
      })
    if (chatHistory.length === 0) chatHistory = null
    return chatHistory
  }

  /** 发送消息 */
  async function handleSend(text, inputAreaRef, scrollToBottom) {
    const message = text || ''
    if (!message || isSending.value) return
    currentSuggestions.value = []
    if (!store.hasApiKey) {
      uni.showToast({ title: '请先在设置中配置 API Key', icon: 'none' })
      return
    }
    isSending.value = true
    stopSignal.value = { stopped: false }

    const chatHistory = buildChatHistory()

    store.addMessage({ role: 'user', content: message })
    inputAreaRef?.value?.reset()
    scrollToBottom()
    store.addMessage({ role: 'assistant', content: '', loading: true })
    scrollToBottom()

    const online = await isOnline()
    if (!online) {
      store.updateLastMessage({ content: '当前无网络连接,请联网后重试。', loading: false })
      isSending.value = false
      return
    }

    try {
      const systemPrompt = store.getAgentSystemPrompt(store.activeAgentId)
      const activeConv = store.activeConversation
      const cfg = {
        provider: store.aiProvider,
        model: store.aiModel,
        apiKey: store.providerKeys[store.aiProvider] || '',
        systemPrompt,
        temperature: 0.8,
        stopSignal: stopSignal.value,
        convSummary: activeConv?.summary || null,
        summaryIndex: activeConv?.summaryIndex || 0
      }

      let streamedText = ''
      const result = await chatRequestStream(
        message, store.conversationId, cfg,
        (chunk) => {
          streamedText += chunk
          store.updateLastMessage({ content: streamedText, loading: true })
          scrollToBottom()
        },
        chatHistory
      )

      const reply = result.reply || streamedText || '(AI 未返回有效响应)'
      if (!result.reply && !streamedText) {
        logger.warn('AI 返回空 reply', JSON.stringify(result))
      }

      const needConfirm = result.action && result.action.needConfirm

      if (needConfirm) {
        const isMulti = result.action.type === 'multi' && result.actions.length > 1
        const confirmText = isMulti ? `${result.actions.length} 个操作需要确认` : '需要你确认一下'
        store.updateLastMessage({
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
        autoExecuteAndDisplay(result, reply, message)
        currentSuggestions.value = result.suggestions || []
      }
      if (result.conversation_id) store.setConversationId(result.conversation_id)

      // 长期记忆
      if (isMemoryEnabled()) {
        try {
          const lastMsg = store.messages[store.messages.length - 1]
          autoExtractMemory(message, reply, lastMsg?.execResult)
          const conv = store.activeConversation
          if (conv && conv.messages.length > 0 && conv.messages.length % 15 === 0) {
            aiSummarizeConversation(conv.messages, {
              provider: store.aiProvider,
              model: store.aiModel,
              apiKey: store.providerKeys[store.aiProvider] || '',
              systemPrompt
            })
          }
        } catch (e) {
          logger.warn('记忆提取失败', e)
        }
      }

      store.persistHistory()
      triggerSummaryIfNeeded()
    } catch (e) {
      logger.error('handleSend error', e)
      store.updateLastMessage({
        content: e.message?.includes('API Key')
          ? `${e.message}。请到设置页检查 AI 配置。`
          : `请求失败: ${e.message || '未知错误'}。请重试。`,
        loading: false
      })
    } finally {
      isSending.value = false
      stopSignal.value = null
      scrollToBottom()
    }
  }

  /** 停止 AI 输出 */
  function handleStop() {
    if (stopSignal.value) stopSignal.value.stopped = true
    const lastMsg = store.messages[store.messages.length - 1]
    if (lastMsg && lastMsg.loading) {
      const partialText = lastMsg.content || ''
      store.updateLastMessage({
        content: partialText + (partialText ? '\n\n' : '') + '▌已停止',
        loading: false
      })
    }
    isSending.value = false
    stopSignal.value = null
  }

  /** 异步触发对话摘要压缩 */
  function triggerSummaryIfNeeded() {
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

  /** 前端兜底提取 */
  function extractFallbackAction(userMessage, aiReply) {
    const reply = aiReply || ''
    const profileKeywords = /名字|叫|姓名|性别|男|女|生日|出生|职业|工作|在哪|住在|城市|爱好|喜欢|喜欢吃|不吃|过敏|预算|作息|睡觉|MBTI|血型|星座/
    if (profileKeywords.test(userMessage) && /记下|更新|帮|已/.test(reply)) {
      const updates = []
      let m = userMessage.match(/我(?:叫|名字(?:是|叫)?|姓名(?:是)?)\s*([\u4e00-\u9fa5a-zA-Z]{2,10})/)
      if (m) updates.push({ card: 'basic', field: 'nickname', value: m[1] })
      if (/我是?(?:个|名)?(?:女生|女孩|女的|女)/.test(userMessage) || userMessage.includes('我是女')) {
        updates.push({ card: 'basic', field: 'gender', value: '女' })
      } else if (/我是?(?:个|名)?(?:男生|男孩|男的|男)/.test(userMessage) || userMessage.includes('我是男')) {
        updates.push({ card: 'basic', field: 'gender', value: '男' })
      }
      m = userMessage.match(/生日(?:是)?(\d{4})年?(\d{1,2})月?(\d{1,2})日?/)
      if (m) updates.push({ card: 'basic', field: 'birthday', value: `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}` })
      m = userMessage.match(/我(?:是|做|干)(?:一名|一个)?([\u4e00-\u9fa5]{2,8})(?:的|工作|职业)/)
      if (m) updates.push({ card: 'basic', field: 'occupation', value: m[1] })
      m = userMessage.match(/我(?:是|在)(?:一名|一个)?(?:程序员|设计师|老师|医生|学生|工程师|产品经理|运营|销售|会计|律师|护士|厨师|司机|摄影师|作家|画家|音乐家)/)
      if (m) {
        const occ = userMessage.match(/(?:程序员|设计师|老师|医生|学生|工程师|产品经理|运营|销售|会计|律师|护士|厨师|司机|摄影师|作家|画家|音乐家)/)[0]
        updates.push({ card: 'basic', field: 'occupation', value: occ })
      }
      m = userMessage.match(/我(?:在|住在|位于|来自)([\u4e00-\u9fa5]{2,6})(?:市|省|区|县)?/)
      if (m) updates.push({ card: 'basic', field: 'location', value: m[1] })
      m = userMessage.match(/我(?:喜欢|爱|的爱好是|爱好是)([\u4e00-\u9fa5a-zA-Z0-9]{1,10})/)
      if (m) updates.push({ card: 'lifestyle', field: 'hobbies', value: m[1] })
      m = userMessage.match(/我(?:喜欢吃|爱吃|喜欢吃|不|不吃)([\u4e00-\u9fa5]{1,8})/)
      if (m) {
        const isNeg = /不吃|不爱/.test(userMessage)
        if (!isNeg) updates.push({ card: 'lifestyle', field: 'dietary', value: m[1] })
      }
      m = userMessage.match(/(?:MBTI|mbti)(?:是)?\s*([A-Z]{4})/)
      if (m) updates.push({ card: 'custom', cardTitle: '性格特征', field: 'MBTI', value: m[1] })
      m = userMessage.match(/我是\s*([A-Z]{4})/)
      if (m && ['INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP','ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP'].includes(m[1])) {
        updates.push({ card: 'custom', cardTitle: '性格特征', field: 'MBTI', value: m[1] })
      }
      m = userMessage.match(/(?:星座是|我是)(白羊座|金牛座|双子座|巨蟹座|狮子座|处女座|天秤座|天蝎座|射手座|摩羯座|水瓶座|双鱼座)/)
      if (m) updates.push({ card: 'custom', cardTitle: '星座', field: '星座', value: m[1] })
      m = userMessage.match(/血型(?:是)?(A|B|AB|O)型?/)
      if (m) updates.push({ card: 'custom', cardTitle: '血型', field: '血型', value: m[1] + '型' })
      m = userMessage.match(/(?:预算|月预算|每月预算)(?:是|大概|大约)?(\d{2,6})/)
      if (m) updates.push({ card: 'lifestyle', field: 'budget', value: Number(m[1]) })
      m = userMessage.match(/(?:睡觉|休息|作息)(?:时间)?(?:是|大概|大约)?(\d{1,2})[点:：](\d{0,2})/)
      if (m) updates.push({ card: 'lifestyle', field: 'sleepTime', value: m[2] ? `${m[1]}:${m[2]}` : `${m[1]}:00` })
      if (updates.length > 0) {
        return { type: 'smart_update_profile', payload: { updates, suggestions: [] }, needConfirm: false }
      }
    }

    // 记账
    const billKeywords = /花了|消费|买了|付了|收入|收到|转了|开销/
    if (billKeywords.test(userMessage) && /记/.test(reply)) {
      let m = userMessage.match(/(\d+(?:\.\d+)?)\s*[元块]/) || userMessage.match(/(\d+(?:\.\d+)?)$/)
      if (m) {
        return { type: 'addRecord', payload: { type: 'bill', billType: 'expense', amount: parseFloat(m[1]), category: '其他', note: '' }, needConfirm: false }
      }
    }
    // 日记
    if (/日记|心情|今天/.test(userMessage) && /已.*记|已.*写|已.*保存/.test(reply)) {
      return { type: 'addRecord', payload: { type: 'diary', title: '今日日记', content: userMessage, mood: '一般' }, needConfirm: false }
    }
    return null
  }

  /** 自动执行并显示结果 */
  function autoExecuteAndDisplay(result, reply, userMessage) {
    let execResults = []
    let displayContent = reply

    if (result.actions && result.actions.length > 1) {
      const multiResult = store.executeActions(result.actions)
      execResults = multiResult.results || []
      if (multiResult.allSuccess) {
        displayContent += `\n\n${multiResult.message}`
      } else {
        const successMsgs = execResults.filter(r => r.success).map(r => r.message)
        const failMsgs = execResults.filter(r => !r.success && r.message !== '无需执行').map(r => r.message)
        if (successMsgs.length > 0) displayContent += `\n\n${successMsgs.join(';')}`
        if (failMsgs.length > 0) displayContent += `\n\n${failMsgs.join(';')}`
      }
      store.updateLastMessage({
        content: displayContent, loading: false,
        aiReply: reply,
        actionCard: execResults.find(r => r.success && r.detail) ? {
          type: 'multi', payload: execResults.filter(r => r.success && r.detail).map(r => r.detail)
        } : null,
        execResult: { success: multiResult.allSuccess, message: multiResult.message, detail: execResults[0]?.detail },
        execResults: execResults.filter(r => r.success && r.detail)
      })
      return
    }

    const effectiveAction = (result.actions && result.actions.length === 1)
      ? result.actions[0] : result.action
    let execResult = null
    if (effectiveAction) execResult = store.executeAction(effectiveAction)
    if (execResult && execResult.success) {
      const msg = execResult.message || ''
      const replyHasIt = msg && (reply || '').includes(msg)
      if (msg && msg !== '无需执行' && !replyHasIt) displayContent += `\n\n${msg}`
    } else if (execResult && !execResult.success && execResult.message !== '无需执行') {
      displayContent += `\n\n${execResult.message}`
    }

    // 防误导检测 + 前端兜底
    const isQueryAction = execResult?.detail?.type?.startsWith('query_')
    const hasExecuted = execResult && execResult.success
    const isNotEnabled = execResult?.detail?.notEnabled
    if (!hasExecuted && !isQueryAction && !isNotEnabled) {
      const actionClaimRegex = /已记|已保存|已创建|已修改|已删除|记了一笔|帮你记|已帮|账单已|日记已|计划已|已为你|已添加|已生成|已更新|记下了|帮你想|帮你把/
      if (actionClaimRegex.test(reply || '')) {
        const fallbackAction = extractFallbackAction(userMessage || '', reply || '')
        if (fallbackAction) {
          logger.warn('前端兜底执行', fallbackAction.type)
          const fbResult = store.executeAction(fallbackAction)
          if (fbResult && fbResult.success) {
            execResult = fbResult
            const msg = fbResult.message || ''
            if (msg && msg !== '无需执行') displayContent = reply + `\n\n${msg}`
            const noCardTypes = ['undo_last', 'get_profile', 'clear_profile', 'toggle_profile']
            const showCard = !noCardTypes.includes(fallbackAction.type) &&
              !fallbackAction.type.startsWith('query_') && execResult.detail && !execResult.detail.deleted
            store.updateLastMessage({
              content: displayContent, loading: false, aiReply: reply,
              actionCard: showCard ? { type: fallbackAction.type, payload: execResult.detail } : null,
              execResult
            })
            return
          }
        }
        displayContent += '\n\n⚠️ 该操作未实际执行(AI 未返回有效指令),请重新描述你的需求'
        logger.warn('AI 声称已操作但未返回 action', JSON.stringify(result))
      }
    }

    const cardType = effectiveAction?.type
    const noCardTypes = ['undo_last', 'get_profile', 'clear_profile', 'toggle_profile']
    const showCard = execResult && execResult.success && execResult.detail &&
      !execResult.detail.deleted && !cardType?.startsWith('query_') && !noCardTypes.includes(cardType)

    store.updateLastMessage({
      content: displayContent, loading: false, aiReply: reply,
      actionCard: showCard ? { type: effectiveAction.type, payload: execResult.detail } : null,
      execResult
    })
  }

  /** 确认待执行操作 */
  function handleConfirmAction() {
    if (pendingActions.value.length > 1) {
      const multiResult = store.executeActions(pendingActions.value)
      let content = pendingReply.value + `\n\n${multiResult.message}`
      store.updateLastMessage({
        content, pendingAction: null, pendingActions: [],
        aiReply: pendingReply.value,
        execResult: { success: multiResult.allSuccess, message: multiResult.message, detail: multiResult.detail?.[0] },
        execResults: multiResult.results.filter(r => r.success && r.detail)
      })
    } else if (pendingAction.value) {
      const execResult = store.executeAction(pendingAction.value)
      let content = pendingReply.value + `\n\n${execResult.message}`
      store.updateLastMessage({
        content, pendingAction: null, aiReply: pendingReply.value,
        actionCard: execResult.success ? { type: pendingAction.value.type, payload: execResult.detail } : null,
        execResult
      })
    }
    pendingAction.value = null
    pendingActions.value = []
    pendingReply.value = ''
  }

  /** 取消待执行操作 */
  function handleCancelAction() {
    store.updateLastMessage({ content: pendingReply.value + '\n\n已取消', pendingAction: null, pendingActions: [] })
    pendingAction.value = null
    pendingActions.value = []
    pendingReply.value = ''
  }

  return {
    isSending, stopSignal, pendingAction, pendingActions, pendingReply, currentSuggestions,
    getWelcomeMessage, handleSend, handleStop, autoExecuteAndDisplay,
    handleConfirmAction, handleCancelAction
  }
}
