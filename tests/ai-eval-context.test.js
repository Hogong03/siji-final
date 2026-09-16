/**
 * 自检的数据前置与幻觉动作（3.7.2）
 *
 * 3.7.1 首跑 17/23、4 条未过的共同真因：语料引用了用户库里并不存在的计划/账单
 * （实测他只有「一年读完12本有意思的书」一个计划、没有 ¥35 的午饭账单），
 * 模型查完如实说「没找到，要不要新建」——行为正确却被判失败。
 * 这一版把语料改成占位符，跑批前从真实数据取值；取不到判跳过。
 *
 * 另一条真 Bug：模型幻觉出 type:'batch' 想表达复合意图，以前当成「执行了但失败」，
 * 兜底与提示都接管不了（结果是「都记好了」既没落库也没人纠正）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { resetStorage } from './setup.js'
import './setup.js'
import {
  buildEvalContext, resolveCase, runCase, runCases, summarizeResults,
  mergeExecutedTools, formatFailureReport, CASE_STATUS
} from '../utils/ai/eval/runner.js'
import { EVAL_CASES } from '../utils/ai/eval/cases.js'
import { useDataStore } from '../store/data.js'
import { executeTool } from '../utils/ai/tools.js'
import { autoExecuteAndDisplay } from '../utils/ai/autoExecutor.js'

const PLANS = [{ client_id: 'plan_001', title: '一年读完12本有意思的书', status: 1 }]
const BILLS = [{ client_id: 'bill_001', type: 'expense', amount: 35, category: '餐饮', bill_date: '2026-09-16' }]

describe('buildEvalContext：从真实数据取值', () => {
  it('取第一条进行中的计划 + 第一笔支出', () => {
    const ctx = buildEvalContext({ plans: PLANS, bills: BILLS })
    expect(ctx.plan).toBe('一年读完12本有意思的书')
    expect(ctx.billAmount).toBe(35)
    expect(ctx.billAmountPlus).toBe(53)
  })

  it('已完成计划不算前置；没有数据时是空值', () => {
    const done = buildEvalContext({ plans: [{ title: '旧计划', status: 2 }], bills: [] })
    expect(done.plan).toBe('')
    // 没有账单时金额是空串（不是 0）：占位符保持原样，避免「不是 0 是 0」这种废话
    expect(done.billAmount).toBe('')
    expect(buildEvalContext().plan).toBe('')
  })

  it('收入账单不当成「可修改的那一笔」', () => {
    const ctx = buildEvalContext({ bills: [{ type: 'income', amount: 5000 }, { type: 'expense', amount: 12 }] })
    expect(ctx.billAmount).toBe(12)
  })
})

describe('resolveCase：占位符替换与前置判定', () => {
  it('{plan} 替换成真实计划名；没有前置时报缺', () => {
    const caze = { id: 'x', needs: 'plan', message: '把「{plan}」的截止时间改到 12 月 12 日' }
    const ok = resolveCase(caze, buildEvalContext({ plans: PLANS }))
    expect(ok.ok).toBe(true)
    expect(ok.message).toBe('把「一年读完12本有意思的书」的截止时间改到 12 月 12 日')

    const miss = resolveCase(caze, buildEvalContext({ plans: [] }))
    expect(miss.ok).toBe(false)
    expect(miss.missing).toEqual(['plan'])
    expect(miss.message).toContain('{plan}')  // 没值就保留原样，方便肉眼看出缺什么
  })

  it('不需要前置的用例一律可跑', () => {
    const r = resolveCase({ id: 'y', message: '记一笔午饭 25' }, {})
    expect(r.ok).toBe(true)
    expect(r.message).toBe('记一笔午饭 25')
  })
})

describe('缺数据前置 → 判跳过而不是失败', () => {
  const caze = { id: 'plan-change-content', title: 't', needs: 'plan', message: '「{plan}」改一下', expect: { tools: ['update_plan'] } }

  it('没有计划时跳过，并说清缺什么', async () => {
    let called = false
    const row = await runCase(async () => { called = true; return {} }, caze, buildEvalContext({ plans: [] }))
    expect(row.status).toBe(CASE_STATUS.SKIP)
    expect(row.failures[0]).toContain('缺少数据前置')
    expect(row.failures[0]).toContain('一条进行中的计划')
    expect(called).toBe(false)  // 没前置就不该打模型
  })

  it('有计划时用真实名字跑，判定照常', async () => {
    const seen = []
    const row = await runCase(async (message) => {
      seen.push(message)
      return { toolCalls: [{ name: 'query_plan' }, { name: 'update_plan' }] }
    }, caze, buildEvalContext({ plans: PLANS }))
    expect(row.status).toBe(CASE_STATUS.PASS)
    expect(seen[0]).toBe('「一年读完12本有意思的书」改一下')
  })

  it('跳过不进通过率分母', async () => {
    const rows = await runCases(async () => ({ toolCalls: [{ name: 'update_plan' }] }), [caze], { ctx: buildEvalContext({ plans: [] }) })
    const sum = summarizeResults(rows)
    expect(sum.skip).toBe(1)
    expect(sum.scored).toBe(0)
    expect(sum.rate).toBe(0)
    expect(formatFailureReport(rows)).toContain('跳过 1 条')
  })

  it('有前置时 22 条语料里带 needs 的都拿得到值', () => {
    const ctx = buildEvalContext({ plans: PLANS, bills: BILLS })
    const needsList = EVAL_CASES.filter(c => c.needs)
    expect(needsList.length).toBeGreaterThan(0)
    needsList.forEach(c => expect(resolveCase(c, ctx).ok).toBe(true))
  })
})

describe('幻觉动作类型：不执行、不谎报（3.7.2）', () => {
  beforeEach(() => {
    resetStorage()
    setActivePinia(createPinia())
  })

  it('store.isKnownActionType 只认 ACTION_MAP 里的类型', () => {
    const store = useDataStore()
    expect(store.isKnownActionType('create_bill')).toBe(true)
    expect(store.isKnownActionType('undo_last')).toBe(true)
    expect(store.isKnownActionType('batch')).toBe(false)
    expect(store.isKnownActionType('none')).toBe(false)
    expect(store.isKnownActionType('')).toBe(false)
  })

  /** autoExecuteAndDisplay 要的 store：真 executeAction + 收 updateLastMessage 的桩 */
  function makeAppStore() {
    const data = useDataStore()
    const writes = []
    const store = {
      executeAction: (a) => data.executeAction(a),
      executeActions: (l) => data.executeActions(l),
      isKnownActionType: (t) => data.isKnownActionType(t),
      updateLastMessage: (p) => { writes.push(p) }
    }
    return { store, writes }
  }

  it('未知 action 不落到 store.executeAction，走兜底并修正回复', () => {
    const { store, writes } = makeAppStore()
    const spy = vi.spyOn(store, 'executeAction')
    const result = {
      reply: '都记好了，午餐 ¥35',
      action: { type: 'batch', payload: { items: [] } },
      actions: []
    }
    autoExecuteAndDisplay(store, result, result.reply, '记一笔午餐 35，再写个记录说今天开会开到六点')
    // batch 不是真类型 → 不该拿它去执行
    expect(spy.mock.calls.some(c => c[0] && c[0].type === 'batch')).toBe(false)
    // 兜底把能救的那半救回来（记账），回复被改写成「收到 + 提示」
    expect(spy.mock.calls.some(c => c[0] && c[0].type === 'create_bill')).toBe(true)
    expect(writes.length).toBe(1)
    expect(writes[0].execResult.detail.type).toBe('bill')  // 账单实体的 detail.type 是 'bill'
  })

  it('自检的合并逻辑同样不把 batch 当工具（与 autoExecutor 一致）', () => {
    const store = useDataStore()
    const isKnownType = (t) => store.isKnownActionType(t)
    const merged = mergeExecutedTools({ toolCalls: [], action: { type: 'batch', payload: {} } }, { isKnownType })
    expect(merged).toEqual([])
    const keep = mergeExecutedTools({ toolCalls: [], action: { type: 'create_bill', payload: { amount: 35 } } }, { isKnownType })
    expect(keep.map(t => t.name)).toEqual(['create_bill'])
  })

  it('模型调用不存在的工具名 → 明确回传，不静默失败', () => {
    const store = useDataStore()
    const r = executeTool(store, 'batch', { items: [] })
    expect(r.ok).toBe(false)
    expect(r.text).toContain('不存在名为 batch 的工具')
    // 真工具照常
    expect(executeTool(store, 'query_plan', {}).ok).toBe(true)
  })
})