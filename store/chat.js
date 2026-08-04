/**
 * 对话 Store — 管理多会话聊天、模式切换、流式状态
 *
 * 拆分为子模块：
 * - chat/persist.js  — 防抖持久化 + 裁剪 + 容量保护
 * - chat/restore.js  — 历史恢复 + 旧格式兼容
 *
 * 本文件：state + getters + 会话 CRUD + 消息操作
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { generateConversationId } from '@/utils/uuid.js'
import { logger } from '@/utils/logger.js'
import { debouncedPersist, flushPersist, persistConversations as _persist, persistActiveId } from './chat/persist.js'
import { restoreHistory as _restoreHistory } from './chat/restore.js'

export const useChatStore = defineStore('chat', () => {
  // ==================== State ====================
  const currentMode = ref('chat')
  const isStreaming = ref(false)
  const conversations = ref([])
  const activeConversationId = ref('')

  // ==================== Getters ====================
  const modeLabel = computed(() => {
    const map = { chat: '自由对话', diary: '写记录', bill: '记账', plan: '定计划' }
    return map[currentMode.value] || '自由对话'
  })

  const messages = computed(() => {
    const conv = conversations.value.find(c => c.id === activeConversationId.value)
    return conv ? conv.messages : []
  })

  const conversationId = computed(() => activeConversationId.value)

  const activeConversation = computed(() => {
    return conversations.value.find(c => c.id === activeConversationId.value) || null
  })

  const conversationCount = computed(() => conversations.value.length)

  // ==================== 持久化桥接 ====================
  function doPersist() {
    _persist(conversations.value, activeConversationId.value)
  }

  function debouncedPersistConversations() {
    debouncedPersist(doPersist)
  }

  // ==================== 会话 CRUD ====================

  function createConversation(customTitle) {
    const count = conversations.value.length
    const conv = {
      id: generateConversationId(),
      title: customTitle || (count === 0 ? '对话' : `新对话${count + 1}`),
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      summary: null,
      summaryIndex: 0
    }
    conversations.value = [...conversations.value, conv]
    activeConversationId.value = conv.id
    doPersist()
    persistActiveId(conv.id)
    return conv
  }

  function switchConversation(id) {
    if (conversations.value.find(c => c.id === id)) {
      activeConversationId.value = id
      persistActiveId(id)
    }
  }

  function deleteConversation(id) {
    const idx = conversations.value.findIndex(c => c.id === id)
    if (idx < 0) return false
    conversations.value.splice(idx, 1)
    if (activeConversationId.value === id) {
      activeConversationId.value = conversations.value.length > 0
        ? conversations.value[conversations.value.length - 1].id : ''
    }
    doPersist()
    persistActiveId(activeConversationId.value)
    return true
  }

  function renameConversation(id, title) {
    const conv = conversations.value.find(c => c.id === id)
    if (conv) {
      conv.title = title || '未命名对话'
      conv.updatedAt = Date.now()
      conv._slimCache = null
      debouncedPersistConversations()
    }
    return true
  }

  function clearMessages() {
    const conv = conversations.value.find(c => c.id === activeConversationId.value)
    if (!conv) return
    conv.messages = []
    conv.updatedAt = Date.now()
    conv._slimCache = null
    doPersist()
  }

  // ==================== 消息操作 ====================

  function addMessage(message) {
    const conv = conversations.value.find(c => c.id === activeConversationId.value)
    if (!conv) return
    conv.messages.push({ ...message, time: formatTime(new Date()) })
    conv.updatedAt = Date.now()
    conv._slimCache = null
    debouncedPersistConversations()
  }

  function updateLastMessage(partial) {
    const conv = conversations.value.find(c => c.id === activeConversationId.value)
    if (!conv || conv.messages.length === 0) return
    Object.assign(conv.messages[conv.messages.length - 1], partial)
    conv.updatedAt = Date.now()
    conv._slimCache = null
    debouncedPersistConversations()
  }

  function updateConversationSummary(id, summary, index) {
    const conv = conversations.value.find(c => c.id === id)
    if (!conv) return
    conv.summary = summary
    conv.summaryIndex = index
    conv.updatedAt = Date.now()
    conv._slimCache = null
    debouncedPersistConversations()
  }

  // ==================== 模式/持久化 ====================

  function setCurrentMode(mode) { currentMode.value = mode }
  function setConversationId(_id) { /* 兼容保留 */ }

  function persistHistory() { doPersist() }

  function restoreHistory() {
    const { conversations: list, activeId } = _restoreHistory()
    conversations.value = list
    activeConversationId.value = activeId
  }

  function flushHistory() { flushPersist(doPersist) }

  // ==================== 内部 ====================

  function formatTime(date) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
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
    persistHistory, restoreHistory,
    flushPersist: flushHistory,
  }
})
