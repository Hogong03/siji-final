/**
 * test: 工具参数解析失败自纠 + 写入失败自检（3.5.11）
 * 修复点：参数解析失败不再静默用 {} 执行；本轮写入失败时追加 [系统] 纠正指令
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { resetStorage } from './setup.js'
import { runAgentLoop } from '../utils/ai/agent-loop.js'
import { parseToolArgs, argErrorResult, getTruncateLimit } from '../utils/ai/tools.js'

beforeEach(() => {
  resetStorage()
  global.uni.setStorageSync('siji_auto_write', '1')
})

describe('parseToolArgs', () => {
  it('空参数视为无参工具（get_profile 等）', () => {
    expect(parseToolArgs('')).toEqual({ ok: true, args: {} })
    expect(parseToolArgs(null)).toEqual({ ok: true, args: {} })
    expect(parseToolArgs('{}')).toEqual({ ok: true, args: {} })
  })

  it('合法 JSON 对象通过', () => {
    expect(parseToolArgs('{"client_id":"p1"}')).toEqual({ ok: true, args: { client_id: 'p1' } })
  })

  it('非法 JSON / 非对象 → ok:false 并带原因', () => {
    expect(parseToolArgs('{"client_id":').ok).toBe(false)
    expect(parseToolArgs('{"client_id":').reason).toBe('不是合法 JSON')
    expect(parseToolArgs('[1,2]').reason).toBe('不是 JSON 对象')
    expect(parseToolArgs('"abc"').reason).toBe('不是 JSON 对象')
  })
})

describe('argErrorResult / getTruncateLimit', () => {
  it('错误结果带中文标签与重发指引', () => {
    const r = argErrorResult('update_plan', '不是合法 JSON')
    expect(r.ok).toBe(false)
    expect(r.text).toContain('修改计划')
    expect(r.text).toContain('重新调用')
  })

  it('截断上限按工具类型取值，未知工具走默认 2000', () => {
    expect(getTruncateLimit('query_stat')).toBe(800)
    expect(getTruncateLimit('query_diary')).toBe(2000)
    expect(getTruncateLimit('unknown_tool')).toBe(2000)
  })
})

function scriptedLoop(rounds, store) {
  let round = 0
  const seen = []
  const responder = async (body) => {
    seen.push(body.messages)
    round++
    const script = rounds[Math.min(round - 1, rounds.length - 1)]
    if (typeof script === 'string') {
      return { message: { role: 'assistant', content: script }, id: 'm' + round }
    }
    const toolCalls = script.map((c, i) => ({
      id: 'c' + round + i,
      type: 'function',
      function: { name: c.name, arguments: c.raw }
    }))
    return { message: { role: 'assistant', content: '', tool_calls: toolCalls }, id: 'm' + round }
  }
  const cfg = { provider: 'deepseek', model: 'deepseek-v4-flash', apiKey: 'k', _mockResponder: responder }
  return runAgentLoop(store, '把记录改一下', 'conv_x', cfg, []).then(result => ({ result, seen }))
}

describe('工具循环：参数不可解析', () => {
  it('不静默执行：不调用 executeAction，失败原因回传给模型', async () => {
    const executeAction = vi.fn(() => ({ success: true, message: 'ok', detail: { type: 'update_diary', id: 'd1' } }))
    const { result, seen } = await scriptedLoop([
      [{ name: 'update_diary', raw: '{"client_id":"d1"' }],
      '抱歉，刚才那条没改成功，我再确认一下。'
    ], { executeAction })

    expect(executeAction).not.toHaveBeenCalled()
    expect(result.toolCalls[0].args).toBe(null)
    expect(result.execResults[0].ok).toBe(false)
    expect(result.execResults[0].message).toContain('不是合法 JSON')
    const secondRound = seen[1].map(m => m.content).join('\n')
    expect(secondRound).toContain('不是合法 JSON')
    expect(result.reply).toContain('再确认')
  })

  it('下一轮给出合法参数即可正常执行', async () => {
    const executeAction = vi.fn(() => ({ success: true, message: '记录已更新', detail: { type: 'update_diary', id: 'd1' } }))
    const { result } = await scriptedLoop([
      [{ name: 'update_diary', raw: '不是JSON' }],
      [{ name: 'update_diary', raw: JSON.stringify({ client_id: 'd1', content: '改好了' }) }],
      '改好了，那条记录已经更新。'
    ], { executeAction })

    expect(executeAction).toHaveBeenCalledTimes(1)
    expect(result.execResults[0].ok).toBe(false)
    expect(result.execResults[1].ok).toBe(true)
    expect(result.reply).toContain('已经更新')
  })
})

describe('工具循环：写入失败自检', () => {
  it('本轮写入失败 → 追加 [系统] 纠正指令后再作答', async () => {
    const executeAction = vi.fn(() => ({ success: false, message: '缺少内容' }))
    const { result, seen } = await scriptedLoop([
      [{ name: 'create_diary', raw: JSON.stringify({ content: '测试' }) }],
      '这次没能保存成功，我换个方式再试。'
    ], { executeAction })

    expect(executeAction).toHaveBeenCalledTimes(1)
    expect(result.execResults[0].ok).toBe(false)
    const secondRound = seen[1].map(m => m.content).join('\n')
    expect(secondRound).toContain('[系统] 本轮写入未成功')
    expect(secondRound).toContain('写记录')
    expect(result.reply).toContain('没能保存')
  })
})