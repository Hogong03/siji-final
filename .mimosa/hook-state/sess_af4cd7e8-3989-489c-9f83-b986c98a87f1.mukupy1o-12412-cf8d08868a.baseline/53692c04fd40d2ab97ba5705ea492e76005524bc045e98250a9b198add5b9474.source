/**
 * memory-profile 联动测试：偏好采纳进画像 + 结构化去重 + AI 写画像后标记
 */
import { describe, it, expect, beforeEach } from 'vitest'
import './setup.js'
import {
  addMemory, getAllMemories, buildMemoryContext, getAdoptableMemories,
  suggestProfileAdoption, adoptMemoryToProfile, markMemoriesAdoptedByProfile,
  getUnadoptedMemories, integrateMemoriesToProfile
} from '@/utils/memory.js'
import { getProfile, saveProfile, setProfileEnabled, addArrayItem } from '@/utils/profile.js'

/** 构造启用的画像 */
function seedProfile(fields) {
  const p = getProfile()
  p.enabled = true
  for (const card of p.cards) {
    if (card.id === 'lifestyle') {
      for (const [k, v] of Object.entries(fields)) {
        card.fields[k] = v
      }
    }
  }
  saveProfile(p)
}

describe('memory ↔ profile 联动', () => {
  beforeEach(() => {
    global.uni.clearStorageSync?.()
    setProfileEnabled(false)
  })

  it('suggestProfileAdoption：喜欢/爱好句式 → hobbies', () => {
    expect(suggestProfileAdoption('我喜欢喝咖啡')).toEqual({ cardId: 'lifestyle', cardTitle: '生活方式', field: 'hobbies', label: '兴趣爱好', value: '喝咖啡' })
    expect(suggestProfileAdoption('我的爱好是打篮球')).toMatchObject({ field: 'hobbies', value: '打篮球' })
  })

  it('suggestProfileAdoption：不吃/讨厌句式 → dietary', () => {
    expect(suggestProfileAdoption('我不吃香菜')).toMatchObject({ field: 'dietary', value: '香菜' })
    expect(suggestProfileAdoption('我讨厌下雨天')).toMatchObject({ field: 'dietary', value: '下雨天' })
  })

  it('suggestProfileAdoption：无偏好句式返回 null', () => {
    expect(suggestProfileAdoption('今天天气不错')).toBeNull()
    expect(suggestProfileAdoption('')).toBeNull()
  })

  it('adoptMemoryToProfile：写入画像并标记记忆', () => {
    seedProfile({})
    const mem = addMemory('用户喜欢喝咖啡', 'preference')
    const r = adoptMemoryToProfile(mem.id, 'lifestyle', 'hobbies', '喝咖啡')
    expect(r.success).toBe(true)

    const profile = getProfile()
    const lifestyle = profile.cards.find(c => c.id === 'lifestyle')
    expect(lifestyle.fields.hobbies).toContain('喝咖啡')

    const stored = getAllMemories().find(m => m.id === mem.id)
    expect(stored.adoptedToProfile).toBeTruthy()
    expect(stored.adoptedToProfile.field).toBe('hobbies')
    expect(getAdoptableMemories().length).toBe(0)
  })

  it('buildMemoryContext：画像字段值命中时过滤冗余记忆', () => {
    seedProfile({ hobbies: ['咖啡'] })
    addMemory('用户喜欢喝咖啡', 'preference')
    const ctx = buildMemoryContext()
    expect(ctx).not.toContain('喝咖啡')
  })

  it('buildMemoryContext：噪声词（喜欢/爱好）不作为过滤依据', () => {
    seedProfile({ hobbies: ['喜欢'] })
    addMemory('用户喜欢喝咖啡', 'preference')
    const ctx = buildMemoryContext()
    expect(ctx).toContain('喝咖啡')
  })

  it('buildMemoryContext：已采纳标记的记忆不再注入', () => {
    seedProfile({})
    const mem = addMemory('用户喜欢喝咖啡', 'preference')
    adoptMemoryToProfile(mem.id, 'lifestyle', 'hobbies', '喝咖啡')
    const ctx = buildMemoryContext()
    expect(ctx).not.toContain('喝咖啡')
  })

  it('markMemoriesAdoptedByProfile：AI 写画像后同步标记同内容记忆', () => {
    seedProfile({})
    addMemory('用户喜欢喝咖啡', 'preference')
    addMemory('下个月要搬家', 'event')
    const marked = markMemoriesAdoptedByProfile([
      { card: 'lifestyle', field: 'hobbies', value: '咖啡' }
    ])
    expect(marked).toBe(1)
    const memories = getAllMemories()
    expect(memories.find(m => m.content.includes('喝咖啡')).adoptedToProfile).toBeTruthy()
    // 事件类不标记
    expect(memories.find(m => m.category === 'event').adoptedToProfile).toBeFalsy()
  })

  it('buildMemoryContext：无画像数据时返回记忆上下文', () => {
    setProfileEnabled(false)
    addMemory('用户喜欢喝咖啡', 'preference')
    const ctx = buildMemoryContext()
    expect(ctx).toContain('喝咖啡')
  })
})

