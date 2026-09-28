/**
 * memory/governance.js — 记忆治理（3.2 M2，3.5.14 从 utils/memory.js 拆出）
 *
 * 只做用户确认后的合并 / 隐藏 / 删除 / 归类修正，无任何静默删除。
 */

import { asyncSetStorageJSON } from '@/utils/store-helpers.js'
import { getAllMemories, persist, STORAGE_KEY } from './store.js'
import { normalizeMemoryText } from './normalize.js'

// ==================== 记忆治理（3.2 M2）====================

/** 已整合记忆默认隐藏阈值：整合且超过 90 天（D2 仅隐藏、永不自动删除） */
const ADOPTED_HIDE_TTL = 90 * 24 * 60 * 60 * 1000
/** 一方包含另一方时视作重复的长者长度上限（超过 60 字不强行合并） */
const MAX_CONTAIN_DUP_LEN = 60

/** 两条记忆是否构成重复（归一化相等，或一方包含另一方且长者 ≤ 60 字） */
function isDuplicateText(a, b) {
  const na = normalizeMemoryText(a)
  const nb = normalizeMemoryText(b)
  if (!na || !nb) return false
  if (na === nb) return true
  if (na.includes(nb) || nb.includes(na)) {
    return Math.max(na.length, nb.length) <= MAX_CONTAIN_DUP_LEN
  }
  return false
}

/** 找出重复记忆组：返回 [{ keepId, removeIds, members }]，members 按 updatedAt 倒序，首条为保留建议 */
export function findDuplicateGroups() {
  const all = getAllMemories()
  const groups = []
  const used = new Set()
  for (const mem of all) {
    if (used.has(mem.id)) continue
    let group = null
    for (const g of groups) {
      const leader = g.members[0]
      if (isDuplicateText(leader.content, mem.content)) {
        group = g
        break
      }
    }
    if (!group) {
      group = { members: [] }
      groups.push(group)
    }
    group.members.push(mem)
    used.add(mem.id)
  }
  return groups
    .filter(g => g.members.length >= 2)
    .map(g => {
      g.members.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      const keepId = g.members[0].id
      return { keepId, removeIds: g.members.slice(1).map(m => m.id), members: g.members }
    })
}

/** 已整合超期记忆（隐藏候选，D2：仅用于默认视图隐藏，永不自动删除） */
export function findStaleAdoptedMemories(now = Date.now()) {
  return getAllMemories().filter(m =>
    m.adoptedToProfile &&
    (m.category === 'fact' || m.category === 'preference') &&
    now - (m.createdAt || 0) > ADOPTED_HIDE_TTL &&
    !m.hidden
  )
}

/** other 类记忆按句式建议归类（fact/preference/event/summary），无把握返回 null */
export function suggestMemoryCategory(content) {
  if (!content) return null
  const s = String(content).trim()
  if (/(?:我叫|我是|我(?:在|于).{0,12}(?:工作|上班|读书|居住)|住在|老家|职业|生日|生于|星座|血型|MBTI)/.test(s)) return 'fact'
  if (/(?:喜欢|我爱|爱好|讨厌|不爱|不喜欢|忌口|不吃|想要|希望|更愿意|习惯|偏好)/.test(s)) return 'preference'
  if (/(?:昨天|今天|明天|上周|这周|下周|上个月|这个月|参加|面试|考试|出差|旅行|搬家|买了|吃了|去了|聊了|发生了)/.test(s)) return 'event'
  if (s.length >= 10) return 'summary'
  return null
}

/**
 * 执行记忆治理（用户确认后调用；无任何静默删除）
 * @param {Object} opts
 *   merge: [{ keepId, removeId }] 合并重复（保留 updatedAt 较新一条的内容与 id）
 *   hide: [id] 已整合超期记忆 → 仅标记 hidden: true（D2）
 *   delete: [id] 用户明确删除
 *   recategorize: [{ id, category }] 修正分类
 * @returns {{ merged:number, hidden:number, deleted:number, recategorized:number }}
 */
export function applyGovernance({ merge = [], hide = [], delete: delIds = [], recategorize = [] } = {}) {
  const memories = getAllMemories()
  if (!Array.isArray(merge) || !Array.isArray(hide) || !Array.isArray(delIds) || !Array.isArray(recategorize)) {
    return { merged: 0, hidden: 0, deleted: 0, recategorized: 0 }
  }
  let merged = 0
  const appliedRemove = new Set()
  for (const pair of merge) {
    if (!pair || !pair.keepId || !pair.removeId || pair.keepId === pair.removeId) continue
    const keep = memories.find(m => m.id === pair.keepId)
    const remove = memories.find(m => m.id === pair.removeId)
    if (!keep || !remove) continue
    if ((remove.updatedAt || 0) > (keep.updatedAt || 0)) {
      keep.content = remove.content
      keep.category = remove.category
      keep.updatedAt = remove.updatedAt
      keep.createdAt = keep.createdAt || remove.createdAt
      if (remove.adoptedToProfile && !keep.adoptedToProfile) keep.adoptedToProfile = remove.adoptedToProfile
    }
    appliedRemove.add(pair.removeId)
    merged++
  }
  let hidden = 0
  const hideSet = new Set(hide)
  for (const m of memories) {
    if (hideSet.has(m.id) && !m.hidden) {
      m.hidden = true
      hidden++
    }
  }
  let deleted = 0
  const delSet = new Set()
  for (const id of delIds) {
    if (memories.some(m => m.id === id) && !appliedRemove.has(id)) {
      delSet.add(id)
      deleted++
    }
  }
  const removeIds = new Set([...appliedRemove, ...delSet])
  const cleaned = memories.filter(m => !removeIds.has(m.id))
  let recategorized = 0
  const VALID_CATEGORIES = new Set(['fact', 'preference', 'event', 'summary', 'other'])
  for (const it of recategorize) {
    if (!it || !it.id) continue
    const item = cleaned.find(m => m.id === it.id)
    if (item && VALID_CATEGORIES.has(it.category) && item.category !== it.category) {
      item.category = it.category
      item.updatedAt = Date.now()
      recategorized++
    }
  }
  persist(cleaned)
  return { merged, hidden, deleted, recategorized }
}

/** 恢复隐藏标记（用户在「已整合」分段手动取消隐藏） */
export function restoreHiddenMemory(id) {
  const memories = getAllMemories()
  const item = memories.find(m => m.id === id)
  if (item && item.hidden) {
    item.hidden = false
    asyncSetStorageJSON(STORAGE_KEY, memories)
    return true
  }
  return false
}
