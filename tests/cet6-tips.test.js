/**
 * 内置六级技巧（3.8.0 建的，3.9.0 改成 4 章长文）
 *
 * 覆盖：4 章章节长文落库、每章都能解析出多个小节（目录尺的刻度来源）、
 * 标签「技巧」注册到学习种类、幂等补发、旧版 12 条短技巧被撤掉、
 * 用户删掉的不复活、seed_v 变化时刷新内容。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { resetStorage } from './setup.js'
import './setup.js'
import {
  ensureCet6Tips, CET6_TIPS, CET6_TIP_IDS, CET6_TIP_IDS_V1, CET6_TIP_TAG,
  CET6_SEED_MARK, CET6_SEED_VERSION
} from '../utils/storage/cet6-tips.js'
import { getRawList, getMonthFromDate } from '../utils/storage/helpers.js'
import { getTags } from '../utils/storage/tags.js'
import { splitSections, shouldShowOutline } from '../utils/text-outline.js'

const NOW = new Date(2026, 8, 17, 20, 0, 0).getTime()
const MONTH = getMonthFromDate(NOW)
const KEY = 'diary_' + MONTH

const alive = (key = KEY) => getRawList(key).filter(r => r.is_deleted !== 1)

describe('ensureCet6Tips：首次补齐 4 章长文', () => {
  beforeEach(() => resetStorage())

  it('4 章全部写进当月分片，带「技巧」标签与种子标记', () => {
    const r = ensureCet6Tips(NOW)
    expect(r.added).toBe(CET6_TIPS.length)
    expect(r.added).toBe(4)
    const rows = alive()
    expect(rows).toHaveLength(4)
    rows.forEach(row => {
      expect(row.tags).toEqual([CET6_TIP_TAG])
      expect(row.record_type).toBe('note')
      expect(row.seed).toBe(CET6_SEED_MARK)
      expect(row.seed_v).toBe(CET6_SEED_VERSION)
      // 章节长文：每章正文至少 500 字，且有 Markdown 小节标题
      expect(row.content.length).toBeGreaterThan(500)
      expect(row.content).toContain('## ')
    })
  })

  it('每章正文都能解析出多个小节（阅读页目录尺的刻度来源）', () => {
    ensureCet6Tips(NOW)
    alive().forEach(row => {
      const secs = splitSections(row.content)
      expect(secs.length).toBeGreaterThanOrEqual(3)
      expect(shouldShowOutline(secs.filter(s => s.title).length)).toBe(true)
    })
  })

  it('「技巧」标签进标签注册表并归到学习种类', () => {
    ensureCet6Tips(NOW)
    const tag = getTags('diary').find(t => t.name === CET6_TIP_TAG)
    expect(tag).toBeTruthy()
    expect(tag.categoryId).toBe('study')
  })

  it('四章标题覆盖写作 / 听力 / 阅读 / 翻译，且带章号', () => {
    expect(CET6_TIPS.map(t => t.chapter)).toEqual(['写作', '听力', '阅读', '翻译'])
    CET6_TIPS.forEach(t => expect(t.title.indexOf('六级·')).toBe(0))
  })

  it('内容对准实测短板：视听一致 / 选词填空 / 简单句 / 分数', () => {
    const all = CET6_TIPS.map(t => t.title + t.content).join('\n')
    expect(all).toContain('视听一致')
    expect(all).toContain('选词填空')
    expect(all).toContain('简单句')
    expect(all).toContain('140')
    expect(all).toContain('96')
  })

  it('client_id 唯一且前缀正确', () => {
    const ids = CET6_TIPS.map(t => t.client_id)
    expect(new Set(ids).size).toBe(ids.length)
    ids.forEach(id => expect(id.startsWith('tip_cet6_')).toBe(true))
    expect(CET6_TIP_IDS).toEqual(ids)
  })
})

describe('ensureCet6Tips：幂等 / 迁移 / 不复活', () => {
  beforeEach(() => resetStorage())

  it('重复调用不再写（added 为 0）', () => {
    ensureCet6Tips(NOW)
    const again = ensureCet6Tips(NOW)
    expect(again.added).toBe(0)
    expect(alive()).toHaveLength(4)
  })

  it('3.8.0 的 12 条短技巧会被撤掉（软删），不留两套', () => {
    // 先造出旧版：12 条短技巧
    uni.setStorageSync(KEY, JSON.stringify(CET6_TIP_IDS_V1.map((id, i) => ({
      client_id: id, title: '旧短技巧' + i, content: 'x', tags: [CET6_TIP_TAG], created_at: NOW - 1000
    }))))
    const r = ensureCet6Tips(NOW)
    expect(r.superseded).toBe(12)
    expect(r.added).toBe(4)
    // 旧的没了、新的在
    const rows = getRawList(KEY)
    CET6_TIP_IDS_V1.forEach(id => {
      const hit = rows.find(x => x.client_id === id)
      expect(hit.is_deleted).toBe(1)
    })
    expect(alive()).toHaveLength(4)
  })

  it('已经删掉过的旧短技巧不再动（用户主动删的不复活）', () => {
    uni.setStorageSync(KEY, JSON.stringify(CET6_TIP_IDS_V1.map((id, i) => ({
      client_id: id, title: '旧' + i, content: 'x', is_deleted: 1, created_at: NOW - 1000
    }))))
    const r = ensureCet6Tips(NOW)
    expect(r.superseded).toBe(0)
    expect(r.added).toBe(4)
  })

  it('用户删掉的章节技巧不复活、也不刷新', () => {
    ensureCet6Tips(NOW)
    const rows = getRawList(KEY)
    rows[0].is_deleted = 1
    rows[0].seed_v = 1
    rows[0].content = '用户改成了自己的笔记'
    uni.setStorageSync(KEY, JSON.stringify(rows))

    const r = ensureCet6Tips(NOW)
    expect(r.updated).toBe(0)
    const hit = getRawList(KEY).find(x => x.client_id === rows[0].client_id)
    expect(hit.is_deleted).toBe(1)
    expect(hit.content).toBe('用户改成了自己的笔记')
  })

  it('seed_v 旧于当前版本时刷新正文（升级内容用）', () => {
    ensureCet6Tips(NOW)
    const rows = getRawList(KEY)
    rows.forEach(r => { r.seed_v = 1; r.content = '旧内容' })
    uni.setStorageSync(KEY, JSON.stringify(rows))

    const r = ensureCet6Tips(NOW)
    expect(r.updated).toBe(4)
    getRawList(KEY).forEach(row => {
      expect(row.seed_v).toBe(CET6_SEED_VERSION)
      expect(row.content).not.toBe('旧内容')
      expect(row.content).toContain('##')
    })
  })

  it('跨月不重复：换个月份启动不再补一份', () => {
    ensureCet6Tips(NOW)
    const next = new Date(2026, 9, 2, 9, 0, 0).getTime()
    const r = ensureCet6Tips(next)
    expect(r.added).toBe(0)
    expect(getRawList('diary_' + getMonthFromDate(next))).toHaveLength(0)
    expect(alive()).toHaveLength(4)
  })

  it('已有用户记录时是追加，不覆盖', () => {
    uni.setStorageSync(KEY, JSON.stringify([{ client_id: 'diary_user_1', title: '我的记录', content: 'x', created_at: NOW - 1000 }]))
    ensureCet6Tips(NOW)
    const rows = getRawList(KEY)
    expect(rows.some(r => r.client_id === 'diary_user_1')).toBe(true)
    expect(alive()).toHaveLength(5)
  })
})