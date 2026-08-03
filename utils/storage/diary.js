/**
 * 日记 CRUD
 *
 * 存储策略：按月份分片 → storage key: diary_YYYY-MM
 * 字段：client_id, title, content, tags, category, images, pinned, emotion, ai_summary, ai_advice, created_at, updated_at, is_deleted
 */

import { getRawList, getMonthFromDate } from './helpers.js'
import { asyncSetStorageJSON } from '../store-helpers.js'

/** 获取某月日记列表（不含已删除） */
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

/** 获取某月已删除日记（回收站） */
export function getDeletedDiaries(month) {
  const key = `diary_${month}`
  const raw = uni.getStorageSync(key)
  if (!raw) return []
  try {
    return JSON.parse(raw).filter(item => item.is_deleted === 1)
  } catch {
    return []
  }
}

/** 恢复已删除日记 */
export function restoreDiary(clientId, month) {
  const key = `diary_${month}`
  const list = getRawList(key)
  const idx = list.findIndex(item => item.client_id === clientId)
  if (idx >= 0) {
    list[idx].is_deleted = 0
    list[idx].updated_at = Date.now()
    asyncSetStorageJSON(key, list)
    return true
  }
  return false
}

/** 彻底删除（不可恢复） */
export function purgeDiary(clientId, month) {
  const key = `diary_${month}`
  const list = getRawList(key)
  const filtered = list.filter(item => item.client_id !== clientId)
  asyncSetStorageJSON(key, filtered)
}

/** 保存/更新日记 */
export function saveDiary(diary) {
  if (!diary.created_at || typeof diary.created_at !== 'number' || isNaN(diary.created_at)) {
    diary.created_at = Date.now()
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

/** 置顶/取消置顶 */
export function togglePinDiary(clientId, month) {
  const key = `diary_${month}`
  const list = getRawList(key)
  const idx = list.findIndex(item => item.client_id === clientId)
  if (idx >= 0) {
    list[idx].pinned = !list[idx].pinned
    list[idx].updated_at = Date.now()
    asyncSetStorageJSON(key, list)
    return list[idx].pinned
  }
  return false
}

/** 按 client_id 获取单条日记 */
export function getDiaryById(clientId, month) {
  const key = `diary_${month}`
  const list = getRawList(key)
  return list.find(item => item.client_id === clientId && item.is_deleted !== 1) || null
}
