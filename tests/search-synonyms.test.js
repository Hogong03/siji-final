import { describe, it, expect } from 'vitest'
import { expandKeywords, matchesAnyKeywords } from '../utils/search-synonyms.js'

describe('search-synonyms 语义检索扩展', () => {
  it('关键词命中主题词 → 扩展出同义词组', () => {
    const kws = expandKeywords('焦虑')
    expect(kws).toContain('焦虑')
    expect(kws).toContain('压力')
    expect(kws).toContain('失眠')
    expect(kws).toContain('内耗')
  })

  it('关键词命中同义词 → 反查回主题词并带出整组', () => {
    const kws = expandKeywords('失眠')
    expect(kws).toContain('焦虑')
    expect(kws).toContain('压力')
  })

  it('未知关键词 → 只返回原词', () => {
    const kws = expandKeywords('随便什么词')
    expect(kws).toEqual(['随便什么词'])
  })

  it('空关键词 → 返回空数组', () => {
    expect(expandKeywords('')).toEqual([])
    expect(expandKeywords(null)).toEqual([])
  })

  it('matchesAnyKeywords 命中任一扩展词（不区分大小写）', () => {
    expect(matchesAnyKeywords('最近压力很大睡不着', expandKeywords('焦虑'))).toBe(true)
    expect(matchesAnyKeywords('今天天气不错', expandKeywords('焦虑'))).toBe(false)
    expect(matchesAnyKeywords('Meeting 很顺利', expandKeywords('工作'))).toBe(false)
    expect(matchesAnyKeywords('明天要汇报项目进度', expandKeywords('工作'))).toBe(true)
  })
})
