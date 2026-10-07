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
import { TOOL_FEATURE_MAP, isFeatureActive } from './features.js'
import { chatRequestChunkedStream, assembleStreamToolCalls } from './chat-chunked.js'
import { logger } from '../logger.js'
/**
 * 调用带 tools 参数的 AI（非流式）
 * 当 isFinal=true 时用流式请求（最后一轮，AI 给最终回复）
 */
/** 工具调用轮次超时（ms）——非流式兜底 180s；4.21.0 起工具轮默认走流式（idle 续期，12K tokens 的
 *  JSON arguments 也能在生成期间不被掐），非流式只在流式失败/测试 mock 时兜底。
 *  最终回复 45s（最终轮走流式，另有续期超时） */
const TOOL_CALL_TIMEOUT = 180000
const FINAL_REPLY_TIMEOUT = 45000
const MAX_API_RETRIES = 2

/** 带重试的非流式工具调用 */
export function callWithTools(provider, cfg, messages, apiKey, isFinal = false, onChunk = null) {
  // 最后一轮且非工具调用 → 流式输出（4.5.1：删掉 supportsStream 死条件，没有任何厂商定义它）
  if (isFinal && onChunk) {
    return callWithToolsStream(provider, cfg, messages, apiKey, onChunk)
  }
  // 测试钩子（3.2 M1 回归集）：mock 直连非流式路径，形状不变
  if (cfg && typeof cfg._mockResponder === 'function') {
    const body = buildStreamRoundBody(provider, cfg, messages)
    return callWithRetry(provider, cfg, body, apiKey, TOOL_CALL_TIMEOUT, 0)
  }
  // 4.21.0：工具轮默认流式 —— 非流式一次性等完整 JSON arguments，长文（数千字 content 转义）
  // 生成超 180s 必超时；流式按 chunk 续命，模型还在吐字就不掐。失败降级回非流式。
  return callWithToolsStreamRound(provider, cfg, messages, apiKey).then(res => {
    if (res && res._streamError) {
      logger.warn('[AgentLoop] stream tool-round failed, falling back to non-stream')
      return callWithRetry(provider, cfg, buildStreamRoundBody(provider, cfg, messages), apiKey, TOOL_CALL_TIMEOUT)
    }
    return res
  })
}

/** 工具轮请求体（非流式兜底用，与流式字段一致） */
function buildStreamRoundBody(provider, cfg, messages) {
  const body = {
    model: cfg.model,
    messages,
    temperature: cfg.temperature ?? 0.7,
    max_tokens: getMaxTokens(provider.id),
    tools: buildToolList(provider, cfg.model),
    tool_choice: 'auto'
  }
  const reasoning = getReasoningConfig(provider.id, cfg.model, 'complex')
  if (reasoning) Object.assign(body, reasoning)
  return body
}

/**
 * 工具轮流式（4.21.0）：H5 走 fetch SSE；App 走 enableChunked；其余端降级非流式
 * @returns {{ message: { content, tool_calls?, reasoning_content? }, id, truncated }|{_streamError:true}}
 */
function callWithToolsStreamRound(provider, cfg, messages, apiKey) {
  const tools = buildToolList(provider, cfg.model)
  if (!tools || tools.length === 0) return Promise.resolve({ _streamError: true })
  const reasoning = getReasoningConfig(provider.id, cfg.model, 'complex')
  // #ifdef H5
  return callWithToolsSSEToolRound(provider, cfg, messages, apiKey, tools, reasoning)
  // #endif
  // #ifndef H5
  return chatRequestChunkedStream('', '', cfg, null, [], {
    messages,
    raw: true,
    tools: tools,
    toolRound: true,
    reasoning: reasoning
  }).then(res => {
    if (res && (res._error || res._failed)) return { _streamError: true }
    return res
  }).catch(() => ({ _streamError: true }))
  // #endif
}

/**
 * H5 工具轮流式 SSE（4.21.0）：与最终轮 SSE 的差别 —— 带 tools，解析 delta.tool_calls
 * 增量拼装；超时用 idle 续期（首 token 60s / 每 chunk 续 30s / 硬上限 600s），
 * 12K tokens 的 JSON arguments 生成期间只要还在吐字就不会被掐
 */