describe('记忆批量整合到画像', () => {
  beforeEach(() => {
    global.uni.clearStorageSync?.()
    setProfileEnabled(false)
  })

  it('getUnadoptedMemories：已采纳的记忆不再返回', () => {
    seedProfile({})
    const mem = addMemory('用户喜欢喝咖啡', 'preference')
    expect(getUnadoptedMemories('all').length).toBe(1)
    adoptMemoryToProfile(mem.id, 'lifestyle', 'hobbies', '喝咖啡')
    expect(getUnadoptedMemories('all').length).toBe(0)
  })

  it('integrateMemoriesToProfile：批量写入画像并标记', () => {
    seedProfile({})
    const m1 = addMemory('我喜欢喝咖啡', 'preference')
    const m2 = addMemory('我不吃香菜', 'preference')
    const r = integrateMemoriesToProfile([
      { id: m1.id, cardTitle: '生活方式', field: 'hobbies', value: '喝咖啡' },
      { id: m2.id, cardTitle: '生活方式', field: 'dietary', value: '香菜' }
    ])
    expect(r).toEqual({ success: 2, skipped: 0 })

    const profile = getProfile()
    const lifestyle = profile.cards.find(c => c.id === 'lifestyle')
    expect(lifestyle.fields.hobbies).toContain('喝咖啡')
    expect(lifestyle.fields.dietary).toContain('香菜')
    expect(getAllMemories().every(m => m.adoptedToProfile)).toBe(true)
  })

  it('integrateMemoriesToProfile：字段或值为空时跳过', () => {
    seedProfile({})
    const m1 = addMemory('我喜欢喝咖啡', 'preference')
    const m2 = addMemory('我不吃香菜', 'preference')
    const r = integrateMemoriesToProfile([
      { id: m1.id, cardTitle: '生活方式', field: 'hobbies', value: '喝咖啡' },
      { id: m2.id, cardTitle: '生活方式', field: '', value: '香菜' },
      { id: m2.id, cardTitle: '生活方式', field: 'dietary', value: '' }
    ])
    expect(r.success).toBe(1)
    expect(r.skipped).toBe(2)
    const profile = getProfile()
    expect(profile.cards.find(c => c.id === 'lifestyle').fields.hobbies).toContain('喝咖啡')
  })

  it('integrateMemoriesToProfile：非数组入参返回 0', () => {
    expect(integrateMemoriesToProfile(null)).toEqual({ success: 0, skipped: 0 })
  })
})

