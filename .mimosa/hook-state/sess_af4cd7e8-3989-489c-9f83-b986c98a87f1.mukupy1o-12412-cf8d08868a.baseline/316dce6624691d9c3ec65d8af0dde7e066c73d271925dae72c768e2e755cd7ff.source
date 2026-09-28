/**
 * memory/profile-link.js — 记忆 → 画像采纳（3.5.14 从 utils/memory.js 拆出）
 *
 * 单条采纳、批量整合、AI 写画像后的回标记，三条路径都只标记 adoptedToProfile，不改记忆内容。
 */

import { asyncSetStorageJSON } from '@/utils/store-helpers.js'
import { getProfile, setCardField, addArrayItem, createCard } from '../profile.js'
import { getAllMemories, STORAGE_KEY } from './store.js'

// ==================== 记忆与画像联动 ====================

/** 已知事实句式 → 画像字段建议（按优先级匹配） */
const FACT_RULES = [
  { re: /生日(?:是|为|在)?\s*([\d\u4e00-\u9fa5年\-/.月日]{4,16})/, cardId: 'basic', cardTitle: '基本信息', field: 'birthday', label: '生日' },
  { re: /性别(?:是|为)?\s*(男|女)/, cardId: 'basic', cardTitle: '基本信息', field: 'gender', label: '性别' },
  { re: /(?:在|于)([\u4e00-\u9fa5A-Za-z0-9]{2,12})(?:工作|上班|任职)/, cardId: 'basic', cardTitle: '基本信息', field: 'occupation', label: '职业' },
  { re: /职业(?:是|为)?\s*([\u4e00-\u9fa5A-Za-z0-9]{2,10})/, cardId: 'basic', cardTitle: '基本信息', field: 'occupation', label: '职业' },
  { re: /(?:住在|居住在|家在|所在地(?:是|为)?)\s*([\u4e00-\u9fa5A-Za-z0-9]{2,12})/, cardId: 'basic', cardTitle: '基本信息', field: 'location', label: '所在地' },
  { re: /(?:我叫|我的名字(?:是|叫))\s*([\u4e00-\u9fa5A-Za-z0-9]{1,10})/, cardId: 'basic', cardTitle: '基本信息', field: 'nickname', label: '昵称' },
  { re: /(?:月预算|预算)(?:是|为|约)?\s*(¥?\d[\d,.]*(?:万|千)?)/, cardId: 'lifestyle', cardTitle: '生活方式', field: 'budget', label: '月预算' },
  { re: /(?:作息|睡觉时间|睡眠时间)(?:是|为)?\s*([\u4e00-\u9fa5A-Za-z0-9:点半]{2,12})/, cardId: 'lifestyle', cardTitle: '生活方式', field: 'sleepTime', label: '作息' },
  { re: /每天\s*([\d:点半]{2,8})(?:睡|休息)/, cardId: 'lifestyle', cardTitle: '生活方式', field: 'sleepTime', label: '作息' }
]

/** 偏好句式 → 画像字段建议 */
const PREF_RULES = [
  { re: /(?:我不喜欢|我不爱|讨厌|不吃|忌口)([^，。！？、；\n]{2,8})/, cardId: 'lifestyle', cardTitle: '生活方式', field: 'dietary', label: '饮食偏好' },
  { re: /(?:我喜欢|我爱|爱好(?:是)?|喜欢|爱)([^，。！？、；\n]{2,8})/, cardId: 'lifestyle', cardTitle: '生活方式', field: 'hobbies', label: '兴趣爱好' }
]

/** 记忆 → 画像字段建议（已知事实 + 偏好，返回 null 时需用户手动指定） */
export function suggestProfileAdoption(content) {
  if (!content) return null
  const rules = [...FACT_RULES, ...PREF_RULES]
  for (const rule of rules) {
    const m = content.match(rule.re)
    if (m && m[1]) {
      const value = m[1].replace(/^(就是|比较|非常|特别|大概|约)/, '').trim()
      if (value.length >= 2) {
        return { cardId: rule.cardId, cardTitle: rule.cardTitle, field: rule.field, label: rule.label, value }
      }
    }
  }
  return null
}

/** 采纳一条记忆为画像字段：写入画像并标记记忆；分组不存在时按 cardTitle 自动创建 */
export function adoptMemoryToProfile(memoryId, cardId, field, value, cardTitle) {
  const memories = getAllMemories()
  const mem = memories.find(m => m.id === memoryId)
  if (!mem) return { success: false, message: '记忆不存在' }
  if ((!cardId && !cardTitle) || !field || !value) return { success: false, message: '字段信息不完整' }

  const text = String(value).trim()
  // 定位目标卡片：优先 cardId，其次按 cardTitle 匹配，均无则新建分组
  let target = cardId ? getProfile().cards.find(c => c.id === cardId) : null
  if (!target && cardTitle) target = getProfile().cards.find(c => c.title === cardTitle)
  if (!target) {
    const title = String(cardTitle || cardId || '').trim() || '其他信息'
    target = createCard(title, 'sparkle', {})
  }

  if (field === 'hobbies' || field === 'dietary') {
    addArrayItem(target.id, field, text)
  } else {
    setCardField(target.id, field, text)
  }

  mem.adoptedToProfile = { cardId: target.id, cardTitle: target.title, field, value: text, at: Date.now() }
  asyncSetStorageJSON(STORAGE_KEY, memories)
  return { success: true, message: '已采纳到画像' }
}

/** 获取可采纳的偏好记忆（preference 类、未采纳，最多 5 条） */
export function getAdoptableMemories() {
  return getAllMemories()
    .filter(m => m.category === 'preference' && !m.adoptedToProfile)
    .slice(0, 5)
}

/** 获取未采纳记忆（可按分类过滤，用于批量整合） */
export function getUnadoptedMemories(category) {
  const all = getAllMemories().filter(m => !m.adoptedToProfile)
  if (category && category !== 'all') return all.filter(m => m.category === category)
  return all
}

/** 批量整合记忆到画像：items = [{ id, cardId, cardTitle, field, value }]，逐条写入并标记 */
export function integrateMemoriesToProfile(items) {
  if (!Array.isArray(items)) return { success: 0, skipped: 0 }
  let success = 0
  let skipped = 0
  for (const it of items) {
    if (!it || !it.id) continue
    const field = String(it.field || '').trim()
    const value = String(it.value == null ? '' : it.value).trim()
    if (!field || !value) {
      skipped++
      continue
    }
    const cardId = String(it.cardId || '').trim()
    const cardTitle = String(it.cardTitle || '').trim()
    const r = adoptMemoryToProfile(it.id, cardId, field, value, cardTitle)
    if (r.success) success++
    else skipped++
  }
  return { success, skipped }
}

/** AI 通过 smart_update_profile 写入画像后，同步标记同内容记忆为已采纳 */
export function markMemoriesAdoptedByProfile(updates) {
  if (!Array.isArray(updates)) return 0
  const memories = getAllMemories()
  let marked = 0
  for (const u of updates) {
    if (!u || !u.field) continue
    const vals = Array.isArray(u.value) ? u.value : [u.value]
    for (const v of vals) {
      if (v == null || String(v).trim().length < 2) continue
      const sv = String(v).trim()
      for (const m of memories) {
        if (m.adoptedToProfile) continue
        if (m.category !== 'fact' && m.category !== 'preference') continue
        if (m.content.includes(sv)) {
          m.adoptedToProfile = { cardId: u.card || '', field: u.field, value: sv, at: Date.now() }
          marked++
        }
      }
    }
  }
  if (marked > 0) asyncSetStorageJSON(STORAGE_KEY, memories)
  return marked
}
