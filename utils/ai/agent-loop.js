/**
 * agent-loop.js — Agent 工具循环引擎
 *
 * 把 AI 从"单轮返回 action"升级为"可多次调用工具、基于结果继续推理"。
 *
 * 流程：
 *   用户消息 → AI（带 tools 参数）→ 若返回 tool_calls → 执行工具 → 结果回传 AI
 *     → AI 再推理 → 可能再调 tool → ...（maxRounds 上限）→ AI 给出最终 reply
 *
 * 仅在 provider.supportsToolCalling 时启用；其余走原单轮路径（向后兼容）。
 */

import { getProvider } from './providers.js'
import { buildChatMessages } from './chat-helpers.js'
import { TOOL_DEFINITIONS, executeTool, QUERY_TOOLS, needsConfirmation } from './tools.js'
import { parseAiResponse } from './response-parser.js'
import { logger } from '../logger.js'

const MAX_ROUNDS = 5          // 最多工具调用轮数，防死循环
const MAX_QUERY_RESULTS = 20  // 查询类工具最多返回条数（防 token 爆炸）

/** 按工具类型动态截断 tool_result（防 token 爆炸但保留关键数据） */
const TOOL_RESULT_TRUNCATE_MAP = {
  query_stat: 800,       // 统计数据精简
  query_bill: 1500,      // 账单列表
  query_diary: 2000,     // 记录内容较长
  query_plan: 1500,      // 计划列表
  query_combined: 2500,  // 跨类型查询需要更多空间
  query_relation: 1200,  // 人物关系 JSON
  query_decision: 1500,  // 决策日志
  get_profile: 1000,     // 用户画像
  summarize_diaries: 2000, // 总结报告
  default: 2000
}
function getTruncateLimit(toolName) {
  return TOOL_RESULT_TRUNCATE_MAP[toolName] || TOOL_RESULT_TRUNCATE_MAP.default
}

/**
 * 运行 Agent 循环
 * @param {Object} store - useDataStore（pinia），用于执行工具
 * @param {string} message - 用户消息
 * @param {string} conversationId - 会话ID
 * @param {Object} cfg - { provider, model, apiKey, temperature, systemPrompt }
 * @param {Array} history - 对话历史
 * @returns {Promise<Object>} { reply, toolCalls, execResults, action, actions, conversation_id }
 */
