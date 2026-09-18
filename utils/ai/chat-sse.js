/**
 * chat-sse.js — H5 真实 SSE 流式（3.5.11 从 chat-stream.js 拆出）
 *
 * fetch + ReadableStream 解析 OpenAI 兼容 SSE；支持 stopSignal 中断、首字超时判定；
 * 失败自动降级 simulatedStream。
 */
import { getProvider, supportsStreamStructuredOutput, getReasoningConfig, getMaxTokens } from './providers.js'
import { parseAiResponse } from './response-parser.js'
import { buildChatMessages, getRecentHistory } from './chat-helpers.js'
import { chatRequest as chatRequestNonStream } from './chat-request.js'
import { simulatedStream } from './chat-simulated.js'
import { logger } from '../logger.js'
// ==================== 真实 SSE 流式（H5）====================

/**
 * 真实 SSE 流式输出 — 基于 fetch + ReadableStream
 * 支持所有兼容 OpenAI 格式的 API（DeepSeek/OpenAI/Moonshot/智谱/通义）
 */
export async function chatRequestRealStream(message, conversationId, cfg, onChunk, history) {
  const provider = getProvider(cfg.provider)
  const apiKey = cfg.apiKey || ''
  const chatHistory = history || getRecentHistory()
  const messages = buildChatMessages(message, chatHistory, cfg)
  const stopSignal = cfg.stopSignal || null  // { stopped: false } 引用，外部可设置为 true 终止输出

  // 4.3.0：带上输出上限，长文才不会写到一半被厂商默认值截断
  const body = { model: cfg.model, messages, temperature: cfg.temperature ?? 0.7, stream: true, max_tokens: getMaxTokens(cfg.provider) }
  // D3: 结构化输出按模型能力路由（模型级 structured 字段 > 厂商级 supportsStructuredOutput）
  // 流式额外校验：DeepSeek V4 流式 + json_object 会返回空内容（实测硬约束），流式路径禁用
  if (supportsStreamStructuredOutput(cfg.provider, cfg.model)) {
    body.response_format = { type: 'json_object' }
  }
  // D4: 推理分级 — 日常对话用 low，仅对声明 thinking 能力的模型注入
  const reasoning = getReasoningConfig(cfg.provider, cfg.model, 'chat')
  if (reasoning) Object.assign(body, reasoning)

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

    // 空回复标记 — 兜底文案也算空回复（_isFallback），必须触发自动重试，
    // 否则 retryStreamWithBackoff 拿到非空兜底 reply 会跳过重试，用户只能手动点
    if ((result._isFallback || !result.reply || !result.reply.trim()) && !stopSignal?.stopped) {
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