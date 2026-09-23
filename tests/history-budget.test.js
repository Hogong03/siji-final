/**
 * 聊天历史预算（4.4.0）
 *
 * 背景：历史一直按「条数」取最近 20 条。4.3.0 上了长文能力之后，一条 AI 回复可能
 * 两三千字 —— 聊过一篇文章，后面每条消息都要把这篇原文重发一遍，工具循环每轮再发一次。
 * 「AI 响应越来越慢」有很大一块来自这里。
 */
import { describe, it, expect } from 'vitest'
import './setup.js'
import {
  trimHistory,
  HISTORY_MAX_CHARS,
  HISTORY_MAX_PER_MESSAGE,
  HISTORY_MIN_KEEP,
  HISTORY_TRUNCATED_MARK,
  getRecentHistory
} from '../utils/ai/chat-helpers.js'

const msg = (role, content) => ({ role, content })

describe('trimHistory：单条截断', () => {
  it('超长单条被截断并留标记', () => {
    const long = '长'.repeat(HISTORY_MAX_PER_MESSAGE + 500)
    const out = trimHistory([msg('assistant', long)], { minKeep: 0 })
    expect(out[0].content.length).toBe(HISTORY_MAX_PER_MESSAGE + HISTORY_TRUNCATED_MARK.length)
    expect(out[0].content.endsWith(HISTORY_TRUNCATED_MARK)).toBe(true)
  })

  it('没超长的不动', () => {
    const out = trimHistory([msg('user', '今天跑了 5 公里')], { minKeep: 0 })
    expect(out[0].content).toBe('今天跑了 5 公里')
  })
})

describe('trimHistory：总量预算', () => {
  it('超预算时丢掉更早的，保留最近若干条', () => {
    const history = Array.from({ length: 30 }, (_, i) => msg('user', `第${i}条`.padEnd(400, 'x')))
    const out = trimHistory(history)
    const total = out.reduce((n, m) => n + m.content.length, 0)
    expect(out.length).toBeLessThan(history.length)
    // 最后一条一定在（不能把最新的丢了）
    expect(out[out.length - 1].content.startsWith('第29条')).toBe(true)
    expect(total).toBeLessThanOrEqual(HISTORY_MAX_CHARS + 400)
  })

  it('保底条数：即使超预算也要留住最近 6 条', () => {
    const huge = 'x'.repeat(HISTORY_MAX_PER_MESSAGE)
    const history = Array.from({ length: 10 }, () => msg('user', huge))
    const out = trimHistory(history)
    expect(out.length).toBeGreaterThanOrEqual(HISTORY_MIN_KEEP)
    expect(out.length).toBeLessThan(history.length)
  })

  it('短历史原样返回', () => {
    const history = [msg('user', '你好'), msg('assistant', '你好呀')]
    expect(trimHistory(history)).toEqual(history)
  })

  it('空输入与脏输入不炸', () => {
    expect(trimHistory([])).toEqual([])
    expect(trimHistory(null)).toEqual([])
    expect(trimHistory([{ role: 'user' }])).toEqual([{ role: 'user', content: '' }])
  })

  it('顺序保持（从早到晚）', () => {
    const history = [msg('user', 'a'), msg('assistant', 'b'), msg('user', 'c')]
    expect(trimHistory(history).map(m => m.content)).toEqual(['a', 'b', 'c'])
  })
})

describe('getRecentHistory：真的接上了预算', () => {
  it('20 条超长消息读出来不会原样返回', () => {
    const long = '长'.repeat(3000)
    const conv = {
      id: 'c1',
      messages: Array.from({ length: 20 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: long,
        aiReply: i % 2 === 1 ? long : undefined
      }))
    }
    uni.setStorageSync('siji_conversations', JSON.stringify([conv]))
    uni.setStorageSync('siji_active_conversation', 'c1')
    const history = getRecentHistory()
    const total = history.reduce((n, m) => n + m.content.length, 0)
    expect(history.length).toBeGreaterThan(0)
    expect(total).toBeLessThan(20 * 3000)
    expect(total).toBeLessThanOrEqual(HISTORY_MAX_CHARS + HISTORY_MAX_PER_MESSAGE * HISTORY_MIN_KEEP)
  })
})
