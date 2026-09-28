/**
 * 自检口径：兜底档与两条执行路径（3.7.1）
 *
 * 背景：3.7.0 首跑 23 条里 7 条失败，全部是自检本身的度量缺陷：
 *   1. 干跑把查询也换成占位结果 → 模型拿不到真实 client_id，只能瞎答（本文件第 2 组）
 *   2. 只认 tool_calls，漏掉老 JSON action 路径（mergeExecutedTools，见 tests/ai-eval.test.js）
 *   3. 模型既没调工具也没回 JSON、只口头说「记好了」时，前端 extractFallbackAction 还能兜出写入 ——
 *      结果会落库，但这不是 AI 会拆解，必须单独计数（本文件第 1、3 组）
 */
import { describe, it, expect } from 'vitest'
import './setup.js'
import { runCase, CASE_STATUS, summarizeResults, formatFailureReport, EVAL_PROTOCOL_LABEL } from '../utils/ai/eval/runner.js'
import { dayStr } from '../utils/ai/eval/cases.js'

describe('兜底档：模型口头声称 + 前端正则能救回来', () => {
  const caze = {
    id: 'bill-claim-only',
    title: '记账但没调工具',
    message: '记一笔昨天的午饭 25',
    expect: { tools: ['create_bill'] }
  }

  it('判成 fallback 而不是 fail，并说清是兜底在救场', async () => {
    const row = await runCase(async () => ({ toolCalls: [], reply: '记好了，昨天午饭 ¥25' }), caze)
    expect(row.status).toBe(CASE_STATUS.FALLBACK)
    expect(row.fallbackType).toBe('create_bill')
    expect(row.failures.join('')).toContain('靠前端兜底执行')
    expect(row.gotTools).toEqual([])
  })

  it('口头没声称操作（回复不含「已记/记下了」）→ 仍是 fail，不给兜底发善意', async () => {
    const row = await runCase(async () => ({ toolCalls: [], reply: '这家店好吃吗？' }), caze)
    expect(row.status).toBe(CASE_STATUS.FAIL)
    expect(row.fallbackType).toBe('')
  })

  it('用例本来就不要求工具（只查回复）时，不判兜底', async () => {
    const onlyReply = { id: 'reply-only', title: '只看回复', message: '记一笔午饭 25', expect: { replyIncludes: ['不存在的词'] } }
    const row = await runCase(async () => ({ toolCalls: [], reply: '记好了，午饭 ¥25' }), onlyReply)
    expect(row.status).toBe(CASE_STATUS.FAIL)
    expect(row.fallbackType).toBe('')
  })

  it('模型真的调了工具时不会被打成兜底', async () => {
    const row = await runCase(async () => ({
      toolCalls: [{ name: 'create_bill', args: { amount: 25, bill_date: dayStr(-1) }, source: 'tool' }],
      reply: '记好了，昨天午饭 ¥25'
    }), caze)
    expect(row.status).toBe(CASE_STATUS.PASS)
  })
})

describe('汇总把三档分开算', () => {
  it('通过 / 兜底 / 未过分别计数，通过率只认真的过', () => {
    const sum = summarizeResults([
      { status: CASE_STATUS.PASS, ms: 1 },
      { status: CASE_STATUS.PASS, ms: 1 },
      { status: CASE_STATUS.FALLBACK, ms: 1 },
      { status: CASE_STATUS.FAIL, ms: 1 },
      { status: CASE_STATUS.ERROR, ms: 1 }
    ])
    expect(sum.total).toBe(5)
    expect(sum.pass).toBe(2)
    expect(sum.fallback).toBe(1)
    expect(sum.fail).toBe(1)
    expect(sum.error).toBe(1)
    expect(sum.rate).toBe(40)
  })

  it('失败明细里兜底条数写在汇总行', () => {
    const text = formatFailureReport([
      { id: 'a', title: 'A', status: CASE_STATUS.FALLBACK, failures: ['x'], gotTools: [], ms: 1 }
    ])
    expect(text).toContain('靠前端兜底：1')
  })

  it('报告头部自带自检口径与应用版本（3.7.4：跑的是哪套代码一眼能认）', () => {
    const text = formatFailureReport([], { appVersion: 'v3.7.4', model: 'DeepSeek · V4 Flash' })
    expect(text).toContain('自检口径: ' + EVAL_PROTOCOL_LABEL)
    expect(text).toContain('应用版本: v3.7.4')
    expect(text).toContain('模型: DeepSeek · V4 Flash')
    // 不传 meta 时也要有这一行（免得又出现「不知道哪套代码跑的」）
    const bare = formatFailureReport([])
    expect(bare).toContain('自检口径: ')
    expect(bare).toContain('应用版本: （未知）')
  })
})