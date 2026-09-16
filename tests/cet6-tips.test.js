/**
 * 内置六级技巧记录（3.8.0）
 *
 * 覆盖：12 条技巧落进当月分片、标签为「技巧」并注册进标签表、
 * 幂等（重复调用不重复写）、用户删掉的不复活、四类题型齐全、内容非空可读。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { resetStorage } from './setup.js'
import './setup.js'
import { ensureCet6Tips, CET6_TIPS, CET6_TIP_IDS, CET6_TIP_TAG } from '../utils/storage/cet6-tips.js'
import { getRawList, getMonthFromDate } from '../utils/storage/helpers.js'
import { getTags } from '../utils/storage/tags.js'

const NOW = new Date(2026, 8, 17, 20, 0, 0).getTime()
const MONTH = getMonthFromDate(NOW)

function listOfMonth(month = MONTH) {
  return getRawList('diary_' + month)
}

describe('ensureCet6Tips：首次补齐', () => {
  beforeEach(() => resetStorage())

  it('12 条技巧全部写进当月分片，且都带「技巧」标签', () => {
    const r = ensureCet6Tips(NOW)
    expect(r.added).toBe(CET6_TIPS.length)
    expect(r.month).toBe(MONTH)
    const rows = listOfMonth()
    expect(rows).toHaveLength(CET6_TIPS.length)
    rows.forEach(row => {
      expect(row.tags).toEqual([CET6_TIP_TAG])
      expect(row.record_type).toBe('note')
      expect(row.is_deleted).toBe(0)
      expect(row.title.length).toBeGreaterThan(4)
      expect(row.content.length).toBeGreaterThan(20)
    })
  })

  it('「技巧」标签进了标签注册表，且归到学习种类', () => {
    ensureCet6Tips(NOW)
    const tag = getTags('diary').find(t => t.name === CET6_TIP_TAG)
    expect(tag).toBeTruthy()
    expect(tag.categoryId).toBe('study')
  })

  it('四类题型齐全：写作 / 阅读 / 听力 / 翻译 各 3 条', () => {
    const bySection = { 写作: 0, 阅读: 0, 听力: 0, 翻译: 0 }
    CET6_TIPS.forEach(t => {
      Object.keys(bySection).forEach(k => {
        if (t.title.indexOf(k) === 0) bySection[k]++
      })
    })
    expect(bySection).toEqual({ 写作: 3, 阅读: 3, 听力: 3, 翻译: 3 })
  })

  it('client_id 唯一且带 tip_cet6_ 前缀（增量补发与排查都靠它）', () => {
    const ids = CET6_TIPS.map(t => t.client_id)
    expect(new Set(ids).size).toBe(ids.length)
    ids.forEach(id => expect(id.startsWith('tip_cet6_')).toBe(true))
    expect(CET6_TIP_IDS).toEqual(ids)
  })

  it('内容对得上实测分数里的短板（听力视听一致 / 阅读放弃选词 / 简单句优先）', () => {
    const all = CET6_TIPS.map(t => t.title + t.content).join('\n')
    expect(all).toContain('视听一致')
    expect(all).toContain('选词填空')
    expect(all).toContain('简单句')
    expect(all).toContain('140')
    expect(all).toContain('96')
  })
})

describe('ensureCet6Tips：幂等与不复活', () => {
  beforeEach(() => resetStorage())

  it('重复调用不重复写（第二次 added 为 0）', () => {
    ensureCet6Tips(NOW)
    const again = ensureCet6Tips(NOW)
    expect(again.added).toBe(0)
    expect(listOfMonth()).toHaveLength(CET6_TIPS.length)
  })

  it('用户删掉的技巧不会被重新塞回来（软删也算存在）', () => {
    ensureCet6Tips(NOW)
    const key = 'diary_' + MONTH
    const rows = getRawList(key)
    rows[0].is_deleted = 1
    uni.setStorageSync(key, JSON.stringify(rows))

    const again = ensureCet6Tips(NOW)
    expect(again.added).toBe(0)
    expect(listOfMonth()).toHaveLength(CET6_TIPS.length)
    expect(getRawList(key)[0].is_deleted).toBe(1)
  })

  it('已有其它记录时是追加，不覆盖用户数据', () => {
    const key = 'diary_' + MONTH
    uni.setStorageSync(key, JSON.stringify([{ client_id: 'diary_user_1', title: '我的记录', content: 'x', created_at: NOW - 1000 }]))
    ensureCet6Tips(NOW)
    const rows = getRawList(key)
    expect(rows).toHaveLength(CET6_TIPS.length + 1)
    expect(rows.some(r => r.client_id === 'diary_user_1')).toBe(true)
  })

  it('新增技巧时只补缺的那几条（模拟以后版本追加）', () => {
    const key = 'diary_' + MONTH
    // 先手动放进去 11 条，模拟「老用户已有大部分」
    const eleven = CET6_TIPS.slice(0, 11).map((t, i) => ({ client_id: t.client_id, title: t.title, content: t.content, created_at: NOW + i }))
    uni.setStorageSync(key, JSON.stringify(eleven))
    const r = ensureCet6Tips(NOW)
    expect(r.added).toBe(1)
    expect(r.ids).toEqual([CET6_TIPS[11].client_id])
  })

  it('跨月不重复：换个月份启动不会再补一份（判重扫近 13 个月）', () => {
    ensureCet6Tips(NOW)
    const nextMonth = new Date(2026, 9, 2, 9, 0, 0).getTime()
    const r = ensureCet6Tips(nextMonth)
    expect(r.added).toBe(0)
    // 10 月分片里一条都没有：技巧只留在创建当月
    expect(getRawList('diary_' + getMonthFromDate(nextMonth))).toHaveLength(0)
    // 9 月那份还在，且正好 12 条
    expect(getRawList('diary_' + MONTH)).toHaveLength(CET6_TIPS.length)
  })

  it('近 13 个月之外的旧技巧不会被重复补发（判重也看历史分片）', () => {
    // 把技巧放到一年前那个月，模拟「装了很久的老用户」
    const oldMonth = '2025-09'
    uni.setStorageSync('diary_' + oldMonth, JSON.stringify(CET6_TIPS.map(t => ({ client_id: t.client_id, title: t.title, content: t.content }))))
    const r = ensureCet6Tips(NOW)
    expect(r.added).toBe(0)
  })
})