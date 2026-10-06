/**
 * 聊天共享模块 —— 打破 api.js ↔ chat-request.js 循环依赖
 *
 * 从 api.js 提取：ApiError, buildChatMessages, getRecentHistory, cacheAiResponse, getOfflineCacheReply
 */

import { buildSystemPrompt, getUserProfile } from './prompt-builder.js'
import { isLiteChatMode } from './prompt-actions.js'
import { isFeatureOn } from './features.js'
import { buildMemoryContext } from '@/utils/memory.js'
import { buildRelationsContext, detectMentionedRelations } from '@/utils/relations.js'
import { buildDecisionsContext } from '@/utils/decisions.js'
import { buildPlanContext } from '@/utils/plan-context.js'
import { energyScan } from '@/utils/energy-context.js'
import { buildProgressDigest } from '@/utils/progress-digest.js'
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
  plan: /(?:计划|执行|开始做|做到哪|进度|完成得|下一步|目标|拖延|没做|放弃|取消)/,
  memorySummary: /(?:总结|周报|月报|复盘|回顾|最近怎么样|这段时间)/
}

// ==================== buildChatMessages ====================

export function buildChatMessages(userMessage, history, cfg, opts = {}) {
  // 4.9.0：lite 接线 —— 无指令性动词的短消息（闲聊）用精简 action schema，
  // CORE_ACTIONS(约 3.5k 字符) 换 LITE_ACTIONS(约 0.4k)，闲聊消息 system 直降约 35%。
  // agent 路径显式传 lite:false（工具能力来自 TOOL_DEFINITIONS，但 JSON 兜底需要完整 schema）。
  const lite = opts.lite != null ? opts.lite : isLiteChatMode(userMessage)
  let system = buildSystemPrompt(false, { lite })
  if (cfg && cfg.systemPrompt) {
    system = cfg.systemPrompt + '\n\n---\n\n' + system
  }

  // 基础上下文：profile 始终注入（用户画像是高频引用数据）
  const profile = getUserProfile()
  if (profile) {
    system += `\n\n---\n用户近期数据：\n${profile}`
  }

  // 长期记忆：按当前消息相关度检索 top-30 注入（无命中回落最近 30 条，3.5.11）
  const memoryContext = buildMemoryContext(userMessage)
  if (memoryContext) {
    system += memoryContext
  }

  // 关系上下文：仅在用户消息含人名/关系词时注入
  if (CONTEXT_KEYWORDS.relations.test(userMessage) || detectMentionedRelations(userMessage).length > 0) {
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

  // 关系上下文已包含被提到的人物详情（buildRelationsContext 内部处理）
  // 3.4 M1：能量感知 — 低/极低时注入降载指令（纯本地推断，零用户输入）
  // 4.10.0：能力开关 —— 关掉「能量感知」时按中等档处理（不降载、不抑制点破）
  const energyOn = isFeatureOn('energy')
  const energy = energyOn ? energyScan(userMessage, history) : { level: 'medium', text: '' }
  if (energy.text) {
    system += energy.text
  }
  // 3.4 M1/M3：低/极低能量抑制点破模板（noNudge）；冷藏计划由 buildPlanContext 内部跳过
  // 计划执行上下文：仅当用户消息涉及计划且点名具体计划时注入（3.3 A/B，逃避候选附点破模板）
  const planCtx = buildPlanContext(userMessage, energy.level === 'low' || energy.level === 'very_low' ? { noNudge: true } : undefined)
  if (planCtx) {
    system += planCtx
  }

  // 3.5.13：动静摘要 — 上次结算以来的完成/打卡/新增记录，让 AI 续得上「你不在时」发生的事
  // 4.5.1：very_low 能量档跳过 —— 降载口径（不主动提任务/计划）与摘要里的完成/打卡行冲突
  // 4.10.0：「动静摘要」能力开关
  if (energy.level !== 'very_low' && isFeatureOn('digest')) {
    const progressDigest = buildProgressDigest()
    if (progressDigest) {
      system += progressDigest
    }
  }

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

/**
 * 历史预算（4.4.0）
 *
 * 为什么要有预算：历史窗口一直按「条数」取最近 20 条，4.3.0 上线长文能力之后，
 * 一条 AI 回复可能两三千字 —— 聊过一篇文章以后，**后面每一条消息都要把这篇文章
 * 原文重发一遍**，而且工具循环每轮都重发，固定开销随对话越长越离谱。
 * 这是「AI 响应变慢」最直接的结构性来源。
 *
 * 规则：单条截断 → 从最近往前累加到预算 → 至少保底最近几条。
 */
export const HISTORY_MAX_CHARS = 6000
export const HISTORY_MAX_PER_MESSAGE = 1200
// 4.15 修复 TC-004：保底 6 → 10（带执行卡的长会话里，6 条会被 AI 长回复吃满预算，
// 「我叫测试员」这类 8 轮前的自报信息直接被挤出窗口）
export const HISTORY_MIN_KEEP = 10
// 4.15：AI 历史回复压到 600 字 —— 预算大头是 AI 长回复，用户消息（自报信息/追问）才最该保真
export const HISTORY_MAX_AI_MESSAGE = 600

/** 截断标记：让模型知道这段被截过，不要当作完整上下文 */
export const HISTORY_TRUNCATED_MARK = '…（内容过长已截断）'

/**
 * 按字符预算裁剪历史（纯函数）
 * @param {Array<{role: string, content: string}>} history
 * @param {{maxChars?: number, maxPerMessage?: number, minKeep?: number}} options
 * @returns {Array<{role: string, content: string}>}
 */
export function trimHistory(history, options = {}) {
  const maxChars = Number(options.maxChars) > 0 ? Number(options.maxChars) : HISTORY_MAX_CHARS
  const maxPerMessage = Number(options.maxPerMessage) > 0 ? Number(options.maxPerMessage) : HISTORY_MAX_PER_MESSAGE
  const minKeep = Number(options.minKeep) >= 0 ? Number(options.minKeep) : HISTORY_MIN_KEEP
  const arr = Array.isArray(history) ? history : []

  const normalized = arr.map(m => {
    const content = m && typeof m.content === 'string' ? m.content : ''
    // 4.15：AI 回复按更紧的上限截（历史里 AI 长文价值低于用户原话）
    const cap = m && m.role === 'assistant'
      ? Math.min(maxPerMessage, HISTORY_MAX_AI_MESSAGE)
      : maxPerMessage
    const clipped = content.length > cap
      ? content.slice(0, cap) + HISTORY_TRUNCATED_MARK
      : content
    return { role: m && m.role, content: clipped }
  })

  const out = []
  let used = 0
  for (let i = normalized.length - 1; i >= 0; i--) {
    const item = normalized[i]
    const len = (item.content || '').length
    // 4.15 修复 TC-004：用户消息一律保留 —— 自报信息（"我叫X"）不得被 AI 长回复
    // 挤出窗口（用户消息很短，全留的代价可控；窗口本身由上游 15 条封顶）。
    // AI 回复在保底条数之外按预算裁剪。
    const isUser = item.role === 'user'
    // 只跳过超预算的 AI 回复，继续往旧走 —— 用 break 会把更早的用户消息一并丢掉
    if (!isUser && out.length >= minKeep && used + len > maxChars) continue
    out.unshift(item)
    if (!isUser) used += len
  }
  return out
}

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
          // 4.5.1：窗口内最后一条带文件的用户消息保留正文（与 buildChatHistory 同一口径），
          // 更早的只留卡片摘要 —— 原来这条路径正文与标记全丢，跨轮追问文件等于失忆
          let lastFileIdx = -1
          for (let i = recent.length - 1; i >= 0; i--) {
            if (recent[i].role === 'user' && recent[i].fileText) { lastFileIdx = i; break }
          }
          // 返回前统一过预算（4.4.0）：长文回复不再被整段重发
          return trimHistory(recent.map((m, i) => {
            let content = m.aiReply || m.content
            if (m.role === 'user' && m.fileText) {
              const name = (m.file && m.file.name) || '文件'
              content = i === lastFileIdx
                ? '[文件 ' + name + ']\n' + m.fileText + '\n\n' + content
                : '[已读过文件 ' + name + '] ' + content
            }
            return { role: m.role, content }
          }))
        }
      }
    }
    const raw = uni.getStorageSync('siji_chat_history') || '[]'
    const all = JSON.parse(raw)
    return trimHistory(all.slice(-15).map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? (m.aiReply || m.content) : JSON.stringify(m.content)
    })))
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
