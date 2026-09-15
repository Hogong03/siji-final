/**
 * memory/profile-values.js — 画像字段值提取（3.5.14 从 utils/memory.js 拆出）
 *
 * context.js 与 monthly.js 共用：命中画像字段值的记忆视为冗余，不再重复注入。
 */

import { getProfile } from '../profile.js'

/**
 * 画像字段值噪声词：过滤通用动词/虚词，避免子串匹配误伤
 */
const PROFILE_VALUE_NOISE = new Set(['喜欢', '爱好', '讨厌', '不爱', '比较', '经常', '有时', '最近', '觉得', '认为', '有点', '非常', '特别'])

/** 结构化提取画像字段值，用于过滤冗余记忆（替代旧的正则关键词提取） */
export function getProfileValues() {
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
