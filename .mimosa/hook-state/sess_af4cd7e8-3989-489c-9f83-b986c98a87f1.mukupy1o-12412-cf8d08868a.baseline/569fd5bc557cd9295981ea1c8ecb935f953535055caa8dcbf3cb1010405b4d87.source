/**
 * social-quota.js 测试（3.5.14：社交能量预算）
 *
 * 覆盖：额度读写与钳制、同一天同一个人只算一次、区间口径、
 * 文案（未设置不显示 / 排满不催）、三条草稿的语气红线、与 logInteraction 的联通。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { resetStorage } from './setup.js'
import { weekRangeTsOf } from '../utils/plan-recur.js'
import { logInteraction, createRelation } from '../utils/relations.js'
import {
  getWeeklyQuota,
  setWeeklyQuota,
  countSocialTouches,
  formatSocialQuotaLine,
  buildSocialQuota,
  buildReplyDrafts,
  buildReplyPrompt
} from '../utils/social-quota.js'

const DAY = 24 * 60 * 60 * 1000
/** 2026-09-14（周一）10:00 */
const NOW = new Date(2026, 8, 14, 10, 0, 0).getTime()
const WEEK_START = weekRangeTsOf(NOW).weekStart
const WEEK_END = weekRangeTsOf(NOW).weekEnd

function mkTouch(over) {
  return Object.assign({
    id: 'i1',
    relation_id: 'r1',
    relation_name: '阿伟',
    date: WEEK_START + 2 * 3600 * 1000,
    created_at: WEEK_START,
    is_deleted: 0
  }, over)
}

beforeEach(() => {
  resetStorage()
})

describe('每周额度读写', () => {
  it('默认未设置返回 0', () => {
    expect(getWeeklyQuota()).toBe(0)
  })

  it('设置后可读回', () => {
    expect(setWeeklyQuota(3)).toBe(3)
    expect(getWeeklyQuota()).toBe(3)
  })

  it('钳制在 0-30，非法输入归 0', () => {
    expect(setWeeklyQuota(99)).toBe(30)
    expect(setWeeklyQuota(-2)).toBe(0)
    expect(setWeeklyQuota('abc')).toBe(0)
    expect(setWeeklyQuota(2.7)).toBe(2)
    expect(getWeeklyQuota()).toBe(2)
  })
})

describe('countSocialTouches：计数口径', () => {
  it('同一天同一个人只算一次', () => {
    const list = [
      mkTouch({ id: 'a' }),
      mkTouch({ id: 'b', date: WEEK_START + 5 * 3600 * 1000 }),
      mkTouch({ id: 'c', date: WEEK_START + 8 * 3600 * 1000 })
    ]
    expect(countSocialTouches(list, WEEK_START, WEEK_END)).toBe(1)
  })

  it('同一人不同天各算一次，同一天不同人各算一次', () => {
    const list = [
      mkTouch({ id: 'a', date: WEEK_START + 3600 * 1000 }),
      mkTouch({ id: 'b', date: WEEK_START + DAY + 3600 * 1000 }),
      mkTouch({ id: 'c', relation_id: 'r2', relation_name: '小林', date: WEEK_START + 3600 * 1000 })
    ]
    expect(countSocialTouches(list, WEEK_START, WEEK_END)).toBe(3)
  })

  it('区间左闭右开，上周和下周都不计入', () => {
    const list = [
      mkTouch({ id: 'before', date: WEEK_START - 1 }),
      mkTouch({ id: 'after', date: WEEK_END }),
      mkTouch({ id: 'in', date: WEEK_START })
    ]
    expect(countSocialTouches(list, WEEK_START, WEEK_END)).toBe(1)
  })

  it('已删除的记录不计入', () => {
    const list = [mkTouch({ id: 'a', is_deleted: 1 })]
    expect(countSocialTouches(list, WEEK_START, WEEK_END)).toBe(0)
  })

  it('没有 date 时用 created_at 兜底，两者都没有则跳过', () => {
    const list = [
      mkTouch({ id: 'a', date: 0, created_at: WEEK_START + 3600 * 1000 }),
      mkTouch({ id: 'b', date: 0, created_at: 0 })
    ]
    expect(countSocialTouches(list, WEEK_START, WEEK_END)).toBe(1)
  })

  it('没有关系标识的记录跳过，非数组输入返回 0', () => {
    expect(countSocialTouches([mkTouch({ id: 'a', relation_id: '', relation_name: '' })], WEEK_START, WEEK_END)).toBe(0)
    expect(countSocialTouches(null, WEEK_START, WEEK_END)).toBe(0)
  })
})

