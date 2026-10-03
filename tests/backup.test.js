/**
 * 全量备份/恢复测试：导出范围、敏感排除、导入校验与写回
 * + 自动本地备份纯函数（utils/storage/backup.js）：文件名 / 24h 判定 / 删旧留新
 */
import { describe, it, expect, beforeEach } from 'vitest'
import './setup.js'
import { resetStorage } from './setup.js'
import {
  exportBackup, exportBackupJson, parseBackup, importBackup
} from '@/utils/storage/export.js'
import {
  buildBackupFileName,
  shouldAutoBackup,
  pickKeepLatest,
  fileNameToTime,
  isAutoBackupEnabled,
  createAutoBackup,
  runAutoBackup,
  AUTO_BACKUP_INTERVAL_MS
} from '@/utils/storage/backup.js'

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

// ==================== 自动本地备份纯函数（utils/storage/backup.js） ====================

const DAY_MS = 24 * 60 * 60 * 1000

describe('buildBackupFileName 文件名格式', () => {
  beforeEach(() => { resetStorage() })

  it('格式为 siji-backup-YYYYMMDD-HHmmss.json，月/日/时分秒补零', () => {
    const name = buildBackupFileName(new Date(2026, 0, 5, 9, 8, 7))
    expect(name).toBe('siji-backup-20260105-090807.json')
  })

  it('两位月份与末秒不补零错位', () => {
    const name = buildBackupFileName(new Date(2026, 11, 31, 23, 59, 59))
    expect(name).toBe('siji-backup-20261231-235959.json')
  })

  it('不传参（当前时间）仍产出合法文件名', () => {
    const name = buildBackupFileName()
    expect(name).toMatch(/^siji-backup-\d{8}-\d{6}\.json$/)
  })

  it('与 fileNameToTime 往返一致', () => {
    const d = new Date(2026, 9, 3, 12, 34, 56)
    const back = new Date(fileNameToTime(buildBackupFileName(d)))
    expect([back.getFullYear(), back.getMonth(), back.getDate()]).toEqual([2026, 9, 3])
    expect([back.getHours(), back.getMinutes(), back.getSeconds()]).toEqual([12, 34, 56])
  })
})

describe('shouldAutoBackup 24h 判定', () => {
  beforeEach(() => { resetStorage() })

  it('从未备份（lastAt=0）→ 立即备份', () => {
    expect(shouldAutoBackup(0, 1000000)).toBe(true)
  })

  it('lastAt 非法（空串/NaN）→ 立即备份', () => {
    expect(shouldAutoBackup('', 1000000)).toBe(true)
    expect(shouldAutoBackup(NaN, 1000000)).toBe(true)
  })

  it('恰好 24h → 备份；差 1ms → 不备份', () => {
    expect(shouldAutoBackup(1000000, 1000000 + DAY_MS)).toBe(true)
    expect(shouldAutoBackup(1000000, 1000000 + DAY_MS - 1)).toBe(false)
  })

  it('超过 24h → 备份', () => {
    expect(shouldAutoBackup(1000000, 1000000 + DAY_MS + 60000)).toBe(true)
  })

  it('lastAt 在未来（时钟回拨）→ 不备份', () => {
    expect(shouldAutoBackup(1000000 + DAY_MS, 1000000)).toBe(false)
  })

  it('自定义间隔生效（默认 24h）', () => {
    expect(AUTO_BACKUP_INTERVAL_MS).toBe(DAY_MS)
    expect(shouldAutoBackup(1000000, 1000000 + 60 * 60 * 1000, 30 * 60 * 1000)).toBe(true)
    expect(shouldAutoBackup(1000000, 1000000 + 29 * 60 * 1000, 30 * 60 * 1000)).toBe(false)
  })
})

describe('pickKeepLatest 删旧留新', () => {
  beforeEach(() => { resetStorage() })

  const names = [
    'siji-backup-20260101-080000.json',
    'siji-backup-20260102-080000.json',
    'siji-backup-20260103-080000.json',
    'siji-backup-20260104-080000.json',
    'siji-backup-20260105-080000.json'
  ]

  it('5 份保留 3 份 → 删最旧 2 份', () => {
    expect(pickKeepLatest(names, 3)).toEqual([
      'siji-backup-20260101-080000.json',
      'siji-backup-20260102-080000.json'
    ])
  })

  it('不足保留数 → 不删', () => {
    expect(pickKeepLatest(names.slice(0, 3), 3)).toEqual([])
    expect(pickKeepLatest(names.slice(0, 2), 3)).toEqual([])
    expect(pickKeepLatest([], 3)).toEqual([])
  })

  it('默认 keep=3', () => {
    expect(pickKeepLatest(names)).toEqual([
      'siji-backup-20260101-080000.json',
      'siji-backup-20260102-080000.json'
    ])
  })

  it('乱序输入也能按时间戳排序后删旧', () => {
    const shuffled = [names[3], names[0], names[4], names[2], names[1]]
    expect(pickKeepLatest(shuffled, 3)).toEqual([
      'siji-backup-20260101-080000.json',
      'siji-backup-20260102-080000.json'
    ])
  })

  it('非备份文件名不参与也不删除', () => {
    const mixed = ['readme.txt', names[0], names[1], names[2], names[3], '.DS_Store']
    expect(pickKeepLatest(mixed, 3)).toEqual([names[0]])
  })

  it('keep 传 0 → 全删；keep 非法回落 3', () => {
    expect(pickKeepLatest(names.slice(0, 2), 0)).toEqual(names.slice(0, 2))
    expect(pickKeepLatest(names, undefined)).toHaveLength(2)
    expect(pickKeepLatest(names, NaN)).toHaveLength(2)
  })
})

describe('fileNameToTime', () => {
  beforeEach(() => { resetStorage() })

  it('解析文件名时间戳（月份 -1）', () => {
    expect(fileNameToTime('siji-backup-20260105-090807.json'))
      .toBe(new Date(2026, 0, 5, 9, 8, 7).getTime())
  })

  it('非法名字返回 0', () => {
    expect(fileNameToTime('readme.txt')).toBe(0)
    expect(fileNameToTime('')).toBe(0)
    expect(fileNameToTime(null)).toBe(0)
  })
})

describe('自动备份非 App 端降级（vitest 环境无 plus）', () => {
  beforeEach(() => { resetStorage() })

  it('createAutoBackup 返回 only-app', async () => {
    const r = await createAutoBackup()
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('only-app')
  })

  it('runAutoBackup 直接跳过且不写时间戳', async () => {
    const r = await runAutoBackup()
    expect(r).toBe(false)
    expect(global.uni.getStorageSync('siji_last_auto_backup')).toBe('')
  })

  it('开关默认开，显式存 0 才关', () => {
    expect(isAutoBackupEnabled()).toBe(true)
    global.uni.setStorageSync('siji_auto_backup', '0')
    expect(isAutoBackupEnabled()).toBe(false)
  })
})
