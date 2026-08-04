/**
 * 聊天历史恢复模块 — 从 Storage 恢复会话（支持新格式 + 旧格式兼容）
 */

import { asyncSetStorageJSON } from '@/utils/store-helpers.js'
import { generateConversationId } from '@/utils/uuid.js'
import { CONV_STORAGE_KEY } from './persist.js'

/**
 * 从 Storage 恢复会话列表
 * @returns {{ conversations: array, activeId: string }}
 */
export function restoreHistory() {
  // 优先尝试新格式（多会话）
  const raw = uni.getStorageSync(CONV_STORAGE_KEY)
  if (raw) {
    try {
      const list = JSON.parse(raw)
      if (Array.isArray(list) && list.length > 0) {
        const savedId = uni.getStorageSync('siji_active_conversation')
        const activeId = (savedId && list.find(c => c.id === savedId)) ? savedId : list[0].id
        return { conversations: list, activeId }
      }
    } catch { /* fallthrough to legacy */ }
  }

  // 兼容旧格式（单会话 siji_chat_history）
  const legacyRaw = uni.getStorageSync('siji_chat_history')
  if (legacyRaw) {
    try {
      const history = JSON.parse(legacyRaw)
      if (Array.isArray(history) && history.length > 0) {
        const conv = {
          id: generateConversationId(),
          title: '新对话1',
          messages: history.map(m => ({ ...m, time: '' })),
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
        // 写入新格式
        asyncSetStorageJSON(CONV_STORAGE_KEY, [conv])
        try { uni.removeStorageSync('siji_chat_history') } catch (e) { /* ignore */ }
        return { conversations: [conv], activeId: conv.id }
      }
    } catch { /* ignore */ }
  }

  // 无历史数据
  return { conversations: [], activeId: '' }
}
