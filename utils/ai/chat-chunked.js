/**
 * chat-chunked.js ? App 端真实 SSE 流式（uni.request enableChunked）
 *
 * H5 用 fetch+ReadableStream（chat-stream.js）；App 端用 uni.request({ enableChunked: true })，
 * success 回调随数据分块多次触发，解析 SSE 行后逐段回调 onChunk。
 * 任何异常返回 _error 标记，由调用方透出真实错误或降级。
 */
import { getProvider , supportsStreamStructuredOutput, getReasoningConfig } from './providers.js'
import { parseAiResponse } from './response-parser.js'
import { buildChatMessages } from './chat-helpers.js'
import { logger } from '../logger.js'

/**
 * App 端分块流式请求
 * @param {string} message 用户消息
 * @param {string} conversationId 会话ID
 * @param {object} cfg - { provider, model, apiKey, temperature, stopSignal, systemPrompt, image }
 * @param {function} onChunk 每次增量回调
 * @param {Array} history 会话历史
 * @param {object} opts - { messages?: Array, raw?: boolean }
 *   messages: 传入已构建消息数组（agent 最终回复用），否则内部构建
 *   raw: true 时 resolve { content, conversation_id }（原始拼接文本，agent 用）
 * @returns {Promise<object>}
 */
export function chatRequestChunkedStream(message, conversationId, cfg, onChunk, history, opts = {}) {
  // #ifdef APP-PLUS
  return chunkedImpl(message, conversationId, cfg, onChunk, history, opts)
  // #endif
  // #ifndef APP-PLUS
  return Promise.reject(new Error('chunked stream not supported on this platform'))
  // #endif
}

/** 从 API 错误响应中提取可读错误信息（uni.request 的 res.data 可能是对象或 JSON 字符串） */
export function parseApiError(data) {
  if (!data) return ''
  let parsed = data
  if (typeof data === "string") {
    try { parsed = JSON.parse(data) } catch { return data.slice(0, 200) }
  }
  const msg = parsed?.error?.message || parsed?.message || parsed?.errMsg || ''
  return typeof msg === 'string' ? msg.slice(0, 300) : String(msg || '')
}

/**
 * 计算分块增量，兼容 App 端累积/增量两种回调模式
 * 相同数据重发返回空增量（跳过），避免整段内容被重复解析
 * @param {string} processed 已处理内容
 * @param {string} data 本次回调数据
 * @returns {{ delta: string, processed: string }}
 */
export function computeChunkDelta(processed, data) {
  if (!data) return { delta: '', processed }
  if (data.startsWith(processed) && processed.length > 0) {
    if (data.length > processed.length) {
      return { delta: data.slice(processed.length), processed: data }
    }
    return { delta: '', processed }
  }
  return { delta: data, processed: processed + data }
}


