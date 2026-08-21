/**
 * 流式聊天请求模块
 * 提供三种流式输出策略：
 *   1. chatRequestStream — 公开入口（含 H5 条件编译检测，自动选择策略）
 *   2. chatRequestRealStream — 真实 SSE 流式（fetch + ReadableStream）
 *   3. simulatedStream — 逐字模拟流式（兼容非 H5 环境）
 */

import { getProvider, getDefaultConfig } from './providers.js'
import { parseAiResponse } from './response-parser.js'
import { buildChatMessages, getRecentHistory } from './chat-helpers.js'
import { chatRequest as chatRequestNonStream } from './chat-request.js'
import { logger } from '../logger.js'
import { checkRateLimit, recordRequest } from './rate-limiter.js'
import { runAgentChat } from './agent-loop.js'
import { chatRequestChunkedStream } from './chat-chunked.js'

// ==================== 公开入口 ====================

/**
 * 流式聊天请求 — 根据平台自动选择 SSE 或模拟流式
 * @param {string} message 用户消息
 * @param {string} conversationId 会话ID
 * @param {string|object} config API Key 字符串或完整配置对象
 * @param {function} onChunk 每次回调 (chunkText) => void
 * @param {Array} history 对话历史
 * @returns {Promise<object>} 完整解析结果
 */
export function chatRequestStream(message, conversationId, config, onChunk, history) {
  const cfg = typeof config === 'string'
    ? { provider: 'deepseek', model: 'deepseek-v4-flash', apiKey: config }
    : (config || getDefaultConfig())

  // API Key 为空 — 直接走离线降级，不发无意义请求
  if (!cfg.apiKey) {
    logger.warn('[Stream] API Key 为空，走离线降级')
    return Promise.resolve({ reply: '', _offline: true, _reason: 'no_api_key' })
  }

  // 限流检查
  const { allowed, reason } = checkRateLimit()
  if (!allowed) {
    return Promise.reject(new Error(reason))
  }
  recordRequest()

  // Agent 模式 — 工具循环（支持 function calling 的厂商启用）
  const store = cfg.store
  if (store && cfg.agent !== false) {
    const provider = getProvider(cfg.provider)
    if (provider.supportsToolCalling) {
      // 仅对可能涉及数据的消息启用 agent 循环，纯闲聊走原路径（避免多余延迟）
      if (looksDataQuery(message) || isCommandMessage(message)) {
        logger.log('[AgentMode] Enabling tool loop for message')
        // 注入 agent skills + agentId（内置 Agent 使用定制化技能 prompt）
        if (store.getAgentSkills) {
          cfg.skills = store.getAgentSkills(store.activeAgentId)
        }
        cfg.agentId = store.activeAgentId
        cfg.agentMode = true
        return runAgentChat(store, message, conversationId, cfg, history || getRecentHistory(), onChunk, cfg.onStatus)
      }
    }
  }

  // H5 环境优先使用真实 SSE 流式
  // #ifdef H5
  if (typeof fetch !== 'undefined' && typeof ReadableStream !== 'undefined') {
    return chatRequestRealStream(message, conversationId, cfg, onChunk, history)
  }
  return simulatedStream(message, conversationId, cfg, onChunk, history)
  // #endif

  // App 端使用 enableChunked 真实流式；异常自动降级模拟流式
  // #ifdef APP-PLUS
  return chatRequestChunkedStream(message, conversationId, cfg, onChunk, history)
  // #endif

  // 其余平台（小程序）降级为模拟流式
  // #ifndef H5 || APP-PLUS
  return simulatedStream(message, conversationId, cfg, onChunk, history)
  // #endif
}

/** 判断消息是否可能涉及数据查询（触发 agent 工具循环） */
function looksDataQuery(msg) {
  if (!msg || msg.length < 4) return false
  // 收窄：需要明确的查询意图词+数据域词组合，避免"今天好累想记录一下"误触发
  return /(?:花了多少|花掉|查一下.*(?:账单|消费|记录|计划|账)|多少.*(?:钱|笔|个|次|条)|几个|几次|哪些|上次.*(?:说|记|聊|写)|之前.*(?:说|记|聊|写)|上个月|这个月|本月|最近.*(?:花了|消费|支出|收入|记|写|计划)|预算|总结|周报|月报|消费记录|账单明细)/.test(msg)
}

