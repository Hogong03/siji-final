import { describe, it, expect, beforeEach } from 'vitest'
import './setup.js'
import { encryptKey, decryptKey, encryptKeys, decryptKeys } from '@/utils/crypto.js'

describe('crypto.js', () => {
  beforeEach(() => { global.uni.clearStorageSync?.() })

  it('encryptKey 应返回 enc: 前缀的加密字符串', () => {
    const result = encryptKey('sk-test-123456')
    expect(result).toMatch(/^enc:/)
    expect(result).not.toContain('sk-test')
  })

  it('decryptKey 应还原加密前的明文', () => {
    const original = 'sk-deepseek-abcdefgh'
    const encrypted = encryptKey(original)
    const decrypted = decryptKey(encrypted)
    expect(decrypted).toBe(original)
  })

  it('decryptKey 对明文输入应直接返回（兼容旧版）', () => {
    expect(decryptKey('sk-legacy-plaintext')).toBe('sk-legacy-plaintext')
    expect(decryptKey('')).toBe('')
  })

  it('encryptKeys/decryptKeys 应支持对象级加解密', () => {
    const keys = { deepseek: 'sk-ds-123', openai: 'sk-oa-456' }
    const encrypted = encryptKeys(keys)
    expect(typeof encrypted).toBe('string')
    expect(encrypted).not.toContain('sk-ds')
    expect(encrypted).not.toContain('sk-oa')

    const decrypted = decryptKeys(encrypted)
    expect(decrypted.deepseek).toBe('sk-ds-123')
    expect(decrypted.openai).toBe('sk-oa-456')
  })

  it('decryptKeys 对空值应返回空对象', () => {
    expect(decryptKeys('')).toEqual({})
    expect(decryptKeys(null)).toEqual({})
  })

  it('encryptKey 对空值应返回空字符串', () => {
    expect(encryptKey('')).toBe('')
    expect(encryptKey(null)).toBe('')
  })
})
