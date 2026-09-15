/**
 * memory/context.js — 注入系统提示词的记忆摘要（3.5.14 从 utils/memory.js 拆出）
 *
 * 相关度优先选池（3.5.11）→ 过滤已在画像中的偏好 → 按分类分组，另附月度卡与结构化记忆。
 */

import { selectMemories } from '../memory-rank.js'
import { buildStructuredMemoryContext } from '../memory-structured.js'
import { getAllMemories } from './store.js'
import { getProfileValues } from './profile-values.js'
import { buildMonthlyMemoryContext } from './monthly.js'

const MEMORY_CONTEXT_POOL = 30              // 单次注入上下文的最大记忆条数（按相关度选取）

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
