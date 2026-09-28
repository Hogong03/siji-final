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

/** 记录类型白名单（4.2.0：从 5 种收敛到 3 种） */
export const RECORD_TYPE_KEYS = ['note', 'diary', 'todo']

/** 旧类型 → 新类型（灵感、闪念并入随手记） */
export const LEGACY_TYPE_MAP = { idea: 'note', flash: 'note' }

/** 旧类型对应的标签名（迁移时补上，保住原来的语义） */
export const LEGACY_TYPE_TAGS = { idea: '灵感', flash: '闪念' }

/**
 * 跨月的记录分片 key（近 N 个月 + 存储清单里所有 diary_*）
 * @param {number} at
 * @param {number} [months] 默认 13 个月
 * @returns {string[]}
 */
export function candidateDiaryKeys(at, months) {
  const base = new Date(Number(at) || Date.now())
  const span = Number.isFinite(Number(months)) ? Number(months) : 13
  const keys = new Set()
  for (let i = 0; i < span; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1)
    keys.add('diary_' + getMonthFromDate(d.getTime()))
  }
  try {
    const info = (typeof uni !== 'undefined' && uni.getStorageInfoSync) ? uni.getStorageInfoSync() : null
    const all = (info && info.keys) || []
    all.forEach(k => { if (/^diary_\d{4}-\d{2}$/.test(k)) keys.add(k) })
  } catch (e) { /* 拿不到清单也不影响：近 13 个月已覆盖 */ }
  return Array.from(keys)
}

/**
 * 取一段时间内的全部记录（跨月扫描，回顾与「一句话筛选」用）
 * @param {number} fromTs
 * @param {number} toTs
 * @returns {Array}
 */
export function getDiariesBetween(fromTs, toTs) {
  const from = Number(fromTs) || 0
  const to = Number(toTs) || Date.now()
  const out = []
  candidateDiaryKeys(to).forEach(key => {
    getRawList(key).forEach(item => {
      if (!item || item.is_deleted === 1) return
      const ts = Number(item.created_at) || 0
      if (ts >= from && ts <= to) out.push(item)
    })
  })
  return out.sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
}

/**
 * 迁移①：类型 5 → 3（4.2.0）
 * idea / flash 的 record_type 改成 note，并补一个同名标签，语义不丢
 * 幂等：迁移过的记录 record_type 已是 note，匹配不到就跳过
 * @returns {{ changed: number, months: number }}
 */
export function migrateRecordTypes() {
  let changed = 0
  let months = 0
  candidateDiaryKeys(Date.now()).forEach(key => {
    const list = getRawList(key)
    if (list.length === 0) return
    let touched = 0
    list.forEach(item => {
      if (!item || item.is_deleted === 1) return
      const old = item.record_type
      const mapped = LEGACY_TYPE_MAP[old]
      if (!mapped) return
      item.record_type = mapped
      const tag = LEGACY_TYPE_TAGS[old]
      if (tag) {
        const tags = Array.isArray(item.tags) ? item.tags : []
        if (!tags.includes(tag)) item.tags = tags.concat([tag])
      }
      item.updated_at = Date.now()
      touched++
    })
    if (touched > 0) {
      asyncSetStorageJSON(key, list)
      changed += touched
      months++
    }
  })
  return { changed, months }
}

/**
 * 迁移②：分类并入标签（4.2.0）
 * 记录的 category 值转成同名标签（工作 / 生活 / 健康 / 思考 本来就是好标签），字段清空
 * @returns {{ changed: number }}
 */
export function migrateDiaryCategories() {
  let changed = 0
  candidateDiaryKeys(Date.now()).forEach(key => {
    const list = getRawList(key)
    if (list.length === 0) return
    let touched = 0
    list.forEach(item => {
      if (!item || item.is_deleted === 1) return
      const cat = String(item.category || '').trim()
      if (!cat) return
      const tags = Array.isArray(item.tags) ? item.tags : []
      if (!tags.includes(cat)) item.tags = tags.concat([cat])
      item.category = ''
      item.updated_at = Date.now()
      touched++
    })
    if (touched > 0) {
      asyncSetStorageJSON(key, list)
      changed += touched
    }
  })
  return { changed: changed }
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
