/**
 * 流式聊天请求模块
 * 提供三种流式输出策略：
 *   1. chatRequestStream — 公开入口（含 H5 条件编译检测，自动选择策略）
 *   2. chatRequestRealStream — 真实 SSE 流式（fetch + ReadableStream）
 *   3. simulatedStream — 逐字模拟流式（兼容非 H5 环境）
 */

import { getProvider, getProviderKeys, getDefaultConfig } from './providers.js'
import { parseAiResponse } from './response-parser.js'
import { buildChatMessages, getRecentHistory } from './chat-helpers.js'
import { chatRequest as chatRequestNonStream } from './chat-request.js'
import { logger } from '../logger.js'

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

  // H5 环境优先使用真实 SSE 流式
  // #ifdef H5
  if (typeof fetch !== 'undefined' && typeof ReadableStream !== 'undefined') {
    return chatRequestRealStream(message, conversationId, cfg, onChunk, history)
  }
  // #endif

  // 非 H5 环境降级为模拟流式
  return simulatedStream(message, conversationId, cfg, onChunk, history)
}

// ==================== 真实 SSE 流式（H5）====================

/**
 * 真实 SSE 流式输出 — 基于 fetch + ReadableStream
 * 支持所有兼容 OpenAI 格式的 API（DeepSeek/OpenAI/Moonshot/智谱/通义）
 */
async function chatRequestRealStream(message, conversationId, cfg, onChunk, history) {
  const provider = getProvider(cfg.provider)
  const apiKey = cfg.apiKey || getProviderKeys()[cfg.provider] || ''
  const chatHistory = history || getRecentHistory()
  const messages = buildChatMessages(message, chatHistory, cfg)
  const stopSignal = cfg.stopSignal || null  // { stopped: false } 引用，外部可设置为 true 终止输出

  const body = { model: cfg.model, messages, temperature: cfg.temperature ?? 0.7, stream: true }
  // 仅 OpenAI 官方模型稳定支持 response_format，其他厂商靠系统提示词约束
  if (provider.supportsJsonFormat && cfg.provider !== 'qwen' && cfg.provider !== 'zhipu') {
    body.response_format = { type: 'json_object' }
  }

  // 流式超时保护：60 秒无任何响应则中止
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 60000)
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

    // 空回复标记 — 由调用方（useChatEngine）决定是否重试
    if ((!result.reply || !result.reply.trim() || result.reply.includes('走神了')) && !stopSignal?.stopped) {
      result._emptyReply = true
    }

    return result
  } catch (e) {
    clearTimeout(timeoutId)
    if (stopCheckId) clearInterval(stopCheckId)
    // 超时中止
    if (e.name === 'AbortError') {
      logger.warn('[Stream] Request aborted (timeout or user stop)')
      return { reply: '', _emptyReply: true, _aborted: true }
    }
    // API 参数错误（如无效 model/endpoint）→ 直接抛出，不浪费重试
    if (e.message && (e.message.includes('API error') || e.message.includes('InternalError'))) {
      throw e
    }
    logger.warn('[Stream] Real stream failed, fallback to simulated:', e.message)
    return simulatedStream(message, conversationId, cfg, onChunk)
  } finally {
    clearTimeout(timeoutId)
    if (stopCheckId) clearInterval(stopCheckId)
  }
}

// ==================== 模拟流式（非 H5 降级）====================

/**
 * 模拟流式输出 — 逐字推送（加速版）
 */
async function simulatedStream(message, conversationId, cfg, onChunk, history) {
  try {
    const result = await chatRequestNonStream(message, null, conversationId, cfg, history)
    const reply = result.reply || ''

    if (result.offline) {
      if (onChunk) onChunk(reply)
      return result
    }

    if (!reply || !reply.trim()) {
      return { reply: '', _emptyReply: true }
    }

    if (onChunk && reply) {
      // 按词组推送（每 2-3 个字一组），更自然
      const chars = reply.split('')
      let i = 0
      while (i < chars.length) {
        const groupSize = Math.min(3, chars.length - i)
        const chunk = chars.slice(i, i + groupSize).join('')
        onChunk(chunk)
        i += groupSize
        // 标点符号后稍长停顿，模拟思考节奏
        const lastChar = chars[i - 1]
        const delay = /[。，！？、；：\n]/.test(lastChar) ? 30 : 6
        await new Promise(r => setTimeout(r, delay))
      }
    }

    return result
  } catch (e) {
    logger.error('[SimulatedStream] Error:', e.message)
    return { reply: '', _emptyReply: true, _error: e.message }
  }
}
