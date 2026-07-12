/**
 * 我的个人信息管理 v2 — 动态画像卡（Dynamic Profile Cards）
 *
 * 数据结构：
 *   profile: {
 *     enabled: false,
 *     version: 2,
 *     cards: [
 *       {
 *         id: 'basic',
 *         title: '基本信息',
 *         icon: 'user',
 *         fields: { nickname, gender, birthday, occupation, location, bio },
 *         source: 'manual'
 *       },
 *       {
 *         id: 'lifestyle',
 *         title: '生活方式',
 *         icon: 'home',
 *         fields: { budget, sleepTime, hobbies: [], dietary: [] },
 *         source: 'manual'
 *       },
 *       {
 *         id: 'custom_xxx',
 *         title: '性格特征',
 *         icon: 'sparkle',
 *         fields: { MBTI: 'INFP', 星座: '双子座' },
 *         source: 'ai_extracted',
 *         createdAt: 1719900000000
 *       }
 *     ],
 *     updatedAt: 0
 *   }
 *
 * 存储：siji_my_profile
 */

import { asyncSetStorageJSON } from '@/utils/store-helpers.js'

const STORAGE_KEY = 'siji_my_profile'

/** 固定卡片定义 */
const FIXED_CARDS = {
  basic: {
    id: 'basic',
    title: '基本信息',
    icon: 'user',
    fields: {
      nickname: '',
      gender: '',
      birthday: '',
      occupation: '',
      location: '',
      bio: ''
    }
  },
  lifestyle: {
    id: 'lifestyle',
    title: '生活方式',
    icon: 'home',
    fields: {
      budget: '',
      sleepTime: '',
      hobbies: [],
      dietary: []
    }
  }
}

/** 数组类型字段集合（hobbies/dietary 使用 chip 交互） */
const ARRAY_FIELDS = new Set(['hobbies', 'dietary'])

/** 创建空 profile v2 */
function createEmptyProfile() {
  return {
    enabled: false,
    version: 2,
    cards: [
      JSON.parse(JSON.stringify(FIXED_CARDS.basic)),
      JSON.parse(JSON.stringify(FIXED_CARDS.lifestyle))
    ],
    updatedAt: 0
  }
}

/**
 * v1 → v2 数据迁移
 */
function migrateProfile(oldData) {
  if (oldData.version === 2) return oldData

  // 兼容 v1 的扁平结构
  const old = typeof oldData === 'string' ? JSON.parse(oldData) : oldData

  const cards = [
    {
      id: 'basic',
      title: '基本信息',
      icon: 'user',
      fields: {
        nickname: old.nickname || '',
        gender: old.gender || '',
        birthday: old.birthday || '',
        occupation: old.occupation || '',
        location: old.location || '',
        bio: old.bio || ''
      },
      source: 'manual'
    },
    {
      id: 'lifestyle',
      title: '生活方式',
      icon: 'home',
      fields: {
        budget: old.budget || '',
        sleepTime: old.sleepTime || '',
        hobbies: old.hobbies || [],
        dietary: old.dietary || []
      },
      source: 'manual'
    }
  ]

  // 旧 custom 数组 → 一张卡片
  if (Array.isArray(old.custom) && old.custom.length > 0) {
    const validCustom = old.custom.filter(c => c.label && c.value)
    if (validCustom.length > 0) {
      const fields = {}
      for (const c of validCustom) {
        fields[c.label] = c.value
      }
      cards.push({
        id: 'custom_migrated',
        title: '更多信息',
        icon: 'sparkle',
        fields,
        source: 'migrated',
        createdAt: Date.now()
      })
    }
  }

  return {
    enabled: old.enabled || false,
    version: 2,
    cards,
    updatedAt: Date.now()
  }
}

/** 获取 profile（自动迁移 v1 数据） */
export function getProfile() {
  try {
    const raw = uni.getStorageSync(STORAGE_KEY)
    if (!raw) return createEmptyProfile()
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw

    // 自动迁移
    if (!data.version || data.version < 2) {
      const migrated = migrateProfile(data)
      asyncSetStorageJSON(STORAGE_KEY, migrated)
      return migrated
    }

    // 确保固定卡片存在
    const cardIds = data.cards?.map(c => c.id) || []
    if (!cardIds.includes('basic')) {
      data.cards?.unshift(JSON.parse(JSON.stringify(FIXED_CARDS.basic)))
    }
    if (!cardIds.includes('lifestyle')) {
      const idx = data.cards?.findIndex(c => c.id === 'basic') ?? -1
      data.cards?.splice((idx + 1) || 1, 0, JSON.parse(JSON.stringify(FIXED_CARDS.lifestyle)))
    }

    return data
  } catch {
    return createEmptyProfile()
  }
}

/** 保存 profile */
export function saveProfile(profile) {
  const data = { ...profile, updatedAt: Date.now() }
  asyncSetStorageJSON(STORAGE_KEY, data)
  return data
}

/** 更新部分字段（顶层） */
export function updateProfile(partial) {
  const current = getProfile()
  const updated = { ...current, ...partial, updatedAt: Date.now() }
  asyncSetStorageJSON(STORAGE_KEY, updated)
  return updated
}

