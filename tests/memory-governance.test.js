/**
 * M2 记忆治理测试（3.2 升级方案 3.3）
 * 覆盖：归一化去重、重复组发现、已整合超期隐藏候选、other 归类建议、
 *       applyGovernance（merge/hide/delete/recategorize）、月度卡冗余过滤
 */
import { describe, it, expect, beforeEach } from 'vitest'
import './setup.js'
import {
  addMemory, getAllMemories, normalizeMemoryText, findDuplicateGroups,
  findStaleAdoptedMemories, suggestMemoryCategory, applyGovernance,
  restoreHiddenMemory, appendToMonthlyCard, getMonthlyMemoryCards,
  buildMonthlyMemoryContext, deleteMemory
} from '@/utils/memory.js'
import { getProfile, saveProfile } from '@/utils/profile.js'

const DAY = 24 * 60 * 60 * 1000

function seedProfileField(field, value) {
  const p = getProfile()
  p.enabled = true
  const card = p.cards.find(c => c.id === 'lifestyle')
  card.fields[field] = value
  saveProfile(p)
}

function wipe() {
  global.uni.clearStorageSync()
  // 删除可能残留的画像启用状态（saveProfile 已写入）
}

let seq = 0
/** 直接播种记忆（绕过 addMemory 归一化去重，用于构造同义重复数据） */
function seedMemory(content, category = 'fact', { createdAt, updatedAt, adoptedToProfile, hidden } = {}) {
  const now = Date.now()
  seq++
  const item = {
    id: `mem_test_${seq}`,
    content,
    category,
    createdAt: createdAt != null ? createdAt : now,
    updatedAt: updatedAt != null ? updatedAt : now
  }
  if (adoptedToProfile) item.adoptedToProfile = adoptedToProfile
  if (hidden) item.hidden = true
  const list = getAllMemories()
  list.push(item)
  global.uni.setStorageSync('siji_long_term_memory', JSON.stringify(list))
  return item
}

describe('normalizeMemoryText 归一化', () => {
  beforeEach(wipe)

  it('全角转半角、去标点空白、统一小写', () => {
    expect(normalizeMemoryText('我 喜欢喝咖啡，ＡＢＣ１２３。')).toBe('喜欢喝咖啡abc123')
    expect(normalizeMemoryText('MyFavorite：COFFEE！')).toBe('myfavoritecoffee')
  })

  it('去「我今天/我想/我打算/我要」前缀', () => {
    expect(normalizeMemoryText('我今天想跑步')).toBe('跑步')
    expect(normalizeMemoryText('我想去旅行')).toBe('去旅行')
    expect(normalizeMemoryText('我打算周末搬家')).toBe('周末搬家')
    expect(normalizeMemoryText('我要早睡')).toBe('早睡')
  })

  it('空内容返回空串', () => {
    expect(normalizeMemoryText('')).toBe('')
    expect(normalizeMemoryText(null)).toBe('')
    expect(normalizeMemoryText('  ')).toBe('')
  })
})

describe('addMemory 归一化去重（3.2）', () => {
  beforeEach(wipe)

  it('同义句（全半角/标点/前缀差异）不再新增，只更新时间戳', async () => {
    const first = addMemory('我今天喜欢喝咖啡', 'preference')
    await new Promise(r => setTimeout(r, 2))
    const second = addMemory('我想喜欢喝咖啡。', 'other')
    expect(getAllMemories().length).toBe(1)
    expect(second.id).toBe(first.id)
    expect(second.updatedAt).toBeGreaterThanOrEqual(first.updatedAt)
    // other 不覆盖原分类；显式给出有效分类时才更新
    expect(second.category).toBe('preference')
  })

  it('归一化后不同内容仍正常新增', () => {
    addMemory('我喜欢喝咖啡', 'preference')
    addMemory('我喜欢打篮球', 'preference')
    expect(getAllMemories().length).toBe(2)
  })
})

describe('findDuplicateGroups 重复组发现', () => {
  beforeEach(wipe)

  it('归一化相等句归为同一组，建议保留较新一条', async () => {
    const old = seedMemory('我的MBTI是INFP', 'fact', { createdAt: Date.now() - 5000, updatedAt: Date.now() - 5000 })
    const newer = seedMemory('我的MBTI是ＩＮＦＰ。', 'fact', { createdAt: Date.now() - 1000, updatedAt: Date.now() - 1000 })
    const groups = findDuplicateGroups()
    expect(groups).toHaveLength(1)
    expect(groups[0].keepId).toBe(newer.id)
    expect(groups[0].removeIds).toEqual([old.id])
  })

  it('短句包含关系（长者 ≤ 60 字）也视为重复', () => {
    const long = seedMemory('我的日常习惯是喜欢喝咖啡', 'preference', { createdAt: Date.now() - 1000, updatedAt: Date.now() - 1000 })
    const short = seedMemory('喜欢喝咖啡', 'preference', { createdAt: Date.now() - 5000, updatedAt: Date.now() - 5000 })
    const groups = findDuplicateGroups()
    expect(groups).toHaveLength(1)
    expect(groups[0].keepId).toBe(long.id)
    expect(groups[0].removeIds).toEqual([short.id])
  })

  it('长者超过 60 字的不强行合并', () => {
    seedMemory('咖啡', 'preference')
    seedMemory('咖啡' + '是一种很常见的饮品'.repeat(12), 'fact')
    expect(findDuplicateGroups()).toHaveLength(0)
  })

  it('无重复时返回空数组', () => {
    addMemory('我喜欢喝咖啡', 'preference')
    addMemory('下个月搬家', 'event')
    expect(findDuplicateGroups()).toHaveLength(0)
  })
})