// #ifdef APP-PLUS
function chunkedImpl(message, conversationId, cfg, onChunk, history, opts) {
  return new Promise((resolve) => {
    // 非 App 运行时（vitest/降级）直接拒绝，由调用方回退模拟流式
    if (typeof plus === 'undefined') {
      resolve({ reply: '', _emptyReply: true, _error: 'chunked requires App runtime' })
      return
    }
    const provider = getProvider(cfg.provider)
    const apiKey = cfg.apiKey || ''
    const stopSignal = cfg.stopSignal || null
    const chatHistory = history || []
    const messages = opts.messages || buildChatMessages(message, chatHistory, cfg)
    // D3: 结构化输出按模型能力路由（400 报错时去掉 response_format 降级重试）
    // 流式额外校验：DeepSeek V4 流式 + json_object 会返回空内容（实测硬约束），流式路径禁用
    const useFormat = supportsStreamStructuredOutput(cfg.provider, cfg.model)
    // D4: 推理分级 — 日常对话 low
    const reasoning = getReasoningConfig(cfg.provider, cfg.model, 'chat')
    const buildBody = (withFormat) => {
      const b = { model: cfg.model, messages, temperature: cfg.temperature ?? 0.7, stream: true }
      if (withFormat && useFormat) b.response_format = { type: 'json_object' }
      if (reasoning) Object.assign(b, reasoning)
      return b
    }
    let body = buildBody(true)
    let formatRetried = false

    let buffer = ''
    let processed = ''
    let fullContent = ''
    let conversationIdResult = ''
    let firstChunkReceived = false
    let finished = false
    let stopCheckId = null
    let staleTimer = null
    let task = null
    let requestSeq = 0

    const cleanup = () => {
      if (stopCheckId) { clearInterval(stopCheckId); stopCheckId = null }
      if (staleTimer) { clearTimeout(staleTimer); staleTimer = null }
    }

    const finish = (result) => {
      if (finished) return
      finished = true
      cleanup()
      resolve(result)
    }

    let lastSseLine = ''
    const handleChunk = (chunkText) => {
      buffer += chunkText
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue
        // 同一 SSE 事件重发（服务端/网络层）时跳过，避免内容重复
        if (trimmed === lastSseLine) continue
        lastSseLine = trimmed
        const data = trimmed.slice(5).trim()
        if (data === '[DONE]') continue
        try {
          const json = JSON.parse(data)
          const delta = json.choices?.[0]?.delta?.content || ''
          if (delta) {
            fullContent += delta
            if (!firstChunkReceived) {
              firstChunkReceived = true
              if (staleTimer) { clearTimeout(staleTimer); staleTimer = null }
            }
            if (onChunk) onChunk(delta)
          }
          if (json.error) {
            logger.warn('[ChunkedStream] API error in chunk: ' + (json.error.message || ''))
            throw new Error(json.error.message || 'API error in stream')
          }
          if (json.id) conversationIdResult = json.id
        } catch (e) {
          if (e.message && e.message.includes('API error')) throw e
          // 分片不完整，跳过
        }
      }
    }

    const buildResult = (extra = {}) => {
      if (extra._error) {
        // 请求失败：透出真实错误，避免“走神”兜底掩盖 API 报错
        const base = { conversation_id: conversationIdResult || conversationId, _emptyReply: true, _failed: true, ...extra }
        if (opts.raw) return { content: '', ...base }
        return { reply: '', ...base }
      }
      if (opts.raw) {
        return { content: fullContent, conversation_id: conversationIdResult || conversationId, ...extra }
      }
      const result = parseAiResponse(fullContent, conversationId)
      if (conversationIdResult) result.conversation_id = conversationIdResult
      if (stopSignal?.stopped) result.stopped = true
      if ((result._isFallback || !result.reply || !result.reply.trim()) && !stopSignal?.stopped) result._emptyReply = true
      return { ...result, ...extra }
    }

    // 首块 30s 未到视为连接失败
    const startRequest = () => {
      lastSseLine = ''
      const seq = ++requestSeq
      staleTimer = setTimeout(() => {
        if (seq !== requestSeq) return
        if (!firstChunkReceived && task) {
          logger.warn('[ChunkedStream] No chunk in 30s, aborting')
          try { if (task.abort) task.abort() } catch (e) { /* ignore */ }
        }
      }, 30000)

      task = uni.request({
        url: provider.endpoint,
        method: 'POST',
        header: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        data: body,
        enableChunked: true,
        timeout: 120000,
        success(res) {
          if (finished || seq !== requestSeq) return
          if (res.statusCode && res.statusCode !== 200) {
            const errMsg = parseApiError(res.data) || `HTTP ${res.statusCode}`
            // 400 且已启用 JSON 模式 → 去掉 response_format 重试一次（对齐非流式路径）
            if (res.statusCode === 400 && useFormat && !formatRetried) {
              formatRetried = true
              requestSeq++
              body = buildBody(false)
              logger.warn('[ChunkedStream] HTTP 400 with response_format, retry without it')
              try { if (task.abort) task.abort() } catch (e) { /* ignore */ }
              startRequest()
              return
            }
            logger.warn(`[ChunkedStream] HTTP ${res.statusCode}: ${errMsg}`)
            finish(buildResult({ _error: errMsg }))
            return
          }
          const data = typeof res.data === 'string' ? res.data : ''
          if (!data) return
          // 兼容增量/累积两种模式：累积时取增量，增量时直接追加；相同数据重发跳过
          const { delta, processed: nextProcessed } = computeChunkDelta(processed, data)
          processed = nextProcessed
          if (!delta) return
          try { handleChunk(delta) } catch (e) {
            finish(buildResult({ _error: e.message }))
          }
        },
        fail(err) {
          if (finished || seq !== requestSeq) return
          if (stopSignal?.stopped) {
            finish(buildResult({ _aborted: true, _timeout: !firstChunkReceived }))
            return
          }
          logger.warn('[ChunkedStream] fail: ' + (err.errMsg || ''), ', fallback')
          finish(buildResult({ _error: err.errMsg || 'request failed' }))
        },
        complete() {
          if (finished || seq !== requestSeq) return
          // 处理剩余缓冲
          try { handleChunk('') } catch (e) { /* ignore */ }
          // 服务端忽略 stream 参数时可能返回普通 JSON，做一次缓冲内容拷底
          if (!fullContent && buffer.trim().startsWith('{')) {
            try {
              const parsed = JSON.parse(buffer.trim())
              const content = parsed.choices?.[0]?.message?.content || ''
              if (content) {
                fullContent = content
                if (onChunk) onChunk(content)
              }
            } catch (e) { /* ignore */ }
          }
          finish(buildResult())
        }
      })
    }
    startRequest()

    if (stopSignal) {
      stopCheckId = setInterval(() => {
        if (stopSignal.stopped) {
          cleanup()
          try { if (task && task.abort) task.abort() } catch (e) { /* ignore */ }
        }
      }, 200)
    }
  })
}
// #endif
