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
import { logger } from '@/utils/logger.js'

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
    const map = { chat: '自由对话', diary: '写记录', bill: '记账', plan: '定计划' }
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

  // ==================== 防抖持久化 ====================
  let _persistTimer = null
  let _isDirty = false
  const PERSIST_DEBOUNCE_MS = 500

  /** 防抖持久化 — 流式传输期间不写入，结束后一次性写入 */
  function debouncedPersist() {
    _isDirty = true
    if (_persistTimer) return  // 已有定时器在等待，不重复设置
    _persistTimer = setTimeout(() => {
      _persistTimer = null
      if (_isDirty) {
        _isDirty = false
        persistConversations()
      }
    }, PERSIST_DEBOUNCE_MS)
  }

  /** 立即 flush — 用于 onHide / 页面切换等需要立即写入的场景 */
  function flushPersist() {
    if (_persistTimer) {
      clearTimeout(_persistTimer)
      _persistTimer = null
    }
    if (_isDirty) {
      _isDirty = false
      persistConversations()
    }
  }

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
    persistConversations()  // 删除操作立即写入
    persistActiveId()
    return true
  }

  /** 重命名会话 — 所有对话均可重命名 */
  function renameConversation(id, title) {
    const conv = conversations.value.find(c => c.id === id)
    if (conv) {
      conv.title = title || '未命名对话'
      conv.updatedAt = Date.now()
      conv._slimCache = null // P1-C3: 失效缓存
      debouncedPersist()
    }
    return true
  }

  /** 清空当前会话消息 */
  function clearMessages() {
    const conv = conversations.value.find(c => c.id === activeConversationId.value)
    if (!conv) return
    conv.messages = []
    conv.updatedAt = Date.now()
    conv._slimCache = null // P1-C3: 失效缓存
    persistConversations()  // 清空操作立即写入
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
    conv._slimCache = null // P1-C3: 失效缓存

    debouncedPersist()
  }

  /** 更新当前会话最后一条消息
   * 流式传输期间高频调用（~16ms/次），使用防抖持久化避免性能问题
   * _skipPersist: 内部标记，流式更新时跳过持久化
   */
  function updateLastMessage(partial) {
    const conv = conversations.value.find(c => c.id === activeConversationId.value)
    if (!conv || conv.messages.length === 0) return
    const last = conv.messages[conv.messages.length - 1]
    Object.assign(last, partial)
    conv.updatedAt = Date.now()
    conv._slimCache = null // P1-C3: 失效缓存
    // 防抖写入：流式期间大量调用只触发一次持久化
    debouncedPersist()
  }

  /** 更新会话摘要 */
  function updateConversationSummary(id, summary, index) {
    const conv = conversations.value.find(c => c.id === id)
    if (!conv) return
    conv.summary = summary
    conv.summaryIndex = index
    conv.updatedAt = Date.now()
    conv._slimCache = null // P1-C3: 失效缓存
    debouncedPersist()
  }

  /** 保存对话历史到 Storage（多会话模式 — 持久化整个 conversations 数组） */
  function persistHistory() {
    persistConversations()
  }

  /** 检测 localStorage 剩余可用空间（字节），超限风险时返回 true */
  function isStorageNearQuota(additionalBytes) {
    try {
      const probeKey = '__quota_probe__'
      const before = JSON.stringify(uni.getStorageInfoSync()).length
      // 估算写入大小
      const estimated = additionalBytes || 0
      // H5 localStorage 上限通常 5MB，小程序 10MB
      const limit = typeof window !== 'undefined' ? 5 * 1024 * 1024 : 10 * 1024 * 1024
      const current = before + estimated
      return current > limit * 0.85 // 超过 85% 预警
    } catch {
      return false
    }
  }

  /** 持久化所有会话 */
  function persistConversations() {
    // 精简每个会话的消息（动态截断 20-500 条 / 200000 字符预算）
    const MAX_CHARS = 200000
    const MIN_KEEP = 20
    const MAX_KEEP = 500

    // 预估序列化体积，超限时逐会话裁剪
    // P1-C3: 只裁剪活跃会话，非活跃会话用上次缓存结果
    let slim = conversations.value.map(conv => {
      // 非活跃会话且有缓存 — 直接用上次结果
      if (conv.id !== activeConversationId.value && conv._slimCache) {
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
        if (m.execResult) item.execResult = m.execResult
        if (m.execResults) item.execResults = m.execResults
        if (m.actionCard) item.actionCard = m.actionCard
        if (m.image) {
          // 持久化时优先用 localPath，避免 base64 撑爆 storage
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
        summaryIndex: conv.summaryIndex || 0
      }
      // P1-C3: 缓存裁剪结果，非活跃会话下次直接用
      conv._slimCache = result
      return result
    })

    // 容量保护：预估序列化体积，超 85% 配额时逐会话裁剪
    const estimatedSize = JSON.stringify(slim).length
    if (isStorageNearQuota(estimatedSize)) {
      logger.warn('[Storage] localStorage 接近配额上限，启动裁剪')
      // 按 updatedAt 升序排列，最老的会话先裁剪
      const sortedIdx = slim
        .map((c, i) => ({ i, updated: c.updatedAt }))
        .sort((a, b) => a.updated - b.updated)

      for (const { i } of sortedIdx) {
        if (!isStorageNearQuota(JSON.stringify(slim).length)) break
        const conv = slim[i]
        // 保留最近 50 条消息，其余丢弃
        if (conv.messages.length > 50) {
          conv.messages = conv.messages.slice(-50)
          logger.info(`[Storage] 裁剪会话「${conv.title}」至 50 条`)
        }
        // 如果裁剪后仍超限且非活跃会话，直接删除
        if (isStorageNearQuota(JSON.stringify(slim).length) && conv.id !== activeConversationId.value) {
          slim.splice(i, 1)
          conversations.value.splice(i, 1)
          logger.info(`[Storage] 删除非活跃会话「${conv.title}」释放空间`)
        }
      }
    }

    try {
      asyncSetStorageJSON(CONV_STORAGE_KEY, slim)
      asyncSetStorage('siji_last_chat_time', String(Date.now()))
    } catch (e) {
      // 异步写入失败时同步重试（降级）
      try {
        uni.setStorageSync(CONV_STORAGE_KEY, JSON.stringify(slim))
      } catch (e2) {
        logger.error('[Storage] 持久化失败，即使裁剪后仍超限', e2)
        uni.showToast({ title: '存储空间不足，部分历史已丢失', icon: 'none', duration: 3000 })
      }
    }
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
          try { uni.removeStorageSync('siji_chat_history') } catch (e) { logger?.warn('清除聊天记录失败', e) }
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
    flushPersist,
  }
})