describe('findStaleAdoptedMemories 隐藏候选（D2）', () => {
  beforeEach(wipe)

  function seedAdopted(category, createdAt, extra = {}) {
    addMemory(`已整合${category}_${createdAt}`, category)
    const list = getAllMemories()
    const mem = list.find(m => m.content === `已整合${category}_${createdAt}`)
    mem.adoptedToProfile = { cardId: 'lifestyle', field: 'hobbies', value: 'x', at: Date.now() }
    mem.createdAt = createdAt
    Object.assign(mem, extra)
    global.uni.setStorageSync('siji_long_term_memory', JSON.stringify(list))
    return mem
  }

  it('fact/preference 已整合且超 90 天 → 列为隐藏候选', () => {
    const stale = seedAdopted('fact', Date.now() - 100 * DAY)
    seedAdopted('preference', Date.now() - 100 * DAY)
    const hits = findStaleAdoptedMemories()
    expect(hits.map(m => m.id)).toEqual(expect.arrayContaining([stale.id]))
    expect(hits).toHaveLength(2)
  })

  it('未超期 / 未整合 / 非 fact-preference / 已 hidden 的不列入', () => {
    seedAdopted('fact', Date.now() - 10 * DAY)
    seedAdopted('event', Date.now() - 200 * DAY)
    seedAdopted('fact', Date.now() - 200 * DAY, { hidden: true })
    const notAdopted = addMemory('不是我的整合', 'fact')
    expect(notAdopted.adoptedToProfile).toBeFalsy()
    expect(findStaleAdoptedMemories()).toHaveLength(0)
  })
})

describe('suggestMemoryCategory 归类建议', () => {
  it('按句式建议 fact/preference/event', () => {
    expect(suggestMemoryCategory('我的生日是 1999 年 1 月')).toBe('fact')
    expect(suggestMemoryCategory('我更喜欢安静的角落')).toBe('preference')
    expect(suggestMemoryCategory('上周去参加了面试')).toBe('event')
  })

  it('短且无关键词返回 null（不强改）', () => {
    expect(suggestMemoryCategory('嗯嗯好的')).toBeNull()
    expect(suggestMemoryCategory('')).toBeNull()
  })
})

describe('applyGovernance 执行治理', () => {
  beforeEach(wipe)

  it('merge：保留 updatedAt 较新一条的内容与 id', async () => {
    const a = addMemory('我的MBTI是INFP', 'fact')
    await new Promise(r => setTimeout(r, 2))
    const b = addMemory('我是MBTI INFP', 'fact')
    const r = applyGovernance({ merge: [{ keepId: a.id, removeId: b.id }] })
    expect(r.merged).toBe(1)
    const rest = getAllMemories()
    expect(rest).toHaveLength(1)
    expect(rest[0].id).toBe(a.id)
    expect(rest[0].content).toBe('我是MBTI INFP')
  })

  it('hide：仅标记 hidden，数据保留；restoreHiddenMemory 可恢复', () => {
    const mem = addMemory('已整合的旧偏好', 'preference')
    mem.adoptedToProfile = { cardId: 'lifestyle', field: 'x', value: 'x', at: Date.now() }
    global.uni.setStorageSync('siji_long_term_memory', JSON.stringify(getAllMemories()))
    const r = applyGovernance({ hide: [mem.id] })
    expect(r.hidden).toBe(1)
    let stored = getAllMemories()
    expect(stored).toHaveLength(1)
    expect(stored[0].hidden).toBe(true)
    expect(restoreHiddenMemory(mem.id)).toBe(true)
    stored = getAllMemories()
    expect(stored[0].hidden).toBe(false)
  })

  it('delete + recategorize：按用户确认执行', () => {
    const a = addMemory('不要了的事实', 'fact')
    const b = addMemory('想换个分类的记忆', 'other')
    const r = applyGovernance({ delete: [a.id], recategorize: [{ id: b.id, category: 'preference' }] })
    expect(r.deleted).toBe(1)
    expect(r.recategorized).toBe(1)
    const rest = getAllMemories()
    expect(rest.map(m => m.id)).not.toContain(a.id)
    expect(rest.find(m => m.id === b.id).category).toBe('preference')
  })

  it('非法入参返回零计数且不写库', () => {
    addMemory('一条记忆', 'fact')
    expect(applyGovernance({ merge: 'bad', hide: 'bad' })).toEqual({ merged: 0, hidden: 0, deleted: 0, recategorized: 0 })
    expect(getAllMemories()).toHaveLength(1)
  })
})

describe('月度记忆卡冗余过滤（3.2）', () => {
  beforeEach(wipe)

  it('与画像字段值重复的 ≤ 20 字短行不注入上下文', () => {
    seedProfileField('hobbies', ['咖啡'])
    appendToMonthlyCard('2026-08', ['我喜欢喝咖啡', '周末和朋友去爬山', '这个月读完两本书'])
    const ctx = buildMonthlyMemoryContext()
    expect(ctx).not.toContain('喝咖啡')
    expect(ctx).toContain('爬山')
    // 数据本身保留在卡片中（只影响上下文注入）
    const cards = getMonthlyMemoryCards()
    expect(cards[0].items).toHaveLength(3)
  })

  it('画像为空时不误过滤', () => {
    appendToMonthlyCard('2026-08', ['我喜欢喝咖啡'])
    const ctx = buildMonthlyMemoryContext()
    expect(ctx).toContain('喝咖啡')
  })
})

describe('deleteMemory 等基础操作不受治理影响', () => {
  beforeEach(wipe)

  it('手动删除 hidden 记忆仍然可用', () => {
    const mem = addMemory('旧记忆', 'fact')
    applyGovernance({ hide: [mem.id] })
    expect(deleteMemory(mem.id)).toBe(true)
    expect(getAllMemories()).toHaveLength(0)
  })
})
