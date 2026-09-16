/**
 * AI 响应解析器 — 容错处理，支持单意图/复合意图/撤销
 *
 * 从 utils/api.js 拆分，减少单文件体积
 */
import { logger } from '../logger.js'
import { OP_CLAIM_RE } from './constants.js'
import { mergeSuggestions } from './chat-suggestion.js'

/**
 * 解析 AI 响应 — 容错处理，支持单意图/复合意图/撤销
 */
/**
 * 拍平嵌套的 multi（3.7.3）
 *
 * 模型返回过 actions: [{ type: 'multi', payload: { … } }] 这种嵌套结构。
 * 直接把 multi 当动作执行，只会拿到 store 的显式拦截「复合意图请用 executeActions」——
 * 用户看到「都记好了」，实际两个意图一个都没落库（实测 multi-intent 那条就是这样）。
 * 这里把内层真实动作展开；展不出东西就丢掉，让它落回「声称操作但无 action」的兜底链路。
 * @param {Array} list
 * @returns {Array<{type: string, payload: Object, needConfirm: boolean}>}
 */
function normalizeActions(list) {
  const out = []
  const pushItem = (a) => {
    if (!a || !a.type || a.type === 'none') return
    if (a.type === 'multi') {
      if (Array.isArray(a.payload)) a.payload.forEach(pushItem)
      else if (a.payload && Array.isArray(a.payload.actions)) a.payload.actions.forEach(pushItem)
      else if (a.payload && Array.isArray(a.payload.items)) a.payload.items.forEach(pushItem)
      return
    }
    out.push({ type: a.type, payload: a.payload || {}, needConfirm: a.needConfirm === true })
  }
  if (Array.isArray(list)) list.forEach(pushItem)
  return out
}

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
    // 尝试从文本中提取最后一个 JSON 对象（贪婪匹配 { ... }）
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
    if (!parsed) {
      // 非 JSON → 当作纯文本回复
      return {
        reply: cleaned,
        action: null,
        actions: [],
        suggestions: mergeSuggestions([], cleaned),
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
    actions = normalizeActions(parsed.actions)
    if (actions.length > 0) {
      action = {
        type: 'multi',
        payload: {},
        needConfirm: actions.some(a => a.needConfirm)
      }
    }
  } else if (parsed.action && parsed.action.type && parsed.action.type !== 'none') {
    if (parsed.action.type === 'multi') {
      // 3.7.3：模型把 multi 当动作返回（实测 actions: [{ type: 'multi', payload: … }]）——
      // 拍平内层；拍不出任何真实动作就当没有动作，交给兜底与提示，别让它走进执行器
      const flat = normalizeActions([parsed.action])
      if (flat.length > 0) {
        actions = flat
        action = { type: 'multi', payload: {}, needConfirm: flat.some(a => a.needConfirm) }
      }
    } else {
      action = {
        type: parsed.action.type,
        payload: parsed.action.payload || {},
        needConfirm: parsed.action.needConfirm === true
      }
      actions = [action]
    }
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
    suggestions: mergeSuggestions(parsed.suggestions, action ? '' : reply),
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
