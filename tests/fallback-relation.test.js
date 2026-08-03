import { describe, it, expect } from 'vitest'
import { extractFallbackAction } from '../utils/ai/fallback.js'

describe('extractFallbackAction — 关系图谱兜底', () => {
  it('用户说"汪澄是我女朋友" + AI回复"已记录" → 提取 create_relation', () => {
    const action = extractFallbackAction('汪澄是我女朋友', '已记录，汪澄，你的女朋友。👩‍❤️‍👨')
    expect(action).not.toBeNull()
    expect(action.type).toBe('create_relation')
    expect(action.payload.name).toBe('汪澄')
    expect(action.payload.relation).toBe('女朋友')
  })

  it('用户说"记住朱大根是我的朋友" → 提取 create_relation', () => {
    const action = extractFallbackAction('记住朱大根是我的朋友', '已帮你记录下朱大根，你的朋友。')
    expect(action).not.toBeNull()
    expect(action.type).toBe('create_relation')
    expect(action.payload.name).toBe('朱大根')
    expect(action.payload.relation).toBe('朋友')
  })

  it('用户说"张三是我同事" → relation=同事', () => {
    const action = extractFallbackAction('张三是我同事', '已记录')
    expect(action).not.toBeNull()
    expect(action.payload.name).toBe('张三')
    expect(action.payload.relation).toBe('同事')
  })

  it('用户说"李四是我老婆" → relation=老婆', () => {
    const action = extractFallbackAction('李四是我老婆', '已记录')
    expect(action).not.toBeNull()
    expect(action.payload.name).toBe('李四')
    expect(action.payload.relation).toBe('老婆')
  })

  it('用户说"叫王五，是我同学" → name=王五 relation=同学', () => {
    const action = extractFallbackAction('叫王五，是我同学', '已帮你记录')
    expect(action).not.toBeNull()
    expect(action.payload.name).toBe('王五')
    expect(action.payload.relation).toBe('同学')
  })

  it('用户说"朱大根是我同事" + AI回复"已更新" → 提取 create_relation', () => {
    const action = extractFallbackAction('朱大根是我同事', '已更新，朱大根，你的同事。👩‍💼👨‍💼')
    expect(action).not.toBeNull()
    expect(action.type).toBe('create_relation')
    expect(action.payload.name).toBe('朱大根')
    expect(action.payload.relation).toBe('同事')
  })

  it('非关系消息 → 返回 null', () => {
    const action = extractFallbackAction('今天天气不错', '嗯，确实')
    expect(action).toBeNull()
  })
})
