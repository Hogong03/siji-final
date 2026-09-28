/**
 * 会话落盘保真度（3.6.1）
 *
 * 复现并锁定：store/chat/persist.js 白名单漏掉消息上的语义标记，导致
 * 「只有欢迎语 / 只有进入总结」的空壳重启后被当成有内容的会话 ——
 * 会话列表里多出假会话、「回去接着聊」跳到壳上（屏幕上还是那句一模一样的开场白，看着像没跳）。
 * 另含跳转本身的两条：switchConversation 的真实返回值、目标切不过去时不谎报成功。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { effectScope } from 'vue'
import { resetStorage } from './setup.js'
import { useChatStore } from '../store/chat.js'
import { persistConversations, persistActiveId } from '../store/chat/persist.js'
import { isEmptyConversation, resetColdStart } from '../utils/chat-session.js'
import { useChatSession } from '../composables/useChatSession.js'
import { buildEnterSummaryMessage } from '../utils/enter-dialogue.js'

const NOW = new Date(2026, 8, 15, 15, 30, 0).getTime()

function stored() {
  return JSON.parse(uni.getStorageSync('siji_conversations') || '[]')
}

function summaryData() {
  return {
    source: 'cold',
    awayMs: 0,
    events: [],
    eventsTotal: 0,
    diaryCount: 2,
    streak: 0,
    moodDip: false,
    weekBill: null
  }
}

describe('会话落盘：语义标记不能丢（3.6.1）', () => {
  let store

  beforeEach(() => {
    resetStorage()
    setActivePinia(createPinia())
    store = useChatStore()
  })

  it('欢迎语标记 _isWelcome 跟着落盘', () => {
    const conv = store.createConversation()
    store.addMessage({ role: 'assistant', content: '你好，我是思迹。', _isWelcome: true })
    persistConversations(store.conversations, store.activeConversationId)
    const saved = stored().find(c => c.id === conv.id)
    expect(saved.messages[0]._isWelcome).toBe(true)
  })

  it('进入总结的标记与预置按钮跟着落盘', () => {
    const conv = store.createConversation()
    store.addMessage(buildEnterSummaryMessage(summaryData(), NOW))
    persistConversations(store.conversations, store.activeConversationId)
    const saved = stored().find(c => c.id === conv.id)
    expect(saved.messages[0]._isEnterSummary).toBe(true)
    expect(Array.isArray(saved.messages[0]._enterButtons)).toBe(true)
    expect(saved.messages[0]._enterButtons.length).toBeGreaterThan(0)
  })

  it('会话的 Agent 绑定跟着落盘', () => {
    const conv = store.createConversation('聊两句', { agentId: 'siji', agentName: '思迹助手' })
    store.addMessage({ role: 'user', content: '在吗' })
    persistConversations(store.conversations, store.activeConversationId)
    const saved = stored().find(c => c.id === conv.id)
    expect(saved.agentId).toBe('siji')
    expect(saved.agentName).toBe('思迹助手')
  })

  it('重启后冷启动：「回去接着聊」落在真正聊过的那条上，不是只有欢迎语的壳', () => {
    // 上一次运行：老对话聊过真东西，之后冷启动开了一条新壳（只有欢迎语），两者都落了盘
    const old = store.createConversation()
    store.addMessage({ role: 'user', content: '在吗' })
    store.addMessage({ role: 'assistant', content: '在的', aiReply: '在的' })
    old.updatedAt = NOW - 60000
    const shell = store.createConversation()
    store.addMessage({ role: 'assistant', content: '你好，我是思迹。', _isWelcome: true })
    shell.updatedAt = NOW
    persistConversations(store.conversations, store.activeConversationId)
    persistActiveId(shell.id)

    // 重启：新进程重新加载 + 冷启动
    setActivePinia(createPinia())
    resetColdStart()
    const restarted = useChatStore()
    restarted.restoreHistory()
    const restoredShell = restarted.conversations.find(c => c.id === shell.id)
    expect(isEmptyConversation(restoredShell)).toBe(true)
    const scope = effectScope()
    const s = scope.run(() => useChatSession(restarted, () => '你好，我是思迹。'))
    s.maybeStartFreshSession()
    expect(restarted.conversations.some(c => c.id === shell.id)).toBe(false)
    expect(s.resumeTarget.value.id).toBe(old.id)
    expect(s.resumeBack()).toBe(true)
    expect(restarted.activeConversationId).toBe(old.id)
    expect(restarted.messages[0].content).toBe('在吗')
    scope.stop()
  })
})

/* ==================== 回去接着聊：跳转结果要真（3.6.1） ==================== */

describe('回去接着聊：跳转结果', () => {
  it('switchConversation 切到不存在的会话返回 false，且不动活跃指针', () => {
    setActivePinia(createPinia())
    const store = useChatStore()
    const conv = store.createConversation()
    store.addMessage({ role: 'user', content: '在吗' })
    expect(store.switchConversation('不存在的 id')).toBe(false)
    expect(store.activeConversationId).toBe(conv.id)
    expect(store.switchConversation(conv.id)).toBe(true)
  })

  it('目标切不过去时 resumeBack 返回 false，不谎报成功', () => {
    resetStorage()
    const welcome = { role: 'assistant', content: '你好，我是思迹。', _isWelcome: true }
    const shell = { id: 'shell', title: '新对话', messages: [welcome], createdAt: NOW, updatedAt: NOW }
    const old = { id: 'old', title: '上次的对话', messages: [{ role: 'user', content: '在吗' }], createdAt: NOW - 1000, updatedAt: NOW - 1000 }
    const deleted = []
    const fake = {
      conversations: [old, shell],
      activeConversationId: 'shell',
      get activeConversation() { return this.conversations.find(c => c.id === this.activeConversationId) || null },
      switchConversation() { return false },
      deleteConversation(id) { deleted.push(id); return true }
    }
    const scope = effectScope()
    const s = scope.run(() => useChatSession(fake, () => '你好，我是思迹。'))
    expect(s.resumeTarget.value.id).toBe('old')
    expect(s.resumeBack()).toBe(false)
    expect(deleted).toEqual(['shell'])
    scope.stop()
  })
})
