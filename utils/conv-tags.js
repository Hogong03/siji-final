/**
 * 对话标签管理工具
 *
 * 存储格式：siji_conv_tags = ['工作', '生活', '学习', ...]
 * 对话标签：conv.tags = ['工作', '学习']（存在对话对象上）
 *
 * 操作：
 * - getAllConvTags()        → 获取所有标签（去重排序）
 * - addConvTag(name)        → 添加标签到全局标签库
 * - removeConvTag(name)     → 从全局标签库删除（不影响已标记对话）
 * - setConvTags(convId, tags) → 设置某对话的标签
 * - getConvTags(conv)       → 获取对话标签（兼容旧数据）
 */

import { logger } from './logger.js'

const CONV_TAGS_KEY = 'siji_conv_tags'
const MAX_TAGS = 20

/** 获取全部标签 */
export function getAllConvTags() {
  try {
    const raw = uni.getStorageSync(CONV_TAGS_KEY)
    if (!raw) return []
    const list = JSON.parse(raw)
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

/** 添加标签到全局标签库 */
export function addConvTag(name) {
  const trimmed = (name || '').trim()
  if (!trimmed) return
  const list = getAllConvTags()
  if (list.includes(trimmed)) return
  list.push(trimmed)
  if (list.length > MAX_TAGS) list.shift()
  try {
    uni.setStorageSync(CONV_TAGS_KEY, JSON.stringify(list))
  } catch (e) {
    logger.warn('[ConvTags] 保存标签失败', e)
  }
}

/** 从全局标签库删除 */
export function removeConvTag(name) {
  const list = getAllConvTags()
  const idx = list.indexOf(name)
  if (idx < 0) return
  list.splice(idx, 1)
  try {
    uni.setStorageSync(CONV_TAGS_KEY, JSON.stringify(list))
  } catch (e) {
    logger.warn('[ConvTags] 删除标签失败', e)
  }
}

/** 获取对话的标签（兼容旧数据无 tags 字段） */
export function getConvTags(conv) {
  if (!conv || !conv.tags) return []
  return Array.isArray(conv.tags) ? conv.tags : []
}

/** 设置对话标签（直接修改对话对象） */
export function setConvTags(conv, tags) {
  if (!conv) return
  conv.tags = Array.isArray(tags) ? tags.filter(t => t && t.trim()) : []
  conv.updatedAt = Date.now()
  conv._slimCache = null
}

/**
 * 时间分组工具 — 将对话按 updatedAt 分到时间桶
 * @returns {label, conversations}[]
 */
export function groupByTime(conversations) {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterdayStart = todayStart - 86400000
  const weekStart = todayStart - 6 * 86400000

  const buckets = {
    today: { label: '今天', items: [] },
    yesterday: { label: '昨天', items: [] },
    thisWeek: { label: '本周', items: [] },
    earlier: { label: '更早', items: [] }
  }

  for (const conv of conversations) {
    const ts = conv.updatedAt || conv.createdAt || 0
    if (ts >= todayStart) buckets.today.items.push(conv)
    else if (ts >= yesterdayStart) buckets.yesterday.items.push(conv)
    else if (ts >= weekStart) buckets.thisWeek.items.push(conv)
    else buckets.earlier.items.push(conv)
  }

  return [buckets.today, buckets.yesterday, buckets.thisWeek, buckets.earlier]
    .filter(b => b.items.length > 0)
}

/**
 * 按标签筛选对话
 * @param {array} conversations
 * @param {string|null} activeTag — null 表示全部
 * @returns {array}
 */
export function filterByTag(conversations, activeTag) {
  if (!activeTag || activeTag === '全部') return conversations
  return conversations.filter(conv => getConvTags(conv).includes(activeTag))
}
