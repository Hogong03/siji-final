/**
 * 长期记忆管理
 *
 * 设计：
 *   memories: [{ id, content, category, createdAt, updatedAt }]
 *   category: fact(事实) | preference(偏好) | event(事件) | summary(摘要) | other
 *
 * 存储：siji_long_term_memory
 *
 * 使用方式：
 *   - AI 回复后自动调用 extractMemory 提取关键信息
 *   - buildSystemPrompt 时注入记忆摘要
 *   - 设置页可查看/编辑/删除
 */

import { chatRequest } from '@/utils/api.js'
import { logger } from './logger.js'
import { asyncSetStorage, asyncSetStorageJSON } from '@/utils/store-helpers.js'
import { getProfile, setCardField, addArrayItem, createCard } from './profile.js'
import { extractStructuredMemory, buildStructuredMemoryContext, clearStructuredMemory, getStructuredMemoryStats } from './memory-structured.js'
import { selectMemories } from './memory-rank.js'

const STORAGE_KEY = 'siji_long_term_memory'
const MAX_MEMORIES = 100 // 最多保存 100 条
const MONTHLY_KEY = 'siji_monthly_memory'   // 月度记忆卡
const MAX_MONTHLY_CARDS = 12                // 最多保留 12 个月
const MAX_MONTHLY_LINES = 20                // 每月最多 20 条
const MEMORY_CONTEXT_POOL = 30              // 单次注入上下文的最大记忆条数（按相关度选取）

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

// ==================== 记忆治理（3.2 M2）====================

/** 已整合记忆默认隐藏阈值：整合且超过 90 天（D2 仅隐藏、永不自动删除） */
const ADOPTED_HIDE_TTL = 90 * 24 * 60 * 60 * 1000
/** 一方包含另一方时视作重复的长者长度上限（超过 60 字不强行合并） */
const MAX_CONTAIN_DUP_LEN = 60

