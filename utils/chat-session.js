/**
 * chat-session.js — 「每次进来都是新对话」的判定（3.5.16）
 *
 * 三个纯函数 + 一个进程内标志：
 *   isEmptyConversation     空会话（没有消息，或只有欢迎语 / 进入总结消息）—— 用于清理由冷启动换下来的空壳
 *   pickResumeConversation  从列表里挑「回去接着聊」的那条（排除当前、跳过空会话、取最近更新）
 *   shouldOfferResume       新对话空态是否给入口（关掉了就不再给；当前对话已带回旧对话按钮时也不给）
 *   formatConversationAge   对话时间的人类说法（刚刚 / N 分钟前 / 今天 10:20 / 昨天 / N 天前 / 3月5日）
 *   consumeColdStart        本次进程是否是第一次进入对话页（只 true 一次）
 *
 * 3.5.19：进入总结改成对话消息（utils/enter-dialogue.js），它不算「有内容」——
 * 只带总结的对话下次冷启动仍会被当空壳清掉，不在会话列表里堆一串没有对话的壳；
 * 但它自己带着「返回旧对话」按钮，所以此时不再显示空态入口卡（避免两个入口打架）。
 *
 * 3.6.1：3.6.0 及以前落盘丢标记（见 store/chat/persist.js 的修复），存量壳在重启后
 * 认不出来，会被当成「聊过的对话」顶掉真正的上一次对话 —— 「回去接着聊」跳到壳上，
 * 屏幕上还是那句一模一样的开场白，看着像没跳。判空因此不再只看标记：整条对话连一句
 * 用户消息都没有、也没有任何 AI 产出，就是壳（与标记口径并存，标记优先）。
 *
 * 不碰存储、不 import store：存储与编排在 store/chat.js 与 composables/useChatSession.js。
 */

import { ENTER_SUMMARY_FLAG } from './enter-dialogue.js'

/** 冷启动标志：模块加载即置位，第一次消费后清除 */
let coldStartPending = true

/** 本次进程是否还没消费过冷启动（消费即置 false） */
export function consumeColdStart() {
  const pending = coldStartPending
  coldStartPending = false
  return pending
}

/** 复位冷启动标志（测试用；业务代码不要调） */
export function resetColdStart() {
  coldStartPending = true
}

/**
 * AI 开口但没产出内容的一条消息（欢迎语 / 进入总结的兜底判据）
 * 标记丢了也能认出来：只要没有任何真实产出（aiReply / 执行结果 / 动作卡 / 图片），
 * 一条 role 为 assistant 的裸消息就是开场白。
 * @param {Object} m
 * @returns {boolean}
 */
function isBareAssistantMessage(m) {
  if (!m || m.role !== 'assistant') return false
  if (m.aiReply || m.execResult || m.execResults || m.actionCard || m.image) return false
  return true
}

/**
 * 空会话：没有消息、或消息全是欢迎语 / 进入总结（3.5.19 起总结也算空）
 * 3.6.1 起再加一条兜底：整条对话没有用户消息、也没有 AI 产出，同样是壳
 * @param {Object} conv
 * @returns {boolean}
 */
export function isEmptyConversation(conv) {
  if (!conv) return true
  if (conv.summary) return false
  const list = Array.isArray(conv.messages) ? conv.messages : []
  if (list.length === 0) return true
  return list.every(m => m && (m._isWelcome || m[ENTER_SUMMARY_FLAG] || isBareAssistantMessage(m)))
}

/**
 * 当前对话里是否已有进入总结消息（3.5.19）
 * 有的话它自己带着「返回旧对话」，空态入口卡就不重复出现
 * @param {Object} conv
 * @returns {boolean}
 */
export function hasEnterSummaryMessage(conv) {
  const list = (conv && Array.isArray(conv.messages)) ? conv.messages : []
  return list.some(m => m && m[ENTER_SUMMARY_FLAG])
}

/**
 * 「回去接着聊」的目标：排除当前会话，跳过空会话，取 updatedAt 最新的一条
 * @param {Array} conversations
 * @param {string} activeId
 * @returns {Object|null}
 */
export function pickResumeConversation(conversations, activeId = '') {
  const list = (Array.isArray(conversations) ? conversations : [])
    .filter(c => c && c.id && c.id !== activeId && !isEmptyConversation(c))
  if (list.length === 0) return null
  return list.reduce((best, c) => ((c.updatedAt || c.createdAt || 0) > (best.updatedAt || best.createdAt || 0) ? c : best), list[0])
}

/**
 * 新对话空态是否显示入口卡
 * @param {Object} opts
 * @param {Array} opts.conversations
 * @param {string} opts.activeId
 * @param {boolean} [opts.dismissed] 本次会话内被用户关掉了
 * @returns {boolean}
 */
export function shouldOfferResume({ conversations = [], activeId = '', dismissed = false, hideWhenEnterSummary = true } = {}) {
  if (dismissed) return false
  const active = (Array.isArray(conversations) ? conversations : []).find(c => c && c.id === activeId) || null
  if (!isEmptyConversation(active)) return false
  if (hideWhenEnterSummary && hasEnterSummaryMessage(active)) return false
  return !!pickResumeConversation(conversations, activeId)
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/**
 * 对话时间的人类说法（非法输入返回空串）
 * @param {number} at
 * @param {number} [now]
 * @returns {string}
 */
export function formatConversationAge(at, now = Date.now()) {
  const ts = Number(at)
  if (!ts || !Number.isFinite(ts)) return ''
  const diff = now - ts
  if (diff < 0) return '刚刚'
  if (diff < 60 * 1000) return '刚刚'
  if (diff < 60 * 60 * 1000) return Math.floor(diff / 60000) + ' 分钟前'
  const d = new Date(ts)
  const today = new Date(now)
  const hm = pad2(d.getHours()) + ':' + pad2(d.getMinutes())
  if (sameDay(d, today)) return '今天 ' + hm
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  if (sameDay(d, yesterday)) return '昨天 ' + hm
  const dayDiff = Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000)
  if (dayDiff <= 6) return dayDiff + ' 天前'
  return (d.getMonth() + 1) + '月' + d.getDate() + '日'
}
