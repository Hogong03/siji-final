/**
 * rate-limiter.js — AI 请求限流器
 * 防止快速连续发送导致 API 浪费和前端卡顿
 */

// 滑动窗口限流
const WINDOW_MS = 60_000  // 1 分钟窗口
const MAX_REQUESTS = 20   // 每窗口最大请求数
const MIN_INTERVAL = 500 // 两次请求最小间隔（ms）

let requestTimestamps = []
let lastRequestTime = 0

/**
 * 检查是否可以发送请求
 * @returns {{ allowed: boolean, waitMs: number, reason: string }}
 */
export function checkRateLimit() {
  const now = Date.now()
  
  // 清理过期时间戳
  requestTimestamps = requestTimestamps.filter(ts => now - ts < WINDOW_MS)
  
  // 检查最小间隔
  const elapsed = now - lastRequestTime
  if (elapsed < MIN_INTERVAL) {
    return {
      allowed: false,
      waitMs: MIN_INTERVAL - elapsed,
      reason: '请求过于频繁，请稍候'
    }
  }
  
  // 检查窗口内请求数
  if (requestTimestamps.length >= MAX_REQUESTS) {
    const oldestTs = requestTimestamps[0]
    const waitMs = WINDOW_MS - (now - oldestTs)
    return {
      allowed: false,
      waitMs: Math.max(waitMs, 1000),
      reason: `已达到每分钟 ${MAX_REQUESTS} 次限制`
    }
  }
  
  return { allowed: true, waitMs: 0, reason: '' }
}

/**
 * 记录一次请求
 */
export function recordRequest() {
  const now = Date.now()
  requestTimestamps.push(now)
  lastRequestTime = now
}

/**
 * 等待限流解除
 * @param {number} maxWaitMs - 最大等待时间
 * @returns {Promise<boolean>} 是否成功（false 表示超时）
 */
export function waitForAvailability(maxWaitMs = 5000) {
  return new Promise((resolve) => {
    const check = () => {
      const { allowed, waitMs } = checkRateLimit()
      if (allowed) {
        resolve(true)
      } else if (waitMs > maxWaitMs) {
        resolve(false)
      } else {
        setTimeout(check, Math.min(waitMs, 500))
      }
    }
    check()
  })
}

/**
 * 重置限流器（用于测试或手动清除）
 */
export function resetRateLimiter() {
  requestTimestamps = []
  lastRequestTime = 0
}
