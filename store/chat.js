/**
 * 对话 Store — 管理多会话聊天、模式切换、流式状态
 *
 * 多会话架构（所有对话平等管理）：
 *   conversations: [{ id, title, messages, createdAt, updatedAt }]
 *   activeConversationId: 当前活跃会话 ID
 *   messages: 当前会话的消息列表（computed 从 conversations 派生）
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { generateConversationId } from '@/utils/uuid.js'
import { asyncSetStorage, asyncSetStorageJSON } from '@/utils/store-helpers.js'

const CONV_STORAGE_KEY = 'siji_conversations'
const ACTIVE_CONV_KEY = 'siji_active_conversation'

export const useChatStore = defineStore('chat', () => {
  // ==================== State ====================
  const currentMode = ref('chat')   // chat|diary|bill|plan
  const isStreaming = ref(false)
  const conversations = ref([])
  const activeConversationId = ref('')

  // ==================== Getters ====================
  const modeLabel = computed(() => {
    const map = { chat: '自由对话', diary: '写日记', bill: '记账', plan: '定计划' }
    return map[currentMode.value] || '自由对话'
  })

  /** 当前会话的消息列表 */
  const messages = computed(() => {
    const conv = conversations.value.find(c => c.id === activeConversationId.value)
    return conv ? conv.messages : []
  })

  /** 当前会话 ID */
  const conversationId = computed(() => activeConversationId.value)

  /** 当前活跃会话对象 */
  const activeConversation = computed(() => {
    return conversations.value.find(c => c.id === activeConversationId.value) || null
  })

  /** 会话数量 */
  const conversationCount = computed(() => conversations.value.length)

  // ==================== Actions ====================

  /** 创建新会话 — 可自定义标题，默认 新对话N */
  function createConversation(customTitle) {
    const count = conversations.value.length
    const conv = {
      id: generateConversationId(),
      title: customTitle || (count === 0 ? '对话' : `新对话${count + 1}`),
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      summary: null,      // 对话摘要（压缩早期消息）
      summaryIndex: 0     // 摘要覆盖到第几条消息
    }
    conversations.value = [...conversations.value, conv]
    activeConversationId.value = conv.id
    persistConversations()
    persistActiveId()
    return conv
  }

  /** 切换会话 */
  function switchConversation(id) {
    const conv = conversations.value.find(c => c.id === id)
    if (conv) {
      activeConversationId.value = id
      persistActiveId()
    }
  }

  /** 删除会话 — 所有对话均可删除 */
  function deleteConversation(id) {
    const idx = conversations.value.findIndex(c => c.id === id)
    if (idx < 0) return false
    conversations.value.splice(idx, 1)
    if (activeConversationId.value === id) {
      // 切换到最近的对话，没有则空
      activeConversationId.value = conversations.value.length > 0 ? conversations.value[conversations.value.length - 1].id : ''
    }
    persistConversations()
    persistActiveId()
    return true
  }

  /** 重命名会话 — 所有对话均可重命名 */
  function renameConversation(id, title) {
    const conv = conversations.value.find(c => c.id === id)
    if (conv) {
      conv.title = title || '未命名对话'
      conv.updatedAt = Date.now()
      persistConversations()
    }
    return true
  }

  /** 清空当前会话消息 */
  function clearMessages() {
    const conv = conversations.value.find(c => c.id === activeConversationId.value)
    if (!conv) return
    conv.messages = []
    conv.updatedAt = Date.now()
    persistConversations()
  }

  function setCurrentMode(mode) {
    currentMode.value = mode
  }

  function setConversationId(id) {
    // 多会话模式下不再外部设置 conversationId，保留兼容
  }

  /** 添加消息到当前会话 */
  function addMessage(message) {
    const conv = conversations.value.find(c => c.id === activeConversationId.value)
    if (!conv) return
    const msg = {
      ...message,
      time: formatTime(new Date())
    }
    conv.messages.push(msg)
    conv.updatedAt = Date.now()

    persistConversations()
  }

  /** 更新当前会话最后一条消息 */
  function updateLastMessage(partial) {
    const conv = conversations.value.find(c => c.id === activeConversationId.value)
    if (!conv || conv.messages.length === 0) return
    const last = conv.messages[conv.messages.length - 1]
    Object.assign(last, partial)
    conv.updatedAt = Date.now()
    persistConversations()
  }

  /** 更新会话摘要 */
  function updateConversationSummary(id, summary, index) {
    const conv = conversations.value.find(c => c.id === id)
    if (!conv) return
    conv.summary = summary
    conv.summaryIndex = index
    conv.updatedAt = Date.now()
    persistConversations()
  }

  /** 保存对话历史到 Storage（多会话模式 — 持久化整个 conversations 数组） */
  function persistHistory() {
    persistConversations()
  }

  /** 持久化所有会话 */
  function persistConversations() {
    // 精简每个会话的消息（动态截断 20-500 条 / 200000 字符预算）
    const MAX_CHARS = 200000
    const MIN_KEEP = 20
    const MAX_KEEP = 500

    const slim = conversations.value.map(conv => {
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
        const contentChars = (m.content || '').length + (m.aiReply || '').length
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
        if (m.execResult) item.execResult = m.execResult
        if (m.execResults) item.execResults = m.execResults
        if (m.actionCard) item.actionCard = m.actionCard
        return item
      })

      return {
        id: conv.id,
        title: conv.title,
        messages: items,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        summary: conv.summary || null,
        summaryIndex: conv.summaryIndex || 0
      }
    })

    try {
      asyncSetStorageJSON(CONV_STORAGE_KEY, slim)
      asyncSetStorage('siji_last_chat_time', String(Date.now()))
    } catch (e) { /* ignore */ }
  }

  /** 持久化活跃会话 ID */
  function persistActiveId() {
    try {
      asyncSetStorage(ACTIVE_CONV_KEY, activeConversationId.value)
    } catch (e) { /* ignore */ }
  }

  /** 从 Storage 恢复 */
  function restoreHistory() {
    // 优先尝试新格式（多会话）
    const raw = uni.getStorageSync(CONV_STORAGE_KEY)
    if (raw) {
      try {
        const list = JSON.parse(raw)
        if (Array.isArray(list) && list.length > 0) {
          conversations.value = list
          const savedId = uni.getStorageSync(ACTIVE_CONV_KEY)
          if (savedId && list.find(c => c.id === savedId)) {
            activeConversationId.value = savedId
          } else {
            activeConversationId.value = list[0].id
          }
          return
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
          conversations.value = [conv]
          activeConversationId.value = conv.id
          persistConversations()
          try { uni.removeStorageSync('siji_chat_history') } catch (e) {}
          return
        }
      } catch { /* ignore */ }
    }

    // 无历史数据，不自动创建（由页面决定是否创建）
    conversations.value = []
    activeConversationId.value = ''
  }

  // ==================== 内部 ====================

  function formatTime(date) {
    const h = String(date.getHours()).padStart(2, '0')
    const m = String(date.getMinutes()).padStart(2, '0')
    return `${h}:${m}`
  }

  return {
    // state
    currentMode, isStreaming, conversations, activeConversationId,
    // getters
    modeLabel, messages, conversationId, activeConversation, conversationCount,
    // actions
    setCurrentMode, setConversationId,
    createConversation, switchConversation, deleteConversation, renameConversation,
    addMessage, updateLastMessage, updateConversationSummary, clearMessages,
    persistHistory, persistConversations, restoreHistory,
  }
})
