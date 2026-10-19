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

/** 按姓名模糊查找（姓名 / 场景 / 标签）—— 用于 query_relation 这类关键词检索 */
export function findRelationsByName(name) {
  if (!name) return []
  const kw = name.toLowerCase()
  return getAllRelations().filter(r =>
    r.name.toLowerCase().includes(kw) ||
    (r.context || '').toLowerCase().includes(kw) ||
    (r.tags || []).some(t => t.toLowerCase().includes(kw))
  )
}

/**
 * 精确姓名匹配（4.37.0）：严格相等、去首尾空格，同名返回全部候选。
 * 与 findRelationsByName 分开的原因：写互动时「像人名」的上下文词/标签词
 * 绝不能算命中，否则会把互动记到错误的人名下。
 */
export function findRelationsByExactName(name) {
  const key = String(name == null ? '' : name).trim()
  if (!key) return []
  return getAllRelations().filter(r => String(r.name || '').trim() === key)
}

/**
 * 姓名模糊候选（4.37.0）：**只匹配姓名**，不看 context / tags。
 * 少于 2 字直接返回空（单字名噪声太大，交给精确匹配）。
 */
export function findRelationCandidates(keyword, opts = {}) {
  const key = String(keyword == null ? '' : keyword).trim()
  if (key.length < 2) return []
  const limit = opts.limit || 5
  return getAllRelations()
    .filter(r => String(r.name || '').includes(key))
    .slice(0, limit)
}

/** 候选摘要：给 AI 与确认流程用的可区分信息（不含全量 traits/preferences，省 token） */
export function briefRelation(r) {
  return {
    id: r.id,
    name: r.name,
    role: r.role || '',
    context: r.context || '',
    tags: Array.isArray(r.tags) ? r.tags.slice(0, 3) : [],
    last_interaction: r.last_interaction || '',
    relationship_score: r.relationship_score != null ? r.relationship_score : null
  }
}

/**
 * 解析一次互动要记给谁（4.37.0）—— **只读，不写库**。
 *
 * 规则（优先级从上到下，绝不按数组顺序默认取第一个）：
 *  1. 有效 relation_id 且人物存在 → 直接用（ID 优先）
 *  2. 姓名精确匹配且唯一 → 用该人
 *  3. 姓名精确匹配但同名多人 → ambiguous
 *  4. 姓名模糊匹配唯一 → 用该人（保持 4.36 之前的行为）
 *  5. 姓名模糊匹配多个 → ambiguous
 *  6. 无匹配 → none
 *
 * @param {{ relationId?: string, relationName?: string }} [target]
 * @returns {{ status:'resolved', relation:object }
 *          | { status:'ambiguous', reason:string, keyword:string, candidates:object[] }
 *          | { status:'none', keyword:string }}
 */
export function resolveInteractionTarget(target = {}) {
  const id = String(target.relationId == null ? '' : target.relationId).trim()
  const name = String(target.relationName == null ? '' : target.relationName).trim()

  if (id) {
    const byId = getAllRelations().find(r => r.id === id)
    if (byId) return { status: 'resolved', relation: byId }
    // ID 失效（人物被删或前端传错）：有姓名就退回按姓名解析，否则视为未找到
  }
  if (!name) return { status: 'none', keyword: '' }

  const exact = findRelationsByExactName(name)
  if (exact.length === 1) return { status: 'resolved', relation: exact[0] }
  if (exact.length > 1) return { status: 'ambiguous', reason: '同名', keyword: name, candidates: exact }

  const fuzzy = findRelationCandidates(name)
  if (fuzzy.length === 1) return { status: 'resolved', relation: fuzzy[0] }
  if (fuzzy.length > 1) return { status: 'ambiguous', reason: '模糊匹配多个', keyword: name, candidates: fuzzy }

  return { status: 'none', keyword: name }
}

/** 亲密度默认值（无来源时的中性值。与「用户明确评价的中性」不可区分是已知限制，见 4.38.0 版本日志） */
export const DEFAULT_RELATIONSHIP_SCORE = 5

