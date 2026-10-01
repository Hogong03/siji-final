/**
 * AI 审查修复回归（4.5.1）
 *
 * 锁死本轮扫描修掉的问题：
 *  - P1 query 结果文本必须带 client_id（「先查后改」的链路根：原来查到了也改不了）
 *  - P2 混合轮：需确认写入与查询同轮时，查询照常执行、结果回传，只挂起确认项
 *  - P2 兜底产出的 create_bill 同样要过确认闸门（原来 needConfirm:false 绕过大额确认）
 *  - P3 非空短 query 零命中不再回落注入最近 30 条记忆
 */
import { describe, it, expect } from 'vitest'
import './setup.js'
import { runAgentChat } from '../utils/ai/agent-loop.js'
import { executeTool } from '../utils/ai/tools.js'
import { extractFallbackAction } from '../utils/ai/fallback.js'
import { selectMemories } from '../utils/memory-rank.js'
import { resetStorage } from './setup.js'

/** mock store：query_bill 返回一条带 id 的账单，其余写操作原样成功 */
function makeStore() {
  return {
    executeAction(action) {
      if (action && action.type === 'query_bill') {
        return {
          success: true, message: 'ok',
          detail: {
            month: '2026-09', count: 1,
            items: [{ client_id: 'bill_1', type: 'expense', amount: 30, category: '餐饮', bill_date: '2026-09-28' }]
          }
        }
      }
      return { success: true, message: '已执行', detail: { type: action && action.type } }
    }
  }
}

describe('P1：query 结果带 client_id', () => {
  it('query_bill 的结果文本含 [id:...]，模型拿得到改单的钥匙', () => {
    const r = executeTool(makeStore(), 'query_bill', {})
    expect(r.ok).toBe(true)
    expect(r.text).toContain('[id:bill_1]')
  })
})

describe('P2：混合轮不静默丢弃', () => {
  it('同一轮「查询 + 大额写入」：查询照常执行回传，写入挂起确认卡', async () => {
    let round = 0
    const responder = () => {
      round++
      if (round === 1) {
        return {
          message: {
            role: 'assistant', content: '',
            tool_calls: [
              { id: 'q1', type: 'function', function: { name: 'query_bill', arguments: '{}' } },
              { id: 'w1', type: 'function', function: { name: 'create_bill', arguments: JSON.stringify({ type: 'expense', amount: 5000, category: '房租' }) } }
            ]
          },
          id: 'mock1'
        }
      }
      return { message: { role: 'assistant', content: '已确认' }, id: 'mock2' }
    }
    const cfg = { provider: 'deepseek', model: 'deepseek-v4-flash', apiKey: 'mock-' + 'key', temperature: 0, _mockResponder: responder }
    const result = await runAgentChat(makeStore(), '看下这月账单，再把五千块房租记上', 'conv_mix', cfg, [])
    // 查询执行了、结果进了 execResults（模型与用户都看得见）
    expect(result.execResults.some(r => r.name === 'query_bill' && r.ok)).toBe(true)
    // 写入没有静默执行，而是挂起确认
    const confirmEntry = result.execResults.find(r => r.name === 'create_bill')
    expect(confirmEntry.confirm).toBe(true)
    expect(result.action.type).toBe('create_bill')
    expect(result.reply).toContain('确认')
  })
})

describe('P2：兜底产出的记账要过确认', () => {
  it('extractFallbackAction 的 create_bill needConfirm=true，大额不再绕闸门', () => {
    const a = extractFallbackAction('记一笔昨天的午饭 25', '记好了~')
    expect(a).toBeTruthy()
    expect(a.type).toBe('create_bill')
    expect(a.needConfirm).toBe(true)
  })
})

describe('P3：非空短 query 不回落注入', () => {
  const memories = [{ content: '喜欢吃辣', type: 'preference', createdAt: 1, updatedAt: 1 }]
  it('「嗯」这类零命中短 query 返回空，空 query 保留回落', () => {
    expect(selectMemories('嗯', memories)).toEqual([])
    expect(selectMemories('', memories)).toHaveLength(1)
  })
})
