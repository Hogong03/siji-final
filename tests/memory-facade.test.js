/**
 * 记忆门面测试（3.5.14：utils/memory.js 692 行拆成 utils/memory/ 八块）
 *
 * 拆分最容易出的错是「某个导出在门面里丢了」——旧引用在别处，测试不跑就发现不了。
 * 这里把原单文件的 27 个导出钉住，并要求每个分模块都能单独导入。
 */
import { describe, it, expect } from 'vitest'
import './setup.js'
import * as facade from '../utils/memory.js'

/** 拆分前 utils/memory.js 的全部导出（顺序按字母，便于对比） */
const OLD_EXPORTS = [
  'addMemory', 'adoptMemoryToProfile', 'aiSummarizeConversation', 'appendToMonthlyCard',
  'applyGovernance', 'autoExtractMemory', 'buildMemoryContext', 'buildMonthlyMemoryContext',
  'clearAllMemories', 'deleteMemory', 'findDuplicateGroups', 'findStaleAdoptedMemories',
  'getAdoptableMemories', 'getAllMemories', 'getMemoriesByCategory', 'getMemoryStats',
  'getMonthlyMemoryCards', 'getUnadoptedMemories', 'integrateMemoriesToProfile',
  'isMemoryEnabled', 'markMemoriesAdoptedByProfile', 'normalizeMemoryText',
  'restoreHiddenMemory', 'setMemoryEnabled', 'suggestMemoryCategory',
  'suggestProfileAdoption', 'updateMemory'
]

describe('utils/memory.js 门面', () => {
  it('27 个旧导出一个不少，且都是函数', () => {
    const missing = OLD_EXPORTS.filter(name => typeof facade[name] !== 'function')
    expect(missing).toEqual([])
    expect(OLD_EXPORTS.length).toBe(27)
  })

  it('不把模块间私有依赖（persist / STORAGE_KEY）暴露出去', () => {
    expect(facade.persist).toBeUndefined()
    expect(facade.STORAGE_KEY).toBeUndefined()
  })

  it('分模块可单独导入', async () => {
    const mods = [
      '../utils/memory/store.js',
      '../utils/memory/normalize.js',
      '../utils/memory/governance.js',
      '../utils/memory/context.js',
      '../utils/memory/profile-values.js',
      '../utils/memory/profile-link.js',
      '../utils/memory/monthly.js',
      '../utils/memory/auto-extract.js'
    ]
    for (const m of mods) {
      const mod = await import(m)
      expect(Object.keys(mod).length).toBeGreaterThan(0)
    }
  })

  it('归一化口径仍与治理共用同一实现', () => {
    expect(facade.normalizeMemoryText(' 我今天想  喝咖啡！ ')).toBe('喝咖啡')
  })
})
