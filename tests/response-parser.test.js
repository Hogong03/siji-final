/**
 * response-parser.js 测试
 */
import { describe, it, expect } from 'vitest'
import './setup.js'
import { parseAiResponse } from '@/utils/ai/response-parser.js'

describe('response-parser.js', () => {
  it('纯文本回复 — 直接返回 reply', () => {
    const result = parseAiResponse('你好，我是 AI 助手', 'conv_001')
    expect(result.reply).toBe('你好，我是 AI 助手')
    expect(result.action).toBeNull()
  })

  it('JSON 回复 — 含 reply 字段', () => {
    const json = JSON.stringify({
      reply: '已经记好了',
      action: { type: 'create_bill', needConfirm: false, payload: { amount: 35, category: '午餐' } }
    })
    const result = parseAiResponse(json, 'conv_001')
    expect(result.reply).toBe('已经记好了')
    expect(result.action.type).toBe('create_bill')
    expect(result.action.payload.amount).toBe(35)
  })

  it('JSON 回复 — 含多操作', () => {
    const json = JSON.stringify({
      reply: '一起处理了',
      actions: [
        { type: 'create_bill', needConfirm: false, payload: { amount: 20 } },
        { type: 'create_diary', needConfirm: false, payload: { mood: 'happy' } }
      ]
    })
    const result = parseAiResponse(json, 'conv_001')
    expect(result.actions).toHaveLength(2)
    expect(result.actions[0].type).toBe('create_bill')
    expect(result.actions[1].type).toBe('create_diary')
  })

  it('JSON 包裹在 markdown 代码块中 — 应提取', () => {
    const wrapped = '```json\n{"reply":"代码块里的回复"}\n```'
    const result = parseAiResponse(wrapped, 'conv_001')
    expect(result.reply).toBe('代码块里的回复')
  })

  it('含 suggestions 的回复', () => {
    const json = JSON.stringify({
      reply: '记好了',
      suggestions: ['再记一笔', '查看今日账单']
    })
    const result = parseAiResponse(json, 'conv_001')
    expect(result.suggestions).toEqual(['再记一笔', '查看今日账单'])
  })

  it('空字符串 — 返回兜底回复', () => {
    const result = parseAiResponse('', 'conv_001')
    expect(result.reply).toBeTruthy() // 应有兜底文案
    expect(result._isFallback).toBe(true)
  })

  it('混合文本+JSON — 应提取 JSON 部分', () => {
    const mixed = '好的，我来帮你记一下。\n{"reply":"已记账","action":{"type":"create_bill","needConfirm":false,"params":{"amount":50}}}'
    const result = parseAiResponse(mixed, 'conv_001')
    expect(result.reply).toBe('已记账')
    expect(result.action.type).toBe('create_bill')
  })
})
