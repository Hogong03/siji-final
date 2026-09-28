/**
 * 版本历史存储测试（3.5.2：断言以 getDefaultHistory + manifest 为基准，发版不必再改测试）
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { resetStorage } from './setup.js'
import { getVersionHistory } from '../utils/storage/version-history.js'
import { getDefaultHistory } from '../utils/storage/version-data.js'
import manifest from '../manifest.json'

const KEY = 'siji_version_history'

function seed(list) {
  global.uni.setStorageSync(KEY, JSON.stringify(list))
}

beforeEach(() => {
  resetStorage()
})

describe('getVersionHistory：老用户增量合并', () => {
  it('无存储时返回默认历史', () => {
    const list = getVersionHistory()
    const defs = getDefaultHistory()
    expect(list.length).toBeGreaterThan(0)
    expect(list[0].version).toBe(defs[0].version)
    expect(list[1].version).toBe(defs[1].version)
    expect(list[2].version).toBe(defs[2].version)
  })

  it('已存完整记录会并入默认数据缺失的版本', () => {
    const defs = getDefaultHistory()
    const stored = [
      { version: '3.3.0', date: '2026-09-01', title: '旧版本', summary: ['x'], categories: [{ title: 'a', items: ['b'] }] }
    ]
    seed(stored)
    const list = getVersionHistory()
    expect(list.some(r => r.version === '3.3.0')).toBe(true)
    defs.forEach(d => expect(list.some(r => r.version === d.version)).toBe(true))
    expect(list[0].version).toBe(defs[0].version)
  })

  it('同日期多条按版本号倒序，合并结果与默认历史顺序一致', () => {
    const defs = getDefaultHistory()
    const stored = [
      { version: '3.4.1', date: '2026-09-09', title: 't1', summary: ['x'], categories: [{ title: 'a', items: ['b'] }] },
      { version: '3.4.2', date: '2026-09-09', title: 't2', summary: ['x'], categories: [{ title: 'a', items: ['b'] }] }
    ]
    seed(stored)
    const list = getVersionHistory()
    expect(list.map(r => r.version)).toEqual(defs.map(r => r.version))
  })

  it('默认数据最新版本与 manifest versionName 对齐，且每条含 summary 与 categories', () => {
    const defs = getDefaultHistory()
    expect(defs[0].version).toBe(manifest.versionName)
    defs.forEach(r => {
      expect(Array.isArray(r.summary) && r.summary.length > 0).toBe(true)
      expect(Array.isArray(r.categories)).toBe(true)
    })
  })
})
