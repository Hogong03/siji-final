/**
 * autoExecutor - AI 自动执行并显示结果
 *
 * 从 useChatEngine.js 抽取，负责解析 AI 返回的 action 并执行
 * 包含：单/多执行、防误导检测、前端兜底
 */

import { logger } from '@/utils/logger.js'
import { extractFallbackAction } from '@/utils/ai/fallback.js'
import { OP_CLAIM_RE_EXT, OP_CLAIM_REPLACE_RE } from '@/utils/ai/constants.js'

/**
 * 自动执行并显示结果
 * @param {Object} store - useAppStore
 * @param {Object} result - AI 返回结果
 * @param {string} reply - AI 回复文本
 * @param {string} userMessage - 用户原始消息
 * @param {Object} options - { source: 'agent' | 'json' }，agent 模式跳过执行步骤
 */
export function autoExecuteAndDisplay(store, result, reply, userMessage, options = {}) {
  const { source = 'json' } = options
  // === Agent 模式：工具已在循环内执行，仅渲染结果卡片 ===
  if (source === 'agent') {
    const execResults = result.execResults || []
    const successCards = execResults.filter(r => r.ok && r.detail && !r.name?.startsWith('query_'))
    const execCard = execResults.find(r => r.ok && r.detail)
    const actionCard = successCards.length > 1
      ? { type: 'multi', payload: successCards.map(r => r.detail) }
      : successCards.length === 1
        ? { type: successCards[0].name, payload: successCards[0].detail }
        : (execCard?.detail ? { type: execCard.name, payload: execCard.detail } : null)
    store.updateLastMessage({
      content: reply, loading: false, aiReply: reply,
      actionCard,
      execResult: execCard ? { success: true, message: execCard.message || '', detail: execCard.detail } : null,
      execResults: successCards
    })
    return
  }

  // === JSON 模式：解析 action 并执行 ===
  let execResults = []
  let displayContent = reply

  if (result.actions && result.actions.length > 1) {
    const multiResult = store.executeActions(result.actions)
    execResults = multiResult.results || []
    if (multiResult.allSuccess) {
      displayContent += `\n\n${multiResult.message}`
    } else {
      const successMsgs = execResults.filter(r => r.success).map(r => r.message)
      const failMsgs = execResults.filter(r => !r.success && r.message !== '无需执行').map(r => r.message)
      if (successMsgs.length > 0) displayContent += `\n\n${successMsgs.join(';')}`
      if (failMsgs.length > 0) displayContent += `\n\n${failMsgs.join(';')}`
    }
    store.updateLastMessage({
      content: displayContent, loading: false,
      aiReply: reply,
      actionCard: execResults.find(r => r.success && r.detail) ? {
        type: 'multi', payload: execResults.filter(r => r.success && r.detail).map(r => r.detail)
      } : null,
      execResult: { success: multiResult.allSuccess, message: multiResult.message, detail: execResults[0]?.detail },
      execResults: execResults.filter(r => r.success && r.detail)
    })
    return
  }

  // === 单 action 执行 ===
  let effectiveAction = (result.actions && result.actions.length === 1)
    ? result.actions[0] : result.action
  
  // 注：原二次 JSON 提取逻辑已删除——response-parser 已做充分兜底，
  // action 为 null 就是 null，不应在 autoExecutor 再试一次
  
  let execResult = null
  if (effectiveAction) {
    execResult = store.executeAction(effectiveAction)
    // 降级：update_plan 缺少 client_id 但有完整创建字段 → 自动转为 create_plan
    if (!execResult.success && effectiveAction.type === 'update_plan'
        && !effectiveAction.payload?.client_id && !effectiveAction.payload?.id
        && (effectiveAction.payload?.title || effectiveAction.payload?.description)) {
      logger.warn('[AutoExecutor] update_plan missing client_id, fallback to create_plan')
      const createAction = {
        type: 'create_plan',
        payload: effectiveAction.payload,
        needConfirm: false
      }
      execResult = store.executeAction(createAction)
      if (execResult.success) effectiveAction.type = 'create_plan'
    }
  }

  if (execResult && execResult.success) {
    const msg = execResult.message || ''
    const replyHasIt = msg && (reply || '').includes(msg)
    if (msg && msg !== '无需执行' && !replyHasIt) displayContent += `\n\n${msg}`
  } else if (execResult && !execResult.success && execResult.message !== '无需执行') {
    displayContent += `\n\n${execResult.message}`
  }

  // === 防误导检测 + 前端兜底 ===
  const isQueryAction = execResult?.detail?.type?.startsWith('query_')
  const hasExecuted = execResult && execResult.success
  const isNotEnabled = execResult?.detail?.notEnabled
  if (!hasExecuted && !isQueryAction && !isNotEnabled) {
    const opClaimed = OP_CLAIM_RE_EXT.test(reply || '') || result._opClaimWithoutAction
    if (opClaimed) {
      const fallbackAction = extractFallbackAction(userMessage || '', reply || '')
      if (fallbackAction) {
        logger.warn('前端兜底执行', fallbackAction.type)
        const fbResult = store.executeAction(fallbackAction)
        if (fbResult && fbResult.success) {
          execResult = fbResult
          const msg = fbResult.message || ''
          if (msg && msg !== '无需执行') displayContent = reply + `\n\n${msg}`
          const noCardTypes = ['undo_last', 'get_profile', 'clear_profile', 'toggle_profile']
          const showCard = !noCardTypes.includes(fallbackAction.type) &&
            !fallbackAction.type.startsWith('query_') && execResult?.detail && !execResult.detail.deleted
          store.updateLastMessage({
            content: displayContent, loading: false, aiReply: reply,
            actionCard: showCard ? { type: fallbackAction.type, payload: execResult.detail } : null,
            execResult
          })
          return
        }
      }
      // fallback 也失败 → 修正 reply 中的操作完成语，追加引导提示
      const correctedReply = (reply || '').replace(OP_CLAIM_REPLACE_RE, '收到')
      displayContent = correctedReply + '\n\n💡 没能自动记录，再告诉我一次具体要记什么？'
      logger.warn('AI 声称操作但无 action，fallback 也失败，修正 reply:', JSON.stringify(result))
    }
  }

  const cardType = effectiveAction?.type
  const noCardTypes = ['undo_last', 'get_profile', 'clear_profile', 'toggle_profile']
  const showCard = execResult && execResult.success && execResult.detail &&
    !execResult.detail.deleted && !cardType?.startsWith('query_') && !noCardTypes.includes(cardType)

  store.updateLastMessage({
    content: displayContent, loading: false, aiReply: reply,
    actionCard: showCard ? { type: effectiveAction.type, payload: execResult.detail } : null,
    execResult
  })
}
