/**
 * streamRetry - 流式空回复指数退避重试
 *
 * 从 useChatEngine.js 抽取，负责处理流式请求返回空回复时的重试逻辑
 * 策略：1s → 3s，逐级精简消息（最多 2 次重试，不让用户等太久）
 */

import { logger } from '@/utils/logger.js'
import { resetStreamParser } from '@/utils/ai/stream-parser.js'

const MAX_STREAM_RETRIES = 2
const RETRY_DELAYS = [1000, 3000]

/**
 * 执行带指数退避的流式重试
 * @param {Function} streamFn - chatRequestStream 调用函数 (message, onChunk, history) => result
 * @param {string} originalMessage - 原始用户消息
 * @param {Function} updateLastMessage - store.updateLastMessage
 * @param {Object} stopSignal - { stopped: boolean }
 * @returns {Object} { result, streamedText }
 */
export async function retryStreamWithBackoff(streamFn, originalMessage, updateLastMessage, stopSignal, onRetry) {
  let result = await streamFn(originalMessage)
  let streamedText = ''

  // 第一次就有内容，直接返回
  if (!result._emptyReply) {
    return { result, streamedText: result.reply || '' }
  }

  // 超时中止（_aborted + _timeout）不重试，直接返回让上层显示重试按钮
  if (result._aborted && result._timeout) {
    logger.warn('[Stream Retry] Timeout abort, skip retry (will show retry button)')
    return { result, streamedText: '' }
  }

  // 用户主动停止不重试
  if (stopSignal?.stopped) {
    return { result, streamedText: '' }
  }

  let streamRetry = 0
  while (result._emptyReply && streamRetry < MAX_STREAM_RETRIES && !stopSignal.stopped) {
    streamRetry++
    const delay = RETRY_DELAYS[streamRetry - 1] || 3000

    // 逐级精简消息
    let simplifiedMsg = originalMessage
    let retryHint = ''
    if (streamRetry === 2) {
      simplifiedMsg = originalMessage.replace(/^\[[^\]]+\]\s*/g, '').trim().substring(0, 100)
      retryHint = '（请简短回复）'
    }

    logger.warn(`[Stream Empty Retry] ${streamRetry}/${MAX_STREAM_RETRIES}, waiting ${delay}ms...`)

    // 显示退避提示
    streamedText = ''
    updateLastMessage({
      content: streamRetry === 1
        ? '正在重新思考...'
        : `第 ${streamRetry} 次重试中...`,
      loading: true
    })

    await new Promise(r => setTimeout(r, delay))
    if (stopSignal.stopped) break

    // 重新发送 — 重置增量解析器状态，防止上次请求残留
    resetStreamParser()
    if (onRetry) onRetry()
    result = await streamFn(simplifiedMsg + retryHint)
    streamedText = ''

    // 超时中止不继续重试
    if (result._aborted && result._timeout) {
      logger.warn(`[Stream Retry] Timeout abort on retry ${streamRetry}, stopping`)
      break
    }
  }

  return { result, streamedText }
}
