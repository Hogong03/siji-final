/**
 * 3.4 M1 能量模式（纯本地推断）测试
 * 覆盖：空输入中档、低档触发、否定不触发、极低档、积极抵消、energyScan 注入口径
 */
import { describe, it, expect } from 'vitest'
import { inferEnergyLevel, energyScan } from '../utils/energy-context.js'

describe('inferEnergyLevel', () => {
  it('空输入 / 无信号 → medium', () => {
    expect(inferEnergyLevel([]).level).toBe('medium')
    expect(inferEnergyLevel(['今天天气不错呀']).level).toBe('medium')
  })

  it('低能量词 → low', () => {
    expect(inferEnergyLevel(['今天好累']).level).toBe('low')
    expect(inferEnergyLevel(['好烦，什么都不想动']).level).toBe('low')
  })

  it('否定句不触发低档（不累 / 没太累）', () => {
    const r1 = inferEnergyLevel(['今天不累，精神很好'])
    expect(r1.level).not.toBe('low')
    const r2 = inferEnergyLevel(['其实没太累，就是有点困'])
    expect(r2.level).not.toBe('very_low')
  })

  it('极低词 → very_low', () => {
    expect(inferEnergyLevel(['我今天真的崩溃了，动不了']).level).toBe('very_low')
    expect(inferEnergyLevel(['撑不住了']).level).toBe('very_low')
  })

  it('积极事件可抵消轻度低落 → medium', () => {
    const r = inferEnergyLevel(['今天有点累，但出门走了走，心情不错'])
    expect(r.level).toBe('medium')
  })

  it('积极累计且无低档 → high', () => {
    expect(inferEnergyLevel(['今天状态很好，很精神，很有活力']).level).toBe('high')
  })
})

describe('energyScan（chat 注入）', () => {
  it('中档不注入任何文本（零 token）', () => {
    const r = energyScan('今天天气不错', [])
    expect(r.level).toBe('medium')
    expect(r.text).toBe('')
  })

  it('低档注入降载指令：1 分钟 / 先放一放', () => {
    const r = energyScan('今天好累，什么都不想动', [])
    expect(r.level).toBe('low')
    expect(r.text).toContain('1 分钟')
    expect(r.text).toContain('先放一放')
    expect(r.text).not.toContain('加油')
  })

  it('极低档注入最短回应口径', () => {
    const r = energyScan('真的崩溃了，什么都不想做', [])
    expect(r.level).toBe('very_low')
    expect(r.text).toContain('1-2 句')
  })

  it('历史消息参与推断（最新消息权重最高）', () => {
    // 前一天低落、今天平静 → 不再是低档
    const history = [
      { role: 'user', content: '昨天好累' },
      { role: 'assistant', content: '早点休息' },
      { role: 'user', content: '嗯，今天还好' }
    ]
    const r = energyScan('起来喝了口水', history)
    expect(r.level).not.toBe('low')
  })
})