describe('已知事实智能映射与分组整合', () => {
  beforeEach(() => {
    global.uni.clearStorageSync?.()
    setProfileEnabled(false)
  })

  it('suggestProfileAdoption：已知事实映射到对应分组字段', () => {
    expect(suggestProfileAdoption('我在字节跳动工作')).toEqual({ cardId: 'basic', cardTitle: '基本信息', field: 'occupation', label: '职业', value: '字节跳动' })
    expect(suggestProfileAdoption('我的生日是1999年1月1日')).toMatchObject({ cardId: 'basic', cardTitle: '基本信息', field: 'birthday' })
    expect(suggestProfileAdoption('我叫李明')).toMatchObject({ cardId: 'basic', field: 'nickname', value: '李明' })
    expect(suggestProfileAdoption('我住在上海')).toMatchObject({ cardId: 'basic', field: 'location', value: '上海' })
    expect(suggestProfileAdoption('我的月预算是5000')).toMatchObject({ cardId: 'lifestyle', field: 'budget', value: '5000' })
    expect(suggestProfileAdoption('我每天12点睡')).toMatchObject({ cardId: 'lifestyle', field: 'sleepTime' })
  })

  it('adoptMemoryToProfile：分组不存在时按 cardTitle 自动创建', () => {
    seedProfile({})
    const mem = addMemory('我的MBTI是INFP', 'fact')
    const r = adoptMemoryToProfile(mem.id, '', 'MBTI', 'INFP', '性格特征')
    expect(r.success).toBe(true)
    const profile = getProfile()
    const card = profile.cards.find(c => c.title === '性格特征')
    expect(card).toBeTruthy()
    expect(card.fields.MBTI).toBe('INFP')
  })

  it('integrateMemoriesToProfile：已有分组直接填入（数组追加），新分组自动创建', () => {
    seedProfile({ hobbies: ['咖啡'] })
    const m1 = addMemory('我喜欢打篮球', 'preference')
    const m2 = addMemory('我在字节跳动工作', 'fact')
    const m3 = addMemory('我的星座是双子座', 'fact')
    const r = integrateMemoriesToProfile([
      { id: m1.id, cardTitle: '生活方式', field: 'hobbies', value: '打篮球' },
      { id: m2.id, cardTitle: '基本信息', field: 'occupation', value: '字节跳动' },
      { id: m3.id, cardTitle: '性格特征', field: '星座', value: '双子座' }
    ])
    expect(r).toEqual({ success: 3, skipped: 0 })

    const profile = getProfile()
    const lifestyle = profile.cards.find(c => c.id === 'lifestyle')
    expect(lifestyle.fields.hobbies).toEqual(['咖啡', '打篮球'])
    expect(profile.cards.find(c => c.id === 'basic').fields.occupation).toBe('字节跳动')
    const newCard = profile.cards.find(c => c.title === '性格特征')
    expect(newCard).toBeTruthy()
    expect(newCard.fields.星座).toBe('双子座')
  })

  it('integrateMemoriesToProfile：标量字段已有值时覆盖', () => {
    seedProfile({ budget: '3000' })
    const m1 = addMemory('我的月预算是5000', 'fact')
    const r = integrateMemoriesToProfile([
      { id: m1.id, cardTitle: '生活方式', field: 'budget', value: '5000' }
    ])
    expect(r.success).toBe(1)
    expect(getProfile().cards.find(c => c.id === 'lifestyle').fields.budget).toBe('5000')
  })
})

describe('画像数组字段归一化去重（3.2 M2）', () => {
  beforeEach(() => {
    global.uni.clearStorageSync?.()
    setProfileEnabled(false)
  })

  it('大小写 / 全半角差异不再重复追加', () => {
    addArrayItem('lifestyle', 'hobbies', 'Badminton')
    addArrayItem('lifestyle', 'hobbies', 'badminton')
    addArrayItem('lifestyle', 'hobbies', 'ＢＡＤＭＩＮＴＯＮ')
    const card = getProfile().cards.find(c => c.id === 'lifestyle')
    expect(card.fields.hobbies).toEqual(['Badminton'])
  })

  it('不同内容正常追加', () => {
    addArrayItem('lifestyle', 'hobbies', '篮球')
    addArrayItem('lifestyle', 'hobbies', '羽毛球')
    const card = getProfile().cards.find(c => c.id === 'lifestyle')
    expect(card.fields.hobbies).toEqual(['篮球', '羽毛球'])
  })
})
