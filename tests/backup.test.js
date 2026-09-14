/**
 * 全量备份/恢复测试：导出范围、敏感排除、导入校验与写回
 */
import { describe, it, expect, beforeEach } from 'vitest'
import './setup.js'
import {
  exportBackup, exportBackupJson, parseBackup, importBackup
} from '@/utils/storage/export.js'

/** 造一批业务数据与敏感数据 */
function seed() {
  global.uni.setStorageSync('diary_2026-09', JSON.stringify([{ id: 'd1', title: '测试记录', content: 'x' }]))
  global.uni.setStorageSync('bill_2026-09', JSON.stringify([{ id: 'b1', amount: 12.5 }]))
  global.uni.setStorageSync('plan_all', JSON.stringify([{ id: 'p1', title: '计划A' }]))
  global.uni.setStorageSync('siji_long_term_memory', JSON.stringify([{ id: 'm1', content: '喜欢喝咖啡', category: 'preference' }]))
  global.uni.setStorageSync('siji_my_profile', JSON.stringify({ enabled: true, version: 2, cards: [] }))
  global.uni.setStorageSync('siji_conversations', JSON.stringify([{ id: 'c1', title: '会话1' }]))
  global.uni.setStorageSync('siji_provider_keys', 'ENCRYPTED_KEY')
  global.uni.setStorageSync('siji_index', JSON.stringify({ updatedAt: 0 }))
  global.uni.setStorageSync('siji_export_json', '{"old":true}')
  global.uni.setStorageSync('siji_pin', '1234')
  global.uni.setStorageSync('not_siji_key', 'should-not-export')
}

describe('exportBackup 全量备份', () => {
  beforeEach(() => { global.uni.clearStorageSync?.() })

  it('备份包含业务 key，排除敏感/可重建/产物 key', () => {
    seed()
    const backup = exportBackup({ version: 'v2.3.20' })
    expect(backup.meta.app).toBe('思迹')
    expect(backup.meta.version).toBe('v2.3.20')
    expect(backup.meta.backupVersion).toBe(1)
    const keys = Object.keys(backup.storage)
    expect(keys).toContain('diary_2026-09')
    expect(keys).toContain('bill_2026-09')
    expect(keys).toContain('plan_all')
    expect(keys).toContain('siji_long_term_memory')
    expect(keys).toContain('siji_my_profile')
    expect(keys).toContain('siji_conversations')
    // 敏感与可重建数据排除
    expect(keys).not.toContain('siji_provider_keys')
    expect(keys).not.toContain('siji_index')
    expect(keys).not.toContain('siji_export_json')
    expect(keys).not.toContain('siji_pin')
    // 非 siji 前缀 key 不进入备份
    expect(keys).not.toContain('not_siji_key')
  })

  it('exportBackupJson 可 JSON.parse 回原结构', () => {
    seed()
    const json = exportBackupJson({ version: 'v2.3.20' })
    const parsed = JSON.parse(json)
    expect(parsed.storage['diary_2026-09']).toContain('测试记录')
  })
})

describe('exportBackup 分域导出（微信粘贴防崩溃）', () => {
  beforeEach(() => { global.uni.clearStorageSync?.() })

  it('section=chat 只含聊天域 key', () => {
    seed()
    const backup = exportBackup({ section: 'chat' })
    expect(backup.meta.section).toBe('chat')
    const keys = Object.keys(backup.storage)
    expect(keys).toContain('siji_conversations')
    expect(keys).not.toContain('diary_2026-09')
    expect(keys).not.toContain('siji_long_term_memory')
    expect(keys).not.toContain('siji_my_profile')
  })

  it('life/ai/chat 三份互斥且能拼回全量', () => {
    seed()
    const life = exportBackup({ section: 'life' })
    const ai = exportBackup({ section: 'ai' })
    const chat = exportBackup({ section: 'chat' })
    expect(life.meta.section).toBe('life')
    expect(ai.meta.section).toBe('ai')
    expect(Object.keys(life.storage)).toContain('diary_2026-09')
    expect(Object.keys(ai.storage)).toContain('siji_long_term_memory')
    expect(Object.keys(ai.storage)).toContain('siji_my_profile')
    expect(Object.keys(ai.storage)).not.toContain('siji_conversations')
    const overlap = Object.keys(life.storage).filter(k => ai.storage[k] !== undefined || chat.storage[k] !== undefined)
    expect(overlap).toEqual([])
    const merged = exportBackup({ section: '' })
    expect(Object.keys(merged.storage).sort()).toEqual(
      Object.keys({ ...life.storage, ...ai.storage, ...chat.storage }).sort()
    )
  })

  it('exportBackupJson 分域 meta 带 section 且可被恢复', () => {
    seed()
    const json = exportBackupJson({ section: 'ai' })
    const parsed = JSON.parse(json)
    expect(parsed.meta.section).toBe('ai')
    expect(Object.keys(parsed.storage)).toContain('siji_long_term_memory')
    expect(Object.keys(parsed.storage)).not.toContain('siji_conversations')
  })
})

describe('parseBackup / importBackup 恢复', () => {
  beforeEach(() => { global.uni.clearStorageSync?.() })

  it('非法内容抛错', () => {
    expect(() => parseBackup('')).toThrow(/为空/)
    expect(() => parseBackup('not json')).toThrow(/JSON/)
    expect(() => parseBackup('{"meta":{"app":"别的应用"},"storage":{}}')).toThrow(/思迹/)
    expect(() => parseBackup('{"meta":{"app":"思迹"}}')).toThrow(/数据内容/)
  })

  it('importBackup 写回业务 key，跳过非法/排除 key', () => {
    seed()
    const backup = exportBackup()
    global.uni.clearStorageSync()
    const r = importBackup(backup)
    expect(r.total).toBeGreaterThan(0)
    expect(r.skipped).toBe(0)
    const restored = global.uni.getStorageSync('diary_2026-09')
    expect(restored).toContain('测试记录')
    expect(global.uni.getStorageSync('siji_conversations')).toContain('会话1')
    // 非法 key 注入被忽略
    const evil = JSON.parse(JSON.stringify(backup))
    evil.storage['evil_key'] = 'x'
    evil.storage['siji_provider_keys'] = 'LEAK'
    const r2 = importBackup(evil)
    expect(r2.skipped).toBe(2) // evil_key + siji_provider_keys
    expect(global.uni.getStorageSync('evil_key')).toBe('')
    expect(global.uni.getStorageSync('siji_provider_keys')).toBe('')
  })

  it('importBackup 接受 JSON 字符串', () => {
    seed()
    const json = exportBackupJson()
    global.uni.clearStorageSync()
    const r = importBackup(json)
    expect(r.total).toBeGreaterThan(0)
  })
})
