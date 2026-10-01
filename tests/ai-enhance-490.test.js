/**
 * 4.9.0 AI 强化回归 — lite 接线 / 实体命中排序
 *
 * 锁死：
 *  - 闲聊消息（无指令动词）走 LITE_ACTIONS 精简 system prompt，比完整版显著更小
 *  - 指令消息 / agent 路径强制完整 schema
 *  - 结构化记忆：query 点名实体时，该实体的卡片与事件排最前（记忆「可点名」）
 */
import { describe, it, expect } from 'vitest'
import './setup.js'
import { buildChatMessages } from '../utils/ai/chat-helpers.js'
import { buildSystemPrompt } from '../utils/ai/prompt-builder.js'
import { resetStorage } from './setup.js'
import { buildStructuredMemoryContext, upsertEntity, upsertRelation, addStructuredEvent } from '../utils/memory-structured.js'

describe('lite 接线（4.9.0）', () => {
  it('闲聊消息的 system 用精简 schema（不含 update_diary 等完整段）', () => {
    const msgs = buildChatMessages('今天心情不错啊', [], {})
    const system = msgs[0].content
    expect(system).not.toContain('update_diary:')
    expect(system).not.toContain('query_plan:')
  })

  it('指令消息保持完整 schema', () => {
    const msgs = buildChatMessages('帮我记一下今天花了25块', [], {})
    const system = msgs[0].content
    expect(system).toContain('create_bill:')
  })

  it('显式 lite:false（agent 路径）强制完整 schema', () => {
    const msgs = buildChatMessages('今天心情不错啊', [], {}, { lite: false })
    expect(msgs[0].content).toContain('update_diary:')
  })

  it('lite 版 system prompt 显著小于完整版', () => {
    const lite = buildSystemPrompt(false, { lite: true })
    const full = buildSystemPrompt(false, { lite: false })
    expect(lite.length).toBeLessThan(full.length * 0.8)
  })
})

describe('结构化记忆实体命中（4.9.0）', () => {
  it('query 点名实体 → 该实体排最前、相关事件前置', () => {
    resetStorage()
    upsertEntity('小雅', 'person', { 角色: '朋友' })
    upsertEntity('老张', 'person', { 角色: '同事' })
    upsertRelation('小雅', '朋友', '我')
    addStructuredEvent('和小雅逛街', '2026-10-01')
    addStructuredEvent('和老张开会', '2026-09-30')

    const hit = buildStructuredMemoryContext('小雅最近怎么样')
    const hitIdx = hit.indexOf('小雅')
    const otherIdx = hit.indexOf('老张')
    expect(hitIdx).toBeGreaterThanOrEqual(0)
    expect(hitIdx).toBeLessThan(otherIdx)
    // 命中实体的事件前置
    expect(hit.indexOf('和小雅逛街')).toBeLessThan(hit.indexOf('和老张开会'))

    // 不点名时保持最近顺序（老张后写入 → 在前）
    const plain = buildStructuredMemoryContext('最近怎么样')
    expect(plain.indexOf('老张')).toBeLessThan(plain.indexOf('小雅'))
  })
})
