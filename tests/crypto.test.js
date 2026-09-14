import { describe, it, expect, beforeEach } from 'vitest'
import './setup.js'
import { encryptKey, decryptKey, encryptKeys, decryptKeys } from '@/utils/crypto.js'

describe('crypto.js', () => {
  beforeEach(() => { global.uni.clearStorageSync?.() })

  it('encryptKey 应返回 enc2: 前缀的加密字符串（F1 新方案）', () => {
    const result = encryptKey('sk-test-123456')
    expect(result).toMatch(/^enc2:/)
    expect(result).not.toContain('sk-test')
  })

  it('encryptKey 同明文两次加密结果应不同（随机盐）', () => {
    const a = encryptKey('sk-same-key-1')
    const b = encryptKey('sk-same-key-1')
    expect(a).not.toBe(b)
    expect(decryptKey(a)).toBe('sk-same-key-1')
    expect(decryptKey(b)).toBe('sk-same-key-1')
  })

  it('decryptKey 应还原加密前的明文', () => {
    const original = 'sk-deepseek-abcdefgh'
    const decrypted = decryptKey(encryptKey(original))
    expect(decrypted).toBe(original)
  })

  it('decryptKey 兼容旧版 enc: 格式（XOR+Base64）', () => {
    // 用旧算法手工构造 enc: 密文
    const SECRET = 'siji_2026_xor_key_!@#'
    const plain = 'sk-legacy-abc123'
    let xored = ''
    for (let i = 0; i < plain.length; i++) {
      xored += String.fromCharCode(plain.charCodeAt(i) ^ SECRET.charCodeAt(i % SECRET.length))
    }
    const b64 = Buffer.from(xored, 'binary').toString('base64')
    expect(decryptKey('enc:' + b64)).toBe(plain)
  })

  it('decryptKey 对明文输入应直接返回（兼容更早版本）', () => {
    expect(decryptKey('sk-legacy-plaintext')).toBe('sk-legacy-plaintext')
    expect(decryptKey('')).toBe('')
  })

  it('密文被篡改时解密应返回空字符串（完整性校验）', () => {
    const encrypted = encryptKey('sk-tamper-test')
    const payload = encrypted.slice(5) // 去掉 enc2:
    const salt = payload.slice(0, 8)
    const checksum = payload.slice(-8)
    const b64 = payload.slice(8, -8)
    const tamperedB64 = Buffer.from('tampered-data!!', 'binary').toString('base64')
    const tampered = 'enc2:' + salt + tamperedB64 + checksum
    expect(decryptKey(tampered)).toBe('')
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