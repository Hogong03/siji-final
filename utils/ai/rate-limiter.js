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
  bumpUsageCounters(now)
}

// ==================== 4.15 用量统计（持久化，设置页展示） ====================
const USAGE_KEY = 'siji_ai_usage'

function bumpUsageCounters(now) {
  try {
    const d = new Date(now)
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const raw = uni.getStorageSync(USAGE_KEY)
    const usage = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {}
    if (usage.month !== month) {
      usage.month = month
      usage.monthCount = 0
    }
    usage.monthCount = (usage.monthCount || 0) + 1
    usage.totalCount = (usage.totalCount || 0) + 1
    usage.lastAt = now
    uni.setStorageSync(USAGE_KEY, JSON.stringify(usage))
  } catch (e) { /* 统计失败不影响主流程 */ }
}

/**
 * 用量统计（设置页「AI 用量」展示用）
 * @returns {{ month: string, monthCount: number, totalCount: number, perMinuteLimit: number, lastAt: number }}
 */
export function getUsageStats() {
  let usage = {}
  try {
    const raw = uni.getStorageSync(USAGE_KEY)
    usage = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {}
  } catch { usage = {} }
  const d = new Date()
  const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  return {
    month: usage.month || month,
    monthCount: usage.month === month ? (usage.monthCount || 0) : 0,
    totalCount: usage.totalCount || 0,
    perMinuteLimit: MAX_REQUESTS,
    lastAt: usage.lastAt || 0
  }
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
