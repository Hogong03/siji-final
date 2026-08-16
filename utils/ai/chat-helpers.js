/**
 * 聊天共享模块 —— 打破 api.js ↔ chat-request.js 循环依赖
 *
 * 从 api.js 提取：ApiError, buildChatMessages, getRecentHistory, cacheAiResponse, getOfflineCacheReply
 */

import { buildSystemPrompt, getUserProfile } from './prompt-builder.js'
import { buildSkillsPrompt } from './skills.js'
import { buildMemoryContext } from '@/utils/memory.js'
import { buildRelationsContext } from '@/utils/relations.js'
import { buildDecisionsContext } from '@/utils/decisions.js'
import { buildVisionMessage } from '@/utils/image.js'
import { logger } from '../logger.js'
import { asyncSetStorageJSON } from '../store-helpers.js'

// ==================== ApiError ====================

export class ApiError extends Error {
  constructor(message, type, statusCode, retryable) {
    super(message)
    this.name = 'ApiError'
    this.type = type
    this.statusCode = statusCode || 0
    this.retryable = retryable !== undefined ? retryable : false
  }
}

/** token 估算 — CJK 字符约 2 token，ASCII 约 0.25 token */
function estimateTokens(text) {
  if (!text) return 0
  let tokens = 0
  for (const ch of text) {
    tokens += /[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/.test(ch) ? 2 : 0.25
  }
  return Math.ceil(tokens) + 10
}

/** 按需注入上下文 — 根据用户消息内容决定注入哪些上下文，节省 token */
const CONTEXT_KEYWORDS = {
  relations: /(?:朋友|同事|女朋友|男朋友|女友|男友|老婆|老公|妻子|丈夫|家人|爸爸|妈妈|爸|妈|领导|老板|老师|同学|室友|人脉|关系|认识|介绍|是谁|叫什么)/,
  decisions: /(?:纠结|选择|决定|决策|要不要|该不该|选哪个|两难|权衡|纠结|犯难)/,
  memorySummary: /(?:总结|周报|月报|复盘|回顾|最近怎么样|这段时间)/
}

// ==================== buildChatMessages ====================

export function buildChatMessages(userMessage, history, cfg) {
  let system = buildSystemPrompt()
  if (cfg && cfg.systemPrompt) {
    system = cfg.systemPrompt + '\n\n---\n\n' + system
  }

  // 基础上下文：profile 始终注入（用户画像是高频引用数据）
  const profile = getUserProfile()
  if (profile) {
    system += `\n\n---\n用户近期数据：\n${profile}`
  }

  // 长期记忆：始终注入精简版（最近 3 条），完整版按需
  const memoryContext = buildMemoryContext()
  if (memoryContext) {
    system += memoryContext
  }

  // 关系上下文：仅在用户消息含人名/关系词时注入
  if (CONTEXT_KEYWORDS.relations.test(userMessage)) {
    const relationsCtx = buildRelationsContext(userMessage)
    if (relationsCtx) {
      system += relationsCtx
    }
  }

  // 决策上下文：仅在用户消息含决策相关词时注入
  if (CONTEXT_KEYWORDS.decisions.test(userMessage)) {
    const decisionsCtx = buildDecisionsContext()
    if (decisionsCtx) {
      system += decisionsCtx
    }
  }

  // Agent 模式：注入技能 prompt（内置 Agent 使用定制化技能 prompt）
  if (cfg && cfg.agentMode && cfg.skills && cfg.skills.length > 0) {
    const skillsPrompt = buildSkillsPrompt(cfg.skills, cfg.agentId || null)
    if (skillsPrompt) {
      system += skillsPrompt
    }
  }

  // 关系上下文已包含被提到的人物详情（buildRelationsContext 内部处理）
  // 不再单独注入 detectMentionedRelations，避免重复

  const messages = [{ role: 'system', content: system }]

  if (cfg && cfg.image) {
    messages[0].content += `\n\n## 图片识别模式\n用户上传了微信/聊天截图。你的任务是：\n1. 识别截图中的对话内容、时间、参与人\n2. 分析其中的关键信息（记账/记录/计划相关）\n3. 执行相应操作（create_diary/create_bill/create_plan/create_relation/log_interaction）\n4. reply 中简要说明你提取到了什么、做了什么\n5. 如果截图内容与记录无关，正常回复即可`
  }

  const convSummary = cfg && cfg.convSummary ? cfg.convSummary : null
  const summaryIndex = cfg && cfg.summaryIndex ? cfg.summaryIndex : 0

  if (convSummary && summaryIndex > 0 && history && history.length > summaryIndex) {
    messages.push({ role: 'system', content: `【对话历史摘要】${convSummary}` })
    const recentHistory = history.slice(summaryIndex)
    recentHistory.forEach(msg => messages.push(msg))
  } else if (history && history.length > 0) {
    const MAX_HISTORY_TOKENS = 8000
    const MIN_KEEP = 10
    const MAX_KEEP = 20
    const truncated = []
    let tokenEstimate = 0
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i]
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      const msgTokens = estimateTokens(content)
      if (tokenEstimate + msgTokens > MAX_HISTORY_TOKENS && truncated.length >= MIN_KEEP) break
      truncated.unshift(msg)
      tokenEstimate += msgTokens
      if (truncated.length >= MAX_KEEP) break
    }
    truncated.forEach(msg => messages.push(msg))
  }

  if (cfg && cfg.image) {
    const content = buildVisionMessage(userMessage, cfg.image, cfg.provider)
    messages.push({ role: 'user', content })
  } else {
    messages.push({ role: 'user', content: userMessage })
  }
  return messages
}

