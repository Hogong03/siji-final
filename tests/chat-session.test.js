/**
 * chat-session 测试（3.5.16：每次进来都是新对话）
 *
 * 覆盖：空会话判定、回去接着聊的候选挑选、入口卡的显示条件、时间说法、
 * 冷启动标志只消费一次、store.pruneEmptyConversations 不误删。
 * 3.5.19：进入总结落成对话消息；3.5.20：总结覆盖开场白而不是追加。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { effectScope } from 'vue'
import { resetStorage } from './setup.js'
import { useChatSession } from '../composables/useChatSession.js'
import {
  isEmptyConversation,
  hasEnterSummaryMessage,
  pickResumeConversation,
  shouldOfferResume,
  formatConversationAge,
  consumeColdStart,
  resetColdStart
} from '../utils/chat-session.js'
import { useChatStore } from '../store/chat.js'

const NOW = new Date(2026, 8, 15, 15, 30, 0).getTime()
const DAY = 24 * 60 * 60 * 1000

function mkConv(id, over) {
  return Object.assign({
    id: id,
    title: id,
    messages: [{ role: 'user', content: 'hi' }],
    createdAt: NOW - DAY,
    updatedAt: NOW - DAY
  }, over)
}

const WELCOME = { role: 'assistant', content: '你好', _isWelcome: true }

describe('isEmptyConversation：空会话判定', () => {
  it('null / 没有消息 / 只有欢迎语都算空', () => {
    expect(isEmptyConversation(null)).toBe(true)
    expect(isEmptyConversation({ id: 'a' })).toBe(true)
    expect(isEmptyConversation({ id: 'a', messages: [] })).toBe(true)
    expect(isEmptyConversation({ id: 'a', messages: [WELCOME] })).toBe(true)
    expect(isEmptyConversation({ id: 'a', messages: [WELCOME, WELCOME] })).toBe(true)
  })

  it('有用户消息就不空', () => {
    expect(isEmptyConversation(mkConv('a'))).toBe(false)
  })

  it('有摘要的会话不算空（消息可能被裁剪）', () => {
    expect(isEmptyConversation({ id: 'a', messages: [], summary: '聊了工作' })).toBe(false)
  })
})

describe('pickResumeConversation：挑「回去接着聊」的那条', () => {
  it('排除当前会话', () => {
    const list = [mkConv('a', { updatedAt: NOW - DAY }), mkConv('b', { updatedAt: NOW - 2 * DAY })]
    expect(pickResumeConversation(list, 'a').id).toBe('b')
  })

  it('取最近更新的那条', () => {
    const list = [
      mkConv('a', { updatedAt: NOW - 5 * DAY }),
      mkConv('b', { updatedAt: NOW - 1 * DAY }),
      mkConv('c', { updatedAt: NOW - 3 * DAY })
    ]
    expect(pickResumeConversation(list, '').id).toBe('b')
  })

  it('跳过空会话', () => {
    const list = [
      mkConv('empty', { messages: [WELCOME], updatedAt: NOW }),
      mkConv('full', { updatedAt: NOW - 2 * DAY })
    ]
    expect(pickResumeConversation(list, '').id).toBe('full')
  })

  it('没有候选返回 null（含非数组输入）', () => {
    expect(pickResumeConversation([], 'a')).toBe(null)
    expect(pickResumeConversation([mkConv('a')], 'a')).toBe(null)
    expect(pickResumeConversation(null, 'a')).toBe(null)
  })

  it('updatedAt 缺失时回落 createdAt', () => {
    const list = [
      mkConv('old', { updatedAt: 0, createdAt: NOW - 9 * DAY }),
      mkConv('new', { updatedAt: 0, createdAt: NOW - 2 * DAY })
    ]
    expect(pickResumeConversation(list, '').id).toBe('new')
  })
})

describe('shouldOfferResume：入口卡显示条件', () => {
  const list = [mkConv('a'), mkConv('b', { messages: [] })]

  it('当前是空会话且有候选 → 显示', () => {
    expect(shouldOfferResume({ conversations: list, activeId: 'b' })).toBe(true)
  })

  it('当前会话有内容 → 不显示', () => {
    expect(shouldOfferResume({ conversations: list, activeId: 'a' })).toBe(false)
  })

  it('被关掉后不再显示', () => {
    expect(shouldOfferResume({ conversations: list, activeId: 'b', dismissed: true })).toBe(false)
  })

  it('除当前会话外没有别的对话 → 不显示', () => {
    expect(shouldOfferResume({ conversations: [mkConv('only')], activeId: 'only' })).toBe(false)
  })

  it('activeId 指向不存在的会话（数据损坏）时照样给入口', () => {
    expect(shouldOfferResume({ conversations: [mkConv('only')], activeId: 'ghost' })).toBe(true)
  })
})

describe('formatConversationAge：时间说法', () => {
  it('一小时内的说法', () => {
    expect(formatConversationAge(NOW - 30 * 1000, NOW)).toBe('刚刚')
    expect(formatConversationAge(NOW - 20 * 60 * 1000, NOW)).toBe('20 分钟前')
  })

  it('今天 / 昨天 / 前天带时刻', () => {
    expect(formatConversationAge(new Date(2026, 8, 15, 9, 5).getTime(), NOW)).toBe('今天 09:05')
    expect(formatConversationAge(new Date(2026, 8, 14, 21, 40).getTime(), NOW)).toBe('昨天 21:40')
    expect(formatConversationAge(new Date(2026, 8, 13, 8, 0).getTime(), NOW)).toBe('2 天前')
  })

  it('更早只给日期', () => {
    expect(formatConversationAge(new Date(2026, 7, 30, 8, 0).getTime(), NOW)).toBe('8月30日')
  })

  it('非法输入返回空串，时钟回拨不报负数', () => {
    expect(formatConversationAge(0, NOW)).toBe('')
    expect(formatConversationAge(null, NOW)).toBe('')
    expect(formatConversationAge('abc', NOW)).toBe('')
    expect(formatConversationAge(NOW + 5000, NOW)).toBe('刚刚')
  })
})

describe('consumeColdStart：进程内只真一次', () => {
  it('第一次 true，之后 false，复位后又能 true', () => {
    resetColdStart()
    expect(consumeColdStart()).toBe(true)
    expect(consumeColdStart()).toBe(false)
    resetColdStart()
    expect(consumeColdStart()).toBe(true)
  })
})

describe('useChatSession：冷启动编排', () => {
  let store
  let scope
  beforeEach(() => {
    resetStorage()
    setActivePinia(createPinia())
    store = useChatStore()
    resetColdStart()
    scope = effectScope()
  })

  function session() {
    return scope.run(() => useChatSession(store, () => '你好，我是思迹。'))
  }

  it('当前会话有内容 → 新开一条空对话并补欢迎语，同时给出回到上次的入口', () => {
    const old = store.createConversation()
    store.addMessage({ role: 'user', content: '在吗' })
    const s = session()
    expect(s.maybeStartFreshSession()).toBe(true)
    expect(store.activeConversationId).not.toBe(old.id)
    expect(store.messages.length).toBe(1)
    expect(store.messages[0]._isWelcome).toBe(true)
    expect(s.resumeVisible.value).toBe(true)
    expect(s.resumeTarget.value.id).toBe(old.id)
  })

  it('当前已经是空对话 → 不重复新建，只补欢迎语', () => {
    store.createConversation()
    const before = store.conversations.length
    const s = session()
    s.maybeStartFreshSession()
    expect(store.conversations.length).toBe(before)
    expect(store.messages[0]._isWelcome).toBe(true)
  })

  it('冷启动只生效一次（切 Tab 回来不换会话）', () => {
    store.createConversation()
    store.addMessage({ role: 'user', content: '在吗' })
    const s = session()
    s.maybeStartFreshSession()
    const freshId = store.activeConversationId
    store.addMessage({ role: 'user', content: '第二轮' })
    expect(s.maybeStartFreshSession()).toBe(false)
    expect(store.activeConversationId).toBe(freshId)
  })

  it('有待进入的模拟演练时不换会话', () => {
    const old = store.createConversation()
    store.addMessage({ role: 'user', content: '在吗' })
    const s = session()
    expect(s.maybeStartFreshSession({ pendingSimulation: true })).toBe(false)
    expect(store.activeConversationId).toBe(old.id)
  })

  it('冷启动顺手清掉历史空壳，只留新对话', () => {
    const old = store.createConversation()
    store.addMessage({ role: 'user', content: '在吗' })
    store.createConversation()
    store.createConversation()
    const s = session()
    s.maybeStartFreshSession()
    expect(store.conversations.length).toBe(2)
    expect(store.conversations.map(c => c.id)).toContain(old.id)
  })

  it('关掉入口后不再显示，回到上次会切走', () => {
    const old = store.createConversation()
    store.addMessage({ role: 'user', content: '在吗' })
    const s = session()
    s.maybeStartFreshSession()
    expect(s.resumeVisible.value).toBe(true)
    s.dismissResume()
    expect(s.resumeVisible.value).toBe(false)
    expect(s.resumeBack()).toBe(true)
    expect(store.activeConversationId).toBe(old.id)
  })

  it('没有可回去的对话时入口不出现，resumeBack 返回 false', () => {
    store.createConversation()
    const s = session()
    s.maybeStartFreshSession()
    expect(s.resumeVisible.value).toBe(false)
    expect(s.resumeBack()).toBe(false)
  })
})

describe('store.pruneEmptyConversations：不留空壳', () => {
  let store
  beforeEach(() => {
    resetStorage()
    setActivePinia(createPinia())
    store = useChatStore()
  })

  it('删掉空会话，保留有内容的与 keepId', () => {
    store.createConversation()
    const emptyId = store.activeConversationId
    const kept = store.createConversation()
    store.addMessage({ role: 'user', content: '在吗' })
    store.createConversation()
    const removed = store.pruneEmptyConversations(kept.id)
    expect(removed).toBeGreaterThanOrEqual(1)
    const ids = store.conversations.map(c => c.id)
    expect(ids).toContain(kept.id)
    expect(ids).not.toContain(emptyId)
  })

  it('没有空会话时不动列表，返回 0', () => {
    const conv = store.createConversation()
    store.addMessage({ role: 'user', content: '在吗' })
    expect(store.pruneEmptyConversations(conv.id)).toBe(0)
    expect(store.conversations.length).toBe(1)
  })

  it('清理掉当前活跃的空会话时，活跃指针落到剩下的会话上', () => {
    const first = store.createConversation()
    store.addMessage({ role: 'user', content: '在吗' })
    store.createConversation()
    store.pruneEmptyConversations()
    expect(store.activeConversationId).toBe(first.id)
    expect(store.activeConversation).toBeTruthy()
  })
})

/* ==================== 3.5.19：进入总结落成对话消息 ==================== */

