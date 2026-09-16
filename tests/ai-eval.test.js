/**
 * AI 效果自检测试（3.7.0）
 *
 * 覆盖：语料结构完整性、判定器各条断言语义、跑批编排与汇总、
 *       干跑模式（cfg.dryRun）不写数据但照常记录工具调用。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { resetStorage } from './setup.js'
import './setup.js'
import { EVAL_CASES, EXPECT_KEYS, dayStr } from '../utils/ai/eval/cases.js'
import {
  CASE_STATUS, toolNamesOf, judgeCase, runCase, runCases,
  summarizeResults, formatFailureReport, mergeExecutedTools
} from '../utils/ai/eval/runner.js'
import { runAgentLoop } from '../utils/ai/agent-loop.js'

describe('语料集结构', () => {
  it('每条都有 id / title / message / expect，id 唯一', () => {
    const ids = EVAL_CASES.map(c => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    EVAL_CASES.forEach(c => {
      expect(typeof c.id).toBe('string')
      expect(c.id.length).toBeGreaterThan(0)
      expect(typeof c.title).toBe('string')
      expect(typeof c.message).toBe('string')
      expect(c.message.length).toBeGreaterThan(0)
      expect(c.expect && typeof c.expect).toBe('object')
    })
  })

  it('每条至少有一条断言，且断言字段都是已知字段', () => {
    EVAL_CASES.forEach(c => {
      const keys = Object.keys(c.expect).filter(k => {
        const v = c.expect[k]
        if (Array.isArray(v)) return v.length > 0
        return v !== undefined && v !== null
      })
      expect(keys.length).toBeGreaterThan(0)
      keys.forEach(k => expect(EXPECT_KEYS).toContain(k))
    })
  })

  it('语料覆盖用户排在前面的痛点：计划变更、属性、纠错、时间、网址', () => {
    const ids = EVAL_CASES.map(c => c.id).join(',')
    expect(ids).toContain('plan-change')
    expect(ids).toContain('profile-add')
    expect(ids).toContain('bill-relative-date')
    expect(ids).toContain('url-cjk-stuck')
    expect(ids).toContain('multi-intent')
  })

  it('相对日期现算，不写死（昨天 / 前天）', () => {
    const at = new Date(2026, 8, 16, 10, 0, 0)
    expect(dayStr(0, at)).toBe('2026-09-16')
    expect(dayStr(-1, at)).toBe('2026-09-15')
    expect(dayStr(-2, at)).toBe('2026-09-14')
  })
})

describe('judgeCase：断言语义', () => {
  const caze = (expect) => ({ id: 'x', title: 't', message: 'm', expect })

  it('tools 必须全部出现', () => {
    expect(judgeCase(caze({ tools: ['query_plan'] }), { toolCalls: [{ name: 'query_plan' }] }).pass).toBe(true)
    const r = judgeCase(caze({ tools: ['query_plan'] }), { toolCalls: [] })
    expect(r.pass).toBe(false)
    expect(r.failures[0]).toContain('缺少工具 query_plan')
  })

  it('toolsAny 至少一个', () => {
    const c = caze({ toolsAny: ['query_bill', 'query_stat'] })
    expect(judgeCase(c, { toolCalls: [{ name: 'query_stat' }] }).pass).toBe(true)
    expect(judgeCase(c, { toolCalls: [{ name: 'create_bill' }] }).pass).toBe(false)
  })

  it('forbid 一个都不许出现', () => {
    const r = judgeCase(caze({ forbid: ['create_plan'] }), { toolCalls: [{ name: 'create_plan' }] })
    expect(r.pass).toBe(false)
    expect(r.failures[0]).toContain('不该调用 create_plan')
  })

  it('order：出现 b 必须先出现 a', () => {
    const c = caze({ order: [['query_plan', 'update_plan']] })
    expect(judgeCase(c, { toolCalls: [{ name: 'query_plan' }, { name: 'update_plan' }] }).pass).toBe(true)
    expect(judgeCase(c, { toolCalls: [{ name: 'update_plan' }] }).pass).toBe(false)
    const r = judgeCase(c, { toolCalls: [{ name: 'update_plan' }, { name: 'query_plan' }] })
    expect(r.pass).toBe(false)
    expect(r.failures.join('')).toContain('必须在')
    // 没调 update_plan 时顺序断言不生效（别的断言负责管缺工具）
    expect(judgeCase(c, { toolCalls: [] }).pass).toBe(true)
  })

  it('args：按工具参数判定（网址截断 / 口头时间换算）', () => {
    const c = caze({ args: { read_url: (args) => args.url === 'https://a.com/' } })
    expect(judgeCase(c, { toolCalls: [{ name: 'read_url', args: { url: 'https://a.com/' } }] }).pass).toBe(true)
    const r = judgeCase(c, { toolCalls: [{ name: 'read_url', args: { url: 'https://a.com/阅读' } }] })
    expect(r.pass).toBe(false)
    expect(r.failures[0]).toContain('参数不符合预期')
    // 没调该工具 → 明确提示无法校验
    expect(judgeCase(c, { toolCalls: [] }).failures[0]).toContain('没有调用 read_url')
  })

  it('args 里抛错不会把整批跑挂', () => {
    const c = caze({ args: { create_bill: () => { throw new Error('boom') } } })
    const r = judgeCase(c, { toolCalls: [{ name: 'create_bill', args: {} }] })
    expect(r.pass).toBe(false)
    expect(r.failures[0]).toContain('抛错')
  })

  it('confirm：期望走确认闸门 / 不该走', () => {
    expect(judgeCase(caze({ confirm: true }), { toolCalls: [], confirm: true }).pass).toBe(true)
    expect(judgeCase(caze({ confirm: true }), { toolCalls: [] }).pass).toBe(false)
    expect(judgeCase(caze({ confirm: false }), { toolCalls: [], confirm: true }).pass).toBe(false)
  })

  it('replyIncludes / replyExcludes', () => {
    const c = caze({ replyIncludes: ['确认'], replyExcludes: ['已记录'] })
    expect(judgeCase(c, { toolCalls: [], reply: '需要你确认一下' }).pass).toBe(true)
    expect(judgeCase(c, { toolCalls: [], reply: '已记录' }).pass).toBe(false)
  })

  it('没有 expect 一律判失败（防止语料写漏）', () => {
    expect(judgeCase({ id: 'x' }, { toolCalls: [] }).pass).toBe(false)
    expect(judgeCase(null, {}).pass).toBe(false)
  })

  it('toolNamesOf 过滤空值', () => {
    expect(toolNamesOf([{ name: 'a' }, null, { name: '' }, { name: 'b' }])).toEqual(['a', 'b'])
    expect(toolNamesOf(null)).toEqual([])
  })
})

describe('runCase / runCases / summarizeResults', () => {
  const caseA = { id: 'a', title: 'A', message: 'm-a', expect: { tools: ['query_plan'] } }
  const caseB = { id: 'b', title: 'B', message: 'm-b', expect: { tools: ['create_diary'] } }

  it('runCase 把结果行组装好（含实际工具序列与耗时）', async () => {
    const row = await runCase(async () => ({ toolCalls: [{ name: 'query_plan' }], reply: 'ok' }), caseA)
    expect(row.status).toBe(CASE_STATUS.PASS)
    expect(row.gotTools).toEqual(['query_plan'])
    expect(row.id).toBe('a')
    expect(typeof row.ms).toBe('number')
  })

  it('runCase 把抛错记成 error 而不是整批挂掉', async () => {
    const row = await runCase(async () => { throw new Error('网络炸了') }, caseA)
    expect(row.status).toBe(CASE_STATUS.ERROR)
    expect(row.failures[0]).toContain('网络炸了')
  })

  it('runCases 顺序跑完并回调进度', async () => {
    const progress = []
    const rows = await runCases(async (msg) => ({
      toolCalls: [{ name: msg === 'm-a' ? 'query_plan' : 'create_diary' }]
    }), [caseA, caseB], { onProgress: (done, total) => progress.push(`${done}/${total}`) })
    expect(rows.map(r => r.status)).toEqual([CASE_STATUS.PASS, CASE_STATUS.PASS])
    expect(progress).toEqual(['1/2', '2/2'])
  })

  it('runCases 响应停止标志：停在哪条就是哪条', async () => {
    const stopRef = { stopped: false }
    const rows = await runCases(async () => {
      stopRef.stopped = true
      return { toolCalls: [{ name: 'query_plan' }] }
    }, [caseA, caseB], { stopRef })
    expect(rows).toHaveLength(1)
  })

  it('summarizeResults 出通过率，formatFailureReport 只列未通过项', async () => {
    const rows = await runCases(async (msg) => ({
      toolCalls: msg === 'm-a' ? [{ name: 'query_plan' }] : [{ name: 'create_bill' }],
      reply: '嗯'
    }), [caseA, caseB])
    const sum = summarizeResults(rows)
    expect(sum.total).toBe(2)
    expect(sum.pass).toBe(1)
    expect(sum.fail).toBe(1)
    expect(sum.rate).toBe(50)

    const text = formatFailureReport(rows)
    expect(text).toContain('通过：1/2（50%）')
    expect(text).toContain('B（b）')
    expect(text).toContain('create_bill')
    expect(text).not.toContain('## A（a）')
  })

  it('全通过时报告明说全通过', () => {
    const text = formatFailureReport([{ id: 'a', title: 'A', status: CASE_STATUS.PASS, gotTools: ['query_plan'], failures: [], ms: 1 }])
    expect(text).toContain('全部通过')
  })
})

describe('干跑模式：自检不写真实数据', () => {
  beforeEach(() => resetStorage())

  function scriptedResponder(rounds) {
    let round = 0
    return async () => {
      round++
      const script = rounds[Math.min(round - 1, rounds.length - 1)]
      if (typeof script === 'string') return { message: { role: 'assistant', content: script }, id: `mock_${round}` }
      return {
        message: {
          role: 'assistant',
          content: '',
          tool_calls: script.map((fn, i) => ({
            id: `call_${round}_${i}`,
            type: 'function',
            function: { name: fn.name, arguments: JSON.stringify(fn.args || {}) }
          }))
        },
        id: `mock_${round}`
      }
    }
  }

  /** 最小 store：只实现查询类要用的 executeAction，记录调用次数 */
  function makeStore() {
    const executeAction = vi.fn(({ type }) => {
      if (type === 'query_plan') {
        return {
          success: true,
          message: '找到 1 个计划',
          detail: { type: 'query_plan', count: 1, items: [{ client_id: 'plan_001', title: '六级备考计划', status: 1 }] }
        }
      }
      return { success: true, message: 'ok', detail: { type } }
    })
    return { store: { executeAction }, executeAction }
  }

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

  it('查询真跑、写入被闸门挡住：模型能拿到真实 client_id，数据一行没动', async () => {
    const executor = makeStore()
    const responder = scriptedResponder([
      [{ name: 'query_plan', args: { status: 'all' } }],
      [{ name: 'update_plan', args: { client_id: 'plan_001', deadline: '2026-12-12' } }],
      '计划已改到 12 月 12 日。'
    ])
    const result = await runAgentLoop(executor.store, '把计划改到 12 月 12 日', 'eval', cfgWith(responder), [])

    // 选了什么工具、什么顺序 —— 这正是自检要测的东西，两侧都完整记下来
    expect(result.toolCalls.map(c => c.name)).toEqual(['query_plan', 'update_plan'])
    expect(result.toolCalls[0].args).toEqual({ status: 'all' })
    expect(result.toolCalls[1].args.client_id).toBe('plan_001')
    // 查询只读、照常执行：模型拿到的就是真实数据（3.7.0 用占位结果，模型只能瞎答）
    const read = result.execResults.find(r => r.name === 'query_plan')
    expect(read.ok).toBe(true)
    expect(read.detail.count).toBe(1)
    expect(executor.executeAction).toHaveBeenCalledTimes(1)
    expect(executor.executeAction).toHaveBeenCalledWith({ type: 'query_plan', payload: { status: 'all' } })
    // 写操作被确认闸门挡在写入之前：自检不可能污染数据
    const write = result.execResults.find(r => r.name === 'update_plan')
    expect(write.confirm).toBe(true)
    expect(write.ok).toBe(false)
  })

  it('store 传 null 也不炸（查询失败被 executeTool 兜住，写依旧不落库）', async () => {
    const responder = scriptedResponder([
      [{ name: 'query_plan', args: {} }],
      [{ name: 'update_plan', args: { client_id: 'plan_001' } }],
      '好。'
    ])
    const result = await runAgentLoop(null, '改计划', 'eval', cfgWith(responder), [])
    expect(result.toolCalls.map(c => c.name)).toEqual(['query_plan', 'update_plan'])
    expect(result.execResults.find(r => r.name === 'query_plan').ok).toBe(false)
  })

  it('关掉确认闸门（siji_auto_write）后干跑真正走 dryRunResult：ok 为真、标记 dryRun、依旧不写库', async () => {
    uni.setStorageSync('siji_auto_write', '1')
    const executeAction = vi.fn()
    const responder = scriptedResponder([
      [{ name: 'create_diary', args: { content: '今天去图书馆看书' } }],
      '记好了。'
    ])
    const result = await runAgentLoop(null, '记录：今天去图书馆看书', 'eval', cfgWith(responder), [])
    expect(result.toolCalls.map(c => c.name)).toEqual(['create_diary'])
    expect(result.execResults[0].ok).toBe(true)
    expect(result.execResults[0].detail.dryRun).toBe(true)
    expect(executeAction).not.toHaveBeenCalled()
  })

  it('干跑下大额记账仍然走确认闸门（确认是闸门，不是写入）', async () => {
    const responder = scriptedResponder([
      [{ name: 'create_bill', args: { amount: 1500, category: '房租', bill_date: dayStr(0) } }]
    ])
    const result = await runAgentLoop(null, '记一笔房租 1500', 'eval', cfgWith(responder), [])
    expect(result.execResults.some(r => r.confirm)).toBe(true)
    expect(result.reply).toContain('确认')
    expect(result.toolCalls.map(c => c.name)).toEqual(['create_bill'])
  })

  it('干跑不碰网络工具：read_url 不发请求，只记录调用', async () => {
    let requested = false
    const originalRequest = global.uni.request
    global.uni.request = () => { requested = true }
    const responder = scriptedResponder([
      [{ name: 'read_url', args: { url: 'https://www.deepseek.com/' } }],
      '读完了。'
    ])
    const result = await runAgentLoop(null, 'https://www.deepseek.com/阅读这个网址', 'eval', cfgWith(responder), [])
    global.uni.request = originalRequest
    expect(requested).toBe(false)
    expect(result.toolCalls[0].name).toBe('read_url')
  })

  it('两条执行路径合并：tool_calls 与老 JSON action 都算「用了工具」（3.7.1）', async () => {
    // 原生工具调用
    expect(mergeExecutedTools({ toolCalls: [{ name: 'create_bill', args: { amount: 25 } }] }))
      .toEqual([{ name: 'create_bill', args: { amount: 25 }, source: 'tool' }])
    // 老 JSON action（模型没调工具、只回 JSON）→ response-parser 解析出的 action
    expect(mergeExecutedTools({ toolCalls: [], action: { type: 'create_diary', payload: { content: 'x' } } }))
      .toEqual([{ name: 'create_diary', args: { content: 'x' }, source: 'json' }])
    // 复合意图的 actions 数组
    const multi = mergeExecutedTools({ toolCalls: [], actions: [{ type: 'create_bill', payload: {} }, { type: 'create_diary', payload: {} }] })
    expect(multi.map(t => t.name)).toEqual(['create_bill', 'create_diary'])
    expect(multi.every(t => t.source === 'json')).toBe(true)
    // 什么都没调 → 空（判定层据此报「缺少工具」）
    expect(mergeExecutedTools({ toolCalls: [] })).toEqual([])
    expect(mergeExecutedTools(null)).toEqual([])
  })

  it('JSON 兜底路径的用例不再被判成「没调工具」', async () => {
    const caze = { id: 'json-path', title: '记账走 JSON 兜底', message: '记一笔午饭 25', expect: { tools: ['create_bill'] } }
    const row = await runCase(async () => ({
      toolCalls: mergeExecutedTools({ toolCalls: [], action: { type: 'create_bill', payload: { amount: 25, bill_date: dayStr(0) } } }),
      reply: '记好了，午饭 ¥25'
    }), caze)
    expect(row.status).toBe(CASE_STATUS.PASS)
    expect(row.gotTools).toEqual(['create_bill'])
    expect(row.jsonTools).toEqual(['create_bill'])
  })

  it('失败明细会标出 JSON 兜底步数', async () => {
    const rows = [{
      id: 'x', title: 'X', status: CASE_STATUS.FAIL, ms: 1,
      gotTools: ['create_bill'], jsonTools: ['create_bill'], failures: ['缺少工具 create_diary'], message: 'm'
    }]
    const text = formatFailureReport(rows)
    expect(text).toContain('其中 1 步走 JSON 兜底')
  })

  it('整套语料能在干跑下跑完（用脚本化回复验证编排，不打真实模型）', async () => {
    const executeAction = vi.fn()
    const responder = async (body) => {
      // 每轮都先读一次工具名做点判断，保证走的是工具轮 → 最终回复
      const last = body.messages[body.messages.length - 1]
      if (last && last.role === 'tool') return { message: { role: 'assistant', content: '好，处理完了。' }, id: 'x' }
      return {
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [{ id: 'c1', type: 'function', function: { name: 'query_plan', arguments: '{}' } }]
        },
        id: 'x'
      }
    }
    // 带 needs 的用例要有数据前置才跑（这里给一条假计划，账单缺省 → 那条会跳过）
    const ctx = { plan: '测试计划', planId: 'plan_001' }
    const rows = await runCases((message) => runAgentLoop(null, message, 'eval', cfgWith(responder), []), EVAL_CASES, { ctx })
    expect(rows).toHaveLength(EVAL_CASES.length)
    expect(rows.every(r => r.status !== CASE_STATUS.ERROR)).toBe(true)
    expect(executeAction).not.toHaveBeenCalled()
    // 脚本一律只调 query_plan：只读用例应当过，要求写工具的用例应当判失败
    const planQuery = rows.find(r => r.id === 'plan-query')
    const planChange = rows.find(r => r.id === 'plan-change-content')
    const casual = rows.find(r => r.id === 'casual-no-tools')
    expect(planQuery.status).toBe(CASE_STATUS.PASS)
    expect(casual.status).toBe(CASE_STATUS.PASS)
    expect(planChange.status).toBe(CASE_STATUS.FAIL)
    expect(planChange.failures.join('')).toContain('缺少工具 update_plan')
  })
})