export async function runAgentLoop(store, message, conversationId, cfg, history, onChunk, onStatus) {
  const provider = getProvider(cfg.provider)
  const apiKey = cfg.apiKey || ''
  const chatHistory = history || []

  // 构建基础消息（含 system/profile/记忆/关系等）
  const baseMessages = buildChatMessages(message, chatHistory, cfg)

  // system prompt 追加工具说明，让 AI 明确"要先查数据再回答"
  const toolInstruction = `
## Agent 模式
你是「思迹」的智能助手，可以调用工具读取本地数据后再回答用户。规则：
- 用户问涉及数据的问题（账单/记录/计划/人物/决策/反馈/标签）时，先调用对应 query_* 工具拿到真实数据，再基于数据回答。禁止凭记忆瞎编数字。
- 一个查询不够时，可连续调用多个工具（例如先 query_stat 再看 query_plan）。
- 用户明确要求创建/修改时，调用对应 create_*/update_* 工具。
- 用户说「撤销/撤回/取消刚才」时，调用 undo_last 工具。
- 纠错：用户指出数据有误（"记错了/不对/金额错了"）或你发现矛盾时，先 query 确认目标记录，再 update_* 直接修正本地数据，不要只说"建议手动修改"
- 标签管理：用户提到标签分类/归类时，调用 add_tag/update_tag_category/query_tags 直接操作
- 体验反馈可直接增删改查：create_feedback/update_feedback/delete_feedback/query_feedback
- 所有工具调用完成后，用自然语言总结回答用户。
- 若用户消息是纯闲聊，不调用任何工具，直接回复。`

  const messages = [
    { ...baseMessages[0], content: baseMessages[0].content + toolInstruction },
    ...baseMessages.slice(1)
  ]

  const toolCalls = []        // 记录所有 tool_call
  const execResults = []      // 记录所有执行结果
  let rounds = 0

  while (rounds < MAX_ROUNDS) {
    rounds++
    const response = await callWithTools(provider, cfg, messages, apiKey)

    // API 错误/网络失败 → 直接抛给上层处理
    if (response.error) {
      throw new Error(response.error)
    }

    const assistantMsg = response.message || {}
    const callList = assistantMsg.tool_calls || []

    // AI 没有请求工具 → 给出最终回复
    if (callList.length === 0) {
      const content = assistantMsg.content || ''
      // 若有 onChunk（来自 runAgentChat），推送内容（非 H5 模拟逐字）
      if (onChunk && content) {
        const chars = content.split('')
        const baseGroup = content.length > 150 ? 12 : 5
        for (let i = 0; i < chars.length; i += baseGroup + Math.floor(Math.random() * 4)) {
          const groupSize = Math.min(baseGroup + Math.floor(Math.random() * 4), chars.length - i)
          onChunk(chars.slice(i, i + groupSize).join(''))
          const lastChar = chars[Math.min(i + groupSize - 1, chars.length - 1)]
          const delay = /[。！？\n]/.test(lastChar) ? 40 : /[，、；：]/.test(lastChar) ? 25 : 8
          await new Promise(r => setTimeout(r, delay))
        }
      }
      // 兼容：AI 仍可能返回 JSON action 格式（部分场景）
      const result = parseAiResponse(content, conversationId)
      return {
        reply: result.reply,
        action: result.action,
        actions: result.actions,
        suggestions: result.suggestions,
        toolCalls,
        execResults,
        conversation_id: response.id || conversationId
      }
    }

    // 执行本轮所有工具调用（查询类并行，写入类串行）
    const assistantTurn = { role: 'assistant', content: assistantMsg.content || '', tool_calls: callList }
    messages.push(assistantTurn)

    // 进度反馈：通知 UI 正在执行哪些工具
    if (onStatus && callList.length > 0) {
      const toolNames = callList.map(c => c.function?.name).filter(Boolean)
      onStatus(toolNames)
    }

    // 分离查询类和写入类：查询类可并行执行，写入类串行执行防顺序依赖
    const queryCalls = callList.filter(c => QUERY_TOOLS.has(c.function?.name))
    const writeCalls = callList.filter(c => !QUERY_TOOLS.has(c.function?.name))

    // 处理确认需求：如果有工具需要确认，立即退出循环返回待确认信息
    for (const call of writeCalls) {
      const fnName = call.function?.name
      let fnArgs = {}
      try { fnArgs = JSON.parse(call.function?.arguments || '{}') } catch { fnArgs = {} }
      if (needsConfirmation(fnName, fnArgs)) {
        const reason = fnName === 'create_bill' || fnName === 'update_bill'
          ? `金额 ¥${fnArgs.amount} 较大`
          : `操作 ${fnName}`
        toolCalls.push({ name: fnName, args: fnArgs })
        execResults.push({
          name: fnName, ok: false, confirm: true,
          message: `${reason}，需要你确认一下再执行`,
          detail: { type: fnName, payload: fnArgs, confirmReason: reason }
        })
        // 返回待确认结果，上层 useChatEngine 走 pendingAction 流程
        return {
          reply: `我需要确认一下：${reason}，确认执行吗？`,
          action: { type: fnName, payload: fnArgs, needConfirm: true },
          actions: [],
          toolCalls,
          execResults,
          conversation_id: conversationId,
          _agentMode: true,
          _agentExecuted: false
        }
      }
    }

    // 并行执行查询类工具
    if (queryCalls.length > 0) {
      const queryResults = await Promise.all(queryCalls.map(async (call) => {
        const fnName = call.function?.name
        let fnArgs = {}
        try { fnArgs = JSON.parse(call.function?.arguments || '{}') } catch { fnArgs = {} }
        const toolResult = executeTool(store, fnName, fnArgs)
        return { call, fnName, fnArgs, toolResult }
      }))
      for (const { call, fnName, fnArgs, toolResult } of queryResults) {
        toolCalls.push({ name: fnName, args: fnArgs })
        execResults.push({
          name: fnName, ok: toolResult.ok,
          message: toolResult.message || null,
          detail: toolResult.detail || null,
          confirm: !!toolResult.confirm
        })
        let resultText = toolResult.text || '（无返回）'
        const truncateLimit = getTruncateLimit(fnName)
        if (resultText.length > truncateLimit) {
          resultText = resultText.substring(0, truncateLimit) + '…（已截断）'
        }
        messages.push({ role: 'tool', tool_call_id: call.id, content: resultText })
      }
    }

    // 串行执行写入类工具
    for (const call of writeCalls) {
      const fnName = call.function?.name
      let fnArgs = {}
      try { fnArgs = JSON.parse(call.function?.arguments || '{}') } catch { fnArgs = {} }

      const toolResult = executeTool(store, fnName, fnArgs)
      toolCalls.push({ name: fnName, args: fnArgs })
      execResults.push({
        name: fnName, ok: toolResult.ok,
        message: toolResult.message || null,
        detail: toolResult.detail || null,
        confirm: !!toolResult.confirm
      })
      let resultText = toolResult.text || '（无返回）'
      const truncateLimit = getTruncateLimit(fnName)
      if (resultText.length > truncateLimit) {
        resultText = resultText.substring(0, truncateLimit) + '…（已截断）'
      }
      messages.push({ role: 'tool', tool_call_id: call.id, content: resultText })
    }
  }

  // 达到 maxRounds — 兜底：让 AI 基于已收集数据给最终回答
  logger.warn('[AgentLoop] Max rounds reached, forcing final reply')
  const response = await callWithTools(provider, cfg, messages, apiKey, true, onChunk)
  const finalReply = response.message?.content || ''
  const result = parseAiResponse(finalReply, conversationId)
  return {
    reply: result.reply,
    action: result.action,
    actions: result.actions,
    toolCalls,
    execResults,
    conversation_id: response.id || conversationId
  }
}

