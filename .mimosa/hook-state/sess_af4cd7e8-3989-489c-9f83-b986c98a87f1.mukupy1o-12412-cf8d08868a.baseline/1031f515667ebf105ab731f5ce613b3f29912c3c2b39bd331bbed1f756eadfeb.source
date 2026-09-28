/**
 * 标签管理
 *
 * 存储策略：按类型分片 → storage key: siji_tags_diary / siji_tags_plan
 * 支持全局标签注册表 + 从真实数据中提取使用中的标签
 * 标签可关联分类（category 字段）
 *
 * 标签种类（TAG_CATEGORIES）：
 *   预定义 6 大类，用户也可自定义种类
 *   每个标签归属一个种类，通过种类对标签进行分组管理
 */

import { getRawList } from './helpers.js'
import { asyncSetStorageJSON } from '../store-helpers.js'

const tagColors = [
  '#18181B', '#10B981', '#F59E0B', '#EF4444', '#3F3F46',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#14B8A6',
  '#3B82F6', '#22C55E', '#EAB308', '#DC2626', '#52525B'
]

/**
 * 预定义标签种类（6 大类）
 * kind=系统预定义不可删除；用户自定义种类可增删
 */
export const TAG_CATEGORIES = [
  { id: 'life', name: '生活', color: '#10B981', kind: 'system' },
  { id: 'work', name: '工作', color: '#3B82F6', kind: 'system' },
  { id: 'mood', name: '心情', color: '#EC4899', kind: 'system' },
  { id: 'study', name: '学习', color: '#F59E0B', kind: 'system' },
  { id: 'social', name: '社交', color: '#06B6D4', kind: 'system' },
  { id: 'other', name: '其他', color: '#71717A', kind: 'system' }
]

