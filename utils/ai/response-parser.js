/**
 * AI 响应解析器 — 容错处理，支持单意图/复合意图/撤销
 *
 * 从 utils/api.js 拆分，减少单文件体积
 */
import { logger } from '../logger.js'
import { OP_CLAIM_RE } from './constants.js'

/**
 * 解析 AI 响应 — 容错处理，支持单意图/复合意图/撤销
 */
export function parseAiResponse(raw, conversationId) {
  // 空内容兜底
  if (!raw || !raw.trim()) {
    logger.warn('[思迹] AI 返回空内容，返回友好兜底')
    return {
      reply: '抱歉，我刚才走神了，能再说一次吗？',
      action: null,
      actions: [],
      suggestions: [],
      conversation_id: conversationId || '',
      _isFallback: true
    }
  }

  let cleaned = raw.trim()

  // 剥离 <think>...</think> 思考链标签（部分模型如 DeepSeek-R1 会返回）
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()

  // 剥离 <thinking>...</thinking> 变体
  cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim()

  // 清理可能的 markdown 代码块包裹
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  }

  let parsed
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    // 尝试从文本中提取 JSON 对象（贪婪匹配最后一个 { ... }）
    const jsonMatches = cleaned.match(/\{[\s\S]*\}/g)
    if (jsonMatches) {
      // 从后往前尝试，取第一个能解析成功的
      for (let i = jsonMatches.length - 1; i >= 0; i--) {
        try {
          parsed = JSON.parse(jsonMatches[i])
          break
        } catch {
          continue
        }
      }
    }
    // 兜底：尝试找 {"reply" 开头的子串（AI 有时在 JSON 前输出思考文本）
    if (!parsed) {
      const replyJsonIdx = cleaned.indexOf('{"reply"')
      if (replyJsonIdx === -1) {
        // 再试单引号变体
        const replyJsonIdx2 = cleaned.indexOf("{'reply'")
        if (replyJsonIdx2 !== -1) {
          const sub = cleaned.slice(replyJsonIdx2)
          try { parsed = JSON.parse(sub) } catch {}
        }
      } else if (replyJsonIdx !== -1) {
        const sub = cleaned.slice(replyJsonIdx)
        try { parsed = JSON.parse(sub) } catch {}
        // 如果直接 parse 失败，再试贪婪匹配
        if (!parsed) {
          const subMatch = sub.match(/\{[\s\S]*\}/g)
          if (subMatch) {
            for (let i = subMatch.length - 1; i >= 0; i--) {
              try { parsed = JSON.parse(subMatch[i]); break } catch { continue }
            }
          }
        }
      }
    }
    if (!parsed) {
      // 非 JSON → 当作纯文本回复
      return {
        reply: cleaned,
        action: null,
        actions: [],
        conversation_id: conversationId || ''
      }
    }
  }

  // JSON 解析成功但 reply 为空 → 兜底
  let reply = parsed.reply || parsed.message || parsed.content || ''
  if (!reply.trim()) {
    logger.warn('[思迹] AI 返回 JSON 但 reply 为空:', raw.substring(0, 200))
    reply = '抱歉，我没能理解，能换个方式说说吗？'
  }

  // 清洗 reply 中的 markdown 代码块（AI 有时会违反禁令）
  reply = stripMarkdownCodeBlocks(reply)
  let action = null
  let actions = []

  // 复合意图 — actions 数组
  if (Array.isArray(parsed.actions) && parsed.actions.length > 0) {
    actions = parsed.actions
      .filter(a => a && a.type && a.type !== 'none')
      .map(a => ({
        type: a.type,
        payload: a.payload || {},
        needConfirm: a.needConfirm === true
      }))
    if (actions.length > 0) {
      action = {
        type: 'multi',
        payload: {},
        needConfirm: actions.some(a => a.needConfirm)
      }
    }
  } else if (parsed.action && parsed.action.type && parsed.action.type !== 'none') {
    action = {
      type: parsed.action.type,
      payload: parsed.action.payload || {},
      needConfirm: parsed.action.needConfirm === true
    }
    actions = [action]
  }

  // P2-2: 操作词兜底已由 autoExecutor.extractFallbackAction 统一处理（更全面）
  // 此处不再重复检测，避免两套正则不一致

  // 铁律4兜底：标记 AI 声称操作但无 action 的情况，交由 autoExecutor 决定修正或 fallback
  let _opClaimWithoutAction = false
  if (!action && reply) {
    if (OP_CLAIM_RE.test(reply)) {
      _opClaimWithoutAction = true
      logger.warn('[response-parser] AI 声称操作但无 action，标记 _opClaimWithoutAction:', reply)
    }
  }

  return {
    reply,
    action,
    actions,
    _opClaimWithoutAction,
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3).map(s => String(s)).filter(Boolean) : [],
    conversation_id: conversationId || ''
  }
}

/**
 * 清洗 reply 中的 markdown 代码块
 * AI 有时会违反禁令在 reply 中用 ```wrap 内容```
 * 策略：去掉代码块包裹（```lang ... ```），保留内部纯文本
 */
function stripMarkdownCodeBlocks(text) {
  if (!text) return text
  // 匹配 ```lang\n...``` 模式，保留内部内容
  return text.replace(/```(?:[a-zA-Z]+)?\s*\n?([\s\S]*?)```/g, '$1').trim()
}