function callWithToolsSSEToolRound(provider, cfg, messages, apiKey, tools, reasoning) {
  const body = {
    model: cfg.model,
    messages,
    temperature: cfg.temperature ?? 0.7,
    stream: true,
    max_tokens: getMaxTokens(provider.id),
    tools: tools,
    tool_choice: 'auto'
  }
  if (reasoning) Object.assign(body, reasoning)

  return new Promise((resolve) => {
    let fullContent = ''
    let fullReasoning = ''
    const toolDeltas = []
    let finishReason = ''
    let resolved = false
    const IDLE_AFTER_FIRST = 30000
    const TTFB_TIMEOUT = 60000
    const HARD_TOTAL = 600000
    let timer = setTimeout(onTimeout, TTFB_TIMEOUT)
    const hardTimer = setTimeout(() => {
      if (!resolved) {
        resolved = true
        clearTimeout(timer)
        resolve(buildRoundResult('length'))
      }
    }, HARD_TOTAL)
    function buildRoundResult(forceReason) {
      const message = { content: fullContent }
      const calls = assembleStreamToolCalls(toolDeltas)
      if (calls.length > 0) message.tool_calls = calls
      if (fullReasoning) message.reasoning_content = fullReasoning
      return markReplyTruncated({ message: message, id: '' }, finishReason || forceReason)
    }
    function onTimeout() {
      if (resolved) return
      resolved = true
      clearTimeout(hardTimer)
      // 半截 tool_calls 的 arguments 必然不是合法 JSON —— executeTool 会报错回传，
      // 模型下一轮自愈（通常会把内容写短）。不做非流式重试：同样的生成只会再超时一次。
      resolve(buildRoundResult('length'))
    }
    function bumpIdle() {
      clearTimeout(timer)
      timer = setTimeout(onTimeout, IDLE_AFTER_FIRST)
    }

    fetch(provider.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    }).then(async (resp) => {
      if (!resp.ok) {
        clearTimeout(timer)
        clearTimeout(hardTimer)
        if (!resolved) {
          resolved = true
          resolve({ _streamError: true })
        }
        return
      }
      const reader = resp.body?.getReader()
      if (!reader) {
        const data = await resp.json()
        clearTimeout(timer)
        clearTimeout(hardTimer)
        resolved = true
        const msg = data.choices?.[0]?.message || { content: '' }
        resolve(markReplyTruncated({ message: msg, id: data.id || '' }, data.choices?.[0]?.finish_reason))
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
            const choice = chunk.choices?.[0] || {}
            if (choice.finish_reason) finishReason = choice.finish_reason
            const delta = choice.delta || {}
            if (delta.reasoning_content) {
              fullReasoning += delta.reasoning_content
              bumpIdle()
            }
            if (delta.content) {
              fullContent += delta.content
              bumpIdle()
            }
            if (Array.isArray(delta.tool_calls) && delta.tool_calls.length > 0) {
              toolDeltas.push(...delta.tool_calls)
              bumpIdle()
            }
          } catch { /* skip */ }
        }
      }
      clearTimeout(timer)
      clearTimeout(hardTimer)
      if (!resolved) {
        resolved = true
        resolve(buildRoundResult())
      }
    }).catch((err) => {
      clearTimeout(timer)
      clearTimeout(hardTimer)
      if (!resolved) {
        resolved = true
        logger.error('[AgentLoop] tool-round SSE error:', err.message)
        resolve({ _streamError: true })
      }
    })
  })
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
    const task = uni.request({
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
        // 超时错误不重试：长文请求超时后重试同样的请求还是会超时，纯浪费时间
        const isTimeout = String(err.errMsg || '').toLowerCase().includes('timeout')
        if (!isTimeout && retryCount < MAX_API_RETRIES) {
          const delay = Math.pow(2, retryCount) * 1500
          logger.warn(`[AgentLoop] Network retry ${retryCount + 1}/${MAX_API_RETRIES} in ${delay}ms`)
          setTimeout(() => {
            callWithRetry(provider, cfg, body, apiKey, timeout, retryCount + 1).then(resolve)
          }, delay)
          return
        }
        resolve({ error: isTimeout ? 'AI 响应超时，长文生成需要更久，请稍后重试或换更快的模型' : '网络连接失败，请稍后再试' })
      },
      complete() {
        if (stopCheckId) { clearInterval(stopCheckId); stopCheckId = null }
      }
    })
    if (stopSignal) {
      stopCheckId = setInterval(() => {
        if (stopSignal.stopped) {
          if (stopCheckId) { clearInterval(stopCheckId); stopCheckId = null }
          // 4.5.1：接收 uni.request 返回的 RequestTask 再 abort —— 原来引用未定义变量
          // task 抛 ReferenceError 被 catch 吞掉，用户点停止根本中止不了工具轮请求
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
    // 4.20.1：流式续期超时 —— 首 token 等待 60s，流式期间每收到 chunk 续 30s，总硬上限 180s
    // 原来固定 90s 一刀切，长文（2000+ tokens）流式输出到一半被掐
    const IDLE_AFTER_FIRST = 30000
    const TTFB_TIMEOUT = 60000
    const HARD_TOTAL = 300000
    let timer = setTimeout(onTimeout, TTFB_TIMEOUT)
    const hardTimer = setTimeout(() => {
      if (!resolved) {
        resolved = true
        clearTimeout(timer)
        resolve(markReplyTruncated({ message: { content: fullContent }, id: '' }, finishReason || 'length'))
      }
    }, HARD_TOTAL)
    function onTimeout() {
      if (resolved) return
      resolved = true
      clearTimeout(hardTimer)
      // 超时拿到的可能是半截内容 —— finishReason 为空时按截断标记，让上层气泡出「继续写完」
      resolve(markReplyTruncated({ message: { content: fullContent }, id: '' }, finishReason || 'length'))
    }
    function bumpIdle() {
      clearTimeout(timer)
      timer = setTimeout(onTimeout, IDLE_AFTER_FIRST)
    }

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
        clearTimeout(hardTimer)
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
              bumpIdle()
              onChunk(delta)
            }
          } catch { /* skip */ }
        }
      }
      clearTimeout(timer)
      clearTimeout(hardTimer)
      if (!resolved) {
        resolved = true
        resolve(markReplyTruncated({ message: { content: fullContent }, id: '' }, finishReason))
      }
    }).catch((err) => {
      clearTimeout(timer)
      clearTimeout(hardTimer)
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
  // 4.10.0：功能开关收口 —— 工具→能力映射统一裁决（联网/读网址含 Key 可用性，见 features.js）
  const tools = TOOL_DEFINITIONS
    .filter(t => {
      const fid = TOOL_FEATURE_MAP[t.name]
      return !fid || isFeatureActive(fid)
    })
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
