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
import { setConvTags, getConvTags, addConvTag } from '@/utils/conv-tags.js'

export const useChatStore = defineStore('chat', () => {
  // ==================== State ====================
  const currentMode = ref('chat')
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

  // ==================== 标签操作 ====================

  function addTagToConversation(id, tag) {
    const conv = conversations.value.find(c => c.id === id)
    if (!conv) return
    const tags = getConvTags(conv)
    if (!tags.includes(tag)) {
      tags.push(tag)
      setConvTags(conv, tags)
      addConvTag(tag)
      debouncedPersistConversations()
    }
  }

  function removeTagFromConversation(id, tag) {
    const conv = conversations.value.find(c => c.id === id)
    if (!conv) return
    const tags = getConvTags(conv).filter(t => t !== tag)
    setConvTags(conv, tags)
    debouncedPersistConversations()
  }

  function setConversationTags(id, tags) {
    const conv = conversations.value.find(c => c.id === id)
    if (!conv) return
    setConvTags(conv, tags)
    tags.forEach(t => addConvTag(t))
    debouncedPersistConversations()
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
    if (!conv) return null
    const msg = { ...message, time: formatTime(new Date()) }
    conv.messages.push(msg)
    conv.updatedAt = Date.now()
    conv._slimCache = null
    debouncedPersistConversations()
    return msg
  }

  // 流式中间帧的 updatedAt 节流（避免会话列表排序每帧重算）
  let _lastUpdatedTick = 0
  function _touchConversation(conv, now) {
    if (conv.messages.length > 0) {
      const last = conv.messages[conv.messages.length - 1]
      // 流式中间帧：500ms 内只更新一次 updatedAt
      if (last.loading && last.content && now - _lastUpdatedTick < 500) return
    }
    conv.updatedAt = now
    _lastUpdatedTick = now
  }

  function updateLastMessage(partial) {
    const conv = conversations.value.find(c => c.id === activeConversationId.value)
    if (!conv || conv.messages.length === 0) return
    Object.assign(conv.messages[conv.messages.length - 1], partial)
    _touchConversation(conv, Date.now())
    conv._slimCache = null
    debouncedPersistConversations()
  }

  /** 按指定会话更新最后一条消息（流式切会话后回写用） */
  function updateLastMessageFor(convId, partial) {
    const conv = conversations.value.find(c => c.id === convId)
    if (!conv || conv.messages.length === 0) return
    Object.assign(conv.messages[conv.messages.length - 1], partial)
    _touchConversation(conv, Date.now())
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
    currentMode, conversations, activeConversationId,
    // getters
    modeLabel, messages, conversationId, activeConversation, conversationCount,
    // actions
    setCurrentMode, setConversationId,
    createConversation, switchConversation, deleteConversation, renameConversation,
    addMessage, updateLastMessage, updateLastMessageFor, updateConversationSummary, clearMessages,
    addTagToConversation, removeTagFromConversation, setConversationTags,
    persistHistory, restoreHistory,
    flushPersist: flushHistory,
  }
})
