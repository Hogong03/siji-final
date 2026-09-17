/**
 * useChatSession — 冷启动新对话 + 新对话空态入口（3.5.16）
 *
 * 语义：
 *   - 冷启动（进程第一次进入对话页）→ 停在一条新对话上，欢迎语待发
 *   - 回前台 / 切 Tab → 保持当前对话，不打断打字
 *   - 新对话空态 → 给出「回去接着聊（最近一条）」与「选择历史对话」两个入口，可关
 *
 * 3.5.19：有进入总结时，开场白换成总结消息（伪对话），欢迎语不再重复发；
 * 3.5.20：总结落消息前先丢掉已写下的欢迎语（覆盖，不是追加）。
 * 3.5.21：总结消息带预置按钮；点「回去接着聊」时销毁这条伪对话（没真聊过的不留壳）。
 * 总结消息自带「返回旧对话」，空态入口卡此时自动让位（见 chat-session 的 shouldOfferResume）。
 */
import { ref, computed, watch } from 'vue'
import {
  consumeColdStart,
  isEmptyConversation,
  pickResumeConversation,
  shouldOfferResume,
  formatConversationAge
} from '@/utils/chat-session.js'
import { buildEnterSummaryMessage, buildWelcomeMessage } from '@/utils/enter-dialogue.js'

export function useChatSession(store, getWelcomeMessage) {
  const dismissed = ref(false)

  // 目标：排除当前会话、跳过空壳（含落盘丢标记后按「没用户消息」兜底认出来的壳）、取最近更新
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

  /**
   * 把进入总结写成 AI 消息落进当前对话（3.5.19）
   * @param {Object} summary useEnterSummary 的 pending 值
   * @returns {boolean} 是否写入（无内容返回 false，调用方回落欢迎语）
   */
  function appendEnterSummary(summary) {
    const message = buildEnterSummaryMessage(summary)
    if (!message) return false
    // 直接覆盖开场白：欢迎语是占位，总结进来就该顶掉它，不叠在下面（3.5.20）
    store.dropWelcomeMessages()
    store.addMessage(message)
    return true
  }

  /**
   * 回到最近一条有内容的对话；成功返回 true
   * 3.5.21：回去＝离开这条伪对话，只带总结 / 欢迎语、没真聊过的当前对话直接销毁，
   * 不在列表里留一条「只有开场白」的壳（用户点了回去，就不会再想回来）
   * 3.6.1：返回值改成 switchConversation 的真实结果 —— 切不过去时返回 false，
   * 调用方不再拿着一个「以为切了」的 true 去滚屏
   */
  function resumeBack() {
    const conv = resumeTarget.value
    if (!conv) return false
    const current = store.activeConversation
    if (current && current.id !== conv.id && isEmptyConversation(current)) {
      store.deleteConversation(current.id)
    }
    return store.switchConversation(conv.id) === true
  }

  /**
   * 冷启动：清掉历史空壳 → 当前会话有内容就新开一条 → 补欢迎语
   * @param {Object} [opts]
   * @param {boolean} [opts.pendingSimulation] 有模拟演练待进入时不换会话
   * @param {Object} [opts.enterSummary] 待展示的进入总结（有则代替欢迎语落成对话消息）
   * @returns {boolean} 是否执行了冷启动换新
   */
  function maybeStartFreshSession({ pendingSimulation = false, enterSummary = null } = {}) {
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
      if (!appendEnterSummary(enterSummary)) {
        store.addMessage(buildWelcomeMessage(getWelcomeMessage()))
      }
    }
    return true
  }

  return {
    resumeTarget, resumeVisible, resumeAge, resumeCount, dismissResume, resumeBack,
    appendEnterSummary, maybeStartFreshSession
  }
}
