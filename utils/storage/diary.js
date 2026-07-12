/**
 * 日记 CRUD
 *
 * 存储策略：按月份分片 → storage key: diary_YYYY-MM
 */

import { getRawList, getMonthFromDate } from './helpers.js'
import { asyncSetStorageJSON } from '../store-helpers.js'

/** 获取某月日记列表 */
export function getDiaryList(month) {
  const key = `diary_${month}`
  const raw = uni.getStorageSync(key)
  if (!raw) return []
  try {
    return JSON.parse(raw).filter(item => item.is_deleted !== 1)
  } catch {
    return []
  }
}

/** 保存/更新日记 */
export function saveDiary(diary) {
  // 防御：created_at 缺失或无效时 fallback 到当前时间
  // 避免 getMonthFromDate(undefined) → "NaN-NaN" → 存到 diary_NaN-NaN 错误 key
  if (!diary.created_at || typeof diary.created_at !== 'number' || isNaN(diary.created_at)) {
    diary.created_at = Date.now()
    logger.warn('[saveDiary] created_at 无效，已 fallback 到当前时间')
  }
  const month = getMonthFromDate(diary.created_at)
  const key = `diary_${month}`
  const list = getRawList(key)
  const idx = list.findIndex(item => item.client_id === diary.client_id)
  diary.updated_at = Date.now()
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...diary }
  } else {
    list.push(diary)
  }
  asyncSetStorageJSON(key, list)
  return diary
}

/** 软删除日记 */
export function deleteDiary(clientId, month) {
  const key = `diary_${month}`
  const list = getRawList(key)
  const idx = list.findIndex(item => item.client_id === clientId)
  if (idx >= 0) {
    list[idx].is_deleted = 1
    list[idx].updated_at = Date.now()
    asyncSetStorageJSON(key, list)
  }
}

/** 按 client_id 获取单条日记 */
export function getDiaryById(clientId, month) {
  const key = `diary_${month}`
  const list = getRawList(key)
  return list.find(item => item.client_id === clientId && item.is_deleted !== 1) || null
}
