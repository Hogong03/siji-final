/**
 * useChatSession — 冷启动新对话 + 新对话空态入口（3.5.16）
 *
 * 语义：
 *   - 冷启动（进程第一次进入对话页）→ 停在一条新对话上，欢迎语待发
 *   - 回前台 / 切 Tab → 保持当前对话，不打断打字
 *   - 新对话空态 → 给出「回去接着聊（最近一条）」与「选择历史对话」两个入口，可关
 */
import { ref, computed, watch } from 'vue'
import {
  consumeColdStart,
  isEmptyConversation,
  pickResumeConversation,
  shouldOfferResume,
  formatConversationAge
} from '@/utils/chat-session.js'

export function useChatSession(store, getWelcomeMessage) {
  const dismissed = ref(false)

  const resumeTarget = computed(() => pickResumeConversation(store.conversations, store.activeConversationId))
  const resumeVisible = computed(() => shouldOfferResume({
    conversations: store.conversations,
    activeId: store.activeConversationId,
    dismissed: dismissed.value
  }))
  const resumeAge = computed(() => {
    const conv = resumeTarget.value
    return conv ? formatConversationAge(conv.updatedAt || conv.createdAt || 0, Date.now()) : ''
  })
  const resumeCount = computed(() => {
    const conv = resumeTarget.value
    return (conv && Array.isArray(conv.messages)) ? conv.messages.length : 0
  })

  // 换会话后重新给一次入口（每个新对话各自可关）
  watch(() => store.activeConversationId, () => { dismissed.value = false })

  function dismissResume() {
    dismissed.value = true
  }

  /** 回到最近一条有内容的对话；成功返回 true */
  function resumeBack() {
    const conv = resumeTarget.value
    if (!conv) return false
    store.switchConversation(conv.id)
    return true
  }

  /**
   * 冷启动：清掉历史空壳 → 当前会话有内容就新开一条 → 补欢迎语
   * @param {Object} [opts]
   * @param {boolean} [opts.pendingSimulation] 有模拟演练待进入时不换会话
   * @returns {boolean} 是否执行了冷启动换新
   */
  function maybeStartFreshSession({ pendingSimulation = false } = {}) {
    if (pendingSimulation) return false
    if (!consumeColdStart()) return false
    store.pruneEmptyConversations()
    const active = store.activeConversation
    if (!active) {
      store.createConversation()
    } else if (!isEmptyConversation(active)) {
      store.createConversation()
    }
    const conv = store.activeConversation
    if (conv && isEmptyConversation(conv)) {
      store.addMessage({ role: 'assistant', content: getWelcomeMessage(), _isWelcome: true })
    }
    return true
  }

  return { resumeTarget, resumeVisible, resumeAge, resumeCount, dismissResume, resumeBack, maybeStartFreshSession }
}
