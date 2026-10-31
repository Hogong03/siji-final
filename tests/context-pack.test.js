/**
 * context-pack.test.js — M1 情境包（4.51.0）
 *
 * 守四件事：
 *   1. 零数据 → 空串（不注入、不编内容）
 *   2. 只陈述事实：不出现推断/催促词
 *   3. 最终注入 ≤300 字（含标题）
 *   4. 真的接进了 buildChatMessages，且固定在 system 末尾
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  buildContextPacket,
  renderContextPacket,
  collectSnapshot,
  CONTEXT_PACK_MAX_CHARS,
  RELATION_STALE_DAYS
} from '../utils/context-pack.js'
import { buildChatMessages } from '../utils/ai/chat-helpers.js'
import { collectSnapshot as adviceSnapshot } from '../utils/advice.js'

// 时间现算：账单按「本月」取数，写死月份会让用例在跨月后假失败
const NOW = Date.now()
const _d = new Date(NOW)
const MONTH = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, '0')}`

const DAY_MS = 86400000
const ymd = (offset) => {
  const d = new Date(NOW + offset * DAY_MS)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** 固定夹具：取数全部注入，不碰存储 */
function deps(over = {}) {
  return {
    plans: () => over.plans || [],
    bills: () => over.bills || [],
    budget: () => over.budget || 0,
    diaries: () => over.diaries || [],
    profile: () => over.profile || { enabled: false, cards: [] },
    relations: () => over.relations || [],
    interactions: () => over.interactions || []
  }
}

const PROFILE = {
  enabled: true,
  version: 2,
  cards: [
    {
      id: 'portrait',
      title: '我的画像',
      fields: { 职业方向: 'AI 工程 / RAG 方向', 人生关键词: '把想法做出来', 当前阶段: '补 AI 工程能力' }
    }
  ]
}

const PLANS = [
  { client_id: 'p1', title: '整理作品集', deadline: ymd(-6), status: 1, is_deleted: 0 },
  { client_id: 'p2', title: '预约体检', deadline: ymd(0), status: 1, is_deleted: 0 },
  { client_id: 'p3', title: '读书', deadline: '', status: 1, is_deleted: 0 }
]

const BILLS = [
  { amount: 4800, type: 'expense', category: '房租', bill_date: ymd(-10), created_at: NOW - 10 * DAY_MS },
  { amount: 900, type: 'expense', category: '餐饮', bill_date: ymd(-2), created_at: NOW - 2 * DAY_MS }
]

const DIARIES = [
  { title: '周一', content: 'x', created_at: NOW - 2 * DAY_MS },
  { title: '周二', content: 'y', created_at: NOW - 1 * DAY_MS }
]

/** 抽取注入段（从标题到结尾） */
function packetPart(system) {
  const i = system.indexOf('【当前情境】')
  return i < 0 ? '' : system.slice(i)
}

