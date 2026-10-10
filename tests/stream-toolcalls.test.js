/**
 * test: 工具轮流式化 + JSON 修复式解析（4.21.0）
 *
 * 背景（真机实测）：GLM-5.3 强制思考下 tool_calls 一次写 12K tokens 的 JSON arguments
 * 超过任何固定超时 —— 根治是流式工具轮（idle 续期，模型还在吐字就不掐）；
 * 超时回退 JSON 路径时 content 里的真实换行符导致 JSON.parse 失败 —— 补修复式解析。
 *
 * 覆盖：assembleStreamToolCalls（分片乱序/多工具/arguments 累加）、
 *       tryParseWithControlCharFix / parseAiResponse（裸换行 content 收下）、
 *       callWithTools（H5 SSE 工具轮端到端拼装 + fetch 失败降级非流式）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import './setup.js'
import { assembleStreamToolCalls } from '../utils/ai/chat-chunked.js'
import { tryParseWithControlCharFix, parseAiResponse } from '../utils/ai/response-parser.js'
import { callWithTools } from '../utils/ai/agent-transport.js'

const PROVIDER = { id: 'zhipu', name: '智谱', endpoint: 'https://example.invalid/v1/chat/completions' }
const CFG = { provider: 'zhipu', model: 'glm-5.3', apiKey: 'test-key', temperature: 0.7 }
const MESSAGES = [{ role: 'user', content: '写一篇长文' }]

describe('assembleStreamToolCalls（流式 tool_calls 增量拼装）', () => {
  it('arguments 分片按序累加，id/type 取首片', () => {
    const out = assembleStreamToolCalls([
      { index: 0, id: 'call_1', type: 'function', function: { name: 'create_diary', arguments: '{"ti' } },
      { index: 0, function: { arguments: 'tle":"数学笔记"}' } }
    ])
    expect(out.length).toBe(1)
    expect(out[0].id).toBe('call_1')
    expect(out[0].function.name).toBe('create_diary')
    expect(out[0].function.arguments).toBe('{"title":"数学笔记"}')
  })

  it('多工具 + index 乱序到达，按 index 升序还原', () => {
    const out = assembleStreamToolCalls([
      { index: 1, id: 'b', function: { name: 'query_bill', arguments: '{}' } },
      { index: 0, id: 'a', function: { name: 'create_diary', arguments: '{}' } }
    ])
    expect(out.map(t => t.function.name)).toEqual(['create_diary', 'query_bill'])
  })

  it('空 / 非法输入返回空数组', () => {
    expect(assembleStreamToolCalls([])).toEqual([])
    expect(assembleStreamToolCalls(null)).toEqual([])
    expect(assembleStreamToolCalls([null, 42])).toEqual([])
  })
})

describe('tryParseWithControlCharFix（裸控制字符修复）', () => {
  it('content 里的真实换行被转义后可解析', () => {
    const raw = '{"reply":"已存","action":{"type":"create_diary","payload":{"title":"t","content":"第一段\n真换行\n第二段"}}}'
    const parsed = tryParseWithControlCharFix(raw)
    expect(parsed).not.toBeNull()
    expect(parsed.action.payload.content).toBe('第一段\n真换行\n第二段')
  })

  it('tab 同样被转义；已转义的 \\n 不受二次破坏', () => {
    const parsed = tryParseWithControlCharFix('{"a":"x\ty\\n z\nw"}')
    expect(parsed.a).toBe('x\ty\n z\nw')
  })

  it('无法修复的坏 JSON 返回 null', () => {
    expect(tryParseWithControlCharFix('{"a": ')).toBeNull()
  })
})

describe('parseAiResponse 端到端（超时回退 JSON 路径的长 content）', () => {
  it('payload.content 含真实换行也能落出 action，不再整段当纯文本', () => {
    const content = '{"reply":"写好了","suggestions":[],"action":{"type":"create_diary","payload":{"title":"高数笔记","content":"# 第一章\n\n极限与连续：\n\n## 1.1 定义\n\nε-δ 语言。\n\n# 第二章\n\n导数。"}}}'
    const r = parseAiResponse(content, 'c1')
    expect(r.action).not.toBeNull()
    expect(r.action.type).toBe('create_diary')
    expect(r.action.payload.content).toContain('# 第一章')
    expect(r.action.payload.content).toContain('\n')
  })
})

describe('callWithTools 流式工具轮（H5 SSE 分支，vitest 跑原始源码走 H5 return）', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function sseResponse(lines) {
    const chunks = lines.map(l => new TextEncoder().encode(l))
    let i = 0
    return {
      ok: true,
      body: {
        getReader() {
          return {
            read() {
              return i < chunks.length
                ? Promise.resolve({ done: false, value: chunks[i++] })
                : Promise.resolve({ done: true })
            }
          }
        }
      }
    }
  }

  it('delta.tool_calls 分片拼成完整调用，返回形状与非流式一致', async () => {
    global.fetch.mockImplementation(() => Promise.resolve(sseResponse([
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_9","type":"function","function":{"name":"create_diary","arguments":"{\\"ti"}}]}}]}\n\n',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"tle\\":\\"高数\\",\\"content\\":\\"第一章\\"}"}}]}}]}\n\n',
      'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}\n\n',
      'data: [DONE]\n\n'
    ])))
    const res = await callWithTools(PROVIDER, CFG, MESSAGES, 'test-key')
    expect(res._streamError).toBeUndefined()
    expect(res.message.tool_calls.length).toBe(1)
    expect(res.message.tool_calls[0].function.name).toBe('create_diary')
    expect(JSON.parse(res.message.tool_calls[0].function.arguments).title).toBe('高数')
  })

  it('模型直接给 content 无工具调用 → 走最终回复路径，content 完整', async () => {
    global.fetch.mockImplementation(() => Promise.resolve(sseResponse([
      'data: {"choices":[{"delta":{"content":"直接回答"}}]}\n\n',
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
      'data: [DONE]\n\n'
    ])))
    const res = await callWithTools(PROVIDER, CFG, MESSAGES, 'test-key')
    expect(res.message.content).toBe('直接回答')
    expect(res.message.tool_calls).toBeUndefined()
  })

  it('流式请求失败（网络/非200）→ 降级非流式兜底，透出错误而非挂死', async () => {
    global.uni.request = (opts) => opts.fail({ errMsg: 'request:fail timeout' })
    global.fetch.mockImplementation(() => Promise.reject(new Error('network down')))
    const res = await callWithTools(PROVIDER, CFG, MESSAGES, 'test-key')
    expect(res.error).toContain('超时')
  })

  it('工具轮请求体用 low 思考档（4.23.0：确定性任务不再 high 档深思）', async () => {
    let capturedBody = null
    global.fetch.mockImplementation((url, opts) => {
      capturedBody = JSON.parse(opts.body)
      return Promise.resolve(sseResponse([
        'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}\n\n',
        'data: [DONE]\n\n'
      ]))
    })
    await callWithTools(PROVIDER, CFG, MESSAGES, 'test-key')
    // GLM-5.3 是 forced 思考模型：thinking 仍开（厂商强制），但 effort 降到 low
    expect(capturedBody.thinking).toEqual({ type: 'enabled' })
    expect(capturedBody.reasoning_effort).toBe('low')
    expect(capturedBody.tools.length).toBeGreaterThan(0)
  })

  it('onThinking 回调收到 reasoning_content 分片（4.23.0 思考流上屏）', async () => {
    const seen = []
    global.fetch.mockImplementation(() => Promise.resolve(sseResponse([
      'data: {"choices":[{"delta":{"reasoning_content":"用户想查"}}]}\n\n',
      'data: {"choices":[{"delta":{"reasoning_content":"账单，先调工具"}}]}\n\n',
      'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}\n\n',
      'data: [DONE]\n\n'
    ])))
    await callWithTools(PROVIDER, CFG, MESSAGES, 'test-key', false, null, (t) => seen.push(t))
    expect(seen.join('')).toBe('用户想查账单，先调工具')
  })
})
