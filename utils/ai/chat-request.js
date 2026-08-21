/**
 * 聊天请求模块 —— 非流式
 * 提供带重试的聊天请求 + 离线降级回复
 *
 * 循环依赖解耦：buildChatMessages 等已提取至 chat-helpers.js
 */

import { getDefaultConfig, getProvider, getProviderDefaultModel, buildProviderRequest } from './providers.js'
import { parseAiResponse } from './response-parser.js'
import { buildChatMessages, getRecentHistory, cacheAiResponse, getOfflineCacheReply, ApiError } from './chat-helpers.js'
import { asyncSetStorageJSON } from '../store-helpers.js'
import { logger } from '../logger.js'
import { checkRateLimit, recordRequest } from './rate-limiter.js'

// P0-4: setTimeout timer 管理 — 页面卸载时统一清除
const _timers = new Set()
function _trackedTimeout(fn, delay) {
  const id = setTimeout(() => {
    _timers.delete(id)
    fn()
  }, delay)
  _timers.add(id)
  return id
}
/** 清除所有待执行的 retry timer — 供页面卸载时调用 */
export function clearAllChatTimers() {
  _timers.forEach(id => clearTimeout(id))
  _timers.clear()
}

// ==================== 公开入口 ====================

/**
 * 生成对话标题（轻量级，不阻塞主流程）
 * 使用 cheapest model（deepseek-v4-flash），5s 超时
 * @param {string} firstUserMessage - 首条用户消息
 * @param {object} cfg - { provider, apiKey } 可选，用于获取 API Key
 * @returns {Promise<string>} 生成的标题文本
 */
export function chatRequest(message, contextType, conversationId, config, history, _skipRateLimit = false) {
  const cfg = typeof config === 'string'
    ? { provider: 'deepseek', model: 'deepseek-v4-flash', apiKey: config }
    : (config || getDefaultConfig())

  return chatRequestWithRetry(message, conversationId, cfg, _skipRateLimit ? 1 : 0, history)
}

// ==================== 重试逻辑 ====================

/**
 * 带重试的聊天请求 — 最多重试 2 次
 * 重试策略：网络错误重试，429/500+ 重试，400/401 不重试，空回复自动重试
 */