/** 开关：是否注入到 AI 上下文 */
export function isProfileEnabled() {
  return getProfile().enabled === true
}

/** 设置开关 */
export function setProfileEnabled(enabled) {
  return updateProfile({ enabled: !!enabled })
}

// ============ 卡片操作 ============

/** 获取指定卡片 */
export function getCard(cardId) {
  const profile = getProfile()
  return profile.cards.find(c => c.id === cardId) || null
}

/** 创建新卡片 */
export function createCard(title, icon = 'sparkle', fields = {}) {
  const profile = getProfile()
  const id = `custom_${Date.now()}`
  const card = {
    id,
    title: title || '自定义分组',
    icon,
    fields,
    source: 'manual',
    createdAt: Date.now()
  }
  profile.cards.push(card)
  saveProfile(profile)
  return card
}

/** 更新卡片标题 */
export function updateCardTitle(cardId, title) {
  const profile = getProfile()
  const card = profile.cards.find(c => c.id === cardId)
  if (card) {
    card.title = title
    saveProfile(profile)
  }
  return card
}

/** 删除卡片（固定卡片不可删） */
export function deleteCard(cardId) {
  if (cardId === 'basic' || cardId === 'lifestyle') return false
  const profile = getProfile()
  const idx = profile.cards.findIndex(c => c.id === cardId)
  if (idx >= 0) {
    profile.cards.splice(idx, 1)
    saveProfile(profile)
    return true
  }
  return false
}

/** 设置卡片字段值 */
export function setCardField(cardId, field, value) {
  const profile = getProfile()
  const card = profile.cards.find(c => c.id === cardId)
  if (card) {
    card.fields[field] = value
    saveProfile(profile)
  }
  return card
}

/** 删除卡片字段 */
export function removeCardField(cardId, field) {
  const profile = getProfile()
  const card = profile.cards.find(c => c.id === cardId)
  if (card && card.fields[field] !== undefined) {
    delete card.fields[field]
    saveProfile(profile)
    return true
  }
  return false
}

/** 数组字段添加项 */
export function addArrayItem(cardId, field, value) {
  const profile = getProfile()
  const card = profile.cards.find(c => c.id === cardId)
  if (card && Array.isArray(card.fields[field])) {
    if (!card.fields[field].includes(value)) {
      card.fields[field].push(value)
      saveProfile(profile)
    }
  }
  return card
}

/** 数组字段删除项 */
export function removeArrayItem(cardId, field, value) {
  const profile = getProfile()
  const card = profile.cards.find(c => c.id === cardId)
  if (card && Array.isArray(card.fields[field])) {
    const idx = card.fields[field].indexOf(value)
    if (idx >= 0) {
      card.fields[field].splice(idx, 1)
      saveProfile(profile)
    }
  }
  return card
}

/** 重新排序卡片 */
export function reorderCards(newOrder) {
  const profile = getProfile()
  const cardMap = new Map(profile.cards.map(c => [c.id, c]))
  const reordered = newOrder.map(id => cardMap.get(id)).filter(Boolean)
  // 确保没有遗漏
  for (const c of profile.cards) {
    if (!reordered.includes(c)) reordered.push(c)
  }
  profile.cards = reordered
  saveProfile(profile)
  return profile
}

// ============ 上下文注入 ============

/**
 * 构建 profile 上下文文本（注入到 system prompt）
 * 支持场景过滤：账单/计划/日记场景注入生活方式卡片
 * @param {object} context - { lastActionType: 'bill'|'plan'|'diary'|'general' }
 * @returns {string|null}
 */
export function buildProfileContext(context) {
  const profile = getProfile()
  if (!profile.enabled) return null

  const ctxType = context?.lastActionType || 'general'
  const lines = []

  for (const card of profile.cards) {
    const fieldLines = []

    if (card.id === 'lifestyle' && !['bill', 'plan', 'diary', 'general'].includes(ctxType)) {
      // 非相关场景跳过生活方式
      continue
    }

    for (const [key, val] of Object.entries(card.fields)) {
      if (val == null || val === '') continue
      if (Array.isArray(val)) {
        if (val.length === 0) continue
        fieldLines.push(`${key}：${val.join('、')}`)
      } else {
        fieldLines.push(`${key}：${val}`)
      }
    }

    if (fieldLines.length > 0) {
      lines.push(`[${card.title}] ${fieldLines.join('；')}`)
    }
  }

  if (lines.length === 0) return null
  return `【用户画像】\n${lines.join('\n')}`
}

// ============ AI 智能更新 ============

/**
 * 执行 AI 智能更新 profile
 * @param {object} params - { updates: [], remove: [], createCard: [] }
 */
