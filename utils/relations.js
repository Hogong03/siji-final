/**
 * 关系图谱管理 — 人际关系卡片系统
 *
 * 数据结构：
 *   siji_relations: [{
 *     id, name, role, context, traits[], preferences[],
 *     notes, relationship_score(1-10), tags[],
 *     last_interaction, created_at, updated_at, is_deleted
 *   }]
 *
 * 互动记录：
 *   siji_interactions: [{
 *     id, relation_id, scene, content, result, emotion, date, created_at
 *   }]
 */

import { logger } from './logger.js'

const RELATIONS_KEY = 'siji_relations'
const INTERACTIONS_KEY = 'siji_interactions'

// ==================== 关系卡片 CRUD ====================

/** 获取所有关系（排除已删除） */
export function getAllRelations() {
  let stored = []
  try {
    const raw = uni.getStorageSync(RELATIONS_KEY)
    if (raw) stored = JSON.parse(raw).filter(r => r.is_deleted !== 1)
  } catch {
    stored = []
  }
  return stored
}

/** 按 ID 获取单条关系 */
export function getRelationById(id) {
  return getAllRelations().find(r => r.id === id) || null
}

/** 按姓名模糊查找 */
export function findRelationsByName(name) {
  if (!name) return []
  const kw = name.toLowerCase()
  return getAllRelations().filter(r =>
    r.name.toLowerCase().includes(kw) ||
    (r.context || '').toLowerCase().includes(kw) ||
    (r.tags || []).some(t => t.toLowerCase().includes(kw))
  )
}

/** 创建关系卡片 */
export function createRelation(data) {
  const now = Date.now()
  const relation = {
    id: `rel_${now}_${Math.random().toString(36).slice(2, 8)}`,
    name: data.name || '未知',
    role: data.role || '其他',
    context: data.context || '',
    traits: Array.isArray(data.traits) ? data.traits : [],
    preferences: Array.isArray(data.preferences) ? data.preferences : [],
    notes: data.notes || '',
    relationship_score: data.relationship_score != null ? data.relationship_score : 5,
    tags: Array.isArray(data.tags) ? data.tags : [],
    last_interaction: '',
    created_at: now,
    updated_at: now,
    is_deleted: 0
  }
  const all = getRawRelations()
  all.push(relation)
  persistRelations(all)
  logger.log('[relations] Created:', relation.name)
  return relation
}

/** 更新关系卡片 */
export function updateRelation(id, updates) {
  const all = getRawRelations()
  const idx = all.findIndex(r => r.id === id)
  if (idx < 0) return false
  const allowed = ['name', 'role', 'context', 'traits', 'preferences', 'notes', 'relationship_score', 'tags']
  for (const key of allowed) {
    if (updates[key] != null) all[idx][key] = updates[key]
  }
  all[idx].updated_at = Date.now()
  persistRelations(all)
  return true
}

/** 软删除关系卡片 */
export function deleteRelation(id) {
  const all = getRawRelations()
  const idx = all.findIndex(r => r.id === id)
  if (idx < 0) return false
  all[idx].is_deleted = 1
  all[idx].updated_at = Date.now()
  persistRelations(all)
  return true
}

// ==================== 互动记录 ====================

/** 获取某关系的互动记录 */
export function getInteractions(relationId) {
  try {
    const raw = uni.getStorageSync(INTERACTIONS_KEY)
    if (!raw) return []
    return JSON.parse(raw)
      .filter(i => i.relation_id === relationId && i.is_deleted !== 1)
      .sort((a, b) => b.date - a.date)
  } catch {
    return []
  }
}

/** 获取最近 N 条互动 */
export function getRecentInteractions(limit = 10) {
  try {
    const raw = uni.getStorageSync(INTERACTIONS_KEY)
    if (!raw) return []
    return JSON.parse(raw)
      .filter(i => i.is_deleted !== 1)
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, limit)
  } catch {
    return []
  }
}

/** 记录一次互动 */
export function logInteraction(data) {
  const now = Date.now()
  const interaction = {
    id: `int_${now}_${Math.random().toString(36).slice(2, 8)}`,
    relation_id: data.relation_id || '',
    relation_name: data.relation_name || '',
    scene: data.scene || '日常',
    content: data.content || '',
    result: data.result || '',
    emotion: data.emotion || '',
    date: data.date || now,
    created_at: now,
    is_deleted: 0
  }
  const all = getRawInteractions()
  all.push(interaction)
  persistInteractions(all)

  // 更新关系的 last_interaction
  if (data.relation_id) {
    updateRelation(data.relation_id, { last_interaction: interaction.date })
  }
  return interaction
}

