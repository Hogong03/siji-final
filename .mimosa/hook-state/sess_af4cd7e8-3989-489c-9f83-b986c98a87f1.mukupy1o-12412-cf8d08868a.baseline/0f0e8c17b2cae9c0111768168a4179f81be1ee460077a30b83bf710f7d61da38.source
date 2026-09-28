/**
 * 流式聊天请求模块
 * 提供三种流式输出策略：
 *   1. chatRequestStream — 公开入口（含 H5 条件编译检测，自动选择策略）
 *   2. chatRequestRealStream — 真实 SSE 流式（fetch + ReadableStream）
 *   3. simulatedStream — 逐字模拟流式（兼容非 H5 环境）
 */

import { getProvider, getDefaultConfig } from './providers.js'
import { getRecentHistory } from './chat-helpers.js'
import { logger } from '../logger.js'
import { checkRateLimit, recordRequest } from './rate-limiter.js'
import { runAgentChat } from './agent-loop.js'
import { chatRequestChunkedStream } from './chat-chunked.js'
import { chatRequestRealStream } from './chat-sse.js'
import { simulatedStream } from './chat-simulated.js'

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
  // 3.5.11：门控反转 — 只把「明显闲聊」留给单轮流式快通道，其余全部进工具循环。
  // 旧实现是白名单正则（looksDataQuery/isCommandMessage），不命中就永远调不到工具，
  // 「记录」「帮我看看」这类短指令会被漏执行。
  const store = cfg.store
  if (store && cfg.agent !== false) {
    const provider = getProvider(cfg.provider)
    if (provider.supportsToolCalling && !isClearlyCasual(message)) {
      logger.log('[AgentMode] Enabling tool loop for message')
      return runAgentChat(store, message, conversationId, cfg, history || getRecentHistory(), onChunk, cfg.onStatus)
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

/** 明显闲聊的最大字符数：超过此长度一律交给工具循环判断 */
export const CASUAL_MAX_LEN = 14

/** 数据域 / 动作提示词 — 命中即不进闲聊快通道 */
const DATA_HINT_RE = /(账单|消费|支出|收入|花了|花掉|预算|余额|记录|日记|想法|待办|计划|阶段|子计划|进度|任务|打卡|人脉|关系|朋友|同事|家人|领导|决策|纠结|反馈|标签|记忆|画像|喜好|偏好|习惯|总结|周报|月报|复盘|上次|之前|以前|说过|提过|多少|几个|几条|几次|哪些|记一下|记下|查一下|看一下|创建|新建|修改|更新|删除|撤销|提醒|安排|记账|记一笔|查账|吃饭|吃了|聊天|见面|喝咖啡|看电影|打电话|散步|生气)/

/** 疑问 / 请求句式 — 命中即不进闲聊快通道 */
const ASK_RE = /[?？]|怎么|如何|为什么|能不能|可不可以|要不要|有没有|是不是|该不该|帮我/

/**
 * 是否「明显闲聊」—— 只有同时满足：极短、无数字、无数据域词、无疑问句式，
 * 才走单轮流式快通道；其余一律进工具循环（宁可多跑一次工具轮，也不漏执行用户指令）。
 * @param {string} msg 用户消息
 * @returns {boolean}
 */
export function isClearlyCasual(msg) {
  if (!msg) return true
  const text = String(msg).trim()
  if (!text) return true
  if (text.length > CASUAL_MAX_LEN) return false
  if (/\d/.test(text)) return false
  if (DATA_HINT_RE.test(text)) return false
  if (ASK_RE.test(text)) return false
  return true
}
