/**
 * chat-suggestion.js 测试（3.4.4 P2：AI 回复后轻追问稳定化）
 */
import { describe, it, expect } from 'vitest'
import './setup.js'
import { buildFallbackSuggestions, mergeSuggestions } from '@/utils/ai/chat-suggestion.js'
import { parseAiResponse } from '@/utils/ai/response-parser.js'

const EVAL_RE = /你觉得呢|要不要试试|感觉怎么样|怎么想|心情如何/

describe('buildFallbackSuggestions', () => {
  it('账单话题给出记账类建议且最多 2 条', () => {
    const list = buildFallbackSuggestions('好的，午餐 ¥25 已帮你记好。')
    expect(list.length).toBeGreaterThan(0)
    expect(list.length).toBeLessThanOrEqual(2)
    expect(list.some(s => s.includes('账单') || s.includes('再记'))).toBe(true)
  })

  it('计划话题给排计划建议', () => {
    const list = buildFallbackSuggestions('可以，建议把这个目标拆成三步来做。')
    expect(list[0]).toBe('排进我的计划')
  })

  it('AI 问要不要记时给可一键答复的短句', () => {
    const list = buildFallbackSuggestions('要不要我帮你把今天的事记下来？')
    expect(list).toContain('好，记下来')
    expect(list).toContain('先不用')
  })

  it('纯闲聊短回复不加 chips 避免噪音', () => {
    expect(buildFallbackSuggestions('哈哈，挺好的')).toEqual([])
    expect(buildFallbackSuggestions('嗯嗯')).toEqual([])
  })

  it('失败/超时兜底文案不加 chips', () => {
    expect(buildFallbackSuggestions('AI 响应超时，可能网络不稳定或服务繁忙。')).toEqual([])
    expect(buildFallbackSuggestions('抱歉，我刚才走神了，能再说一次吗？')).toEqual([])
  })

  it('长段第一人称分享给"记成记录"出口', () => {
    const reply = '今天下午一个人去江边走了很久，风很大但脑子清楚了不少，还看到两只狗在打架，心情放松了很多。'
    expect(buildFallbackSuggestions(reply)).toContain('把这条记成记录')
  })

  it('任何输出都不含评价式/催促式伪建议', () => {
    const samples = [
      '要不要我帮你把今天的开销记下来？',
      '好的，午餐 ¥25 已记好。',
      '这个目标建议拆成三步执行。',
      '你上次说喜欢跑步，我记下来了。',
      '今天心情不错，去公园走了两圈，阳光很好，风也很舒服，整个人放松了不少，还拍了几张照片。'
    ]
    samples.forEach(text => {
      buildFallbackSuggestions(text).forEach(s => expect(s).not.toMatch(EVAL_RE))
    })
  })
})

describe('mergeSuggestions / response-parser 接入', () => {
  it('AI 给了 suggestions 原样透传（最多 3 条、去重）', () => {
    expect(mergeSuggestions(['再记一笔', '查看账单'], 'xxx')).toEqual(['再记一笔', '查看账单'])
    expect(mergeSuggestions(['a', 'b', 'c'], 'x')).toEqual(['a', 'b', 'c'])
    expect(mergeSuggestions(['a', 'a', 'b', 'c'], 'x')).toEqual(['a', 'b'])
  })

  it('纯文本回复自动补本地兜底建议', () => {
    const r = parseAiResponse('要不要我帮你把这周的日常记下来？', 'c')
    expect(r.suggestions.length).toBeGreaterThan(0)
  })

  it('JSON 回复没给 suggestions 时补兜底（无 action 场景）', () => {
    const r = parseAiResponse(JSON.stringify({ reply: '这个目标可以拆成三步来做。' }), 'c')
    expect(r.suggestions.length).toBeGreaterThan(0)
  })

  it('JSON 回复带 action 时不强制兜底（避免执行后弹无关建议）', () => {
    const r = parseAiResponse(JSON.stringify({
      reply: '午餐记好了。',
      action: { type: 'create_bill', payload: { amount: 25, category: '午餐' } }
    }), 'c')
    expect(Array.isArray(r.suggestions)).toBe(true)
    expect(r.suggestions).toEqual([])
  })
})
