/**
 * memory/monthly.js — 月度记忆卡（记忆进化，3.5.14 从 utils/memory.js 拆出）
 *
 * 存储：siji_monthly_memory，按月去重合并，最多 12 个月、每月 20 条。
 */

import { asyncSetStorageJSON } from '@/utils/store-helpers.js'
import { getProfileValues } from './profile-values.js'

const MONTHLY_KEY = 'siji_monthly_memory'   // 月度记忆卡
const MAX_MONTHLY_CARDS = 12                // 最多保留 12 个月
const MAX_MONTHLY_LINES = 20                // 每月最多 20 条

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
export function currentMonth() {
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
