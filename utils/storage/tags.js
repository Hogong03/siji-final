/**
 * 标签管理
 *
 * 存储策略：按类型分片 → storage key: siji_tags_diary / siji_tags_plan
 * 支持全局标签注册表 + 从真实数据中提取使用中的标签
 */

import { getRawList } from './helpers.js'
import { asyncSetStorageJSON } from '../store-helpers.js'

const tagColors = [
  '#18181B', '#10B981', '#F59E0B', '#EF4444', '#3F3F46',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#14B8A6',
  '#3B82F6', '#22C55E', '#EAB308', '#DC2626', '#52525B'
]

/**
 * 获取全局标签注册表
 * @param {'diary'|'plan'} type
 * @returns {Array<{name:string, color:string, count:number}>}
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
  registry.forEach(r => { registryMap[r.name] = r.color || tagColors[0] })

  const usedColors = new Set(Object.values(registryMap))
  let colorIdx = 0

  // 合并：数据中出现的标签 + 注册表中的标签（count=0）
  const allNames = new Set([...Object.keys(tagMap), ...Object.keys(registryMap)])
  const result = [...allNames].sort((a, b) => (tagMap[b] || 0) - (tagMap[a] || 0)).map(name => {
    let color = registryMap[name]
    if (!color) {
      // 分配未使用过的颜色
      while (usedColors.has(tagColors[colorIdx % tagColors.length])) {
        colorIdx++
        if (colorIdx > tagColors.length * 2) break
      }
      color = tagColors[colorIdx % tagColors.length]
      usedColors.add(color)
      colorIdx++
    }
    return { name, color, count: tagMap[name] || 0 }
  })

  return result
}

/** 添加自定义标签到注册表 */
export function addCustomTag(type, tagName, color) {
  const tags = getTags(type)
  const exists = tags.find(t => t.name === tagName)
  if (exists) {
    if (color) exists.color = color
    setTags(type, tags)
    return exists
  }
  // 分配颜色
  const usedColors = new Set(tags.map(t => t.color))
  const c = color || tagColors.find(c => !usedColors.has(c)) || tagColors[tags.length % tagColors.length]
  const newTag = { name: tagName, color: c }
  tags.push(newTag)
  setTags(type, tags)
  return newTag
}

/** 从注册表删除标签 */
export function removeCustomTag(type, tagName) {
  const tags = getTags(type).filter(t => t.name !== tagName)
  setTags(type, tags)
}