/** 判断消息是否含明确指令（触发 agent 工具循环） */
function isCommandMessage(msg) {
  if (!msg) return false
  // 收窄：需要"动作词+对象"组合，避免"我想记录一下心情"误触发（应为闲聊）
  return /(?:帮我(?:记|查|建|写|创建|修改|更新|删除|撤销)|记一下(?:账|消费|支出|收入|记录)|查一下(?:账|账单|消费|记录|计划|人)|建一个(?:计划|记录)|写一篇(?:记录|日记|周报|月报)|创建(?:计划|记录|账单|决策)|修改(?:计划|记录|账单)|更新(?:计划|记录|画像)|删除(?:计划|记录|账单)|撤销)/.test(msg)
}

// ==================== 真实 SSE 流式（H5）====================

/**
 * 真实 SSE 流式输出 — 基于 fetch + ReadableStream
 * 支持所有兼容 OpenAI 格式的 API（DeepSeek/OpenAI/Moonshot/智谱/通义）
 */
async function chatRequestRealStream(message, conversationId, cfg, onChunk, history) {
  const provider = getProvider(cfg.provider)
  const apiKey = cfg.apiKey || ''
  const chatHistory = history || getRecentHistory()
  const messages = buildChatMessages(message, chatHistory, cfg)
  const stopSignal = cfg.stopSignal || null  // { stopped: false } 引用，外部可设置为 true 终止输出

  const body = { model: cfg.model, messages, temperature: cfg.temperature ?? 0.7, stream: true }
  // 仅 OpenAI 官方模型稳定支持 response_format，其他厂商靠系统提示词约束
  if (provider.supportsResponseFormat) {
    body.response_format = { type: 'json_object' }
  }

  // 流式超时保护：30 秒无任何响应则中止（原来 60s 太长，用户等不住）
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)
  // 超时计数器：如果 30s 内没有任何 chunk 到达，认为连接已死
  let firstChunkReceived = false
  let staleTimer = null
  // 如果外部提供了 stopSignal，也监听中止
  let stopCheckId = null
  if (stopSignal) {
    stopCheckId = setInterval(() => {
      if (stopSignal.stopped) controller.abort()
    }, 200)
  }

  try {
    const resp = await fetch(provider.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    })

    // 收到响应头后清除超时（后续靠 reader read 自身超时）
    clearTimeout(timeoutId)

    if (!resp.ok) {
      // 非流式错误 — 降级到普通请求
      logger.warn(`[Stream] HTTP ${resp.status}, fallback to normal request: provider=${cfg.provider}, model=${cfg.model}`)
      const result = await chatRequestNonStream(message, null, conversationId, cfg)
      const reply = result.reply || ''
      if (onChunk && reply) onChunk(reply)
      return result
    }

    const reader = resp.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let fullContent = ''
    let conversationIdResult = ''
    let chunkCount = 0

    // 收到响应头后启动 stale 计时器：如果 30s 内没有任何 chunk，中止
    staleTimer = setTimeout(() => {
      if (!firstChunkReceived) {
        logger.warn('[Stream] No chunk received in 30s, aborting')
        controller.abort()
      }
    }, 30000)

    while (true) {
      if (stopSignal?.stopped) break
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // 处理 SSE 数据行
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // 保留最后不完整的行

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith(':')) continue // 空行或注释
        if (!trimmed.startsWith('data:')) continue

        const data = trimmed.slice(5).trim()
        if (data === '[DONE]') continue

        try {
          const json = JSON.parse(data)
          const delta = json.choices?.[0]?.delta?.content || ''
          if (delta) {
            fullContent += delta
            chunkCount++
            if (!firstChunkReceived) {
              firstChunkReceived = true
              if (staleTimer) { clearTimeout(staleTimer); staleTimer = null }
            }
            if (onChunk) onChunk(delta)
          }
          // 检测 API 错误返回（非标准 SSE 流）
          if (json.error) {
            logger.warn(`[Stream] API error in chunk: ${json.error.message || JSON.stringify(json.error)}`)
            throw new Error(json.error.message || 'API error in stream')
          }
          if (json.id) conversationIdResult = json.id
        } catch (e) {
          if (e.message && e.message.includes('API error')) throw e
          // JSON 解析失败 — 可能是分片不完整，跳过
        }
      }
    }

    // 处理 buffer 中剩余数据
    if (buffer.trim().startsWith('data:')) {
      const data = buffer.trim().slice(5).trim()
      if (data && data !== '[DONE]') {
        try {
          const json = JSON.parse(data)
          const delta = json.choices?.[0]?.delta?.content || ''
          if (delta) {
            fullContent += delta
            if (onChunk) onChunk(delta)
          }
        } catch (e) { /* 忽略 */ }
      }
    }

    // 解析完整的 AI 响应（可能被中途停止）
    if (!fullContent) {
      logger.warn(`[Stream] 0 chunks received, status=${resp.status}, chunkCount=${chunkCount}, buffer bytes=${buffer.length}`)
    }
    const result = parseAiResponse(fullContent, conversationId)
    if (conversationIdResult) result.conversation_id = conversationIdResult
    if (stopSignal?.stopped) result.stopped = true

    // 空回复标记 — 仅以 reply 是否为空判定，不使用关键词启发（避免误伤正常回复）
    if ((!result.reply || !result.reply.trim()) && !stopSignal?.stopped) {
      result._emptyReply = true
    }

    return result
  } catch (e) {
    clearTimeout(timeoutId)
    if (staleTimer) clearTimeout(staleTimer)
    if (stopCheckId) clearInterval(stopCheckId)
    // 超时中止
    if (e.name === 'AbortError') {
      logger.warn('[Stream] Request aborted (timeout or user stop)')
      return { reply: '', _emptyReply: true, _aborted: true, _timeout: !firstChunkReceived }
    }
    // API 参数错误（如无效 model/endpoint）→ 直接抛出，不浪费重试
    if (e.message && (e.message.includes('API error') || e.message.includes('InternalError'))) {
      throw e
    }
    logger.warn('[Stream] Real stream failed, fallback to simulated:', e.message)
    return simulatedStream(message, conversationId, cfg, onChunk)
  } finally {
    clearTimeout(timeoutId)
    if (staleTimer) clearTimeout(staleTimer)
    if (stopCheckId) clearInterval(stopCheckId)
  }
}

