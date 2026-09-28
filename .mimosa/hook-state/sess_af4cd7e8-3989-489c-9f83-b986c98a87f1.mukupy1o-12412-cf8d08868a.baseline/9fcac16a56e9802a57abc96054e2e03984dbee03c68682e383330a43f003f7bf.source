/**
 * 决策日志管理 — 结构化复盘引擎
 *
 * 数据结构：
 *   siji_decisions: [{
 *     id, title, category, status, deadline,
 *     options: [{ name, pros[], cons[], weight }],
 *     stakeholders[], factors[],
 *     decision, reasoning, emotion,
 *     created_at, decided_at, reviewed_at, review_notes,
 *     is_deleted
 *   }]
 */

import { logger } from './logger.js'

const STORAGE_KEY = 'siji_decisions'

// ==================== CRUD ====================

/** 获取所有决策（排除已删除） */
export function getAllDecisions() {
  try {
    const raw = uni.getStorageSync(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw)
      .filter(d => d.is_deleted !== 1)
      .sort((a, b) => b.created_at - a.created_at)
  } catch {
    return []
  }
}

/** 按 ID 获取 */
export function getDecisionById(id) {
  try {
    const raw = uni.getStorageSync(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw).find(d => d.id === id && d.is_deleted !== 1) || null
  } catch {
    return null
  }
}

/** 按状态筛选 */
export function getDecisionsByStatus(status) {
  return getAllDecisions().filter(d => d.status === status)
}

/** 按分类筛选 */
export function getDecisionsByCategory(category) {
  return getAllDecisions().filter(d => d.category === category)
}

/** 创建决策记录 */
export function createDecision(data) {
  const now = Date.now()
  const decision = {
    id: `dec_${now}_${Math.random().toString(36).slice(2, 8)}`,
    title: data.title || '未命名决策',
    category: data.category || '其他',
    status: data.status || 'thinking',
    deadline: data.deadline || '',
    options: Array.isArray(data.options) ? data.options.map(o => ({
      name: o.name || '选项',
      pros: Array.isArray(o.pros) ? o.pros : [],
      cons: Array.isArray(o.cons) ? o.cons : [],
      weight: o.weight != null ? o.weight : 5
    })) : [],
    stakeholders: Array.isArray(data.stakeholders) ? data.stakeholders : [],
    factors: Array.isArray(data.factors) ? data.factors : [],
    decision: '',
    reasoning: '',
    emotion: data.emotion || '',
    created_at: now,
    decided_at: null,
    reviewed_at: null,
    review_notes: '',
    is_deleted: 0
  }
  const all = getRawDecisions()
  all.push(decision)
  persist(all)
  logger.log('[decisions] Created:', decision.title)
  return decision
}

/** 更新决策 */
export function updateDecision(id, updates) {
  const all = getRawDecisions()
  const idx = all.findIndex(d => d.id === id)
  if (idx < 0) return false
  const allowed = ['title', 'category', 'status', 'deadline', 'options', 'stakeholders', 'factors', 'decision', 'reasoning', 'emotion', 'review_notes', 'reviewed_at', 'decided_at']
  for (const key of allowed) {
    if (updates[key] != null) all[idx][key] = updates[key]
  }
  // 状态变更时自动记录时间
  if (updates.status === 'decided' && !all[idx].decided_at) {
    all[idx].decided_at = Date.now()
  }
  if (updates.status === 'reviewed' && !all[idx].reviewed_at) {
    all[idx].reviewed_at = Date.now()
  }
  persist(all)
  return true
}

/** 软删除 */
export function deleteDecision(id) {
  const all = getRawDecisions()
  const idx = all.findIndex(d => d.id === id)
  if (idx < 0) return false
  all[idx].is_deleted = 1
  persist(all)
  return true
}

/** 记录复盘 */
export function reviewDecision(id, reviewNotes, outcome) {
  const all = getRawDecisions()
  const idx = all.findIndex(d => d.id === id)
  if (idx < 0) return false
  all[idx].review_notes = reviewNotes || ''
  if (outcome) all[idx].review_outcome = outcome
  all[idx].reviewed_at = Date.now()
  all[idx].status = 'reviewed'
  persist(all)
  return true
}

// ==================== 分析 ====================

/**
 * 获取需要复盘的决策（已决定但未复盘，且超过 N 天）
 */
export function getPendingReviews(daysThreshold = 7) {
  const now = Date.now()
  const threshold = daysThreshold * 24 * 60 * 60 * 1000
  return getAllDecisions().filter(d => {
    if (d.status !== 'decided' || d.reviewed_at) return false
    if (!d.decided_at) return false
    return (now - d.decided_at) >= threshold
  })
}

/**
 * 分析决策模式 — 发现用户倾向
 */
