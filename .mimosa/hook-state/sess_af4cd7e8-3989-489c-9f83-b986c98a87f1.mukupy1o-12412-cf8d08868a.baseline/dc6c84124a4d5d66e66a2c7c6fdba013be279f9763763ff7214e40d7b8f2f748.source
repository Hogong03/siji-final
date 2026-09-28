/**
 * 3.0 M3 — AI 写操作默认需确认（needsConfirmation 设置感知）
 */
import { describe, it, expect, afterEach } from 'vitest'
import { needsConfirmation, TOOL_LABELS } from '../utils/ai/tools.js'

describe('needsConfirmation — 写操作确认规则（3.0）', () => {
  afterEach(() => {
    delete globalThis.uni
  })

  it('uni 环境默认（未开自动执行）→ 写工具需确认', () => {
    globalThis.uni = { getStorageSync: () => '' }
    expect(needsConfirmation('create_diary', { content: 'x' })).toBe(true)
    expect(needsConfirmation('create_bill', { amount: 10 })).toBe(true)
    expect(needsConfirmation('update_plan', { client_id: 'p1' })).toBe(true)
    expect(needsConfirmation('smart_update_profile', {})).toBe(true)
    expect(needsConfirmation('add_tag', { name: 'x' })).toBe(true)
    expect(needsConfirmation('create_agent', { name: 'x', systemPrompt: 'y' })).toBe(true)
  })

  it('查询 / 撤销 / 联网搜索不确认', () => {
    globalThis.uni = { getStorageSync: () => '' }
    expect(needsConfirmation('query_diary', {})).toBe(false)
    expect(needsConfirmation('query_stat', {})).toBe(false)
    expect(needsConfirmation('undo_last', {})).toBe(false)
    expect(needsConfirmation('web_search', { query: 'x' })).toBe(false)
  })

  it('开启自动执行后 → 写入直接执行，大额账单仍确认', () => {
    globalThis.uni = { getStorageSync: () => '1' }
    expect(needsConfirmation('create_diary', { content: 'x' })).toBe(false)
    expect(needsConfirmation('create_bill', { amount: 100 })).toBe(false)
    expect(needsConfirmation('create_bill', { amount: 500 })).toBe(true)
    expect(needsConfirmation('update_bill', { amount: 999 })).toBe(true)
  })

  it('非 uni 环境（单测/降级）保持旧行为：写入不确认', () => {
    expect(needsConfirmation('create_diary', { content: 'x' })).toBe(false)
  })

  it('TOOL_LABELS 覆盖写工具中文标签（确认文案不暴露英文工具名）', () => {
    expect(TOOL_LABELS.create_diary).toBe('写记录')
    expect(TOOL_LABELS.create_agent).toBe('创建 Agent')
    expect(TOOL_LABELS.smart_update_profile).toBe('更新个人信息')
  })
})
