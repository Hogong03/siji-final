/**
 * test: 记忆相关度排序（3.5.11）
 * 覆盖 tokenize / rankMemories / selectMemories 与 buildMemoryContext 的相关度接入
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { resetStorage } from './setup.js'
import { tokenize, rankMemories, selectMemories } from '../utils/memory-rank.js'
import { addMemory, buildMemoryContext } from '../utils/memory.js'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.parse('2026-09-13T12:00:00+08:00')

function mem(content, category, ageDays) {
  return { id: content, content, category, createdAt: NOW - ageDays * DAY, updatedAt: NOW - ageDays * DAY }
}

beforeEach(() => {
  resetStorage()
})

describe('tokenize', () => {
  it('中文取二元组，末尾补单字', () => {
    expect(tokenize('露营')).toEqual(['露营', '营'])
  })

  it('英文取长度大于 1 的单词并小写', () => {
    expect(tokenize('Go Hiking')).toEqual(['go', 'hiking'])
  })

  it('空输入返回空数组', () => {
    expect(tokenize('')).toEqual([])
    expect(tokenize(null)).toEqual([])
  })
})

describe('rankMemories / selectMemories', () => {
  const memories = [
    mem('我女朋友叫小雅，做设计', 'fact', 200),
    mem('上周去露营了，搭帐篷很累', 'event', 40),
    mem('喜欢吃辣，不吃香菜', 'preference', 10)
  ]

  it('强相关记忆排最前，即使它最旧', () => {
    const ranked = rankMemories('我女朋友小雅最近怎么样', memories, { now: NOW })
    expect(ranked[0].memory.content).toContain('小雅')
    expect(ranked[0].score).toBeGreaterThan(0)
  })

  it('selectMemories：有命中时按相关度取，不受时间新近影响', () => {
    const picked = selectMemories('露营装备要买什么', memories, { limit: 2, now: NOW })
    expect(picked[0].content).toContain('露营')
    expect(picked).toHaveLength(1)
  })

  it('selectMemories：无命中时回落最近 N 条', () => {
    const picked = selectMemories('量子力学第三定律', memories, { limit: 2, now: NOW })
    expect(picked).toHaveLength(2)
    expect(picked[0].content).toContain('香菜')
  })

  it('selectMemories：空 query 与空记忆都安全', () => {
    expect(selectMemories('', memories, { limit: 2, now: NOW })).toHaveLength(2)
    expect(selectMemories('露营', [], { limit: 2, now: NOW })).toEqual([])
    expect(selectMemories('露营', null, { limit: 2, now: NOW })).toEqual([])
  })

  it('分类型权重：同分时事实类优先于对话摘要', () => {
    const tie = [mem('住在杭州', 'summary', 5), mem('住在杭州', 'fact', 5)]
    const ranked = rankMemories('住在哪', tie, { now: NOW })
    expect(ranked[0].memory.category).toBe('fact')
  })
})

describe('buildMemoryContext 相关度接入', () => {
  it('按当前消息检索：早期记忆也能进上下文', () => {
    addMemory('女朋友小雅生日是 3 月 8 日', 'fact')
    for (let i = 0; i < 40; i++) addMemory('第 ' + i + ' 条普通想法记录', 'other')
    const ctx = buildMemoryContext('小雅生日是哪天')
    expect(ctx).toContain('小雅')
  })

  it('无 query 时保持原行为（返回最近记忆上下文）', () => {
    addMemory('喜欢吃辣', 'preference')
    expect(buildMemoryContext()).toContain('喜欢吃辣')
  })
})