function chatRequestWithRetry(message, conversationId, cfg, retryCount, history) {
  const maxRetries = 2
  const providerName = getProvider(cfg.provider).name
  const apiKey = cfg.apiKey || uni.getStorageSync('siji_api_key') || ''

  return new Promise((resolve, reject) => {
    // API Key 为空 — 直接走离线降级，不发无意义请求
    if (!apiKey) {
      logger.warn(`[${providerName}] API Key 为空，跳过请求走离线降级`)
      resolve({ reply: '', _offline: true, _reason: 'no_api_key' })
      return
    }
    // 限流检查（重试请求跳过限流）
    if (retryCount === 0) {
      const { allowed, reason } = checkRateLimit()
      if (!allowed) {
        reject(new ApiError(reason, 429))
        return
      }
      recordRequest()
    }
    const chatHistory = history || getRecentHistory()
    const messages = buildChatMessages(message, chatHistory, cfg)
    const reqOpts = buildProviderRequest(cfg.provider, cfg.model, messages, apiKey, cfg.temperature)

    const stopSignal = cfg.stopSignal || null
    let stopCheckId = null
    const task = uni.request({
      ...reqOpts,
      success(res) {
        if (res.statusCode === 200 && res.data?.choices) {
          const raw = res.data.choices[0]?.message?.content || ''
          const parsed = parseAiResponse(raw, conversationId)

          // 空回复自动重试 — 模型偶发返回空内容
          if (!parsed.reply || !parsed.reply.trim() || parsed._isFallback) {
            if (retryCount < maxRetries) {
              const simplifiedMsg = retryCount === 0
                ? message
                : message.replace(/^\[[^\]]+\]\s*/g, '').trim().substring(0, 100)
              logger.warn(`[${providerName} Empty Reply] Auto retry ${retryCount + 1}/${maxRetries}`)
              _trackedTimeout(() => {
                chatRequestWithRetry(simplifiedMsg, conversationId, cfg, retryCount + 1, chatHistory)
                  .then(resolve).catch(reject)
              }, 1000)
              return
            }
          }

          resolve(parsed)

          if (parsed.reply && !parsed._isFallback) {
            cacheAiResponse(message, parsed.reply)
          }
        } else {
          const errMsg = res.data?.error?.message || res.data?.message || `HTTP ${res.statusCode}`
          logger.error(`[${providerName} API Error]`, res.statusCode, JSON.stringify(res.data))

          if ((res.statusCode === 429 || res.statusCode >= 500) && retryCount < maxRetries) {
            const retryAfter = res.header?.['Retry-After'] || res.header?.['retry-after']
            const delay = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, retryCount) * 1500
            logger.warn(`[${providerName} Retry] ${res.statusCode}, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`)
            _trackedTimeout(() => {
              chatRequestWithRetry(message, conversationId, cfg, retryCount + 1, chatHistory)
                .then(resolve).catch(reject)
            }, delay)
            return
          }

          if (res.statusCode === 401) {
            reject(new ApiError(`${providerName} API Key 无效，请在设置页检查配置`, 'auth', 401, false))
            return
          }

          if (res.statusCode === 400) {
            if (retryCount < maxRetries) {
              logger.warn(`[${providerName} 400] Retry without response_format`)
              _trackedTimeout(() => {
                chatRequestWithRetryNoFormat(message, conversationId, cfg, chatHistory)
                  .then(resolve).catch(reject)
              }, 1000)
              return
            }
            resolve(fallbackResponse(message, `请求格式错误: ${errMsg}`))
            return
          }

          reject(new ApiError(errMsg, 'server', res.statusCode, false))
        }
      },
      fail(err) {
        if (stopSignal && stopSignal.stopped) {
          resolve({ reply: '', _emptyReply: true, _aborted: true })
          return
        }
        logger.error(`[${providerName} Network Error]`, err.errMsg)

        if (retryCount < maxRetries) {
          const delay = Math.pow(2, retryCount) * 1500
          logger.warn(`[${providerName} Retry] Network error, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`)
          _trackedTimeout(() => {
            chatRequestWithRetry(message, conversationId, cfg, retryCount + 1, chatHistory)
              .then(resolve).catch(reject)
          }, delay)
          return
        }

        logger.warn(`[${providerName} Fallback] Max retries exceeded, returning offline response`)
        resolve(fallbackResponse(message, '网络连接失败，请稍后再试'))
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
 * 无 response_format 重试 — 用于 400 错误的降级
 */
function chatRequestWithRetryNoFormat(message, conversationId, cfg, history) {
  const providerName = getProvider(cfg.provider).name
  const apiKey = cfg.apiKey || ''
  const chatHistory = history || getRecentHistory()
  const messages = buildChatMessages(message, chatHistory, cfg)
  const provider = getProvider(cfg.provider)

  return new Promise((resolve, reject) => {
    const data = { model: cfg.model, messages, temperature: cfg.temperature ?? 0.8 }
    const stopSignal = cfg.stopSignal || null
    let stopCheckId = null

    const task = uni.request({
      url: provider.endpoint,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      data,
      timeout: 45000,
      success(res) {
        if (res.statusCode === 200 && res.data?.choices) {
          const raw = res.data.choices[0]?.message?.content || ''
          resolve(parseAiResponse(raw, conversationId))
        } else {
          resolve(fallbackResponse(message, `请求失败: HTTP ${res.statusCode}`))
        }
      },
      fail() {
        if (stopSignal && stopSignal.stopped) {
          resolve({ reply: '', _emptyReply: true, _aborted: true })
          return
        }
        resolve(fallbackResponse(message, '网络连接失败'))
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

// ==================== 离线降级 ====================

/**
 * 降级响应 — AI 不可用时的兜底回复
 * 尝试从用户消息中提取简单意图，否则返回友好提示
 */
function fallbackResponse(userMessage, errorDetail) {
  const cached = getOfflineCacheReply(userMessage)
  if (cached) return { ...cached, action: null, actions: [], conversation_id: '', error: errorDetail }

  const msg = userMessage.toLowerCase()
  const amountMatch = userMessage.match(/(\d+(?:\.\d+)?)\s*[块元¥]/)
  if (amountMatch) {
    const amount = parseFloat(amountMatch[1])
    let category = '其他'
    if (/餐|饭|吃|外卖|午饭|晚饭|早饭/.test(userMessage)) category = '餐饮'
    else if (/车|打车|地铁|公交|加油/.test(userMessage)) category = '交通'
    else if (/咖啡|奶茶|饮料|茶/.test(userMessage)) category = '餐饮'
    else if (/买|购|超市|商品/.test(userMessage)) category = '购物'
    else if (/电影|游戏|玩|KTV/.test(userMessage)) category = '娱乐'
    else if (/药|医院|看病|诊/.test(userMessage)) category = '医疗'
    else if (/房租|水电|物业/.test(userMessage)) category = '住房'

    try {
      const now = new Date()
      const billDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      const bill = {
        client_id: `bill_offline_${Date.now()}`,
        type: 'expense',
        amount,
        category,
        note: userMessage.substring(0, 50),
        bill_date: billDate,
        created_at: now.getTime(),
        updated_at: now.getTime(),
        is_deleted: 0
      }
      const queue = JSON.parse(uni.getStorageSync('siji_offline_queue') || '[]')
      queue.push({ type: 'bill', data: bill })
      asyncSetStorageJSON('siji_offline_queue', queue)

      return {
        reply: `🌐 离线模式：已暂存记账 ${category} ¥${amount}，网络恢复后自动同步。`,
        action: null, actions: [],
        suggestions: ['查看本月账单', '再记一笔'],
        conversation_id: '',
        offline: true, error: errorDetail
      }
    } catch {
      return {
        reply: `🌐 离线模式：识别到记账 ${category} ¥${amount}，但暂存失败。请网络恢复后重试。`,
        action: null, actions: [],
        conversation_id: '',
        offline: true, error: errorDetail
      }
    }
  }

  if (/心情|日记|记录|今天|开心|难过|累/.test(userMessage)) {
    return {
      reply: `🌐 离线模式：我现在无法处理你的消息。\n你可以直接在「功能」页手动写记录，等网络恢复后再通过对话记录。`,
      action: null, actions: [], suggestions: [],
      conversation_id: '',
      offline: true, error: errorDetail
    }
  }

  return {
    reply: `抱歉，我现在暂时无法回复。${errorDetail ? `（${errorDetail}）` : ''}\n请检查网络或 API Key 配置后重试。`,
    action: null, actions: [], suggestions: [],
    conversation_id: '',
    offline: true, error: errorDetail
  }
}

// ==================== 对话标题生成 ====================

/**
 * AI 生成对话标题 — 轻量级请求，不阻塞主流程
 * @param {string} firstUserMessage 首条用户消息
 * @param {object} cfg { provider, apiKey }
 * @returns {Promise<string|null>} 标题或 null
 */
export async function generateConversationTitle(firstUserMessage, cfg) {
  if (!cfg || !cfg.apiKey) return null
  
  const provider = getProvider(cfg.provider || 'deepseek')
  if (!provider || !provider.endpoint) return null

  const messages = [
    { role: 'system', content: '请根据用户首条消息生成 ≤8个字的对话标题，只返回标题文本，不要多余内容。' },
    { role: 'user', content: firstUserMessage.substring(0, 100) }
  ]

  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 5000)
    uni.request({
      url: provider.endpoint,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.apiKey}`
      },
      data: { model: getProviderDefaultModel(cfg.provider) || 'deepseek-v4-flash', messages, temperature: 0.1, max_tokens: 20 },
      timeout: 5000,
      success(res) {
        clearTimeout(timer)
        const raw = res.data?.choices?.[0]?.message?.content || ''
        const title = raw.replace(/["\n\r]/g, '').trim().substring(0, 12)
        resolve(title || null)
      },
      fail() {
        clearTimeout(timer)
        resolve(null)
      }
    })
  })
}
