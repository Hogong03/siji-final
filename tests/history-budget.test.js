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
  it('超长 AI 回复按 600 上限截断并留标记（4.15）', () => {
    const long = '长'.repeat(HISTORY_MAX_PER_MESSAGE + 500)
    const out = trimHistory([msg('assistant', long)], { minKeep: 0 })
    expect(out[0].content.length).toBe(600 + HISTORY_TRUNCATED_MARK.length)
    expect(out[0].content.endsWith(HISTORY_TRUNCATED_MARK)).toBe(true)
  })

  it('超长用户消息仍按 1200 上限截断（4.15：用户消息保真优先）', () => {
    const long = '长'.repeat(HISTORY_MAX_PER_MESSAGE + 500)
    const out = trimHistory([msg('user', long)], { minKeep: 0 })
    expect(out[0].content.length).toBe(HISTORY_MAX_PER_MESSAGE + HISTORY_TRUNCATED_MARK.length)
    expect(out[0].content.endsWith(HISTORY_TRUNCATED_MARK)).toBe(true)
  })

  it('没超长的不动', () => {
    const out = trimHistory([msg('user', '今天跑了 5 公里')], { minKeep: 0 })
    expect(out[0].content).toBe('今天跑了 5 公里')
  })
})

describe('trimHistory：总量预算', () => {
  it('超预算时丢掉更早的 AI 回复，用户消息与最近若干条保留（4.15）', () => {
    const history = Array.from({ length: 30 }, (_, i) =>
      i % 2 === 0 ? msg('user', `第${i}条`.padEnd(20, 'x')) : msg('assistant', 'a'.repeat(600))
    )
    const out = trimHistory(history)
    const total = out.reduce((n, m) => n + m.content.length, 0)
    // AI 回复被预算裁掉 → 总条数小于输入
    expect(out.length).toBeLessThan(history.length)
    // 用户消息全部保留（TC-004：自报信息不得被挤出）
    expect(out.filter(m => m.role === 'user').length).toBe(15)
    // 最后一条一定在（不能把最新的丢了）
    expect(out[out.length - 1].content).toBe(history[history.length - 1].content)
  })

  it('保底条数：全 AI 输入也至少留住最近 10 条（4.15 提升自 6）', () => {
    const huge = 'x'.repeat(HISTORY_MAX_PER_MESSAGE)
    const history = Array.from({ length: 15 }, () => msg('assistant', huge))
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
    // 4.15：用户消息全保留（10×1200 上限）+ AI 回复 600×保底 10 + 预算 6000
    expect(total).toBeLessThanOrEqual(
      HISTORY_MAX_CHARS + HISTORY_MAX_PER_MESSAGE * HISTORY_MIN_KEEP + 600 * HISTORY_MIN_KEEP
    )
  })
})