/**
 * 调用带 tools 参数的 AI（非流式）
 * 当 isFinal=true 时用流式请求（最后一轮，AI 给最终回复）
 */
/** 工具调用轮次超时（ms）——工具轮次 30s，最终回复 45s */
const TOOL_CALL_TIMEOUT = 30000
const FINAL_REPLY_TIMEOUT = 45000
const MAX_API_RETRIES = 2

/** 带重试的非流式工具调用 */
function callWithTools(provider, cfg, messages, apiKey, isFinal = false, onChunk = null) {
  // 最后一轮且非工具调用 → 流式输出
  if (isFinal && onChunk && provider.supportsStream !== false) {
    return callWithToolsStream(provider, cfg, messages, apiKey, onChunk)
  }

  const body = {
    model: cfg.model,
    messages,
    temperature: cfg.temperature ?? 0.7,
    tools: TOOL_DEFINITIONS.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }
    })),
    tool_choice: 'auto'
  }

  const timeout = isFinal ? FINAL_REPLY_TIMEOUT : TOOL_CALL_TIMEOUT

  return callWithRetry(provider, cfg, body, apiKey, timeout, 0)
}

/** 带指数退避重试的 uni.request 封装 */
function callWithRetry(provider, cfg, body, apiKey, timeout, retryCount) {
  return new Promise((resolve) => {
    uni.request({
      url: provider.endpoint,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      data: body,
      timeout,
      success(res) {
        if (res.statusCode === 200 && res.data?.choices?.[0]) {
          const choice = res.data.choices[0]
          resolve({ message: choice.message, id: res.data.id })
        } else {
          const errMsg = res.data?.error?.message || res.data?.message || `HTTP ${res.statusCode}`
          logger.error('[AgentLoop] API error:', res.statusCode, errMsg)

          // 429/500+ 可重试
          if ((res.statusCode === 429 || res.statusCode >= 500) && retryCount < MAX_API_RETRIES) {
            const retryAfter = res.header?.['Retry-After'] || res.header?.['retry-after']
            const delay = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, retryCount) * 1500
            logger.warn(`[AgentLoop] HTTP ${res.statusCode}, retry ${retryCount + 1}/${MAX_API_RETRIES} in ${delay}ms`)
            setTimeout(() => {
              callWithRetry(provider, cfg, body, apiKey, timeout, retryCount + 1).then(resolve)
            }, delay)
            return
          }

          // 401 不重试
          if (res.statusCode === 401) {
            resolve({ error: `${provider.name} API Key 无效，请在设置页检查配置` })
            return
          }

          resolve({ error: errMsg })
        }
      },
      fail(err) {
        logger.error('[AgentLoop] Network error:', err.errMsg)

        if (retryCount < MAX_API_RETRIES) {
          const delay = Math.pow(2, retryCount) * 1500
          logger.warn(`[AgentLoop] Network retry ${retryCount + 1}/${MAX_API_RETRIES} in ${delay}ms`)
          setTimeout(() => {
            callWithRetry(provider, cfg, body, apiKey, timeout, retryCount + 1).then(resolve)
          }, delay)
          return
        }

        resolve({ error: '网络连接失败，请稍后再试' })
      }
    })
  })
}

