/**
 * 统一日志工具 — 生产环境自动静默
 *
 * 用法：
 *   import { logger } from '@/utils/logger.js'
 *   logger.log('msg')
 *   logger.warn('msg')
 *   logger.error('msg')
 *
 * 通过 store 中的 debug 开关控制（store.debugMode），
 * 或通过 localStorage 'siji_debug' = '1' 强制开启。
 */

const _readDebug = () => {
  try {
    return uni.getStorageSync('siji_debug') === '1' ||
           uni.getStorageSync('siji_debug') === true
  } catch {
    return false
  }
}

let _debug = _readDebug()

/** 运行时切换调试模式 */
export function setDebug(on) {
  _debug = !!on
  try { uni.setStorageSync('siji_debug', _debug ? '1' : '0') } catch {}
}

export const logger = {
  log(...args) {
    if (_debug) console.log('[思迹]', ...args)
  },
  warn(...args) {
    console.warn('[思迹]', ...args)
  },
  error(...args) {
    console.error('[思迹]', ...args)
  },
  info(...args) {
    if (_debug) console.info('[思迹]', ...args)
  },
}
