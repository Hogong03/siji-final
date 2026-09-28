/**
 * chat-simulated.js — 模拟流式（3.5.11 从 chat-stream.js 拆出）
 *
 * 小程序等非 H5 / 非 App 平台与降级场景：先取完整回复，再按标点节奏逐段回调。
 */
import { chatRequest as chatRequestNonStream } from './chat-request.js'
import { logger } from '../logger.js'
// ==================== 模拟流式（非 H5 降级）====================

/**
 * 模拟流式输出 — 逐字推送（加速版）
 */
export async function simulatedStream(message, conversationId, cfg, onChunk, history) {
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
