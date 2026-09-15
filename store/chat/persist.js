/**
 * 聊天持久化模块 — 防抖写入 + 消息裁剪 + 容量保护
 *
 * 从 store/chat.js 拆出，纯函数操作，由 store 调用
 */

import { asyncSetStorage, asyncSetStorageJSON } from '@/utils/store-helpers.js'
import { logger } from '@/utils/logger.js'

const CONV_STORAGE_KEY = 'siji_conversations'
const PERSIST_DEBOUNCE_MS = 500

let _persistTimer = null
let _isDirty = false

/** 防抖持久化 — 流式传输期间不写入，结束后一次性写入 */
export function debouncedPersist(persistFn) {
  _isDirty = true
  if (_persistTimer) return
  _persistTimer = setTimeout(() => {
    _persistTimer = null
    if (_isDirty) {
      _isDirty = false
      persistFn()
    }
  }, PERSIST_DEBOUNCE_MS)
}

/** 立即 flush — 用于 onHide / 页面切换等需要立即写入的场景 */
export function flushPersist(persistFn) {
  if (_persistTimer) {
    clearTimeout(_persistTimer)
    _persistTimer = null
  }
  if (_isDirty) {
    _isDirty = false
    persistFn()
  }
}

/** 检测 localStorage 剩余可用空间，超限风险时返回 true */
export function isStorageNearQuota(additionalBytes) {
  try {
    const probeKey = '__quota_probe__'
    const before = JSON.stringify(uni.getStorageInfoSync()).length
    const estimated = additionalBytes || 0
    const limit = typeof window !== 'undefined' ? 5 * 1024 * 1024 : 10 * 1024 * 1024
    const current = before + estimated
    return current > limit * 0.85
  } catch {
    return false
  }
}

/**
 * 持久化所有会话 — 裁剪消息 + 容量保护 + 写入
 * @param {array} conversations - 会话数组
 * @param {string} activeConversationId - 当前活跃会话 ID
 */
export function persistConversations(conversations, activeConversationId) {
  const MAX_CHARS = 200000
  const MIN_KEEP = 20
  const MAX_KEEP = 500

  let slim = conversations.map(conv => {
    if (conv.id !== activeConversationId && conv._slimCache) {
      return conv._slimCache
    }

    const filtered = conv.messages.filter(m => {
      if (m.role === 'assistant' && !m.aiReply) {
        if (m.loading) return false
        if (typeof m.content === 'string' && (m.content.startsWith('❌') || m.content.startsWith('⚠️'))) return false
      }
      return true
    })

    const recent = []
    let totalChars = 0
    for (let i = filtered.length - 1; i >= 0; i--) {
      const m = filtered[i]
      const contentChars = (m.content || '').length + (m.aiReply || '').length + ((m.image && m.image.base64) ? m.image.base64.length : 0)
      totalChars += contentChars
      if (totalChars > MAX_CHARS && recent.length >= MIN_KEEP) break
      recent.unshift(m)
      if (recent.length >= MAX_KEEP) break
    }

    const items = recent.map(m => {
      const item = {
        role: m.role,
        content: m.content,
        aiReply: m.aiReply || undefined
      }
      // 3.6.1：开场白 / 进入总结的标记必须落盘 —— 丢了的话重启后「只有欢迎语 /
      // 只有总结」的空壳会被当成有内容的会话：列表里堆壳、coldStart 清不掉、
      // 「回去接着聊」跳到一个和大厅长得一模一样的壳上（看着像没跳）
      if (m._isWelcome) item._isWelcome = true
      if (m._isEnterSummary) {
        item._isEnterSummary = true
        if (m._enterSummaryKind) item._enterSummaryKind = m._enterSummaryKind
        if (Array.isArray(m._enterButtons)) item._enterButtons = m._enterButtons
        if (m._enterSummaryDigest) item._enterSummaryDigest = m._enterSummaryDigest
      }
      if (m.execResult) item.execResult = m.execResult
      if (m.execResults) item.execResults = m.execResults
      if (m.actionCard) item.actionCard = m.actionCard
      if (m.image) {
        if (m.image.localPath) {
          item.image = { localPath: m.image.localPath }
        } else {
          item.image = m.image
        }
      }
      return item
    })

    const result = {
      id: conv.id,
      title: conv.title,
      messages: items,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      summary: conv.summary || null,
      summaryIndex: conv.summaryIndex || 0,
      tags: conv.tags || []
    }
    // Agent 绑定同样要落盘，否则重启后「该会话由 X 进行」的提示永远不出现
    if (conv.agentId) {
      result.agentId = conv.agentId
      result.agentName = conv.agentName || ''
    }
    conv._slimCache = result
    return result
  })

  // 容量保护
  const estimatedSize = JSON.stringify(slim).length
  if (isStorageNearQuota(estimatedSize)) {
    logger.warn('[Storage] localStorage 接近配额上限，启动裁剪')
    const sortedIdx = slim
      .map((c, i) => ({ i, updated: c.updatedAt }))
      .sort((a, b) => a.updated - b.updated)

    for (const { i } of sortedIdx) {
      if (!isStorageNearQuota(JSON.stringify(slim).length)) break
      const conv = slim[i]
      if (conv.messages.length > 50) {
        conv.messages = conv.messages.slice(-50)
        logger.info(`[Storage] 裁剪会话「${conv.title}」至 50 条`)
      }
      if (isStorageNearQuota(JSON.stringify(slim).length) && conv.id !== activeConversationId) {
        slim.splice(i, 1)
        conversations.splice(i, 1)
        logger.info(`[Storage] 删除非活跃会话「${conv.title}」释放空间`)
      }
    }
  }

  try {
    asyncSetStorageJSON(CONV_STORAGE_KEY, slim)
    asyncSetStorage('siji_last_chat_time', String(Date.now()))
  } catch (e) {
    try {
      uni.setStorageSync(CONV_STORAGE_KEY, JSON.stringify(slim))
    } catch (e2) {
      logger.error('[Storage] 持久化失败，即使裁剪后仍超限', e2)
      uni.showToast({ title: '存储空间不足，部分历史已丢失', icon: 'none', duration: 3000 })
    }
  }
}

/** 持久化活跃会话 ID */
export function persistActiveId(id) {
  try {
    asyncSetStorage('siji_active_conversation', id)
  } catch (e) { /* ignore */ }
}

export { CONV_STORAGE_KEY }