describe('formatSocialQuotaLine：文案', () => {
  it('未设置额度返回空串（不该出现在页面上）', () => {
    expect(formatSocialQuotaLine({ quota: 0, used: 2, remaining: 0 })).toBe('')
    expect(formatSocialQuotaLine(null)).toBe('')
  })

  it('还有余量时报剩余次数', () => {
    expect(formatSocialQuotaLine({ quota: 3, used: 2, remaining: 1 })).toBe('本周社交 2/3 · 还能放 1 次')
  })

  it('排满时只说排满，不催不评', () => {
    const line = formatSocialQuotaLine({ quota: 3, used: 3, remaining: 0 })
    expect(line).toBe('本周社交 3/3 · 排满了，剩下的下周再说也行')
    expect(line).not.toContain('应该')
    expect(line).not.toContain('还差')
  })
})

describe('buildSocialQuota：本周状态', () => {
  it('未设置额度时不显示、不判定排满', () => {
    const r = buildSocialQuota({ now: NOW, interactions: [mkTouch({})] })
    expect(r.quota).toBe(0)
    expect(r.used).toBe(1)
    expect(r.reached).toBe(false)
    expect(r.line).toBe('')
  })

  it('设置额度后给出剩余与排满状态', () => {
    setWeeklyQuota(2)
    const r = buildSocialQuota({
      now: NOW,
      interactions: [
        mkTouch({ id: 'a', date: WEEK_START + 3600 * 1000 }),
        mkTouch({ id: 'b', relation_id: 'r2', date: WEEK_START + DAY })
      ]
    })
    expect(r.used).toBe(2)
    expect(r.remaining).toBe(0)
    expect(r.reached).toBe(true)
    expect(r.line).toContain('排满了')
  })

  it('超出额度时剩余为 0，不出现负数', () => {
    setWeeklyQuota(1)
    const r = buildSocialQuota({
      now: NOW,
      interactions: [
        mkTouch({ id: 'a', date: WEEK_START + 3600 * 1000 }),
        mkTouch({ id: 'b', relation_id: 'r2', date: WEEK_START + DAY })
      ]
    })
    expect(r.remaining).toBe(0)
    expect(r.used).toBe(2)
  })
})

describe('buildSocialQuota 与互动记录联通', () => {
  it('logInteraction 写入的互动会计入本周', () => {
    createRelation({ name: '阿伟', role: '同事' })
    const rel = JSON.parse(uni.getStorageSync('siji_relations'))[0]
    logInteraction({ relation_id: rel.id, relation_name: '阿伟', content: '回了消息', date: Date.now() })
    setWeeklyQuota(3)
    const r = buildSocialQuota({ now: Date.now() })
    expect(r.used).toBeGreaterThanOrEqual(1)
    expect(r.line).toContain('/3')
  })
})

describe('回复草稿：可延后不消失', () => {
  it('给出三条草稿，带姓名与标签', () => {
    const drafts = buildReplyDrafts({ name: '阿伟', role: '同事', scene: '开会' })
    expect(drafts.length).toBe(3)
    drafts.forEach(d => {
      expect(d.id).toBeTruthy()
      expect(d.label).toBeTruthy()
      expect(d.text.length).toBeGreaterThan(0)
      expect(d.text.length).toBeLessThanOrEqual(60)
    })
    expect(drafts[0].text).toContain('阿伟')
  })

  it('不出现催促或检讨式措辞', () => {
    const all = buildReplyDrafts({ name: '阿伟' }).map(d => d.text).join(' ')
    ;['你应该', '必须', '抱歉', '对不起', '尽快', '马上回'].forEach(word => {
      expect(all).not.toContain(word)
    })
  })

  it('没有姓名时不出现空占位', () => {
    const drafts = buildReplyDrafts({})
    expect(drafts[0].text).toContain('你')
    expect(drafts[0].text).not.toContain('undefined')
  })

  it('交给 AI 的提示词包含对象、场景与语气要求', () => {
    const prompt = buildReplyPrompt({ name: '阿伟', role: '同事', scene: '开会' })
    expect(prompt).toContain('阿伟')
    expect(prompt).toContain('同事')
    expect(prompt).toContain('开会')
    expect(prompt).toContain('3 条备选')
    expect(prompt).not.toContain('undefined')
  })
})
