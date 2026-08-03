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
