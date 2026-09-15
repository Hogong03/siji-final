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
 *
 * 3.5.11：请求传输（HTTP/SSE/App chunked/重试）拆到 agent-transport.js；
 *         工具参数解析失败不再静默用 {} 执行，改为回传模型自纠；写入失败追加自检提示。
 */

import { getProvider } from './providers.js'
import { buildChatMessages } from './chat-helpers.js'
import { executeTool, QUERY_TOOLS, needsConfirmation, TOOL_LABELS, getTruncateLimit, parseToolArgs, argErrorResult } from './tools.js'
import { parseAiResponse } from './response-parser.js'
import { AGENT_TOOL_INSTRUCTION } from './prompt-actions.js'
import { executeWebSearch } from './tools/web-search.js'
import { callWithTools } from './agent-transport.js'
import { logger } from '../logger.js'

const MAX_ROUNDS = 5          // 最多工具调用轮数，防死循环



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
  const toolInstruction = AGENT_TOOL_INSTRUCTION

  const messages = [
    { ...baseMessages[0], content: baseMessages[0].content + toolInstruction },
    ...baseMessages.slice(1)
  ]

  const toolCalls = []        // 记录所有 tool_call
  const execResults = []      // 记录所有执行结果
  let rounds = 0

  while (rounds < MAX_ROUNDS) {
    rounds++
    const roundStart = execResults.length // 本轮起点：写入失败自检用（3.5.11）
    // 用户停止 — 立即退出工具循环
    if (cfg.stopSignal?.stopped) {
      logger.warn('[AgentLoop] Stopped by user, exiting loop')
      return { reply: '', action: null, actions: [], toolCalls, execResults, conversation_id: conversationId, _agentMode: true, _stopped: true }
    }
    const response = await callWithTools(provider, cfg, messages, apiKey)
    if (response.stopped || cfg.stopSignal?.stopped) {
      logger.warn('[AgentLoop] Stopped by user, exiting loop')
      return { reply: '', action: null, actions: [], toolCalls, execResults, conversation_id: conversationId, _agentMode: true, _stopped: true }
    }

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
    // Kimi K3 要求：多轮工具调用必须原样回传完整 assistant message（含 reasoning_content）
    const assistantTurn = {
      role: 'assistant',
      content: assistantMsg.content || '',
      tool_calls: callList,
      ...(assistantMsg.reasoning_content ? { reasoning_content: assistantMsg.reasoning_content } : {})
    }
    messages.push(assistantTurn)

    // 进度反馈：通知 UI 正在执行哪些工具
    if (onStatus && callList.length > 0) {
      const toolNames = callList.map(c => c.function?.name).filter(Boolean)
      onStatus(toolNames)
    }

    // 分离查询类和写入类：查询类可并行执行，写入类串行执行防顺序依赖
    const queryCalls = callList.filter(c => QUERY_TOOLS.has(c.function?.name))
    const writeCalls = callList.filter(c => !QUERY_TOOLS.has(c.function?.name))

    // 处理确认需求：同一轮所有需确认的写入工具全部挂起，返回待确认信息（单/多操作确认卡）
    const pendingCalls = []
    for (const call of writeCalls) {
      const fnName = call.function?.name
      const parsed = parseToolArgs(call.function?.arguments)
      if (!parsed.ok) continue // 参数不可用的调用不做确认，交给写入轮回传错误
      if (needsConfirmation(fnName, parsed.args)) {
        pendingCalls.push({ name: fnName, args: parsed.args })
      }
    }
    if (pendingCalls.length > 0) {
      const reasons = pendingCalls.map((p) => {
        const isBill = (p.name === 'create_bill' || p.name === 'update_bill') && typeof p.args.amount === 'number'
        return isBill ? `金额 ¥${p.args.amount} 较大` : (TOOL_LABELS[p.name] || p.name)
      })
      for (const p of pendingCalls) {
        toolCalls.push({ name: p.name, args: p.args })
        execResults.push({
          name: p.name, ok: false, confirm: true,
          message: `${reasons.join('、')}，需要你确认一下再执行`,
          detail: { type: p.name, payload: p.args, confirmReason: reasons.join('、') }
        })
      }
      const multi = pendingCalls.length > 1
      const first = pendingCalls[0]
      return {
        reply: `我需要确认一下：${reasons.join('、')}${multi ? `（${pendingCalls.length} 个操作）` : ''}，确认执行吗？`,
        action: multi
          ? { type: 'multi', payload: null, needConfirm: true }
          : { type: first.name, payload: first.args, needConfirm: true },
        actions: multi ? pendingCalls.map(p => ({ type: p.name, payload: p.args, needConfirm: true })) : [],
        toolCalls,
        execResults,
        conversation_id: conversationId,
        _agentMode: true,
        _agentExecuted: false
      }
    }

    // 并行执行查询类工具
    if (queryCalls.length > 0) {
      const queryResults = await Promise.all(queryCalls.map(async (call) => {
        const fnName = call.function?.name
        const parsed = parseToolArgs(call.function?.arguments)
        // 3.5.11：参数解析失败不再静默用 {} 执行，改为回传错误让模型重发
        if (!parsed.ok) {
          return { call, fnName, fnArgs: null, toolResult: argErrorResult(fnName, parsed.reason) }
        }
        const fnArgs = parsed.args
        // web_search 独立执行（网络调用，不走 store）
        const toolResult = fnName === 'web_search'
          ? await executeWebSearch(fnArgs.query)
          : executeTool(store, fnName, fnArgs)
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
      const parsed = parseToolArgs(call.function?.arguments)
      if (!parsed.ok) {
        // 3.5.11：参数不可解析 → 记失败并把原因回传，模型下一轮重发
        toolCalls.push({ name: fnName, args: null })
        const failed = argErrorResult(fnName, parsed.reason)
        execResults.push({ name: fnName, ok: false, message: failed.text, detail: null, confirm: false })
        messages.push({ role: 'tool', tool_call_id: call.id, content: failed.text })
        continue
      }
      const fnArgs = parsed.args

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

    // 3.5.11 自检：本轮写入失败 → 明确要求模型自纠，禁止把失败文本当结论回复用户
    const roundFailedWrites = execResults.slice(roundStart).filter(r => !r.ok && !r.confirm && !QUERY_TOOLS.has(r.name))
    if (roundFailedWrites.length > 0) {
      const failedText = roundFailedWrites.map(r => `${TOOL_LABELS[r.name] || r.name}（${r.message || '未知原因'}）`).join('、')
      messages.push({ role: 'user', content: `[系统] 本轮写入未成功：${failedText}。请修正参数后重新调用工具完成操作；确实无法完成就直接向用户说明原因。` })
    }
  }

  // 用户停止 — 不再请求最终回复
  if (cfg.stopSignal?.stopped) {
    logger.warn('[AgentLoop] Stopped by user')
    return { reply: '', action: null, actions: [], toolCalls, execResults, conversation_id: conversationId, _agentMode: true, _stopped: true }
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

export { MAX_ROUNDS, AGENT_TOOL_INSTRUCTION }
