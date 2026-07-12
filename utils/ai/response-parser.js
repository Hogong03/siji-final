/**
 * AI 响应解析器 — 容错处理，支持单意图/复合意图/撤销
 *
 * 从 utils/api.js 拆分，减少单文件体积
 */
import { logger } from '../logger.js'

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
      conversation_id: conversationId || ''
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

  // 兜底：AI 回复含操作词但未返回 action 时，尝试从 reply 中检测
  if (!action && (!actions || actions.length === 0)) {
    const opWords = /已记录|已更新|已帮你|已记下|记下了|已经记|已经帮|已经更新|已经修改|帮你记|帮你更新|帮你修改/
    if (opWords.test(reply)) {
      logger.warn('[AI] reply 含操作词但未返回 action，尝试兜底')
      // 无法从 reply 精确提取参数，只能提示用户
      // 不自动构造 action，因为无法确定具体要更新什么
    }
  }

  return {
    reply,
    action,
    actions,
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3).map(s => String(s)).filter(Boolean) : [],
    conversation_id: conversationId || ''
  }
}
