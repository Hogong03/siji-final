/**
 * store 内部辅助函数 — 从 store/data.js 抽取
 */
import { logger } from './logger.js'

export function asyncSetStorage(key, data) {
  try {
    // #ifdef H5
    uni.setStorage({ key, data })
    // #endif
    // #ifndef H5
    uni.setStorageSync(key, typeof data === 'string' ? data : JSON.stringify(data))
    // #endif
  } catch (e) {
    logger.warn('[Storage] async write failed:', key)
  }
}

export function asyncSetStorageJSON(key, obj) {
  asyncSetStorage(key, JSON.stringify(obj))
}

export function formatDateStr(date) {
  const y = date.getFullYear()
  const mo = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${mo}-${d}`
}

export function normalizeDateStr(s) {
  if (!s || typeof s !== 'string') return null
  const str = s.trim()
  if (!str) return null

  const m1 = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (m1) {
    const y = parseInt(m1[1])
    const mo = parseInt(m1[2])
    const d = parseInt(m1[3])
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }
  }

  const now = new Date()
  if (/^今天|今日$/.test(str)) return formatDateStr(now)
  if (/^昨天|昨日$/.test(str)) {
    const d = new Date(now.getTime() - 86400000)
    return formatDateStr(d)
  }
  if (/^前天|前日$/.test(str)) {
    const d = new Date(now.getTime() - 2 * 86400000)
    return formatDateStr(d)
  }

  return null
}
