/**
 * memory/store.js — 长期记忆 CRUD 与开关（3.5.14 从 utils/memory.js 拆出）
 *
 * 存储：siji_long_term_memory，上限 100 条；写入时按分类过期清理（event 90 天 / summary 180 天）。
 */

import { asyncSetStorage, asyncSetStorageJSON } from '@/utils/store-helpers.js'
import { clearStructuredMemory, getStructuredMemoryStats } from '../memory-structured.js'
import { normalizeMemoryText } from './normalize.js'

export const STORAGE_KEY = 'siji_long_term_memory'
const MAX_MEMORIES = 100 // 最多保存 100 条

/** 获取所有记忆 */
export function getAllMemories() {
  try {
    const raw = uni.getStorageSync(STORAGE_KEY)
    if (!raw) return []
    const list = JSON.parse(raw)
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

/** 按分类获取记忆 */
export function getMemoriesByCategory(category) {
  return getAllMemories().filter(m => m.category === category)
}

/** 添加一条记忆 */
export function addMemory(content, category = 'other') {
  const memories = getAllMemories()
  const text = String(content == null ? '' : content).trim()
  const norm = normalizeMemoryText(text)
  // 去重（3.2 M2）：归一化相等（全半角/标点/前缀差异）视为同一条 → 更新时间戳而非新增
  const existing = norm
    ? memories.find(m => normalizeMemoryText(m.content) === norm)
    : memories.find(m => m.content === text)
  if (existing) {
    existing.updatedAt = Date.now()
    if (category && existing.category !== category && category !== 'other') {
      existing.category = category
    }
    persist(memories)
    return existing
  }

  const item = {
    id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    content: text,
    category,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  memories.unshift(item)

  // 超出上限，移除最旧的
  if (memories.length > MAX_MEMORIES) {
    memories.length = MAX_MEMORIES
  }

  persist(memories)
  return item
}

/** 更新记忆 */
export function updateMemory(id, content) {
  const memories = getAllMemories()
  const item = memories.find(m => m.id === id)
  if (item) {
    item.content = content
    item.updatedAt = Date.now()
    persist(memories)
    return true
  }
  return false
}

/** 删除记忆 */
export function deleteMemory(id) {
  const memories = getAllMemories().filter(m => m.id !== id)
  persist(memories)
  return true
}

/** 清空所有记忆 */
export function clearAllMemories() {
  try {
    uni.removeStorageSync(STORAGE_KEY)
  } catch { /* ignore */ }
  clearStructuredMemory()
}

/** 记忆统计 */
export function getMemoryStats() {
  const all = getAllMemories()
  const categories = {}
  all.forEach(m => {
    categories[m.category] = (categories[m.category] || 0) + 1
  })
  const structured = getStructuredMemoryStats()
  return {
    total: all.length,
    categories,
    structured,
    latestUpdate: all.length > 0 ? all[0].updatedAt : 0
  }
}

/** 是否启用长期记忆 */
export function isMemoryEnabled() {
  const v = uni.getStorageSync('siji_memory_enabled')
  return v !== 'false' // 默认启用
}

/** 切换记忆开关 */
export function setMemoryEnabled(enabled) {
  asyncSetStorage('siji_memory_enabled', enabled ? 'true' : 'false')
}

/** 持久化 + 过期清理（治理模块复用，不进对外门面） */
export function persist(memories) {
  // 过期清理：event 类记忆超 90 天自动移除，summary 类超 180 天移除
  const now = Date.now()
  const EVENT_TTL = 90 * 24 * 60 * 60 * 1000   // 90 天
  const SUMMARY_TTL = 180 * 24 * 60 * 60 * 1000  // 180 天
  const cleaned = memories.filter(m => {
    if (m.category === 'event' && now - (m.createdAt || 0) > EVENT_TTL) return false
    if (m.category === 'summary' && now - (m.createdAt || 0) > SUMMARY_TTL) return false
    return true
  })
  try {
    asyncSetStorageJSON(STORAGE_KEY, cleaned)
  } catch { /* ignore */ }
}