const SUMMARY_MSG = { role: 'assistant', content: '下午好。这是上次小结以来的进展：', _isEnterSummary: true }

/** 造一条有内容的进入总结（够写出一条消息） */
function summaryData(over) {
  return Object.assign({
    source: 'cold',
    awayMs: 8 * 60 * 60 * 1000,
    eventsTotal: 1,
    diaryCount: 2,
    streak: 3,
    events: [{ kind: 'checkin', at: NOW - 60 * 1000, title: '六级备考', note: '' }],
    moodDip: false,
    weekBill: null
  }, over)
}

describe('进入总结消息：空会话判定与入口让位（3.5.19）', () => {
  it('只有进入总结消息也算空会话（不在会话列表里堆壳）', () => {
    expect(isEmptyConversation({ id: 'a', messages: [SUMMARY_MSG] })).toBe(true)
    expect(isEmptyConversation({ id: 'a', messages: [WELCOME, SUMMARY_MSG] })).toBe(true)
  })

  it('说过话就不算空', () => {
    expect(isEmptyConversation({ id: 'a', messages: [SUMMARY_MSG, { role: 'user', content: '在吗' }] })).toBe(false)
  })

  it('hasEnterSummaryMessage 认标记', () => {
    expect(hasEnterSummaryMessage({ messages: [WELCOME] })).toBe(false)
    expect(hasEnterSummaryMessage({ messages: [SUMMARY_MSG] })).toBe(true)
    expect(hasEnterSummaryMessage(null)).toBe(false)
    expect(hasEnterSummaryMessage({})).toBe(false)
  })

  it('当前对话自带「返回旧对话」时，空态入口卡让位；显式关掉该行为仍可显示', () => {
    const list = [mkConv('old'), { id: 'new', messages: [SUMMARY_MSG] }]
    expect(shouldOfferResume({ conversations: list, activeId: 'new' })).toBe(false)
    expect(shouldOfferResume({ conversations: list, activeId: 'new', hideWhenEnterSummary: false })).toBe(true)
  })

  it('没有总结消息时入口卡照旧显示', () => {
    const list = [mkConv('old'), { id: 'new', messages: [WELCOME] }]
    expect(shouldOfferResume({ conversations: list, activeId: 'new' })).toBe(true)
  })
})