// ==================== 对话历史 ====================

export function getRecentHistory() {
  try {
    const convRaw = uni.getStorageSync('siji_conversations')
    if (convRaw) {
      const convs = JSON.parse(convRaw)
      if (Array.isArray(convs) && convs.length > 0) {
        const activeId = uni.getStorageSync('siji_active_conversation')
        const conv = activeId ? convs.find(c => c.id === activeId) : convs[0]
        if (conv && conv.messages && conv.messages.length > 0) {
          const recent = conv.messages
            .filter(m => {
              if (m.role === 'user') return m.content && m.content.trim()
              if (m.role === 'assistant') return m.aiReply || (m.content && m.content.trim())
              return false
            })
            .slice(-20)
          return recent.map(m => ({
            role: m.role,
            content: m.aiReply || m.content
          }))
        }
      }
    }
    const raw = uni.getStorageSync('siji_chat_history') || '[]'
    const all = JSON.parse(raw)
    return all.slice(-15).map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? (m.aiReply || m.content) : JSON.stringify(m.content)
    }))
  } catch {
    return []
  }
}

// ==================== 离线缓存 ====================

const OFFLINE_CACHE_KEY = 'siji_offline_cache'
const CACHE_MAX_AGE = 30 * 60 * 1000

export function cacheAiResponse(userMessage, reply) {
  if (!userMessage || !reply) return
  if (userMessage.length > 50 || reply.length > 200) return
  try {
    const key = userMessage.trim().substring(0, 30)
    const cache = JSON.parse(uni.getStorageSync(OFFLINE_CACHE_KEY) || '{}')
    cache[key] = { reply, time: Date.now() }
    const entries = Object.entries(cache)
    if (entries.length > 50) {
      entries.sort((a, b) => b[1].time - a[1].time)
      asyncSetStorageJSON(OFFLINE_CACHE_KEY, Object.fromEntries(entries.slice(0, 50)))
    } else {
      asyncSetStorageJSON(OFFLINE_CACHE_KEY, cache)
    }
  } catch { /* ignore */ }
}

export function getOfflineCacheReply(userMessage) {
  if (!userMessage) return null
  try {
    const cache = JSON.parse(uni.getStorageSync(OFFLINE_CACHE_KEY) || '{}')
    const key = userMessage.trim().substring(0, 30)
    const entry = cache[key]
    if (entry && (Date.now() - entry.time) < CACHE_MAX_AGE) {
      return { reply: entry.reply + '\n\n📶 离线模式 · 数据可能不是最新', offline: true }
    }
  } catch { /* ignore */ }
  return null
}
