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
function normalizeArrayValue(value) {
  return String(value == null ? '' : value)
    .trim()
    .toLowerCase()
    .replace(/[\uFF01-\uFF5E]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    .replace(/\s+/g, '')
}

export function addArrayItem(cardId, field, value) {
  const profile = getProfile()
  const card = profile.cards.find(c => c.id === cardId)
  if (card && Array.isArray(card.fields[field])) {
    // 3.2 M2：归一化去重（大小写/全半角/空白差异不重复追加）
    const norm = normalizeArrayValue(value)
    const duplicated = card.fields[field].some(v => norm && normalizeArrayValue(v) === norm)
    if (norm && !duplicated) {
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

// 以下函数已迁移至 profileContext.js，通过 re-export 保持向后兼容
export { buildProfileContext, smartUpdateProfile, getFilledCount, getBasicFilledCount } from './profileContext.js'


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