describe('useChatSession：开场白换成总结消息（3.5.19）', () => {
  let store
  let scope
  beforeEach(() => {
    resetStorage()
    setActivePinia(createPinia())
    store = useChatStore()
    resetColdStart()
    scope = effectScope()
  })

  function session() {
    return scope.run(() => useChatSession(store, () => '你好，我是思迹。'))
  }

  it('有总结：开场白是总结消息，欢迎语不再发', () => {
    store.createConversation()
    store.addMessage({ role: 'user', content: '在吗' })
    const s = session()
    s.maybeStartFreshSession({ enterSummary: summaryData() })
    expect(store.messages).toHaveLength(1)
    expect(store.messages[0]._isEnterSummary).toBe(true)
    expect(store.messages[0]._isWelcome).toBeUndefined()
    expect(store.messages[0].content).toContain('六级备考')
  })

  it('没有总结：照旧发欢迎语', () => {
    store.createConversation()
    const s = session()
    s.maybeStartFreshSession()
    expect(store.messages[0]._isWelcome).toBe(true)
  })

  it('appendEnterSummary：有内容写入并返回 true，空内容不写', () => {
    store.createConversation()
    const s = session()
    expect(s.appendEnterSummary(summaryData())).toBe(true)
    expect(store.messages).toHaveLength(1)
    expect(s.appendEnterSummary({ events: [], eventsTotal: 0, diaryCount: 0 })).toBe(false)
    expect(s.appendEnterSummary(null)).toBe(false)
    expect(store.messages).toHaveLength(1)
  })

  /* ---- 3.5.20：总结直接覆盖开场白，不叠在欢迎语下面 ---- */

  it('欢迎语已在场上时，总结顶掉它而不是叠在下面', () => {
    store.createConversation()
    const s = session()
    store.addMessage({ role: 'assistant', content: '你好，我是思迹。', _isWelcome: true })
    expect(s.appendEnterSummary(summaryData())).toBe(true)
    expect(store.messages).toHaveLength(1)
    expect(store.messages[0]._isEnterSummary).toBe(true)
    expect(store.messages[0]._isWelcome).toBeUndefined()
  })

  it('覆盖开场白不动真实对话', () => {
    store.createConversation()
    const s = session()
    store.addMessage({ role: 'assistant', content: '你好，我是思迹。', _isWelcome: true })
    store.addMessage({ role: 'user', content: '在吗' })
    expect(s.appendEnterSummary(summaryData())).toBe(true)
    expect(store.messages).toHaveLength(2)
    expect(store.messages[0].content).toBe('在吗')
    expect(store.messages[1]._isEnterSummary).toBe(true)
  })

  it('store.dropWelcomeMessages：只清欢迎语并返回条数，没有则返回 0', () => {
    store.createConversation()
    const s = session()
    expect(store.dropWelcomeMessages()).toBe(0)
    s.appendEnterSummary(summaryData())
    expect(store.dropWelcomeMessages()).toBe(0)
    store.addMessage({ role: 'assistant', content: '你好', _isWelcome: true })
    store.addMessage({ role: 'assistant', content: '你好', _isWelcome: true })
    expect(store.dropWelcomeMessages()).toBe(2)
    expect(store.messages).toHaveLength(1)
    expect(store.messages[0]._isEnterSummary).toBe(true)
  })

  it('只带总结的会话仍是空壳，冷启动清理时会被清掉', () => {
    const s = session()
    s.maybeStartFreshSession({ enterSummary: summaryData() })
    expect(store.messages[0]._isEnterSummary).toBe(true)
    // 下一次冷启动第一件事就是清空壳：只说过总结、没真聊过的对话不留
    const removed = store.pruneEmptyConversations()
    expect(removed).toBe(1)
    expect(store.conversations).toHaveLength(0)
  })

  it('总结消息落进对话后，回来接着聊仍指向有真实对话的那条', () => {
    const old = store.createConversation()
    store.addMessage({ role: 'user', content: '在吗' })
    const s = session()
    s.maybeStartFreshSession({ enterSummary: summaryData() })
    expect(s.resumeTarget.value.id).toBe(old.id)
    expect(s.resumeVisible.value).toBe(false)
  })
})

