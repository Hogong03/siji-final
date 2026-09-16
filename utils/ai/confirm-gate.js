/**
 * confirm-gate.js — 「这一轮要不要弹确认卡」的单一判定（3.7.3）
 *
 * 为什么单独抽出来：
 *  - useChatEngine 里这段判断原来只服务聊天路径，AI 效果自检要么重写一份（会漂移）、
 *    要么就测不出「没走确认闸门」这种问题 —— 3.7.2 首跑就是靠自检才发现：
 *    模型不调工具、直接回 JSON action 时，runAgentChat 无条件打了 _agentMode=true，
 *    于是这段判断整个被跳过，1500 元的大额记账与 delete_feedback 都能绕开确认直接落库。
 *  - 判定只依赖 needsConfirmation（CONFIRM_TOOLS + 金额阈值 + 写操作默认需确认），纯函数好测。
 *
 * 不碰 store、不 import uni。
 */
import { needsConfirmation } from './tools.js'

/**
 * 这一轮需要用户确认的待执行动作
 * @param {Object} result runAgentChat / parseAiResponse 的结果
 * @returns {Array} 需要确认的动作（空数组 = 不需要）
 */
export function pendingConfirmations(result) {
  // agent 模式：工具已在循环内执行，或已在 agent-loop 的确认闸门里挂起，这里不重复判
  if (!result || result._agentMode) return []
  const list = (result.actions && result.actions.length > 1)
    ? result.actions
    : (result.action ? [result.action] : [])
  return list.filter((a) => a && a.type && needsConfirmation(a.type, a.payload || {}))
}

/**
 * 这一轮是否要走确认卡
 * @param {Object} result
 * @returns {boolean}
 */
export function needUserConfirm(result) {
  if (result && result.action && result.action.needConfirm === true) return true
  return pendingConfirmations(result).length > 0
}