export function smartUpdateProfile(params) {
  const profile = getProfile()
  // AI 驱动模式下，用户主动告知信息即视为同意开启，自动启用
  if (!profile.enabled) {
    profile.enabled = true
  }

  const results = []
  const overwritten = []

  // 1. 创建新卡片
  if (Array.isArray(params.createCard)) {
    for (const cc of params.createCard) {
      if (!cc.id || !cc.title) continue
      const exists = profile.cards.find(c => c.id === cc.id)
      if (!exists) {
        profile.cards.push({
          id: cc.id,
          title: cc.title,
          icon: cc.icon || 'sparkle',
          fields: {},
          source: 'ai_extracted',
          createdAt: Date.now()
        })
        results.push(`创建分组「${cc.title}」`)
      }
    }
  }

  // 2. 更新字段
  if (Array.isArray(params.updates)) {
    for (const u of params.updates) {
      if (!u.card || !u.field) continue
      const card = profile.cards.find(c => c.id === u.card)
      if (!card) {
        // 卡片不存在，自动创建
        card = {
          id: u.card,
          title: u.cardTitle || u.card,
          icon: 'sparkle',
          fields: {},
          source: 'ai_extracted',
          createdAt: Date.now()
        }
        profile.cards.push(card)
        results.push(`创建分组「${card.title}」`)
      }

      const oldValue = card.fields[u.field]

      // 数组字段：追加去重
      if (ARRAY_FIELDS.has(u.field) && Array.isArray(u.value)) {
        const existing = Array.isArray(oldValue) ? oldValue : []
        const newItems = u.value.filter(v => !existing.includes(v))
        if (newItems.length > 0) {
          card.fields[u.field] = [...existing, ...newItems]
          results.push(`${u.field}(+${newItems.length})`)
        }
      } else if (ARRAY_FIELDS.has(u.field) && typeof u.value === 'string') {
        // 单个值追加到数组
        const existing = Array.isArray(oldValue) ? oldValue : []
        if (!existing.includes(u.value)) {
          card.fields[u.field] = [...existing, u.value]
          results.push(`${u.field}(+${u.value})`)
        }
      } else {
        // 标量字段：覆盖
        if (oldValue != null && oldValue !== '' && oldValue !== u.value) {
          overwritten.push(`${u.field}: ${oldValue} → ${u.value}`)
        }
        card.fields[u.field] = u.value
        results.push(u.field)
      }
    }
  }

  // 3. 删除字段/数组项
  if (Array.isArray(params.remove)) {
    for (const r of params.remove) {
      if (!r.card || !r.field) continue
      const card = profile.cards.find(c => c.id === r.card)
      if (!card) continue

      if (ARRAY_FIELDS.has(r.field) && r.value) {
        // 从数组中移除某项
        const arr = Array.isArray(card.fields[r.field]) ? card.fields[r.field] : []
        const idx = arr.indexOf(r.value)
        if (idx >= 0) {
          arr.splice(idx, 1)
          card.fields[r.field] = arr
          results.push(`移除${r.field}「${r.value}」`)
        }
      } else if (r.value) {
        // 数组中移除某项（非标准数组字段）
        const arr = Array.isArray(card.fields[r.field]) ? card.fields[r.field] : []
        const idx = arr.indexOf(r.value)
        if (idx >= 0) {
          arr.splice(idx, 1)
          card.fields[r.field] = arr
          results.push(`移除「${r.value}」`)
        }
      } else {
        // 删除整个字段
        if (card.fields[r.field] !== undefined) {
          delete card.fields[r.field]
          results.push(`删除${r.field}`)
        }
      }
    }
  }

  if (results.length === 0) {
    return { success: true, message: '没有新信息需要更新', detail: { type: 'profile', skipped: true } }
  }

  saveProfile(profile)

  const msg = overwritten.length > 0
    ? `已更新个人信息：${results.join('、')}（其中 ${overwritten.length} 项已覆盖旧值）`
    : `已更新个人信息：${results.join('、')}`

  return {
    success: true,
    message: msg,
    detail: {
      type: 'profile',
      updatedFields: results,
      overwritten,
      allFields: results
    }
  }
}

// ============ 统计 ============

/** 计算已填写字段数 */
export function getFilledCount() {
  const profile = getProfile()
  let count = 0
  for (const card of profile.cards) {
    for (const [, val] of Object.entries(card.fields)) {
      if (val == null || val === '') continue
      if (Array.isArray(val) && val.length === 0) continue
      count++
    }
  }
  return count
}

/** 获取基本信息卡片字段数（用于设置页入口展示） */
export function getBasicFilledCount() {
  const card = getCard('basic')
  if (!card) return 0
  let count = 0
  for (const [, val] of Object.entries(card.fields)) {
    if (val) count++
  }
  return count
}

/** 清空所有 profile 信息 */
export function clearProfile() {
  const empty = createEmptyProfile()
  asyncSetStorageJSON(STORAGE_KEY, empty)
  return empty
}

/** 清空指定卡片字段 */
export function clearCardField(cardId, field) {
  const profile = getProfile()
  const card = profile.cards.find(c => c.id === cardId)
  if (card) {
    if (Array.isArray(card.fields[field])) {
      card.fields[field] = []
    } else {
      card.fields[field] = ''
    }
    saveProfile(profile)
  }
  return card
}