/**
 * 创建关系卡片
 * @param {object} data
 * @param {{ trustScore?: boolean }} [opts] **只有 trustScore === true 的调用方才采信 data.relationship_score**
 *   （4.38.0：亲密度是用户主观评价，AI 写入路径一律默认被拒；只有 UI 手动建卡传 true）
 */
export function createRelation(data, opts = {}) {
  const now = Date.now()
  const score = (opts.trustScore === true && data.relationship_score != null)
    ? data.relationship_score
    : DEFAULT_RELATIONSHIP_SCORE
  const relation = {
    id: `rel_${now}_${Math.random().toString(36).slice(2, 8)}`,
    name: data.name || '未知',
    role: data.role || '其他',
    context: data.context || '',
    traits: Array.isArray(data.traits) ? data.traits : [],
    preferences: Array.isArray(data.preferences) ? data.preferences : [],
    notes: data.notes || '',
    relationship_score: score,
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

/**
 * 更新关系卡片
 * @param {object} updates
 * @param {{ trustScore?: boolean }} [opts] **缺省时忽略 relationship_score**（4.38.0）
 *   AI 普通更新、互动落账等路径都不传 → 分数不可被非手动路径改写；UI 手动编辑传 true
 */
export function updateRelation(id, updates, opts = {}) {
  const all = getRawRelations()
  const idx = all.findIndex(r => r.id === id)
  if (idx < 0) return false
  // last_interaction 是系统记账字段（logInteraction 维护），由调用方控制；
  // 执行器（AI 路径）的白名单里没有它，所以 AI 仍然改不到
  const allowed = ['name', 'role', 'context', 'traits', 'preferences', 'notes', 'relationship_score', 'tags', 'last_interaction']
  for (const key of allowed) {
    if (updates[key] == null) continue
    // 亲密度是用户主观评价字段：非显式授权路径一律剥离（其余字段照常更新）
    if (key === 'relationship_score' && opts.trustScore !== true) continue
    all[idx][key] = updates[key]
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

/** 获取全部互动（未删除，按时间倒序）——供周额度统计等只读场景使用 */
export function getAllInteractions() {
  return getRawInteractions()
    .filter(i => i.is_deleted !== 1)
    .sort((a, b) => (Number(b.date) || Number(b.created_at) || 0) - (Number(a.date) || Number(a.created_at) || 0))
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
 * 亲密度来源说明（4.38.0）：分数是现存记录值，来源未必可追溯（可能是历史默认值、模板预填、
 * 用户手动评价或更早版本 AI 写入），因此不得据此断言「用户评价过」。AI 也不能修改它。
 */
const SCORE_PROVENANCE_NOTE = '（亲密度是现存记录值，来源未必可追溯，不要据此断言用户评价过；你也不能修改它）'

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
      return `\n\n---\n关系图谱（用户提到的人物）${SCORE_PROVENANCE_NOTE}：\n${lines.join('\n')}`
    }
  }

  // 未提到人物 → 注入最近 3 个关系摘要（从 5 个减到 3 个，省 token）
  const sorted = relations
    .sort((a, b) => (b.last_interaction || 0) - (a.last_interaction || 0))
    .slice(0, 3)

  const lines = sorted.map(r => formatRelationLine(r))
  return `\n\n---\n关系图谱（用户的人际网络）${SCORE_PROVENANCE_NOTE}：\n${lines.join('\n')}`
}

/** 格式化单个关系卡片为一行 */
function formatRelationLine(r) {
  const parts = [`  - ${r.name}（${r.role}）`]
  if (r.context) parts.push(`场景: ${r.context}`)
  if (r.traits && r.traits.length > 0) parts.push(`特征: ${r.traits.join('、')}`)
  if (r.preferences && r.preferences.length > 0) parts.push(`偏好: ${r.preferences.join('、')}`)
  if (r.notes) parts.push(`备注: ${r.notes}`)
  parts.push(`亲密度: ${r.relationship_score}/10`)
  parts.push(`ID: ${r.id}`) // 供 log_interaction/update_relation 使用
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
