import { describe, it, expect } from 'vitest'
import { generateClientId, generateConversationId, generateEntityId } from '@/utils/uuid.js'

describe('uuid.js', () => {
  it('generateClientId 应生成唯一ID', () => {
    const id1 = generateClientId()
    const id2 = generateClientId()
    expect(id1).not.toBe(id2)
    expect(id1).toMatch(/^[a-z0-9]+-[a-z0-9]+$/)
  })

  it('generateConversationId 应带 conv_ 前缀', () => {
    const id = generateConversationId()
    expect(id).toMatch(/^conv_[a-z0-9]+_[a-z0-9]+$/)
  })

  it('generateEntityId 应支持自定义前缀', () => {
    const id = generateEntityId('diary')
    expect(id).toMatch(/^diary_[a-z0-9]+_[a-z0-9]+$/)
  })

  it('generateEntityId 无前缀应返回 undefined 前缀', () => {
    const id = generateEntityId()
    expect(id).toMatch(/^undefined_[a-z0-9]+_[a-z0-9]+$/)
  })
})
