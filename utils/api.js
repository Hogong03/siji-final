/**
 * API 公共层 - 请求封装 + 厂商注册表 + 对话摘要 + 离线检测
 *
 * 已拆分模块：
 *   ai/chat-helpers.js  - ApiError, buildChatMessages, getRecentHistory, 离线缓存
 *   ai/providers.js     - AI 厂商注册表
 *   ai/prompt-builder.js - 系统提示词、用户画像
 *   ai/response-parser.js - AI 响应解析
 *   ai/chat-request.js   - 非流式请求（含重试/离线降级）
 *   ai/chat-stream.js    - 流式请求
 */

import { logger } from './logger.js'
import { chatRequest, generateConversationTitle } from './ai/chat-request.js'
import { chatRequestStream } from './ai/chat-stream.js'
import {
  AI_PROVIDERS, getProvider, getProviderModels, getProviderDefaultModel,
  getProviderVisionModel, supportsVision, getProviderKeys,
  getDefaultConfig, buildProviderRequest
} from './ai/providers.js'
import { parseAiResponse } from './ai/response-parser.js'

﻿/**
 * HTTP 请求封装 (uni.request + 重试)
 *
 * BASE_URL 配置：
 *   H5 开发: /api (Vite proxy → localhost:3000)
 *   APP 生产: https://your-server.ucloud.cn/api
 */

// TODO: 部署时改为 UCloud 地址
const BASE_URL = '/api'

/** 通用请求 */
export function request(options) {
  const { url, method = 'GET', data, timeout = 15000 } = options
  const deviceId = uni.getStorageSync('siji_device_id') || ''

  return new Promise((resolve, reject) => {
    uni.request({
      url: BASE_URL + url,
      method,
      data,
      timeout,
      header: {
        'Content-Type': 'application/json',
        'X-Device-Id': deviceId
      },
      success(res) {
        const { statusCode, data: body } = res
        if (statusCode === 200 && body && body.code === 0) {
          resolve(body.data)
        } else {
          reject(new Error(body?.message || `HTTP ${statusCode}`))
        }
      },
      fail(err) {
        reject(new Error(err.errMsg || 'Network error'))
      }
    })
  })
}

/** GET 请求 */
export function get(url, params = {}, timeout) {
  const query = Object.keys(params)
    .filter(k => params[k] !== undefined && params[k] !== null)
    .map(k => `${k}=${encodeURIComponent(params[k])}`)
    .join('&')
  return request({ url: query ? `${url}?${query}` : url, method: 'GET', timeout })
}

/** POST 请求 */
export function post(url, data, timeout) {
  return request({ url, method: 'POST', data, timeout })
}

/** PUT 请求 */
export function put(url, data, timeout) {
  return request({ url, method: 'PUT', data, timeout })
}

/** DELETE 请求 */
export function del(url, timeout) {
  return request({ url, method: 'DELETE', timeout })
}

/**
 * 生成对话摘要 — 用 AI 压缩早期消息为简短摘要
 * 当对话超过 15 条时异步调用，摘要存储在会话中供后续请求使用
 */
export async function generateConversationSummary(messages, cfg) {
  if (!messages || messages.length < 8) return null

  // 构建对话文本（只取前 N-6 条，保留最新 6 条不压缩）
  const toSummarize = messages.slice(0, -6)
  const dialogue = toSummarize
    .map(m => {
      if (m.role === 'user') return `用户: ${m.content || ''}`
      const text = ((m.aiReply || m.content || '')).replace(/\[执行结果:.*?\]/gs, '').trim()
      return text ? `AI: ${text}` : null
    })
    .filter(Boolean)
    .join('\n')

  if (!dialogue.trim()) return null

  try {
    const result = await chatRequest(
      '用2-3句话总结以上对话：用户做了什么操作（记账/日记/计划，保留ID）、说了哪些个人信息、有哪些重要上下文。只输出总结不要JSON。',
      null, null,
      { ...cfg, temperature: 0.2 },
      []  // 空历史，只做总结
    )
    const summary = result?.reply?.trim()
    if (summary && summary.length > 10 && summary.length < 500) {
      return summary
    }
  } catch (e) {
    logger.warn('[思迹] 对话摘要生成失败:', e)
  }
  return null
}

/**
 * 模拟流式输出 — 先获取完整响应，再逐字回调
 * 在 uni.request 不支持 SSE 的情况下，这是最兼容的方案
 * @param {string} message 用户消息
 * @param {string} conversationId 会话ID
 * @param {string} apiKey API Key
 * @param {function} onChunk 每次回调 (chunkText) => void
 * @returns {Promise<object>} 完整解析结果
 */
export function isOnline() {
  return new Promise((resolve) => {
    uni.getNetworkType({
      success(res) {
        resolve(res.networkType !== 'none')
      },
      fail() {
        resolve(false)
      }
    })
  })
}

export {
  AI_PROVIDERS, getProvider, getProviderModels, getProviderDefaultModel,
  getProviderVisionModel, supportsVision, getProviderKeys,
  getDefaultConfig, buildProviderRequest,
  chatRequest, chatRequestStream, generateConversationTitle
}
