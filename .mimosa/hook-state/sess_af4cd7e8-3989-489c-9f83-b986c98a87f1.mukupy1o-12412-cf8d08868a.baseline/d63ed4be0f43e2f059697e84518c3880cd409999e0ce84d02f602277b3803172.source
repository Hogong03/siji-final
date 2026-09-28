/**
 * test: 记忆语义扩展（3.5.18）
 *
 * 覆盖 memory-synonyms.js 的同义分组 / 拼音桥接，以及 memory-rank.js 的加权检索接入。
 * 核心回归：用户说「对象」、记忆里写「女朋友」时必须召得回来（BM25 字面匹配下为 0 分）。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { resetStorage } from './setup.js'
import {
  expandTerms, groupIndexOf, synonymVariants, pinyinTargets, isAsciiToken, normalizeTerm
} from '../utils/memory-synonyms.js'
import { buildQueryTerms, rankMemories, selectMemories } from '../utils/memory-rank.js'
import { addMemory, buildMemoryContext } from '../utils/memory.js'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.parse('2026-09-13T12:00:00+08:00')

function mem(content, category, ageDays) {
  return { id: content, content, category, createdAt: NOW - ageDays * DAY, updatedAt: NOW - ageDays * DAY }
}

function weightOf(list, term) {
  const hit = list.find(item => item.term === term)
  return hit ? hit.weight : 0
}

beforeEach(() => { resetStorage() })

describe('同义分组', () => {
  it('原词权重为 1', () => {
    expect(weightOf(expandTerms(['对象']), '对象')).toBe(1)
  })

  it('口语变体互相扩展（对象 → 女朋友）', () => {
    expect(weightOf(expandTerms(['对象']), '女朋友')).toBe(0.6)
    expect(weightOf(expandTerms(['女友']), '对象')).toBe(0.6)
  })

  it('单组扩展数量有上限（防超大组把分数摊平）', () => {
    const list = expandTerms(['对象'])
    expect(list.length).toBeLessThanOrEqual(9)
    expect(list.length).toBeGreaterThan(3)
  })

  it('未登录词不扩展', () => {
    expect(expandTerms(['量子力学'])).toEqual([{ term: '量子力学', weight: 1, from: 'self' }])
    expect(groupIndexOf('量子力学')).toBeUndefined()
    expect(synonymVariants('量子力学')).toEqual([])
  })

  it('一个词只归属一个分组', () => {
    expect(groupIndexOf('对象')).toBe(groupIndexOf('女朋友'))
    expect(groupIndexOf('对象')).not.toBe(groupIndexOf('同事'))
  })

  it('空输入安全', () => {
    expect(expandTerms([])).toEqual([])
    expect(expandTerms(null)).toEqual([])
    expect(expandTerms([''])).toEqual([])
  })
})

describe('拼音桥接', () => {
  it('全拼命中词表（jihua → 计划）', () => {
    expect(weightOf(expandTerms(['jihua']), '计划')).toBe(0.75)
  })

  it('首字母命中词表（jh → 计划）', () => {
    expect(weightOf(expandTerms(['jh']), '计划')).toBe(0.65)
  })

  it('未收录拼音不扩展', () => {
    expect(expandTerms(['zzz'])).toEqual([{ term: 'zzz', weight: 1, from: 'self' }])
    expect(pinyinTargets('zzz')).toEqual([])
  })

  it('单字母不参与桥接（j 太容易误命中）', () => {
    expect(pinyinTargets('j')).toEqual([])
  })

  it('中文词不触发拼音通道', () => {
    expect(pinyinTargets('计划')).toEqual([])
    expect(isAsciiToken('计划')).toBe(false)
    expect(isAsciiToken('jihua')).toBe(true)
  })

  it('拼音命中后带上该词的同义组（权重最低）', () => {
    expect(weightOf(expandTerms(['jihua']), '安排')).toBe(0.45)
  })

  it('同词多来源时取最高权重', () => {
    const list = expandTerms(['计划', 'jihua'])
    expect(weightOf(list, '计划')).toBe(1)
  })
})

describe('buildQueryTerms', () => {
  it('扩展词回落进二元组分词空间（女朋友 → 女朋 / 朋友）', () => {
    const terms = buildQueryTerms('我对象最近怎么样')
    expect(weightOf(terms, '女朋')).toBe(0.6)
    expect(weightOf(terms, '朋友')).toBe(0.6)
    expect(weightOf(terms, '对象')).toBe(1)
  })

  it('扩展词不带末位单字噪声（伴侣 → 侣 不参与匹配）', () => {
    const terms = buildQueryTerms('对象')
    expect(weightOf(terms, '伴侣')).toBe(0.6)
    expect(terms.some(item => item.term === '侣')).toBe(false)
  })

  it('includeSynonyms:false 退回纯字面词表', () => {
    const terms = buildQueryTerms('我对象最近怎么样', false)
    expect(weightOf(terms, '对象')).toBe(1)
    expect(weightOf(terms, '女朋友')).toBe(0)
    expect(terms.every(item => item.from === 'self')).toBe(true)
  })

  it('空 query 安全', () => {
    expect(buildQueryTerms('')).toEqual([])
    expect(buildQueryTerms(null)).toEqual([])
  })
})

describe('语义召回（rankMemories / selectMemories）', () => {
  const memories = [
    mem('我女朋友叫小雅，做设计', 'fact', 200),
    mem('上周去露营了，搭帐篷很累', 'event', 40),
    mem('喜欢吃辣，不吃香菜', 'preference', 10)
  ]

  it('说「对象」能召回写「女朋友」的记忆', () => {
    const ranked = rankMemories('我对象最近怎么样', memories, { now: NOW })
    expect(ranked[0].memory.content).toContain('小雅')
    expect(ranked[0].score).toBeGreaterThan(0)
  })

  it('关闭语义扩展后同一 query 召不回（对照组）', () => {
    const ranked = rankMemories('我对象最近怎么样', memories, { now: NOW, includeSynonyms: false })
    expect(ranked[0].score).toBe(0)
  })

  it('拼音查询能召回中文记忆', () => {
    const list = [mem('下个月的计划是先过六级', 'fact', 3), mem('今天吃了火锅', 'event', 1)]
    const ranked = rankMemories('jihua', list, { now: NOW })
    expect(ranked[0].memory.content).toContain('计划')
  })

  it('字面命中排在同义命中之前', () => {
    const list = [mem('周六的计划没做完', 'event', 5), mem('安排好的事总忘', 'event', 5)]
    const ranked = rankMemories('计划', list, { now: NOW })
    expect(ranked[0].memory.content).toContain('计划没做完')
  })

  it('语义扩展不会把无关记忆拉进来（无命中仍回落最近 N 条）', () => {
    const picked = selectMemories('量子力学第三定律', memories, { limit: 2, now: NOW })
    expect(picked).toHaveLength(2)
    expect(picked[0].content).toContain('香菜')
  })

  it('selectMemories 走同一套扩展', () => {
    const picked = selectMemories('我对象最近怎么样', memories, { limit: 2, now: NOW })
    expect(picked).toHaveLength(1)
    expect(picked[0].content).toContain('小雅')
  })
})

describe('端到端：注入上下文的记忆', () => {
  it('口语提问能带出长期记忆里的书面表述', () => {
    addMemory('女朋友小雅最近工作压力大', 'fact')
    for (let i = 0; i < 20; i++) addMemory('第 ' + i + ' 条普通想法记录', 'other')
    const ctx = buildMemoryContext('我对象最近状态怎么样')
    expect(ctx).toContain('小雅')
  })

  it('normalizeTerm 归一化大小写与空白', () => {
    expect(normalizeTerm('  CET  ')).toBe('cet')
    expect(normalizeTerm(null)).toBe('')
  })
})