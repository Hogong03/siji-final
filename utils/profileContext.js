/**
 * profileContext - 个人信息 AI 上下文构建与智能更新
 *
 * 从 profile.js 抽取，负责：
 *   - buildProfileContext：将画像转为 AI 系统提示词上下文
 *   - smartUpdateProfile：AI 驱动的自动更新（创建/更新/删除字段）
 *   - 统计函数
 */

import { getProfile, saveProfile, getCard } from './profile.js'

const ARRAY_FIELDS = new Set(['hobbies', 'dietary'])

/** 构建画像上下文（注入 AI 系统提示词） */
export function buildProfileContext(context) {
  const profile = getProfile()
  if (!profile.enabled) return null

  const ctxType = context?.lastActionType || 'general'
  const lines = []

  for (const card of profile.cards) {
    if (card.id === 'lifestyle' && !['bill', 'plan', 'diary', 'general'].includes(ctxType)) {
      continue
    }

    const fieldLines = []
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

/** AI 智能更新 profile */
export function smartUpdateProfile(params) {
  const profile = getProfile()
  if (!profile.enabled) profile.enabled = true

  const results = []
  const overwritten = []

  // 1. 创建新卡片
  if (Array.isArray(params.createCard)) {
    for (const cc of params.createCard) {
      if (!cc.id || !cc.title) continue
      if (!profile.cards.find(c => c.id === cc.id)) {
        profile.cards.push({
          id: cc.id, title: cc.title, icon: cc.icon || 'sparkle',
          fields: {}, source: 'ai_extracted', createdAt: Date.now()
        })
        results.push(`创建分组「${cc.title}」`)
      }
    }
  }

  // 2. 更新字段
  if (Array.isArray(params.updates)) {
    for (const u of params.updates) {
      if (!u.card || !u.field) continue
      let card = profile.cards.find(c => c.id === u.card)
      if (!card) {
        card = {
          id: u.card, title: u.cardTitle || u.card, icon: 'sparkle',
          fields: {}, source: 'ai_extracted', createdAt: Date.now()
        }
        profile.cards.push(card)
        results.push(`创建分组「${card.title}」`)
      }

      const oldValue = card.fields[u.field]

      if (ARRAY_FIELDS.has(u.field) && Array.isArray(u.value)) {
        const existing = Array.isArray(oldValue) ? oldValue : []
        const newItems = u.value.filter(v => !existing.includes(v))
        if (newItems.length > 0) {
          card.fields[u.field] = [...existing, ...newItems]
          results.push(`${u.field}(+${newItems.length})`)
        }
      } else if (ARRAY_FIELDS.has(u.field) && typeof u.value === 'string') {
        const existing = Array.isArray(oldValue) ? oldValue : []
        if (!existing.includes(u.value)) {
          card.fields[u.field] = [...existing, u.value]
          results.push(`${u.field}(+${u.value})`)
        }
      } else {
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
        const arr = Array.isArray(card.fields[r.field]) ? card.fields[r.field] : []
        const idx = arr.indexOf(r.value)
        if (idx >= 0) {
          arr.splice(idx, 1)
          card.fields[r.field] = arr
          results.push(`移除${r.field}「${r.value}」`)
        }
      } else if (r.value) {
        const arr = Array.isArray(card.fields[r.field]) ? card.fields[r.field] : []
        const idx = arr.indexOf(r.value)
        if (idx >= 0) {
          arr.splice(idx, 1)
          card.fields[r.field] = arr
          results.push(`移除「${r.value}」`)
        }
      } else {
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
    success: true, message: msg,
    detail: { type: 'profile', updatedFields: results, overwritten, allFields: results }
  }
}

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

/** 获取基本信息卡片字段数 */
export function getBasicFilledCount() {
  const card = getCard('basic')
  if (!card) return 0
  let count = 0
  for (const [, val] of Object.entries(card.fields)) {
    if (val) count++
  }
  return count
}
