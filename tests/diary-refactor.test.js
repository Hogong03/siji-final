/**
 * 记录模块收敛（4.2.0）
 *
 * 方案来源：市面记录法对比（docs/记录方案对比.html）的三条共性 ——
 *   记录零摩擦 / 分类只留一个维度 / 回顾比分类更值钱
 * 这里锁住四件事：
 *   1. 类型 5 → 3，且灵感、闪念归入记录时补上同名标签（语义不丢）
 *   2. 分类并入标签（category 值转成标签名，字段清空）
 *   3. 自动打标签：优先复用已有标签，最多 3 个；没有把握就不打
 *   4. 一句话筛选 + 回顾挑选 + 列表副标题取第一句（纯函数）
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { resetStorage } from './setup.js'
import './setup.js'
import {
  migrateRecordTypes, migrateDiaryCategories, getDiariesBetween, RECORD_TYPE_KEYS, LEGACY_TYPE_MAP
} from '../utils/storage/diary.js'
import { suggestTags, AUTO_TAG_LIMIT } from '../utils/diary-tags.js'
import { parseDiaryQuery, rangeToTimestamps, firstSentence } from '../utils/diary-query.js'
import { pickReviewRecords } from '../utils/record-review.js'

const NOW = new Date(2026, 8, 17, 15, 0, 0).getTime()
const KEY = 'diary_2026-09'

function seedDiaries(list) {
  uni.setStorageSync(KEY, JSON.stringify(list))
}
function raw() {
  return JSON.parse(uni.getStorageSync(KEY) || '[]')
}

describe('类型收敛：5 → 3', () => {
  beforeEach(() => resetStorage())

  it('白名单只有 note / diary / todo', () => {
    expect(RECORD_TYPE_KEYS).toEqual(['note', 'diary', 'todo'])
    expect(LEGACY_TYPE_MAP).toEqual({ idea: 'note', flash: 'note' })
  })

  it('思想/闪念迁移成 note，并补上「灵感」「闪念」标签', () => {
    seedDiaries([
      { client_id: 'd1', title: '有个点子', content: 'x', record_type: 'idea', tags: ['工作'], created_at: NOW },
      { client_id: 'd2', title: '一闪而过', content: 'y', record_type: 'flash', tags: [], created_at: NOW },
      { client_id: 'd3', title: '正常记录', content: 'z', record_type: 'note', created_at: NOW }
    ])
    const r = migrateRecordTypes()
    expect(r.changed).toBe(2)
    const rows = raw()
    expect(rows[0].record_type).toBe('note')
    expect(rows[0].tags).toContain('灵感')
    expect(rows[0].tags).toContain('工作')      // 原有标签不丢
    expect(rows[1].record_type).toBe('note')
    expect(rows[1].tags).toEqual(['闪念'])
    expect(rows[2].record_type).toBe('note')
  })

  it('幂等：再跑一次不再改动', () => {
    seedDiaries([{ client_id: 'd1', title: 'x', content: 'x', record_type: 'idea', created_at: NOW }])
    migrateRecordTypes()
    const again = migrateRecordTypes()
    expect(again.changed).toBe(0)
  })

  it('已删除的记录不动', () => {
    seedDiaries([{ client_id: 'd1', title: 'x', content: 'x', record_type: 'idea', is_deleted: 1, created_at: NOW }])
    expect(migrateRecordTypes().changed).toBe(0)
    expect(raw()[0].record_type).toBe('idea')
  })
})

describe('分类并入标签', () => {
  beforeEach(() => resetStorage())

  it('category 值变成同名标签，字段清空', () => {
    seedDiaries([
      { client_id: 'd1', title: 'a', content: 'a', category: '工作', tags: ['六级'], created_at: NOW },
      { client_id: 'd2', title: 'b', content: 'b', category: '健康', tags: [], created_at: NOW }
    ])
    const r = migrateDiaryCategories()
    expect(r.changed).toBe(2)
    const rows = raw()
    expect(rows[0].tags).toEqual(['六级', '工作'])
    expect(rows[0].category).toBe('')
    expect(rows[1].tags).toEqual(['健康'])
  })

  it('已经有同名标签时不重复添加', () => {
    seedDiaries([{ client_id: 'd1', title: 'a', content: 'a', category: '工作', tags: ['工作'], created_at: NOW }])
    migrateDiaryCategories()
    expect(raw()[0].tags).toEqual(['工作'])
  })

  it('没有分类的记录跳过（幂等）', () => {
    seedDiaries([{ client_id: 'd1', title: 'a', content: 'a', tags: [], created_at: NOW }])
    expect(migrateDiaryCategories().changed).toBe(0)
  })
})

describe('自动打标签', () => {
  it('命中已有标签库的名字时优先复用', () => {
    const tags = suggestTags('今天和阿伟聊了面试的事', ['阿伟', '六级'])
    expect(tags).toContain('阿伟')
    expect(tags.length).toBeLessThanOrEqual(AUTO_TAG_LIMIT)
  })

  it('没命中已有标签时落到内置关键词表', () => {
    expect(suggestTags('今天背单词背到吐', [])).toContain('学习')
    expect(suggestTags('晚上去跑步了', [])).toContain('健康')
    expect(suggestTags('今天又加班到十点', [])).toContain('工作')
  })

  it('最多 3 个；什么都没命中就不打', () => {
    const many = suggestTags('加班 开会 复习 背单词 跑步 早睡 买菜 做饭 朋友 聚会', [])
    expect(many.length).toBeLessThanOrEqual(AUTO_TAG_LIMIT)
    expect(suggestTags('嗯嗯好的', [])).toEqual([])
    expect(suggestTags('', ['工作'])).toEqual([])
  })

  it('已有标签名比内置词优先，且不重复', () => {
    const tags = suggestTags('学习的计划', ['学习'])
    expect(tags.filter(t => t === '学习')).toHaveLength(1)
  })
})

describe('一句话筛选', () => {
  it('「上周的工作记录」→ 时间范围 + 关键词', () => {
    expect(parseDiaryQuery('上周的工作记录')).toEqual({ keyword: '工作', range: 'week' })
    expect(parseDiaryQuery('上个月做了什么')).toEqual({ keyword: '', range: 'lastMonth' })
    expect(parseDiaryQuery('今天的记录')).toEqual({ keyword: '', range: 'today' })
    expect(parseDiaryQuery('六级')).toEqual({ keyword: '六级', range: '' })
    expect(parseDiaryQuery('')).toEqual({ keyword: '', range: '' })
  })

  it('时间范围换算：本周从周一算，上月是完整自然月', () => {
    // 2026-09-17 是周四
    const week = rangeToTimestamps('week', NOW)
    expect(new Date(week.from).getDay()).toBe(1)   // 周一
    const last = rangeToTimestamps('lastMonth', NOW)
    expect(new Date(last.from).getMonth()).toBe(7)  // 8 月
    expect(new Date(last.from).getDate()).toBe(1)
    expect(new Date(last.to).getMonth()).toBe(7)
    expect(new Date(last.to).getDate()).toBe(31)
    expect(rangeToTimestamps('nope', NOW)).toBe(null)
  })
})

describe('列表副标题：取第一句', () => {
  it('按句号切，压平空白，超长截断', () => {
    expect(firstSentence('今天去图书馆看书了。还借了两本书。')).toBe('今天去图书馆看书了。')
    expect(firstSentence('  多行\n内容   压平 ')).toBe('多行 内容 压平')
    const long = '很长的一句话'.repeat(30)
    expect(firstSentence(long, 20).endsWith('…')).toBe(true)
    expect(firstSentence('', 20)).toBe('')
  })
})

describe('回顾挑选', () => {
  const day = 24 * 60 * 60 * 1000
  const pool = [
    { client_id: 'week', title: '7 天前的事', content: '内容'.repeat(20), created_at: NOW - 7 * day },
    { client_id: 'month', title: '30 天前的记录', content: '内容'.repeat(20), created_at: NOW - 30 * day },
    { client_id: 'year', title: '去年今日', content: '内容'.repeat(20), created_at: NOW - 365 * day },
    { client_id: 'today', title: '今天的', content: '内容'.repeat(20), created_at: NOW }
  ]

  it('三个窗口各挑一条，带「为什么是它」', () => {
    const out = pickReviewRecords(pool, NOW, { limit: 3 })
    expect(out.map(r => r.id)).toEqual(['week', 'month', 'year'])
    expect(out[0].why).toBe('7 天前')
    expect(out[2].why).toBe('去年今日')
  })

  it('窗口里没有记录就少给，不硬凑', () => {
    const only = [{ client_id: 'month', title: 'x', content: '内容'.repeat(20), created_at: NOW - 30 * day }]
    expect(pickReviewRecords(only, NOW).map(r => r.id)).toEqual(['month'])
    expect(pickReviewRecords([], NOW)).toEqual([])
  })

  it('已删除的不出现；太短的内容优先级更低', () => {
    const list = [
      { client_id: 'del', title: '删掉的', content: '内容'.repeat(20), is_deleted: 1, created_at: NOW - 7 * day },
      { client_id: 'short', title: '嗯', content: '好', created_at: NOW - 7 * day },
      { client_id: 'good', title: '像样的', content: '内容'.repeat(20), created_at: NOW - 6 * day }
    ]
    expect(pickReviewRecords(list, NOW).map(r => r.id)).toEqual(['good'])
  })
})

describe('跨月取记录（回顾与筛选的数据源）', () => {
  beforeEach(() => resetStorage())

  it('只取时间范围内的、未删除的记录', () => {
    uni.setStorageSync('diary_2026-08', JSON.stringify([
      { client_id: 'aug', title: '8 月', content: 'x', created_at: new Date(2026, 7, 10).getTime() }
    ]))
    seedDiaries([
      { client_id: 'sep', title: '9 月', content: 'x', created_at: new Date(2026, 8, 10).getTime() },
      { client_id: 'sep-del', title: '删了', content: 'x', is_deleted: 1, created_at: new Date(2026, 8, 11).getTime() }
    ])
    const out = getDiariesBetween(new Date(2026, 6, 1).getTime(), new Date(2026, 8, 30).getTime())
    expect(out.map(d => d.client_id)).toEqual(['sep', 'aug'])
  })
})