/** 归一化记忆文本：去空白/标点、全半角统一、小写、去「我今天/我想/我打算」等前缀 */
export function normalizeMemoryText(content) {
  if (content == null) return ''
  let s = String(content).trim()
  if (!s) return ''
  // 全半角统一（含全角字母数字与标点）
  s = s.replace(/[\uFF01-\uFF5E]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
  s = s.toLowerCase()
  // 去空白与 ASCII 标点
  s = s.replace(/[\s!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]+/g, '')
  // 去中文标点（。、，「」『』…— 等）
  s = s.replace(/[\u3000-\u303F\u2018\u2019\u201C\u201D\u2026\u2014\u2013\u00B7]/g, '')
  // 去「我今天想/我今天/我想/我打算/打算/准备/我要/我会」前缀
  s = s.replace(/^(?:我今天想|我今天|今天我想|我想|我打算|打算|我准备|准备|我要|我会|我)/, '')
  return s.trim()
}

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

/**
 * 画像字段值噪声词：过滤通用动词/虚词，避免子串匹配误伤
 */
const PROFILE_VALUE_NOISE = new Set(['喜欢', '爱好', '讨厌', '不爱', '比较', '经常', '有时', '最近', '觉得', '认为', '有点', '非常', '特别'])

/** 结构化提取画像字段值，用于过滤冗余记忆（替代旧的正则关键词提取） */
function getProfileValues() {
  try {
    const profile = getProfile()
    if (!profile || !Array.isArray(profile.cards)) return []
    const values = []
    for (const card of profile.cards) {
      for (const val of Object.values(card.fields || {})) {
        if (val == null || val === '') continue
        const items = Array.isArray(val) ? val : [String(val)]
        for (const item of items) {
          const s = String(item).trim()
          if (s.length >= 2 && !PROFILE_VALUE_NOISE.has(s)) values.push(s)
        }
      }
    }
    return values
  } catch {
    return []
  }
}

/**
 * 构建记忆摘要文本（注入系统提示词）
 * 按分类分组，最多取最近 30 条
 * 改动5：过滤已在画像中存在的记忆，减少 token 冗余
 */
export function buildMemoryContext(query) {
  const enabled = uni.getStorageSync('siji_memory_enabled')
  if (enabled === 'false') return '' // 用户关闭了长期记忆

  const all = getAllMemories()

  // 3.5.11：相关度优先 — 按当前消息检索 top-N，无命中回落最近 N 条。
  // 修复「记忆越多，早期关键事实越容易被最近条目挤出上下文」
  let recent = selectMemories(query, all, { limit: MEMORY_CONTEXT_POOL })

  // 结构化过滤：已在画像中的偏好不再重复注入（字段值匹配 + 已采纳标记）
  const profileValues = getProfileValues()
  recent = recent.filter(m => {
    // 只过滤 fact 和 preference 类（事件和摘要不过滤）
    if (m.category !== 'fact' && m.category !== 'preference') return true
    // 已采纳到画像的记忆不再注入
    if (m.adoptedToProfile) return false
    // 记忆内容包含任一画像字段值时视为冗余
    return !profileValues.some(v => m.content.includes(v))
  })

  if (recent.length === 0) return ''

  const grouped = {}
  recent.forEach(m => {
    const cat = m.category || 'other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(m.content)
  })

  const labels = {
    fact: '已知事实',
    preference: '用户偏好',
    event: '重要事件',
    summary: '对话摘要',
    other: '其他记忆'
  }

  const parts = []
  for (const cat of ['fact', 'preference', 'event', 'summary', 'other']) {
    if (grouped[cat] && grouped[cat].length > 0) {
      const items = grouped[cat].map(c => `  - ${c}`).join('\n')
      parts.push(`【${labels[cat]}】\n${items}`)
    }
  }

  // 历史月度记忆卡（记忆进化产物）始终注入
  const monthly = buildMonthlyMemoryContext()
  if (monthly) parts.push(monthly)

  // E1 结构化记忆：实体/关系/事件（token 精简，始终注入）
  const structured = buildStructuredMemoryContext()
  if (structured) parts.push(structured)

  return parts.length > 0 ? `\n\n---\n长期记忆：\n${parts.join('\n\n')}` : ''
}

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

// ==================== 月度记忆卡（记忆进化）====================

/** 获取月度记忆卡（按月份倒序） */
export function getMonthlyMemoryCards() {
  try {
    const raw = uni.getStorageSync(MONTHLY_KEY)
    if (!raw) return []
    const list = JSON.parse(raw)
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

/** 当前月份 YYYY-MM */
function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** 把记忆条目追加进当月卡片（去重合并，上限 MAX_MONTHLY_LINES） */
export function appendToMonthlyCard(month, lines) {
  const items = Array.isArray(lines) ? lines : [lines]
  const valid = items.map(i => String(i).trim()).filter(i => i.length >= 2)
  if (valid.length === 0) return
  const cards = getMonthlyMemoryCards()
  const m = month || currentMonth()
  let card = cards.find(c => c.month === m)
  if (!card) {
    card = { month: m, items: [], createdAt: Date.now() }
    cards.push(card)
  }
  for (const item of valid) {
    if (!card.items.includes(item)) card.items.push(item)
  }
  if (card.items.length > MAX_MONTHLY_LINES) {
    card.items = card.items.slice(-MAX_MONTHLY_LINES)
  }
  card.updatedAt = Date.now()
  cards.sort((a, b) => (a.month < b.month ? 1 : -1))
  if (cards.length > MAX_MONTHLY_CARDS) cards.length = MAX_MONTHLY_CARDS
  asyncSetStorageJSON(MONTHLY_KEY, cards)
}

/** 构建历史月度记忆上下文（最近 3 个月，每月最多 8 条） */
export function buildMonthlyMemoryContext() {
  const cards = getMonthlyMemoryCards().slice(0, 3)
  if (cards.length === 0) return ''
  // 3.2 M2：过滤与画像字段值重复的短行（≤ 20 字命中即滤），减少 token 冗余
  const profileValues = getProfileValues()
  const redundant = (line) => profileValues.length > 0 && line.length <= 20 && profileValues.some(v => line.includes(v))
  const parts = cards.map(c => {
    const items = (c.items || []).filter(line => !redundant(line)).slice(-8).join('；')
    return `  - ${c.month}：${items}`
  })
  return `【历史月度记忆】\n${parts.join('\n')}`
}

/**
 * 从 AI 对话中自动提取记忆
 * 轻量级本地提取（不调用 AI API），基于规则匹配
 *
 * @param {string} userMessage - 用户消息
 * @param {string} aiReply - AI 回复
 * @param {object} execResult - 执行结果（可选）
 */
export function autoExtractMemory(userMessage, aiReply, execResult) {
  const enabled = uni.getStorageSync('siji_memory_enabled')
  if (enabled === 'false') return

  const memories = []

  // 预加载已有记忆，用于后续去重判断
  const existing = getAllMemories()
  const existingContents = new Set(existing.map(m => m.content))

  // === 改动1：偏好/事实提取已移交 profile smart_update，此处只保留事件/摘要 ===
  // 原 10 条正则（prefPatterns）删除：
  //   - "我喜欢X"/"我讨厌X"/"我通常X" → profile.dietary/hobbies/occupation
  //   - "我叫X"/"我在X工作"/"我住在X" → profile.nickname/occupation/location
  //   - "不吃X"/"预算X" → profile.dietary/budget
  // 这些信息由 AI 通过 smart_update_profile action 结构化更新，不再用正则提取

  // === 执行结果记忆已删除 ===
  // 原：从 execResult 中提取记账/计划事件存入记忆
  // 原因：chatHistoryBuilder 已在历史中追加 [执行结果: 已记账 ¥50 餐饮]，
  // memory 再存一份是冗余。且 AI 能从历史中看到执行结果。

  // === 规则 3：重要关键词触发（改动6：增加情绪宣泄排除） ===
  const EMOTION_NOISE = /太|好烦|气死|受不了|崩溃|烦透|郁卒|恶心|想哭|绝望/
  const importantKeywords = ['生日', '纪念日', '结婚', '搬家', '换工作', '入职', '离职', '考试', '面试', '旅行', '出差']
  importantKeywords.forEach(kw => {
    if (userMessage.includes(kw)) {
      const sentences = userMessage.split(/[。！？\n]/)
      sentences.forEach(s => {
        if (s.includes(kw) && s.length >= 3 && s.length <= 50) {
          // 改动6：排除情绪宣泄句式 — "好烦要去面试"不提取
          if (EMOTION_NOISE.test(s)) return
          memories.push({ content: s.trim(), category: 'event' })
        }
      })
    }
  })

  // === 改动1：规则4 人物/性格提取删除 ===
  // 原规则4从 AI 回复中提取「人际关系：张三（同事）」「性格特点是INFP」
  // 这些信息应由 AI 通过 create_relation / smart_update_profile action 结构化更新
  // 正则提取准确率低且与关系图谱/画像功能重叠，已删除

  // 去重并保存
  memories.forEach(m => {
    if (!existingContents.has(m.content)) {
      addMemory(m.content, m.category)
    }
  })

  // E1 结构化记忆：实体/关系/事件三元组提取（本地规则）
  try {
    extractStructuredMemory(userMessage, aiReply)
  } catch (e) {
    logger.warn('[思迹] 结构化记忆提取失败:', e)
  }
}

/**
 * 手动通过 AI 提取记忆摘要（当对话达到一定长度时调用）
 * 这是一个可选的增强功能，用 AI 自身能力总结对话
 *
 * @param {Array} messages - 对话消息列表
 * @param {object} cfg - AI 配置
 * @returns {Promise<string|null>} 提取的记忆摘要
 */
export async function aiSummarizeConversation(messages, cfg) {
  if (!messages || messages.length < 10) return null

  try {
    // 取最近 20 条对话
    const recent = messages.slice(-20)
    const dialogue = recent
      .map(m => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content || m.aiReply || ''}`)
      .join('\n')

    const prompt = `请从以下对话中提取值得长期记忆的关键信息（用户偏好、重要事实、重要事件），每条一行，不要编号。如果没有值得记忆的内容，回复"无"。\n\n${dialogue}`

    const result = await chatRequest(prompt, null, null, {
      ...cfg,
      temperature: 0.3
    }, [])

    if (result && result.reply && result.reply.trim() && result.reply.trim() !== '无') {
      const lines = result.reply.trim().split('\n').map(l => l.replace(/^[-•*\d.\s]+/, '').trim()).filter(l => l.length >= 3 && l.length <= 60)
      lines.forEach(line => addMemory(line, 'summary'))
      appendToMonthlyCard(currentMonth(), lines)
      return lines.join('\n')
    }
  } catch (e) {
    logger.warn('[思迹] AI 记忆提取失败:', e)
  }
  return null
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

/** 持久化 + 过期清理 */
function persist(memories) {
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
