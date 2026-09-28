/**
 * 体验反馈 CRUD
 *
 * 存储策略：不分片 → storage key: siji_feedback
 */

import { getRawList } from './helpers.js'
import { asyncSetStorageJSON } from '../store-helpers.js'

const FEEDBACK_KEY = 'siji_feedback'

/** 获取所有反馈 */
export function getFeedbackList() {
  const raw = uni.getStorageSync(FEEDBACK_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw).filter(f => !f.is_deleted).sort((a, b) => b.created_at - a.created_at)
  } catch { return [] }
}

/** 保存反馈 */
export function saveFeedback(fb) {
  const list = getRawList(FEEDBACK_KEY)
  const item = {
    client_id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    rating: fb.rating || 5,
    category: fb.category || '功能建议',
    content: fb.content || '',
    contact: fb.contact || '',
    created_at: Date.now(),
    is_deleted: 0
  }
  list.push(item)
  asyncSetStorageJSON(FEEDBACK_KEY, list)
  return item
}

/** 删除反馈 */
export function deleteFeedback(clientId) {
  const list = getRawList(FEEDBACK_KEY)
  const filtered = list.filter(f => f.client_id !== clientId)
  asyncSetStorageJSON(FEEDBACK_KEY, filtered)
}

/** 更新本地反馈（按 client_id 匹配替换） */
export function updateFeedback(clientId, updates) {
  const list = getRawList(FEEDBACK_KEY)
  const idx = list.findIndex(f => f.client_id === clientId)
  if (idx < 0) return null
  list[idx] = { ...list[idx], ...updates, updated_at: Date.now() }
  asyncSetStorageJSON(FEEDBACK_KEY, list)
  return list[idx]
}

/** 获取反馈统计 */
export function getFeedbackStats() {
  const list = getFeedbackList()
  const total = list.length
  const avgRating = total > 0 ? (list.reduce((s, f) => s + (f.rating || 0), 0) / total).toFixed(1) : '0.0'
  const categoryMap = {}
  list.forEach(f => {
    const c = f.category || '其他'
    categoryMap[c] = (categoryMap[c] || 0) + 1
  })
  return { total, avgRating, categoryMap }
}