/** 删除互动记录 */
export function deleteInteraction(id) {
  const all = getRawInteractions()
  const idx = all.findIndex(i => i.id === id)
  if (idx < 0) return false
  all[idx].is_deleted = 1
  persistInteractions(all)
  return true
}

// ==================== 上下文注入 ====================

/**
 * 构建关系图谱上下文（注入系统提示词）
 * 优化：若用户消息提到了已收录人物，只注入被提到的人物详情；
 *  否则注入最近 3 个关系卡片摘要（不全量 5 个，减少 token）
 */
export function buildRelationsContext(userMessage) {
  const relations = getAllRelations()
  if (relations.length === 0) return ''

  // 如果用户消息提到了已知人物，只注入被提到的人物
  if (userMessage) {
    const mentioned = relations.filter(r => {
      if (!r.name || r.name.length < 2) return false
      return userMessage.includes(r.name) || 
        (r.name.length > 2 && userMessage.includes(r.name.substring(1)))
    })
    if (mentioned.length > 0) {
      const lines = mentioned.map(r => formatRelationLine(r))
      return `\n\n---\n关系图谱（用户提到的人物）：\n${lines.join('\n')}`
    }
  }

  // 未提到人物 → 注入最近 3 个关系摘要（从 5 个减到 3 个，省 token）
  const sorted = relations
    .sort((a, b) => (b.last_interaction || 0) - (a.last_interaction || 0))
    .slice(0, 3)

  const lines = sorted.map(r => formatRelationLine(r))
  return `\n\n---\n关系图谱（用户的人际网络）：\n${lines.join('\n')}`
}

/** 格式化单个关系卡片为一行 */
function formatRelationLine(r) {
  const parts = [`  - ${r.name}（${r.role}）`]
  if (r.context) parts.push(`场景: ${r.context}`)
  if (r.traits && r.traits.length > 0) parts.push(`特征: ${r.traits.join('、')}`)
  if (r.preferences && r.preferences.length > 0) parts.push(`偏好: ${r.preferences.join('、')}`)
  if (r.notes) parts.push(`备注: ${r.notes}`)
  parts.push(`亲密度: ${r.relationship_score}/10`)
  return parts.join(' | ')
}

/**
 * 从用户消息中检测是否提到已知人物
 * @returns {Array} 匹配到的关系卡片
 */
/** 检测消息中是否提到了已收录的关系人物
 *  使用简单索引，O(n) 复杂度，正常使用场景 (<100 人物) 性能足够 */
export function detectMentionedRelations(userMessage) {
  if (!userMessage) return []
  const relations = getAllRelations()
  if (relations.length === 0) return []
  
  // 长度不足的直接跳过
  if (userMessage.length < 1) return []
  
  return relations.filter(r => {
    // 姓名全匹配
    if (userMessage.includes(r.name)) return true
    // 单字名不截取
    if (r.name.length <= 1) return false
    // 名字截取（去掉姓氏）
    if (r.name.length > 2 && userMessage.includes(r.name.substring(1))) return true
    // 两字全名（姓氏通常不单独出现）
    if (r.name.length === 2 && userMessage.includes(r.name)) return true
    return false
  })
}

/**
 * 获取关系图谱统计
 */
export function getRelationsStats() {
  const all = getAllRelations()
  const roleMap = {}
  all.forEach(r => {
    roleMap[r.role] = (roleMap[r.role] || 0) + 1
  })
  const interactions = getRawInteractions().filter(i => i.is_deleted !== 1)
  return {
    total: all.length,
    roles: roleMap,
    interactionCount: interactions.length,
    avgScore: all.length > 0
      ? (all.reduce((s, r) => s + (r.relationship_score || 0), 0) / all.length).toFixed(1)
      : 0
  }
}

// ==================== 内部工具 ====================

function getRawRelations() {
  try {
    return JSON.parse(uni.getStorageSync(RELATIONS_KEY) || '[]')
  } catch {
    return []
  }
}

function getRawInteractions() {
  try {
    return JSON.parse(uni.getStorageSync(INTERACTIONS_KEY) || '[]')
  } catch {
    return []
  }
}

function persistRelations(list) {
  try {
    // 关系数据量小（<100 条），用同步写入确保读后即写一致性
    uni.setStorageSync(RELATIONS_KEY, JSON.stringify(list))
  } catch { /* ignore */ }
}

function persistInteractions(list) {
  try {
    uni.setStorageSync(INTERACTIONS_KEY, JSON.stringify(list))
  } catch { /* ignore */ }
}
