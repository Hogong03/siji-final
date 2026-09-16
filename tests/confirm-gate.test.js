/**
 * 确认闸门判定（3.7.3）
 *
 * 3.7.2 自检首跑报「记一笔房租 1500 → 没有走确认闸门」。根因：
 * runAgentChat 无条件打 _agentMode = true，而 useChatEngine 的 JSON 路径确认判定是
 * `if (!result._agentMode)` —— 于是模型不调工具、直接回 JSON action 时，
 * 大额记账与 delete_feedback 都能绕开确认直接落库。
 *
 * 修完后：runAgentChat 只在真的跑过工具时才认 agent 模式；确认判定抽到
 * utils/ai/confirm-gate.js，聊天页与自检页面共用一份（不再有两处逻辑漂移）。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { resetStorage } from './setup.js'
import './setup.js'
import { pendingConfirmations, needUserConfirm } from '../utils/ai/confirm-gate.js'
import { runAgentChat } from '../utils/ai/agent-loop.js'
import { parseAiResponse } from '../utils/ai/response-parser.js'

describe('pendingConfirmations：哪些动作要确认', () => {
  it('JSON 路径的写操作默认要确认（含金额阈值与 delete_feedback）', () => {
    expect(pendingConfirmations({ action: { type: 'create_bill', payload: { amount: 1500 } } }).map(a => a.type))
      .toEqual(['create_bill'])
    expect(pendingConfirmations({ action: { type: 'create_diary', payload: { content: 'x' } } }).length).toBe(1)
    expect(pendingConfirmations({ action: { type: 'delete_feedback', payload: { id: 'f1' } } }).length).toBe(1)
  })

  it('只读动作与撤销不需要确认', () => {
    expect(pendingConfirmations({ action: { type: 'query_plan', payload: {} } })).toEqual([])
    expect(pendingConfirmations({ action: { type: 'undo_last', payload: {} } })).toEqual([])
  })

  it('agent 模式下不在这一层重复判（循环内已挂起或已执行）', () => {
    expect(pendingConfirmations({ _agentMode: true, action: { type: 'create_bill', payload: { amount: 1500 } } })).toEqual([])
  })

  it('复合动作逐条判，只挂起需要确认的那些', () => {
    const result = { actions: [{ type: 'query_plan', payload: {} }, { type: 'update_plan', payload: { client_id: 'p1' } }] }
    expect(pendingConfirmations(result).map(a => a.type)).toEqual(['update_plan'])
  })

  it('模型自己标了 needConfirm 也算', () => {
    expect(needUserConfirm({ action: { type: 'create_diary', payload: {}, needConfirm: true } })).toBe(true)
    expect(needUserConfirm({ action: { type: null } })).toBe(false)
    expect(needUserConfirm(null)).toBe(false)
  })
})

describe('runAgentChat：只有真的跑过工具才认 agent 模式（3.7.3 真 Bug）', () => {
  beforeEach(() => resetStorage())

  function cfgWith(responder) {
    return {
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      apiKey: 'test-key',
      temperature: 0,
      dryRun: true,
      _mockResponder: responder
    }
  }

  function textResponder(content) {
    return async () => ({ message: { role: 'assistant', content }, id: 'mock' })
  }

  it('一轮工具都没调、只回 JSON action → _agentMode 为假，交给 JSON 路径（确认 + 执行）', async () => {
    const raw = JSON.stringify({
      reply: '记好了，房租 ¥1500',
      action: { type: 'create_bill', payload: { amount: 1500, category: '房租' } }
    })
    const result = await runAgentChat(null, '记一笔房租 1500', 'eval', cfgWith(textResponder(raw)), [])
    expect(result._agentMode).toBe(false)
    expect(result._agentExecuted).toBe(false)
    // 这个组合就是「会弹确认卡」：非 agent 模式 + 写操作需要确认
    expect(needUserConfirm(result)).toBe(true)
    expect(pendingConfirmations(result).map(a => a.type)).toEqual(['create_bill'])
  })

  it('跑过工具 → 仍是 agent 模式（不重复执行、不重复确认）', async () => {
    let round = 0
    const responder = async () => {
      round++
      if (round === 1) {
        return {
          message: {
            role: 'assistant', content: '',
            tool_calls: [{ id: 'c1', type: 'function', function: { name: 'query_plan', arguments: '{}' } }]
          },
          id: 'mock1'
        }
      }
      return { message: { role: 'assistant', content: '你有 1 个计划' }, id: 'mock2' }
    }
    const result = await runAgentChat(null, '我有哪些计划', 'eval', cfgWith(responder), [])
    expect(result.toolCalls.length).toBe(1)
    expect(result._agentMode).toBe(true)
    expect(needUserConfirm(result)).toBe(false)
  })
})

describe('parseAiResponse：嵌套 multi 拍平（3.7.3）', () => {
  it('actions 里嵌 multi → 展开成内层真实动作', () => {
    const raw = JSON.stringify({
      reply: '都记好了',
      actions: [{
        type: 'multi',
        payload: [
          { type: 'create_bill', payload: { amount: 35 } },
          { type: 'create_diary', payload: { content: '开会' } }
        ]
      }]
    })
    const r = parseAiResponse(raw, 'c1')
    expect(r.actions.map(a => a.type)).toEqual(['create_bill', 'create_diary'])
    expect(r.action.type).toBe('multi')
  })

  it('payload.actions 形式同样展开', () => {
    const raw = JSON.stringify({
      reply: '好',
      actions: [{ type: 'multi', payload: { actions: [{ type: 'create_diary', payload: { content: 'x' } }] } }]
    })
    const r = parseAiResponse(raw, 'c1')
    expect(r.actions.map(a => a.type)).toEqual(['create_diary'])
  })

  it('空的 multi（没有内层动作）→ 视为没有动作，交给兜底', () => {
    const raw = JSON.stringify({ reply: '都记好了', actions: [{ type: 'multi', payload: {} }] })
    const r = parseAiResponse(raw, 'c1')
    expect(r.action).toBeNull()
    expect(r.actions).toEqual([])
  })

  it('单个 action 就是 multi → 也拍平', () => {
    const raw = JSON.stringify({
      reply: '好',
      action: { type: 'multi', payload: [{ type: 'create_bill', payload: { amount: 5 } }] }
    })
    const r = parseAiResponse(raw, 'c1')
    expect(r.actions.map(a => a.type)).toEqual(['create_bill'])
  })
})