/**
 * agent-transport.js — Agent 请求传输层（3.5.11 从 agent-loop.js 拆出）
 *
 * 负责：工具轮非流式请求（指数退避重试）、最终轮流式请求（H5 SSE / App enableChunked / 其余模拟逐字）、
 *       tools 列表构建、用户停止信号 → 请求中止。
 * 不负责：循环控制、工具执行、结果解析（留在 agent-loop.js）。
 */
import { getReasoningConfig, getMaxTokens } from './providers.js'
import { markReplyTruncated } from './response-parser.js'
import { TOOL_DEFINITIONS } from './tools.js'
import { isWebSearchAvailable } from './search-config.js'
import { isReadUrlAvailable } from './read-config.js'
import { chatRequestChunkedStream } from './chat-chunked.js'
import { logger } from '../logger.js'
/**
 * 调用带 tools 参数的 AI（非流式）
 * 当 isFinal=true 时用流式请求（最后一轮，AI 给最终回复）
 */
/** 工具调用轮次超时（ms）——工具轮次 30s，最终回复 45s */
const TOOL_CALL_TIMEOUT = 30000
const FINAL_REPLY_TIMEOUT = 45000
const MAX_API_RETRIES = 2

/** 带重试的非流式工具调用 */
export function callWithTools(provider, cfg, messages, apiKey, isFinal = false, onChunk = null) {
  // 最后一轮且非工具调用 → 流式输出
  if (isFinal && onChunk && provider.supportsStream !== false) {
    return callWithToolsStream(provider, cfg, messages, apiKey, onChunk)
  }

  const body = {
    model: cfg.model,
    messages,
    temperature: cfg.temperature ?? 0.7,
    // 4.3.0：工具轮也要给足输出上限 —— 长文常由 create_diary 一次性写进 content
    max_tokens: getMaxTokens(provider.id),
    tools: buildToolList(provider, cfg.model),
    tool_choice: 'auto'
  }

  // D4 推理分级：工具轮视为复杂任务，支持思考的模型注入 thinking/reasoning_effort
  const reasoning = getReasoningConfig(provider.id, cfg.model, 'complex')
  if (reasoning) Object.assign(body, reasoning)

  const timeout = isFinal ? FINAL_REPLY_TIMEOUT : TOOL_CALL_TIMEOUT

  return callWithRetry(provider, cfg, body, apiKey, timeout, 0)
}

/** 带指数退避重试的 uni.request 封装 */
function callWithRetry(provider, cfg, body, apiKey, timeout, retryCount) {
  const stopSignal = cfg.stopSignal
  let stopCheckId = null
  return new Promise((resolve) => {
    // 测试钩子（3.2 M1 回归集）：cfg._mockResponder(body) → { message, id }，替代 uni.request
    if (cfg && typeof cfg._mockResponder === 'function') {
      resolve(cfg._mockResponder(body))
      return
    }
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
          // 4.3.1：工具轮 / 最终轮都可能撞上输出上限，把终止原因带给上层
          resolve(markReplyTruncated({ message: choice.message, id: res.data.id }, choice.finish_reason))
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
      },
      complete() {
        if (stopCheckId) { clearInterval(stopCheckId); stopCheckId = null }
      }
    })
    if (stopSignal) {
      stopCheckId = setInterval(() => {
        if (stopSignal.stopped) {
          if (stopCheckId) { clearInterval(stopCheckId); stopCheckId = null }
          try { if (task && task.abort) task.abort() } catch (e) { /* ignore */ }
        }
      }, 200)
    }
  })
}

/**
 * 流式调用（最后一轮，AI 给最终回复时用）
 * H5 用 fetch+ReadableStream，App 用 enableChunked，其余降级为非流式 + 模拟逐字
 */
function callWithToolsStream(provider, cfg, messages, apiKey, onChunk) {
  // #ifdef H5
  return callWithToolsSSE(provider, cfg, messages, apiKey, onChunk)
  // #endif
  // #ifndef H5
  // 非流式降级：拿到完整内容后逐字推送
  const fallbackToNonStream = () => callWithTools(provider, cfg, messages, apiKey).then(res => {
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
  // #ifdef APP-PLUS
  // App 端：enableChunked 真流式，失败降级非流式
  return chatRequestChunkedStream('', '', cfg, onChunk, [], { messages, raw: true })
    .then(res => {
      if (res._error && !res.content) return fallbackToNonStream()
      return { message: { content: res.content || '' }, id: res.conversation_id || '', truncated: res.truncated === true }
    })
    .catch(() => fallbackToNonStream())
  // #endif
  // #ifndef APP-PLUS
  return fallbackToNonStream()
  // #endif
  // #endif
}

/** H5 SSE 流式 */
function callWithToolsSSE(provider, cfg, messages, apiKey, onChunk) {
  const body = {
    model: cfg.model,
    messages,
    temperature: cfg.temperature ?? 0.7,
    stream: true,
    max_tokens: getMaxTokens(provider.id)
    // 最后一轮不传 tools，让 AI 直接回复
  }
  // D4 推理分级：最终回复按日常档（glm-5.3/kimi-k3 强制思考时用 low）
  const reasoning = getReasoningConfig(provider.id, cfg.model, 'chat')
  if (reasoning) Object.assign(body, reasoning)

  return new Promise((resolve) => {
    let fullContent = ''
    let finishReason = ''
    let resolved = false
    const timer = setTimeout(() => {
      if (!resolved) { resolved = true; resolve(markReplyTruncated({ message: { content: fullContent }, id: '' }, finishReason)) }
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
        resolve(markReplyTruncated({ message: data.choices?.[0]?.message || { content: '' }, id: data.id || '' }, data.choices?.[0]?.finish_reason))
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
            // 4.3.1：'length' = 撞上输出上限被截断
            const fr = chunk.choices?.[0]?.finish_reason
            if (fr) finishReason = fr
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
        resolve(markReplyTruncated({ message: { content: fullContent }, id: '' }, finishReason))
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

/** 构建本轮 tools 列表：全局工具 + 已配置好的 web_search（门控与聊天厂商无关） */
function buildToolList(provider, model) {
  // web_search 已入全局注册表；搜索后端配好 Key 才注入，跟聊天用哪个厂商无关（3.5.18）
  const tools = TOOL_DEFINITIONS
    .filter(t => t.name !== 'web_search' || isWebSearchAvailable())
    .filter(t => t.name !== 'read_url' || isReadUrlAvailable())
    .map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters
    }
  }))
  return tools
}