/** 获取自定义标签种类 */
export function getCustomCategories() {
  const raw = uni.getStorageSync('siji_tag_categories')
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

/** 获取全部种类（系统 + 自定义） */
export function getAllCategories() {
  const custom = getCustomCategories()
  return [...TAG_CATEGORIES, ...custom]
}

/** 添加自定义标签种类 */
export function addCustomCategory(name, color) {
  const custom = getCustomCategories()
  const id = `cat_${Date.now()}`
  custom.push({ id, name, color: color || '#71717A', kind: 'user' })
  asyncSetStorageJSON('siji_tag_categories', custom)
  return { id, name, color: color || '#71717A', kind: 'user' }
}

/** 删除自定义标签种类（系统种类不可删） */
export function removeCustomCategory(catId) {
  const custom = getCustomCategories().filter(c => c.id !== catId)
  asyncSetStorageJSON('siji_tag_categories', custom)
  // 将该分类下的标签归入「其他」
  for (const type of ['diary', 'plan']) {
    const tags = getTags(type)
    let changed = false
    tags.forEach(t => {
      if (t.category === catId) { t.category = 'other'; changed = true }
    })
    if (changed) setTags(type, tags)
  }
}

/**
 * 获取全局标签注册表
 * @param {'diary'|'plan'} type
 * @returns {Array<{name:string, color:string, category?:string, categoryId?:string}>}
 */
export function getTags(type) {
  const key = `siji_tags_${type}`
  const raw = uni.getStorageSync(key)
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

/** 保存标签注册表 */
function setTags(type, tags) {
  asyncSetStorageJSON(`siji_tags_${type}`, tags)
}

/**
 * 获取所有实际使用的标签（从真实数据中提取）
 * 优先级：从数据中收集 > 从注册表读取
 * 返回结果按种类分组
 */
export function getUsedTags(type) {
  const tagMap = {} // name → count

  if (type === 'diary') {
    const allKeys = uni.getStorageInfoSync().keys || []
    allKeys.filter(k => k.startsWith('diary_')).forEach(key => {
      const list = getRawList(key)
      list.forEach(item => {
        if (item.is_deleted === 1) return
        const tags = Array.isArray(item.tags) ? item.tags : []
        tags.forEach(t => {
          if (t && t.trim()) {
            const name = t.trim()
            tagMap[name] = (tagMap[name] || 0) + 1
          }
        })
      })
    })
  } else if (type === 'plan') {
    const list = getRawList('plan_all')
    list.forEach(item => {
      if (item.is_deleted === 1) return
      const tags = Array.isArray(item.tags) ? item.tags : []
      tags.forEach(t => {
        if (t && t.trim()) {
          const name = t.trim()
          tagMap[name] = (tagMap[name] || 0) + 1
        }
      })
    })
  }

  // 转为标签列表（复用注册表中的颜色，新标签给自动色）
  const registry = getTags(type)
  const registryMap = {}
  registry.forEach(r => { registryMap[r.name] = r })

  const usedColors = new Set(registry.map(r => r.color).filter(Boolean))
  let colorIdx = 0

  // 合并：数据中出现的标签 + 注册表中的标签（count=0）
  const allNames = new Set([...Object.keys(tagMap), ...Object.keys(registryMap)])
  const result = [...allNames].sort((a, b) => (tagMap[b] || 0) - (tagMap[a] || 0)).map(name => {
    const reg = registryMap[name] || {}
    let color = reg.color
    if (!color) {
      while (usedColors.has(tagColors[colorIdx % tagColors.length])) {
        colorIdx++
        if (colorIdx > tagColors.length * 2) break
      }
      color = tagColors[colorIdx % tagColors.length]
      usedColors.add(color)
      colorIdx++
    }
    return {
      name,
      color,
      count: tagMap[name] || 0,
      category: reg.category || '',
      categoryId: reg.categoryId || 'other'
    }
  })

  return result
}

// ==================== 标签自定义顺序（4.4.0）====================
/**
 * 用户在记录页把标签拖到了自己习惯的位置，这份顺序必须落盘 ——
 * 否则每次重算「按使用频次排」都会把辛苦调好的顺序冲掉。
 * 存成 { diary: [名, 名], plan: [...] }，按类型分片，和标签本身同一套分片习惯。
 */
export const TAG_ORDER_KEY = 'siji_tag_order'

/** 读取某类型的自定义标签顺序（没有则空数组） */
export function getTagOrder(type) {
  try {
    const raw = uni.getStorageSync(TAG_ORDER_KEY)
    const obj = raw ? JSON.parse(raw) : {}
    const arr = obj && Array.isArray(obj[type]) ? obj[type] : []
    return arr.filter(n => typeof n === 'string' && n)
  } catch (e) {
    return []
  }
}

/** 保存某类型的自定义标签顺序 */
export function setTagOrder(type, names) {
  try {
    const raw = uni.getStorageSync(TAG_ORDER_KEY)
    const obj = raw ? JSON.parse(raw) : {}
    obj[type] = (Array.isArray(names) ? names : []).filter(n => typeof n === 'string' && n)
    uni.setStorageSync(TAG_ORDER_KEY, JSON.stringify(obj))
    return true
  } catch (e) {
    return false
  }
}

/**
 * 把自定义顺序套到标签列表上（纯函数）
 *
 * 在 order 里的标签按 order 的顺序排；不在 order 里的（新出现的标签）保持原有相对顺序，
 * 统一排在已排序的后面 —— 新增标签不会打乱用户已经调好的那一批。
 * @param {Array<{name: string}>} list
 * @param {string[]} order
 */
export function applyTagOrder(list, order) {
  const arr = Array.isArray(list) ? list : []
  const seq = Array.isArray(order) ? order : []
  if (seq.length === 0) return arr
  const rank = {}
  seq.forEach((n, i) => {
    if (!Object.prototype.hasOwnProperty.call(rank, n)) rank[n] = i
  })
  const known = []
  const rest = []
  arr.forEach(item => {
    const n = item && item.name
    if (n && Object.prototype.hasOwnProperty.call(rank, n)) known.push(item)
    else rest.push(item)
  })
  known.sort((a, b) => rank[a.name] - rank[b.name])
  return [...known, ...rest]
}

/**
 * 把某个标签往左/往右挪一位（纯函数）
 * @param {string[]} order
 * @param {string} name
 * @param {number} delta -1 左移 / +1 右移
 * @returns {string[]} 新数组；越界时原样返回
 */
export function moveTagInList(order, name, delta) {
  const arr = Array.isArray(order) ? [...order] : []
  const step = Number(delta) < 0 ? -1 : 1
  const i = arr.indexOf(name)
  if (i < 0) return arr
  const j = i + step
  if (j < 0 || j >= arr.length) return arr
  const tmp = arr[i]
  arr[i] = arr[j]
  arr[j] = tmp
  return arr
}

/**
 * 按种类分组获取标签
 * @param {'diary'|'plan'} type
 * @returns {Object} { categoryId: [{ name, color, count }] }
 */
export function getTagsByCategory(type) {
  const all = getUsedTags(type)
  const categories = getAllCategories()
  const grouped = {}
  // 初始化所有种类
  categories.forEach(c => { grouped[c.id] = { name: c.name, color: c.color, tags: [] } })
  // 分配标签到种类
  all.forEach(t => {
    const catId = t.categoryId || 'other'
    if (!grouped[catId]) grouped[catId] = { name: '其他', color: '#71717A', tags: [] }
    grouped[catId].tags.push(t)
  })
  return grouped
}

/** 添加自定义标签到注册表（可指定分类） */
export function addCustomTag(type, tagName, color, category, categoryId) {
  const tags = getTags(type)
  const exists = tags.find(t => t.name === tagName)
  if (exists) {
    if (color) exists.color = color
    if (category) exists.category = category
    if (categoryId) exists.categoryId = categoryId
    setTags(type, tags)
    return exists
  }
  const usedColors = new Set(tags.map(t => t.color))
  const c = color || tagColors.find(c => !usedColors.has(c)) || tagColors[tags.length % tagColors.length]
  const newTag = {
    name: tagName,
    color: c,
    category: category || '',
    categoryId: categoryId || 'other'
  }
  tags.push(newTag)
  setTags(type, tags)
  return newTag
}

/** 更新标签的分类 */
export function updateTagCategory(type, tagName, categoryId) {
  const tags = getTags(type)
  const tag = tags.find(t => t.name === tagName)
  if (!tag) return false
  tag.categoryId = categoryId
  const cat = getAllCategories().find(c => c.id === categoryId)
  tag.category = cat ? cat.name : ''
  setTags(type, tags)
  return true
}

/** 从注册表删除标签 */
export function removeCustomTag(type, tagName) {
  const tags = getTags(type).filter(t => t.name !== tagName)
  setTags(type, tags)
}