export function analyzeDecisionPatterns() {
  const all = getAllDecisions()
  const reviewed = all.filter(d => d.status === 'reviewed' && d.decision)

  if (reviewed.length < 3) {
    return { sufficient: false, message: '复盘数据不足，至少需要 3 条已复盘决策' }
  }

  // 分类统计
  const categoryStats = {}
  reviewed.forEach(d => {
    if (!categoryStats[d.category]) {
      categoryStats[d.category] = { total: 0, decisions: [] }
    }
    categoryStats[d.category].total++
    categoryStats[d.category].decisions.push(d.decision)
  })

  // 情绪分析
  const emotionStats = {}
  all.forEach(d => {
    if (d.emotion) {
      emotionStats[d.emotion] = (emotionStats[d.emotion] || 0) + 1
    }
  })

  // 平均决策时长
  const decidedList = all.filter(d => d.decided_at && d.created_at)
  const avgDecisionTime = decidedList.length > 0
    ? decidedList.reduce((s, d) => s + (d.decided_at - d.created_at), 0) / decidedList.length / (24 * 60 * 60 * 1000)
    : 0

  return {
    sufficient: true,
    total: all.length,
    reviewed: reviewed.length,
    pendingReview: getPendingReviews().length,
    categoryStats,
    emotionStats,
    avgDecisionDays: avgDecisionTime.toFixed(1),
    insights: generateInsights(all, categoryStats, emotionStats)
  }
}

function generateInsisions(all, categoryStats, emotionStats) {
  const insights = []
  // 决策数量趋势
  if (all.length > 10) {
    insights.push('你已经在思迹中记录了超过 10 个重要决策')
  }
  // 情绪模式
  const topEmotion = Object.entries(emotionStats).sort((a, b) => b[1] - a[1])[0]
  if (topEmotion && topEmotion[1] >= 3) {
    insights.push(`做决策时最常见的情绪是「${topEmotion[0]}」（${topEmotion[1]}次）`)
  }
  // 待复盘
  const pending = getPendingReviews()
  if (pending.length > 0) {
    insights.push(`有 ${pending.length} 个决策待复盘`)
  }
  return insights
}

// 使用正确函数名避免拼写错误
function generateInsights(all, categoryStats, emotionStats) {
  return generateInsisions(all, categoryStats, emotionStats)
}

/**
 * 构建决策上下文（注入系统提示词）
 * 注入最近 3 个进行中的决策
 */
export function buildDecisionsContext() {
  const thinking = getDecisionsByStatus('thinking')
  if (thinking.length === 0) return ''

  const recent = thinking.slice(0, 3)
  const lines = recent.map(d => {
    const parts = [`  - ${d.title}（${d.category}）`]
    if (d.deadline) parts.push(`截止: ${d.deadline}`)
    if (d.options && d.options.length > 0) {
      parts.push(`选项: ${d.options.map(o => o.name).join(' / ')}`)
    }
    if (d.emotion) parts.push(`情绪: ${d.emotion}`)
    return parts.join(' | ')
  })

  return `\n\n---\n当前进行中的决策：\n${lines.join('\n')}`
}

/**
 * 改动3：检测用户消息是否与现有决策相关
 * 当用户聊到与某条决策标题/选项匹配的话题时，返回相关决策供 AI 主动关联
 * @param {string} userMessage - 用户消息
 * @returns {Array} 匹配到的决策（最多 2 条）
 */
export function detectRelatedDecisions(userMessage) {
  if (!userMessage || userMessage.length < 4) return []
  const thinking = getDecisionsByStatus('thinking')
  const decided = getDecisionsByStatus('decided')
  const all = [...thinking, ...decided]
  if (all.length === 0) return []

  return all.filter(d => {
    // 标题匹配（标题 >= 2 字才匹配，避免单字误匹配）
    if (d.title && d.title.length >= 2 && userMessage.includes(d.title)) return true
    // 选项名匹配（选项名 >= 2 字）
    if (d.options) {
      return d.options.some(o => o.name && o.name.length >= 2 && userMessage.includes(o.name))
    }
    return false
  }).slice(0, 2)
}

/**
 * 获取决策统计
 */
export function getDecisionStats() {
  const all = getAllDecisions()
  const statusMap = {}
  all.forEach(d => {
    statusMap[d.status] = (statusMap[d.status] || 0) + 1
  })
  return {
    total: all.length,
    thinking: statusMap.thinking || 0,
    decided: statusMap.decided || 0,
    acted: statusMap.acted || 0,
    abandoned: statusMap.abandoned || 0,
    reviewed: statusMap.reviewed || 0,
    pendingReview: getPendingReviews().length
  }
}

// ==================== 内部 ====================

function getRawDecisions() {
  try {
    return JSON.parse(uni.getStorageSync(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function persist(list) {
  try {
    uni.setStorageSync(STORAGE_KEY, JSON.stringify(list))
  } catch { /* ignore */ }
}