/**
 * 流式调用（最后一轮，AI 给最终回复时用）
 * H5 用 fetch+ReadableStream，非 H5 降级为非流式 + 模拟逐字
 */
function callWithToolsStream(provider, cfg, messages, apiKey, onChunk) {
  // #ifdef H5
  return callWithToolsSSE(provider, cfg, messages, apiKey, onChunk)
  // #endif
  // #ifndef H5
  // 非 H5：退回非流式，拿到完整内容后逐字推送
  return callWithTools(provider, cfg, messages, apiKey).then(res => {
    if (res.error) return res
    const content = res.message?.content || ''
    if (content && onChunk) {
      const chars = content.split('')
      const baseGroup = content.length > 150 ? 12 : 5
      return (async () => {
        let i = 0
        while (i < chars.length) {
          const groupSize = Math.min(baseGroup + Math.floor(Math.random() * 4), chars.length - i)
          onChunk(chars.slice(i, i + groupSize).join(''))
          i += groupSize
          const lastChar = chars[i - 1]
          const delay = /[。！？\n]/.test(lastChar) ? 40 : /[，、；：]/.test(lastChar) ? 25 : 8
          await new Promise(r => setTimeout(r, delay))
        }
        return res
      })()
    }
    return res
  })
  // #endif
}

/** H5 SSE 流式 */
function callWithToolsSSE(provider, cfg, messages, apiKey, onChunk) {
  const body = {
    model: cfg.model,
    messages,
    temperature: cfg.temperature ?? 0.7,
    stream: true
    // 最后一轮不传 tools，让 AI 直接回复
  }

  return new Promise((resolve) => {
    let fullContent = ''
    let resolved = false
    const timer = setTimeout(() => {
      if (!resolved) { resolved = true; resolve({ message: { content: fullContent }, id: '' }) }
    }, 90000)

    fetch(provider.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    }).then(async (resp) => {
      const reader = resp.body?.getReader()
      if (!reader) {
        const data = await resp.json()
        clearTimeout(timer)
        resolved = true
        resolve({ message: data.choices?.[0]?.message || { content: '' }, id: data.id || '' })
        return
      }
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data:')) continue
          const jsonStr = trimmed.slice(5).trim()
          if (jsonStr === '[DONE]') continue
          try {
            const chunk = JSON.parse(jsonStr)
            const delta = chunk.choices?.[0]?.delta?.content || ''
            if (delta) {
              fullContent += delta
              onChunk(delta)
            }
          } catch { /* skip */ }
        }
      }
      clearTimeout(timer)
      if (!resolved) {
        resolved = true
        resolve({ message: { content: fullContent }, id: '' })
      }
    }).catch((err) => {
      clearTimeout(timer)
      if (!resolved) {
        resolved = true
        logger.error('[AgentLoop] SSE error:', err.message)
        resolve({ error: '网络连接失败，请稍后再试' })
      }
    })
  })
}

/**
 * Agent 对话入口 — 供 chat-stream 调用
 * 跑完工具循环后，把最终 reply 逐步推送，返回可被 useChatEngine 消费的结果对象。
 * 若工具调用时已执行写入操作，则标记 _agentExecuted，上层不再二次执行。
 * @param {Object} store - useDataStore
 * @param {string} message - 用户消息
 * @param {string} conversationId
 * @param {Object} cfg
 * @param {Array} history
 * @param {Function} onChunk - (text) => void，逐段推送最终回复
 */
export async function runAgentChat(store, message, conversationId, cfg, history, onChunk, onStatus) {
  const result = await runAgentLoop(store, message, conversationId, cfg, history, onChunk, onStatus)

  // 已执行过写入工具 → 标记，避免上层 autoExecutor 二次执行
  const hasWrites = result.execResults.some(r => r.ok && !QUERY_TOOLS.has(r.name))
  result._agentMode = true
  result._agentExecuted = hasWrites

  // runAgentLoop 内部已处理流式推送（最后一轮 SSE 或模拟逐字），此处不再重复
  return result
}

export { MAX_ROUNDS }
