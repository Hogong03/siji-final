/**
 * test: 4.15 TC-004 回归 —— trimHistory 不得把用户自报信息挤出上下文
 *
 * 真实故障（2026-10-07）：用户说"我叫测试员"，隔 2-3 轮问"我叫什么"答"没告诉过你"。
 * 根因：minKeep=6 且 AI 长回复单条上限 1200 字，带执行卡的长会话 6 条就吃满 6000 预算，
 * 早期用户消息被整体挤出。修复：保底 10 条 + AI 回复历史压到 600 字（用户消息保真）。
 */
import { describe, it, expect } from 'vitest'
import { trimHistory, HISTORY_MAX_CHARS, HISTORY_MIN_KEEP } from '../utils/ai/chat-helpers.js'

/** 造一条带执行卡的长 AI 回复（模拟真实会话里最挤预算的形态） */
function longAiReply(n) {
  return `第${n}轮执行结果。\n` + '已经帮你记好了，内容如下：'.padEnd(40, '详情占位') +
    'x'.repeat(1100)
}

function buildLongConversation(turns = 14) {
  const msgs = []
  for (let i = 1; i <= turns; i++) {
    if (i === 3) {
      msgs.push({ role: 'user', content: '我叫测试员' })
      msgs.push({ role: 'assistant', content: '好的测试员，记住啦' })
    } else {
      msgs.push({ role: 'user', content: `第${i}轮：帮我查一下` })
      msgs.push({ role: 'assistant', content: longAiReply(i) })
    }
  }
  return msgs
}

describe('trimHistory — TC-004 回归（4.15）', () => {
  it('长会话里早期的用户自报信息必须留在窗口内', () => {
    const trimmed = trimHistory(buildLongConversation(14))
    const joined = trimmed.map(m => m.content).join('\n')
    expect(joined).toContain('我叫测试员')
  })

  it('保底条数提升到 10', () => {
    expect(HISTORY_MIN_KEEP).toBeGreaterThanOrEqual(10)
  })

  it('AI 历史回复被压到 600 字内，用户消息保真', () => {
    const msgs = []
    for (let i = 1; i <= 8; i++) {
      msgs.push({ role: 'user', content: `第${i}轮追问` })
      msgs.push({ role: 'assistant', content: 'A'.repeat(1100) })
    }
    const trimmed = trimHistory(msgs)
    const ai = trimmed.filter(m => m.role === 'assistant')
    ai.forEach(m => expect(m.content.length).toBeLessThanOrEqual(600 + '…（内容过长已截断）'.length))
    const user = trimmed.filter(m => m.role === 'user')
    user.forEach(m => expect(m.content).not.toContain('…（内容过长已截断）'))
  })

  it('总预算约束仍然生效（minKeep 之外不无限保留）', () => {
    const msgs = []
    for (let i = 1; i <= 30; i++) {
      msgs.push({ role: 'user', content: `u${i}:` + 'u'.repeat(100) })
      msgs.push({ role: 'assistant', content: 'a'.repeat(500) })
    }
    const trimmed = trimHistory(msgs)
    const total = trimmed.reduce((s, m) => s + m.content.length, 0)
    // 保底 10 条 × (100 + 600) ≈ 7000 上限附近；总长不应失控到全量
    expect(total).toBeLessThan(HISTORY_MAX_CHARS * 2.5)
    expect(trimmed.length).toBeLessThan(msgs.length)
  })
})