/* ==================== 3.5.21：回去接着聊时销毁这条伪对话 ==================== */

describe('useChatSession：回去接着聊销毁伪对话（3.5.21）', () => {
  let store
  let scope
  beforeEach(() => {
    resetStorage()
    setActivePinia(createPinia())
    store = useChatStore()
    resetColdStart()
    scope = effectScope()
  })

  function session() {
    return scope.run(() => useChatSession(store, () => '你好，我是思迹。'))
  }

  it('只有一条总结消息的当前对话，点回去就被销毁', () => {
    const old = store.createConversation()
    store.addMessage({ role: 'user', content: '在吗' })
    const s = session()
    s.maybeStartFreshSession({ enterSummary: summaryData() })
    const shellId = store.activeConversationId
    expect(shellId).not.toBe(old.id)
    expect(s.resumeBack()).toBe(true)
    expect(store.activeConversationId).toBe(old.id)
    expect(store.conversations.map(c => c.id)).toEqual([old.id])
    expect(store.conversations.some(c => c.id === shellId)).toBe(false)
  })

  it('只有欢迎语的壳同样销毁', () => {
    const old = store.createConversation()
    store.addMessage({ role: 'user', content: '在吗' })
    const s = session()
    s.maybeStartFreshSession()
    expect(store.messages[0]._isWelcome).toBe(true)
    s.resumeBack()
    expect(store.conversations.map(c => c.id)).toEqual([old.id])
  })

  it('已经真聊过的当前对话不销毁，只切过去', () => {
    const old = store.createConversation()
    store.addMessage({ role: 'user', content: '在吗' })
    const s = session()
    s.maybeStartFreshSession({ enterSummary: summaryData() })
    const fresh = store.activeConversationId
    store.addMessage({ role: 'user', content: '今天想聊聊' })
    expect(s.resumeBack()).toBe(true)
    expect(store.activeConversationId).toBe(old.id)
    expect(store.conversations.map(c => c.id)).toContain(fresh)
    expect(store.conversations).toHaveLength(2)
  })

  it('没有可回去的对话时不销毁也不切换', () => {
    const only = store.createConversation()
    store.addMessage({ role: 'user', content: '在吗' })
    const s = session()
    expect(s.resumeTarget.value).toBeNull()
    expect(s.resumeBack()).toBe(false)
    expect(store.activeConversationId).toBe(only.id)
    expect(store.conversations).toHaveLength(1)
  })
})
