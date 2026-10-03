/**
 * agent-loop 短指令纠偏轮测试（4.10.5）
 *
 * 背景：4.10.4 自检 GLM-5.3 Flash 三类零工具失败 —— 不点名打卡 / 口头问花费 / 一句多意图，
 * 工具全量在手上却直接回闲聊。修法两层：提示词补规则 + agent 循环纠偏轮（本文件钉死行为）。
 *
 * 纠偏语义（agent-loop.js）：
 *   强操作意图消息（STRONG_ACTION_RE）+ 整个循环零工具 + 回复里没有可执行 JSON action
 *   → 追问一轮（AGENT_NUDGE_TEXT），只纠一次；被丢弃的首轮回复不得推流（onChunk）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resetStorage } from './setup.js'
import './setup.js'
import { runAgentLoop, STRONG_ACTION_RE, AGENT_NUDGE_TEXT } from '../utils/ai/agent-loop.js'

beforeEach(() => resetStorage())

function cfgWith(responder) {
  return {
    provider: 'deepseek',
    model: 'deepseek-v4-flash',
    // 纯 mock 夹具：_mockResponder 接管请求，这个 key 不会发往任何服务
    apiKey: 'mock-' + 'key-for-tests',
    temperature: 0,
    dryRun: true,
    _mockResponder: responder
  }
}

function toolRound(name, args) {
  return {
    message: {
      role: 'assistant', content: '',
      tool_calls: [{ id: 'c1', type: 'function', function: { name, arguments: JSON.stringify(args || {}) } }]
    },
    id: 'm-tool'
  }
}
function textRound(content) {
  return { message: { role: 'assistant', content }, id: 'm-text' }
}

describe('STRONG_ACTION_RE 边界', () => {
  it('4.10.4 三类实测失败原话全部命中', () => {
    expect(STRONG_ACTION_RE.test('下班啦，打个卡')).toBe(true)
    expect(STRONG_ACTION_RE.test('我这个月一共花了多少钱？')).toBe(true)
    expect(STRONG_ACTION_RE.test('记一笔午餐 35，再写个记录说今天开会开到六点')).toBe(true)
  })

  it('纯叙述与闲聊不命中（否则会被误纠偏）', () => {
    expect(STRONG_ACTION_RE.test('你好呀，今天天气还行，就是想随便聊两句')).toBe(false)
    expect(STRONG_ACTION_RE.test('今天下班去江边走了走，风很舒服')).toBe(false)
    expect(STRONG_ACTION_RE.test('今天和阿伟聊了项目排期的事，聊得还行')).toBe(false)
  })
})

describe('纠偏轮行为', () => {
  it('强指令 + 首轮零工具闲聊 → 追问一轮后调工具，丢弃的首轮回复不推流', async () => {
    let round = 0
    const responder = vi.fn(async () => {
      round++
      return round === 1 ? textRound('下班快乐~今晚有什么安排吗？') : toolRound('log_plan_checkin', { client_id: 'p1' })
    })
    const chunks = []
    const result = await runAgentLoop(
      { executeAction: () => ({ success: true, message: '已打卡', detail: { type: 'log_plan_checkin' } }) },
      '下班啦，打个卡', 'eval', cfgWith(responder), [],
      (t) => chunks.push(t)
    )
    expect(responder).toHaveBeenCalledTimes(2)
    // 工具在纠偏轮被调用
    expect(result.toolCalls.map(c => c.name)).toEqual(['log_plan_checkin'])
    // 闲聊首轮没推流：上层按累加消费 onChunk，推了就会重复
    expect(chunks).toEqual([])
  })

  it('追问文案带 [系统] 前缀且出现在第二轮 messages 里', async () => {
    const seen = []
    const responder = vi.fn(async () => {
      seen.push(1)
      const n = seen.length
      // 轮次脚本：1 直接闲聊（触发纠偏）→ 2 调工具 → 3+ 最终回复
      if (n === 1) return textRound('还没查到哦')
      if (n === 2) return toolRound('query_bill', {})
      return textRound('这个月一共花了 ¥120')
    })
    await runAgentLoop(null, '我这个月一共花了多少钱？', 'eval', cfgWith(responder), [])
    expect(seen.length).toBe(3)
    // responder.mock.calls[i][0] 是第 i+1 次请求体；第二轮应含纠偏文案
    const secondRoundTexts = (responder.mock.calls[1][0].messages || []).map((m) => m.content || '').join('\n')
    expect(secondRoundTexts).toContain(AGENT_NUDGE_TEXT)
  })

  it('非强指令消息零工具 → 不纠偏（ responder 只被调一次）', async () => {
    const responder = vi.fn(async () => textRound('你好呀，今天天气不错~'))
    const result = await runAgentLoop(null, '你好呀，今天天气还行，就是想随便聊两句', 'eval', cfgWith(responder), [])
    expect(responder).toHaveBeenCalledTimes(1)
    expect(result.reply).toContain('天气不错')
    expect(result.toolCalls).toEqual([])
  })

  it('回复里已带可执行 JSON action → 不纠偏，走 JSON 路径语义', async () => {
    const raw = JSON.stringify({
      reply: '记好了，房租 ¥1500',
      action: { type: 'create_bill', payload: { amount: 1500, category: '房租' } }
    })
    const responder = vi.fn(async () => textRound(raw))
    const result = await runAgentLoop(null, '记一笔房租 1500', 'eval', cfgWith(responder), [])
    expect(responder).toHaveBeenCalledTimes(1)
    expect(result.action.type).toBe('create_bill')
  })

  it('纠偏后仍直接回复 → 接受该回复，不无限循环（恰好两次请求）', async () => {
    const responder = vi.fn(async () => textRound('下班快乐~周末还上班，辛苦啦！'))
    const result = await runAgentLoop(null, '下班啦，打个卡', 'eval', cfgWith(responder), [])
    expect(responder).toHaveBeenCalledTimes(2)
    expect(result.reply).toContain('下班快乐')
    expect(result.toolCalls).toEqual([])
  })

  it('跑过工具的正常回复不触发纠偏（toolCalls 非空即短路）', async () => {
    let round = 0
    const responder = vi.fn(async () => {
      round++
      return round === 1 ? toolRound('query_bill', {}) : textRound('你这个月一共花了 ¥120')
    })
    const result = await runAgentLoop(null, '我这个月一共花了多少钱？', 'eval', cfgWith(responder), [])
    expect(responder).toHaveBeenCalledTimes(2)
    expect(result.toolCalls.map(c => c.name)).toEqual(['query_bill'])
    expect(result.reply).toContain('¥120')
  })
})
