/**
 * 版本历史存储
 *
 * 存储策略：localStorage key: siji_version_history (JSON 数组)
 * 字段：version, date, title, summary[], categories[{ title, items[] }]
 *
 * 列表页只显示 summary（核心更改摘要）
 * 详情页显示 categories（按功能分类的完整变更列表，可折叠）
 *
 * 默认数据拆至 version-data.js
 */

import { getDefaultHistory } from './version-data.js'

const STORAGE_KEY = 'siji_version_history'

/**
 * 判断一条版本记录是否为完整的新结构（含 summary 与 categories）
 * 旧结构只有 changes（数组），会被判定为不完整
 */
function isCompleteRecord(rec) {
  return rec
    && typeof rec === 'object'
    && Array.isArray(rec.summary)
    && Array.isArray(rec.categories)
}

/**
 * 获取所有版本历史（按时间倒序）
 * 自动迁移/过滤：若存储中读到旧结构或不完整记录，回退到默认数据，避免详情页出现 undefined 乱码
 */
export function getVersionHistory() {
  try {
    const raw = uni.getStorageSync(STORAGE_KEY)
    if (!raw) return getDefaultHistory()
    const list = JSON.parse(raw)
    if (!Array.isArray(list)) return getDefaultHistory()
    const allComplete = list.every(isCompleteRecord)
    if (!allComplete) {
      try { uni.setStorageSync(STORAGE_KEY, JSON.stringify(getDefaultHistory())) } catch {}
      return getDefaultHistory()
    }
    return list.sort((a, b) => b.date.localeCompare(a.date))
  } catch {
    return getDefaultHistory()
  }
}

/**
 * 获取指定版本记录
 */
export function getVersionRecord(version) {
  const list = getVersionHistory()
  return list.find(item => item.version === version) || null
}

/**
 * 添加一条版本记录
 * @param {Object} record - { version, date, title, summary: string[], categories: [{title, items: string[]}] }
 */
export function addVersionRecord(record) {
  const list = getVersionHistory()
  const idx = list.findIndex(item => item.version === record.version)
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...record }
  } else {
    list.push(record)
  }
  list.sort((a, b) => b.date.localeCompare(a.date))
  uni.setStorageSync(STORAGE_KEY, JSON.stringify(list))
}

/**
 * 获取最新版本号
 */
export function getLatestVersion() {
  const list = getVersionHistory()
  return list.length > 0 ? list[0].version : '1.0.0'
}

/**
 * 初始化：如果 localStorage 无记录，写入默认历史
 */
export function initVersionHistory() {
  try {
    const raw = uni.getStorageSync(STORAGE_KEY)
    if (!raw) {
      uni.setStorageSync(STORAGE_KEY, JSON.stringify(getDefaultHistory()))
    }
  } catch {}
}
