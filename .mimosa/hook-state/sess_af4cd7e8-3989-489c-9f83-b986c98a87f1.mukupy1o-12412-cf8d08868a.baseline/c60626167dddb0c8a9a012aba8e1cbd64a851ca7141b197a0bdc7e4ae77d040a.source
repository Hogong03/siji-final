/**
 * 错误上报模块
 *
 * 收集运行时错误到本地队列，网络恢复时异步上报。
 * 不收集用户隐私数据，只收集：错误信息、堆栈、设备信息、时间戳。
 */

import { RUNTIME_CONFIG } from '@/config/runtime.js'
import { logger } from '@/utils/logger.js'

const QUEUE_KEY = 'siji_error_queue'

/** 获取设备信息（缓存） */
let _deviceInfo = null
function getDeviceInfo() {
  if (_deviceInfo) return _deviceInfo
  try {
    const sys = uni.getSystemInfoSync()
    _deviceInfo = {
      platform: sys.platform,
      os: sys.osName,
      osVersion: sys.osVersion,
      appVersion: sys.appVersion || '1.0.0',
      brand: sys.deviceBrand,
      model: sys.deviceModel
    }
  } catch {
    _deviceInfo = { platform: 'unknown' }
  }
  return _deviceInfo
}

/** 添加错误到队列 */
function enqueue(error, context = {}) {
  if (!RUNTIME_CONFIG.errorReport.enabled) return

  const entry = {
    timestamp: Date.now(),
    message: error?.message || String(error),
    stack: error?.stack || '',
    context: context,
    device: getDeviceInfo()
  }

  try {
    const queue = uni.getStorageSync(QUEUE_KEY) || []
    queue.push(entry)
    // 超过最大队列长度，丢弃最旧的
    if (queue.length > RUNTIME_CONFIG.errorReport.maxQueueSize) {
      queue.shift()
    }
    uni.setStorageSync(QUEUE_KEY, queue)
  } catch (e) {
    logger.warn('[error-reporter] 队列写入失败', e)
  }
}

/** 上报错误队列 */
export async function flushErrors() {
  if (!RUNTIME_CONFIG.errorReport.enabled) return

  try {
    const queue = uni.getStorageSync(QUEUE_KEY) || []
    if (queue.length === 0) return

    // 尝试上报——当前没有服务端，只做日志记录
    // 部署服务端后改为 uni.request POST
    logger.log(`[error-reporter] 待上报错误 ${queue.length} 条`)
    queue.forEach((e, i) => {
      logger.warn(`[error-reporter] #${i + 1} ${e.message}`, e.context)
    })

    // 清空队列
    uni.setStorageSync(QUEUE_KEY, [])
  } catch (e) {
    logger.warn('[error-reporter] 上报失败', e)
  }
}

/** 上报错误 */
export function reportError(error, context = {}) {
  enqueue(error, context)
}

/** 上报未捕获的 Promise rejection */
export function reportRejection(reason) {
  const error = reason instanceof Error ? reason : new Error(String(reason))
  enqueue(error, { type: 'unhandledrejection' })
}

/** 获取当前错误队列（调试用） */
export function getErrorQueue() {
  try {
    return uni.getStorageSync(QUEUE_KEY) || []
  } catch {
    return []
  }
}

/** 清空错误队列 */
export function clearErrorQueue() {
  try {
    uni.setStorageSync(QUEUE_KEY, [])
  } catch { /* ignore */ }
}