describe('M1 情境包：构建与渲染', () => {
  beforeEach(() => {
    uni.clearStorageSync()
  })

  it('零数据 → empty，渲染空串', () => {
    const p = buildContextPacket({ now: NOW, deps: deps() })
    expect(p.empty).toBe(true)
    expect(renderContextPacket(p)).toBe('')
  })

  it('只有画像方向 → 只出一行方向，不编计划/账单', () => {
    const text = renderContextPacket(buildContextPacket({ now: NOW, deps: deps({ profile: PROFILE }) }))
    expect(text).toContain('方向：')
    expect(text).toContain('AI 工程')
    expect(text).not.toContain('计划')
    expect(text).not.toContain('账单')
    expect(text.length).toBeLessThanOrEqual(CONTEXT_PACK_MAX_CHARS)
  })

  it('有计划/账单/记录 → 每块都出，且是事实口径', () => {
    const text = renderContextPacket(buildContextPacket({
      now: NOW,
      deps: deps({ plans: PLANS, bills: BILLS, budget: 3000, diaries: DIARIES, profile: PROFILE })
    }))
    expect(text).toContain('逾期 1')
    expect(text).toContain('今天到期 1')
    expect(text).not.toContain('进行中')
    expect(text).toContain('记录：近 7 天 2 篇')
    expect(text).toContain('账单：本月 2 笔 ¥5700')
    expect(text).toContain('方向：')
  })

  it('不含推断/催促词（铁律 1、8）', () => {
    const text = renderContextPacket(buildContextPacket({
      now: NOW,
      deps: deps({ plans: PLANS, bills: BILLS, budget: 3000, diaries: DIARIES, profile: PROFILE })
    }))
    for (const bad of ['应该', '建议', '需要', '还没', '加油', '赶紧', '尽快']) {
      expect(text).not.toContain(bad)
    }
  })

  it('超长数据 → 硬上限 300 字', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      client_id: 'x' + i, title: '计划' + i, deadline: ymd(-1 - i), status: 1, is_deleted: 0
    }))
    const longProfile = {
      enabled: true,
      cards: [{ id: 'portrait', title: '我的画像', fields: { 职业方向: '很长的方向描述'.repeat(20) } }]
    }
    const text = renderContextPacket(buildContextPacket({
      now: NOW, deps: deps({ plans: many, bills: BILLS, budget: 100, diaries: DIARIES, profile: longProfile })
    }))
    expect(text.length).toBeLessThanOrEqual(CONTEXT_PACK_MAX_CHARS)
    expect(text.startsWith('【当前情境】')).toBe(true)
  })

  it('very_low 能量 → 隐去计划与人脉（不盘点缺口）', () => {
    const old = new Date(NOW - 40 * DAY_MS).getTime()
    const text = renderContextPacket(buildContextPacket({
      now: NOW,
      energyLevel: 'very_low',
      deps: deps({
        plans: PLANS,
        bills: BILLS,
        budget: 3000,
        profile: PROFILE,
        relations: [{ id: 'r1', name: '阿伟', created_at: old }]
      })
    }))
    expect(text).not.toContain('计划：')
    expect(text).not.toContain('人脉：')
    expect(text).toContain('账单：')
    expect(text).toContain('方向：')
  })

  it('悬着的事：最多 3 条，一行 ≤60 字', () => {
    const loops = [
      { id: 'l1', title: 'RAG 项目', status: 'open', last_at: NOW - 9 * DAY_MS },
      { id: 'l2', title: '学 Python', status: 'open', last_at: NOW - 2 * DAY_MS },
      { id: 'l3', title: '整理作品集', status: 'open', last_at: NOW - 1 * DAY_MS },
      { id: 'l4', title: '第四条不该出现', status: 'open', last_at: NOW }
    ]
    const text = renderContextPacket(buildContextPacket({ now: NOW, deps: deps(), loops }))
    expect(text).toContain('悬着：')
    expect(text).toContain('RAG 项目（9 天）')
    expect(text).not.toContain('第四条')
    const line = text.split('\n').find((l) => l.startsWith('悬着：'))
    expect(line.length).toBeLessThanOrEqual(60)
  })

  it('very_low 能量不注入悬着的事', () => {
    const loops = [{ id: 'l1', title: 'RAG 项目', status: 'open', last_at: NOW - 9 * DAY_MS }]
    const text = renderContextPacket(buildContextPacket({ now: NOW, energyLevel: 'very_low', deps: deps(), loops }))
    expect(text).toBe('')
  })

  it('人脉计数用统一口径常量', () => {
    expect(RELATION_STALE_DAYS).toBe(30)
    const old = new Date(NOW - 40 * DAY_MS).getTime()
    const text = renderContextPacket(buildContextPacket({
      now: NOW,
      deps: deps({
        relations: [{ id: 'r1', name: '阿伟', created_at: old }],
        interactions: []
      })
    }))
    expect(text).toContain('1 人超过 30 天未联系')
  })
})

describe('M1 接入：buildChatMessages', () => {
  beforeEach(() => {
    uni.clearStorageSync()
  })

  it('空库不注入情境段', () => {
    const msgs = buildChatMessages('今天天气不错', [], {})
    expect(msgs[0].content).not.toContain('【当前情境】')
  })

  it('有数据时注入，且固定在 system 末尾', () => {
    uni.setStorageSync('plan_all', JSON.stringify(PLANS))
    uni.setStorageSync(`bill_${MONTH}`, JSON.stringify(BILLS))
    uni.setStorageSync('siji_my_profile', JSON.stringify(PROFILE))

    const msgs = buildChatMessages('最近有点乱', [], {})
    const system = msgs[0].content
    expect(system).toContain('【当前情境】')
    const tail = packetPart(system)
    expect(tail.length).toBeLessThanOrEqual(CONTEXT_PACK_MAX_CHARS)
    // 末尾：情境包之后不应再有别的块
    expect(system.endsWith(tail)).toBe(true)
    // 原有注入不受影响
    expect(system).toContain('【用户画像摘要】')
    expect(system.indexOf('【用户画像摘要】')).toBeLessThan(system.indexOf('【当前情境】'))
  })
})

describe('M1 兼容：collectSnapshot 再导出', () => {
  it('advice.js 导出的 collectSnapshot 与 context-pack 同源同值', () => {
    const d = deps({ plans: PLANS, bills: BILLS, budget: 3000, diaries: DIARIES, profile: PROFILE })
    expect(adviceSnapshot(NOW, {}, d)).toEqual(collectSnapshot(NOW, {}, d))
  })
})