// ==================== 模拟流式（非 H5 降级）====================

/**
 * 模拟流式输出 — 逐字推送（加速版）
 */
async function simulatedStream(message, conversationId, cfg, onChunk, history) {
  const stopSignal = cfg.stopSignal || null
  try {
    // 跳过限流：chatRequestStream 入口已经检查过
    const result = await chatRequestNonStream(message, null, conversationId, cfg, history, true)
    const reply = result.reply || ''

    if (result.offline) {
      if (onChunk) onChunk(reply)
      return result
    }

    if (!reply || !reply.trim()) {
      return { reply: '', _emptyReply: true }
    }

    if (onChunk && reply) {
      const chars = reply.split('')
      const baseGroup = reply.length > 150 ? 12 : 5
      let i = 0
      while (i < chars.length) {
        // P1-8: stopSignal 检查 — 用户点停止时中断模拟流式
        if (stopSignal?.stopped) break
        const groupSize = Math.min(baseGroup + Math.floor(Math.random() * 4), chars.length - i)
        const chunk = chars.slice(i, i + groupSize).join('')
        onChunk(chunk)
        i += groupSize
        const lastChar = chars[i - 1]
        const delay = /[。！？\n]/.test(lastChar) ? 40 : /[，、；：]/.test(lastChar) ? 25 : 8
        await new Promise(r => setTimeout(r, delay))
      }
      if (stopSignal?.stopped) {
        result._aborted = true
        result.reply = reply.substring(0, i)
      }
    }

    return result
  } catch (e) {
    logger.error('[SimulatedStream] Error:', e.message)
    return { reply: '', _emptyReply: true, _error: e.message }
  }
}
