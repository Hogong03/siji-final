import { describe, it, expect } from 'vitest'
import { parseAiResponse } from '../utils/ai/response-parser.js'

describe('操作完成语兜底标记', () => {
  it('reply 含"已帮你记录"但 action 为 none → 标记 _opClaimWithoutAction', () => {
    const raw = JSON.stringify({
      reply: '抱歉，我理解错了。现在已帮你记录下朱大根，你的朋友。📝',
      action: { type: 'none', payload: {}, needConfirm: false },
      actions: []
    })
    const result = parseAiResponse(raw, 'test')
    expect(result._opClaimWithoutAction).toBe(true)
    // reply 不被修改，交由 autoExecutor 决定
    expect(result.reply).toContain('已帮你')
  })

  it('reply 含"记好了"但 action 为 null → 标记 _opClaimWithoutAction', () => {
    const raw = JSON.stringify({
      reply: '记好了，午餐 ¥25',
      action: null,
      actions: []
    })
    const result = parseAiResponse(raw, 'test')
    expect(result._opClaimWithoutAction).toBe(true)
  })

  it('reply 含"已记录"但有有效 action → 不标记', () => {
    const raw = JSON.stringify({
      reply: '已记录，午餐 ¥25',
      action: { type: 'create_bill', payload: { amount: 25 }, needConfirm: false }
    })
    const result = parseAiResponse(raw, 'test')
    expect(result._opClaimWithoutAction).toBe(false)
    expect(result.action).not.toBeNull()
  })

  it('正常聊天 reply 不含操作完成语 → 不标记', () => {
    const raw = JSON.stringify({
      reply: '嗯，听起来不错',
      action: { type: 'none', payload: {}, needConfirm: false }
    })
    const result = parseAiResponse(raw, 'test')
    expect(result._opClaimWithoutAction).toBe(false)
  })
})

/* ==================== 3.7.1：AI 效果自检首跑暴露的静默丢数据 ==================== */

import { OP_CLAIM_RE, OP_CLAIM_RE_FALLBACK } from '../utils/ai/constants.js'
import { extractFallbackAction } from '../utils/ai/fallback.js'
import { formatDateStr } from '../utils/store-helpers.js'

describe('声称操作的说法：识别集必须覆盖实测原话（3.7.1）', () => {
  // 以下五条回复全部来自 2026-09-16 的 AI 效果自检首跑（模型没调工具、只口头答应）
  const OBSERVED = [
    '记好了，昨天午饭 ¥25',
    '记好了，前天(9月14日)打车 ¥48~',
    '记好了，房租 ¥1500',
    '记下来了，上官婉儿冲金标这波稳住了~',
    '记下来啦，今天泡图书馆看书，挺充实的～'
  ]

  it('收窄集认得这五条 —— Agent 路径的兜底闸门就靠它', () => {
    OBSERVED.forEach((reply) => {
      expect(OP_CLAIM_RE_FALLBACK.test(reply)).toBe(true)
    })
  })

  it('基础集也认得（response-parser 标记 + 重写回复时都要用）', () => {
    OBSERVED.forEach((reply) => {
      expect(OP_CLAIM_RE.test(reply)).toBe(true)
    })
  })

  it('普通闲聊不被误判成声称操作', () => {
    expect(OP_CLAIM_RE_FALLBACK.test('我记得你说过想去爬山')).toBe(false)
    expect(OP_CLAIM_RE_FALLBACK.test('这个想法不错，慢慢来')).toBe(false)
  })
})

describe('记账兜底：模型不调工具时也能把账救回来（3.7.1）', () => {
  function yesterday() {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return formatDateStr(d)
  }
  function dayBeforeYesterday() {
    const d = new Date()
    d.setDate(d.getDate() - 2)
    return formatDateStr(d)
  }

  it('「记一笔昨天的午饭 25」→ create_bill，金额 25、日期是昨天', () => {
    const a = extractFallbackAction('记一笔昨天的午饭 25', '记好了，昨天午饭 ¥25')
    expect(a && a.type).toBe('create_bill')
    expect(a.payload.amount).toBe(25)
    expect(a.payload.type).toBe('expense')
    expect(a.payload.bill_date).toBe(yesterday())
  })

  it('「记一笔前天的打车费 48」→ 日期是前天', () => {
    const a = extractFallbackAction('记一笔前天的打车费 48', '记好了，前天(9月14日)打车 ¥48~')
    expect(a.payload.amount).toBe(48)
    expect(a.payload.bill_date).toBe(dayBeforeYesterday())
  })

  it('「记一笔房租 1500」→ 金额取 1500，不编日期（今天走默认）', () => {
    const a = extractFallbackAction('记一笔房租 1500', '记好了，房租 ¥1500')
    expect(a.payload.amount).toBe(1500)
    expect(a.payload.bill_date).toBeUndefined()
  })

  it('「元 / 块」后缀优先于裸数字', () => {
    const a = extractFallbackAction('记一笔 3 月 15 日买书 45 元', '记好了')
    expect(a.payload.amount).toBe(45)
  })

  it('记录类原话仍然走 create_diary（不受记账扩展影响）', () => {
    const a = extractFallbackAction('记录：今天用上官婉儿冲金标，赢了三把', '记下来了')
    expect(a && a.type).toBe('create_diary')
  })
})
