/**
 * 4.49.0 天气查询失效修复
 *
 * 真实反馈（v4.46.0 / GLM-5.3 Flash / Android）：
 *   用户「明天的天气怎么样？」→ AI「帮你查一下明天南昌的天气~」（只承诺）
 *   用户「查一下」→ AI「抱歉，我没能理解，能换个方式说说吗？」（空 reply 兜底）
 *   用户「查一下明天的天气」→ AI「好，查南昌明天的天气~」（仍只承诺）
 *
 * 根因三条：① 模型把 web_search 写成 JSON action，autoExecutor 当未知类型静默丢弃；
 *          ② 空 reply 兜底把「动作走了别的路径」误报成「没理解」；
 *          ③ 提示词无条件让模型调 web_search，但工具按 Key 门控未注入。
 * 本文件钉死修复后的行为。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resetStorage } from './setup.js'
import './setup.js'
import { runAgentLoop } from '../utils/ai/agent-loop.js'
import {
  AGENT_TOOL_INSTRUCTION, AGENT_TOOL_INSTRUCTION_NO_SEARCH, buildAgentToolInstruction
} from '../utils/ai/prompt-actions.js'
import { setOwnSearchKey } from '../utils/ai/search-config.js'

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

const weatherJson = JSON.stringify({
  reply: '',
  action: { type: 'web_search', payload: { query: '南昌 明天 天气' } }
})

describe('JSON action web_search 按工具执行', () => {
  it('空 reply + web_search action → 真的执行搜索并续一轮给最终回复', async () => {
    let round = 0
    const responder = vi.fn(async () => {
      round++
      if (round === 1) return { message: { role: 'assistant', content: weatherJson }, id: 'm1' }
      return { message: { role: 'assistant', content: '南昌明天晴，20-25℃。' }, id: 'm2' }
    })
    const result = await runAgentLoop(null, '查一下', 'eval', cfgWith(responder), [])
    expect(responder).toHaveBeenCalledTimes(2)
    expect(result.toolCalls.map(c => c.name)).toEqual(['web_search'])
    expect(result.toolCalls[0].args.query).toBe('南昌 明天 天气')
    expect(result.reply).toContain('南昌')
  })

  it('第二轮消息带 assistant(tool_calls) + tool 结果，模型基于搜索结果回答', async () => {
    const bodies = []
    let round = 0
    const responder = vi.fn(async (body) => {
      bodies.push(body)
      round++
      if (round === 1) return { message: { role: 'assistant', content: weatherJson }, id: 'm1' }
      return { message: { role: 'assistant', content: '好。' }, id: 'm2' }
    })
    await runAgentLoop(null, '查一下', 'eval', cfgWith(responder), [])
    const second = bodies[1].messages
    const asst = second.find(m => m.role === 'assistant' && Array.isArray(m.tool_calls))
    const tool = second.find(m => m.role === 'tool')
    expect(asst.tool_calls[0].function.name).toBe('web_search')
    expect(tool.tool_call_id).toBe(asst.tool_calls[0].id)
    expect(tool.content).toBeTruthy()
  })

  it('干跑不碰网络：web_search 走占位结果（不发请求）', async () => {
    let requested = false
    const original = global.uni.request
    global.uni.request = () => { requested = true }
    let round = 0
    const responder = vi.fn(async () => {
      round++
      if (round === 1) return { message: { role: 'assistant', content: weatherJson }, id: 'm1' }
      return { message: { role: 'assistant', content: '好。' }, id: 'm2' }
    })
    const result = await runAgentLoop(null, '查一下', 'eval', cfgWith(responder), [])
    global.uni.request = original
    expect(requested).toBe(false)
    expect(result.execResults[0].detail.dryRun).toBe(true)
  })

  it('联网动作混着写动作时不接管（交给老 JSON 路径，避免吞掉写操作）', async () => {
    const mixed = JSON.stringify({
      reply: '',
      actions: [
        { type: 'web_search', payload: { query: '天气' } },
        { type: 'create_bill', payload: { amount: 12, category: '餐饮' } }
      ]
    })
    const responder = vi.fn(async () => ({ message: { role: 'assistant', content: mixed }, id: 'm1' }))
    const result = await runAgentLoop(null, '查一下', 'eval', cfgWith(responder), [])
    expect(result.toolCalls).toEqual([])
    expect(result._jsonFallback).toBe(true)
  })
})

describe('Agent 工具说明按联网搜索可用性门控', () => {
  it('未配置搜索 Key → 用不可用版，不指示调用 web_search', () => {
    expect(buildAgentToolInstruction()).toBe(AGENT_TOOL_INSTRUCTION_NO_SEARCH)
    expect(AGENT_TOOL_INSTRUCTION_NO_SEARCH).not.toContain('调用 web_search 联网搜索')
    expect(AGENT_TOOL_INSTRUCTION_NO_SEARCH).toContain('如实告知')
  })

  it('配置搜索 Key → 用完整版，且含「禁止只承诺不执行」硬规则', () => {
    setOwnSearchKey('sk-search-test')
    expect(buildAgentToolInstruction()).toBe(AGENT_TOOL_INSTRUCTION)
    expect(AGENT_TOOL_INSTRUCTION).toContain('禁止只承诺不执行')
    expect(AGENT_TOOL_INSTRUCTION).toContain('调用 web_search 联网搜索')
  })
})
