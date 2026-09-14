/**
 * test: Agent 入口门控（3.5.11 门控反转）
 * 只有「明显闲聊」才走单轮流式快通道，其余一律进工具循环
 */
import { describe, it, expect } from 'vitest'
import { isClearlyCasual, CASUAL_MAX_LEN } from '../utils/ai/chat-stream.js'

describe('isClearlyCasual — 走闲聊快通道', () => {
  const casual = ['嗯嗯', '在吗', '哈哈', '今天好累', '有点困', '我打王者荣耀', '没什么', '', null, '好的']
  for (const msg of casual) {
    it(JSON.stringify(msg) + ' → 闲聊', () => {
      expect(isClearlyCasual(msg)).toBe(true)
    })
  }
})

describe('isClearlyCasual — 交给工具循环', () => {
  const agent = [
    '记录',
    '记账',
    '帮我记一下',
    '我上个月花了多少',
    '今天和阿伟吃饭',
    '总结一下这周',
    '2026年的目标是什么',
    '我女朋友又生气了',
    '把学习计划改到 9 月 22 日，之前定的 20 日不对',
    '今天上班被领导骂了，感觉特别烦'
  ]
  for (const msg of agent) {
    it(msg + ' → 工具循环', () => {
      expect(isClearlyCasual(msg)).toBe(false)
    })
  }
})

describe('门控常量', () => {
  it('闲聊长度阈值固定为 14', () => {
    expect(CASUAL_MAX_LEN).toBe(14)
  })

  it('超长消息一律进工具循环（哪怕全是闲聊语气）', () => {
    expect(isClearlyCasual('今天没什么事就是想随便聊聊你最近怎么样')).toBe(false)
  })
})