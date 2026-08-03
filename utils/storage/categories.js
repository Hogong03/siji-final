/**
 * 分类管理 — 记录功能的分类体系
 *
 * 存储策略：siji_categories_diary
 * 预设 4 个分类 + 用户自定义
 */

import { asyncSetStorageJSON } from '../store-helpers.js'

const CATEGORY_KEY = 'siji_categories_diary'

/** 预设分类 */
const DEFAULT_CATEGORIES = [
  { name: '工作', icon: 'briefcase' },
  { name: '生活', icon: 'leaf' },
  { name: '健康', icon: 'heart' },
  { name: '思考', icon: 'bulb' }
]

/** 获取所有分类（预设 + 自定义） */
export function getCategories() {
  const raw = uni.getStorageSync(CATEGORY_KEY)
  if (!raw) {
    // 首次访问，写入预设
    asyncSetStorageJSON(CATEGORY_KEY, DEFAULT_CATEGORIES)
    return [...DEFAULT_CATEGORIES]
  }
  try { return JSON.parse(raw) } catch { return [...DEFAULT_CATEGORIES] }
}

/** 添加自定义分类 */
export function addCategory(name, icon) {
  const list = getCategories()
  if (list.find(c => c.name === name)) return null
  const cat = { name, icon: icon || 'tag' }
  list.push(cat)
  asyncSetStorageJSON(CATEGORY_KEY, list)
  return cat
}

/** 删除自定义分类（预设不可删） */
export function removeCategory(name) {
  if (DEFAULT_CATEGORIES.find(c => c.name === name)) return false
  const list = getCategories().filter(c => c.name !== name)
  asyncSetStorageJSON(CATEGORY_KEY, list)
  return true
}

/** 获取分类图标映射 */
export function getCategoryIcon(name) {
  const list = getCategories()
  return list.find(c => c.name === name)?.icon || 'tag'
}
