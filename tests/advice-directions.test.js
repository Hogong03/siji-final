/**
 * advice-directions.test.js — M3：候选 / 五层过滤 / 时机 / 反馈
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { buildCandidates, LOOP_MIN_DAYS, scoreCandidate } from '../utils/advice-candidates.js'
import { filterCandidates } from '../utils/advice-select.js'
import { pickForPanel, LIMITS } from '../utils/advice-timing.js'
import { buildAdvice } from '../utils/advice.js'
import {
  recordShown,
  recordRejected,
  recordIgnored,
  recordAccepted,
  isCoolingDown,
  getAdviceStats,
  clearAdviceSeen,
  recordSilence,
  getSilenceStats,
  COOLDOWN_SHOWN,
  COOLDOWN_REJECTED,
  COOLDOWN_IGNORED
} from '../utils/advice-feedback.js'

const DAY = 86400000
const NOW = Date.now()

function snapshot(over = {}) {
  return Object.assign({
    bucket: 'afternoon',
    bucketLabel: '下午',
    weekend: false,
    env: { aiReady: true, firstRun: false, offline: false, dark: false },
    plans: {
      total: 3, active: 2, hasActive: true, overdue: 2, overdueTopName: '整理作品集', overdueMaxDays: 6,
      dueToday: 1, soonCount: 1, soonMinDays: 3, checkedToday: false
    },
    diary: { today: false, week: 2 },
    bill: { month: 3, monthTotal: 1200, budgetPct: 40, lastDays: 1 },
    relation: { total: 0, stale: 0, staleName: '', staleMaxDays: 0 },
    profile: { pct: 80 },
    empty: false
  }, over)
}

function loop(title, days, extra = {}) {
  return Object.assign({ id: 'l_' + title, title, status: 'open', last_at: NOW - days * DAY, is_deleted: 0 }, extra)
}

beforeEach(() => {
  uni.clearStorageSync()
})

describe('候选池：三来源', () => {
  it('规则候选带 evidence.ref', () => {
    const list = buildCandidates(snapshot(), { now: NOW, loops: [], goals: [] })
    expect(list.length).toBeGreaterThan(0)
    list.forEach((c) => {
      expect(c.source).toBe('rule')
      expect(c.evidence.ref).toMatch(/^snapshot\./)
    })
  })

  it('开放事项 ≥3 天才进池；不足 3 天不进', () => {
    const loops = [loop('RAG 项目', LOOP_MIN_DAYS + 1), loop('学 Python', LOOP_MIN_DAYS - 1)]
    const list = buildCandidates(snapshot(), { now: NOW, loops, goals: [] })
    const loopCands = list.filter((c) => c.source === 'loop')
    expect(loopCands).toHaveLength(1)
    expect(loopCands[0].title).toBe('RAG 项目')
    expect(loopCands[0].evidence.ref).toBe('loop:l_RAG 项目')
  })

  it('已暂停 / 已挂计划 / 已删除的开放事项不进池', () => {
    const loops = [
      loop('A 项目', 5, { status: 'paused' }),
      loop('B 项目', 5, { plan_id: 'p1' }),
      loop('C 项目', 5, { is_deleted: 1 })
    ]
    const list = buildCandidates(snapshot(), { now: NOW, loops, goals: [] })
    expect(list.filter((c) => c.source === 'loop')).toHaveLength(0)
  })

  it('画像只做打分：会影响排序，但不产生候选', () => {
    const goals = ['AI 工程 / RAG 方向']
    const a = scoreCandidate({ title: '学 RAG', why: '', tone: 'nudge', source: 'rule', days: 0 }, { goals })
    const b = scoreCandidate({ title: '记一笔午饭', why: '', tone: 'nudge', source: 'rule', days: 0 }, { goals })
    expect(a).toBeGreaterThan(b)
    const list = buildCandidates(snapshot(), { now: NOW, loops: [], goals })
    expect(list.some((c) => c.source === 'goal')).toBe(false)
  })
})

describe('五层过滤前三层', () => {
  const base = [
    { id: 'rule:plan-overdue', domain: 'plan', title: '2 项计划已过期', score: 0.9, evidence: { ref: 'snapshot.plans.overdue' }, tone: 'urgent' },
    { id: 'rule:plan-today', domain: 'plan', title: '今天有 1 项到期', score: 0.7, evidence: { ref: 'snapshot.plans.dueToday' }, tone: 'nudge' },
    { id: 'rule:bill-budget', domain: 'bill', title: '本月已用 95% 预算', score: 0.8, evidence: { ref: 'snapshot.bill.budgetPct' }, tone: 'urgent' },
    { id: 'loop:x', domain: 'loop', title: 'RAG 项目', score: 0.6, evidence: { ref: 'loop:x' }, tone: 'nudge' },
    { id: 'bad:no-ref', domain: 'other', title: '没有依据', score: 1, evidence: { ref: '' }, tone: 'nudge' }
  ]

  it('没有 evidence.ref 的直接丢', () => {
    const r = filterCandidates(base, { now: NOW, coolingDown: () => false })
    expect(r.items.some((c) => c.id === 'bad:no-ref')).toBe(false)
    expect(r.droppedNoRef).toBe(1)
  })

  it('同域只留分最高的一条', () => {
    const r = filterCandidates(base, { now: NOW, coolingDown: () => false })
    const plans = r.items.filter((c) => c.domain === 'plan')
    expect(plans).toHaveLength(1)
    expect(plans[0].id).toBe('rule:plan-overdue')
  })

  it('冷却期内的候选不出现', () => {
    const r = filterCandidates(base, { now: NOW, coolingDown: (id) => id === 'loop:x' })
    expect(r.items.some((c) => c.id === 'loop:x')).toBe(false)
    expect(r.droppedCooldown).toBe(1)
  })
})

describe('时机与节制', () => {
  const two = [
    { id: 'a', taskLike: true, score: 0.9 },
    { id: 'b', taskLike: false, score: 0.5 }
  ]

  it('正常能量：2~3 条，最多 3', () => {
    expect(pickForPanel(two, { energy: 'medium' }).items).toHaveLength(2)
    const three = two.concat([{ id: 'c', taskLike: true, score: 0.1 }])
    expect(pickForPanel(three, { energy: 'medium' }).items).toHaveLength(3)
    const five = three.concat([{ id: 'd' }, { id: 'e' }])
    expect(pickForPanel(five, { energy: 'medium' }).items).toHaveLength(3)
  })

  it('不足下限 → 不弹（不凑数）', () => {
    const r = pickForPanel([{ id: 'a', taskLike: true }], { energy: 'medium' })
    expect(r.items).toEqual([])
    expect(r.reason).toBe('not-enough')
  })

  it('低能量：只留 1 条非任务项', () => {
    const r = pickForPanel(two, { energy: 'low' })
    expect(r.items).toHaveLength(1)
    expect(r.items[0].id).toBe('b')
    expect(LIMITS.low.max).toBe(1)
  })

  it('低能量但没有轻量候选 → 沉默', () => {
    const r = pickForPanel([{ id: 'a', taskLike: true }], { energy: 'low' })
    expect(r.items).toEqual([])
    expect(r.reason).toBe('low-no-gentle')
  })

  it('极低能量 → 什么都不给', () => {
    const r = pickForPanel(two, { energy: 'very_low' })
    expect(r.items).toEqual([])
    expect(r.reason).toBe('energy-very-low')
  })
})

describe('端到端：buildAdvice 产出方向', () => {
  function resolveRef(ref, snap, loops) {
    if (ref.startsWith('loop:')) return loops.some((l) => 'loop:' + l.id === ref)
    const path = ref.replace(/^snapshot\./, '').split('.')
    let cur = snap
    for (const k of path) {
      if (cur == null || !(k in cur)) return false
      cur = cur[k]
    }
    return true
  }

  it('有数据 + 有悬置事项 → ≥2 条方向，ref 全部可解析', () => {
    const loops = [loop('RAG 项目', 6)]
    const deps = {
      plans: () => [
        { client_id: 'p1', title: '整理作品集', deadline: new Date(NOW - 6 * DAY).toISOString().slice(0, 10), status: 1, is_deleted: 0 },
        { client_id: 'p2', title: '预约体检', deadline: new Date(NOW - 1 * DAY).toISOString().slice(0, 10), status: 1, is_deleted: 0 }
      ],
      bills: () => [{ amount: 900, type: 'expense', category: '餐饮', bill_date: new Date(NOW - DAY).toISOString().slice(0, 10) }],
      budget: () => 1000,
      diaries: () => [],
      profile: () => ({ enabled: false, cards: [] }),
      relations: () => [],
      interactions: () => []
    }
    const built = buildAdvice({ now: NOW, env: { aiReady: true }, deps, loops, goals: ['AI 工程'], energy: 'medium', coolingDown: () => false })
    expect(built.directions.length).toBeGreaterThanOrEqual(2)
    built.directions.forEach((d) => {
      expect(d.evidence && d.evidence.ref).toBeTruthy()
      expect(resolveRef(d.evidence.ref, built.snapshot, loops)).toBe(true)
    })
    expect(built.directionsStats.considered).toBeGreaterThan(0)
  })

  it('数据稀少 → 方向为空（沉默）', () => {
    const deps = {
      plans: () => [], bills: () => [], budget: () => 0, diaries: () => [],
      profile: () => ({ enabled: false, cards: [] }), relations: () => [], interactions: () => []
    }
    const built = buildAdvice({ now: NOW, env: { aiReady: true }, deps, loops: [], goals: [], energy: 'medium', coolingDown: () => false })
    expect(built.directions).toEqual([])
    expect(['not-enough', 'no-candidate']).toContain(built.directionsReason)
  })
})

describe('反馈：接受 / 忽略 / 拒绝 三态分开', () => {
  it('曝光后 7 天内冷却', () => {
    recordShown('rule:plan-overdue', NOW)
    expect(isCoolingDown('rule:plan-overdue', NOW + DAY)).toBe(true)
    expect(isCoolingDown('rule:plan-overdue', NOW + COOLDOWN_SHOWN + 1)).toBe(false)
  })

  it('拒绝后 14 天，且比曝光更久', () => {
    recordRejected('loop:x', NOW)
    expect(isCoolingDown('loop:x', NOW + 10 * DAY)).toBe(true)
    expect(isCoolingDown('loop:x', NOW + COOLDOWN_REJECTED + 1)).toBe(false)
  })

  it('忽略满 3 次 → 30 天', () => {
    const id = 'rule:bill-budget'
    recordIgnored(id, NOW - 200 * DAY)
    recordIgnored(id, NOW - 100 * DAY)
    recordIgnored(id, NOW)
    expect(isCoolingDown(id, NOW + 20 * DAY)).toBe(true)
    expect(isCoolingDown(id, NOW + COOLDOWN_IGNORED + 1)).toBe(false)
  })

  it('接受单独计数，不与拒绝混', () => {
    recordAccepted('a', NOW)
    recordRejected('b', NOW)
    const s = getAdviceStats()
    expect(s.accepted).toBe(1)
    expect(s.rejected).toBe(1)
  })

  it('清空曝光表', () => {
    recordShown('a', NOW)
    clearAdviceSeen()
    expect(getAdviceStats().ids).toBe(0)
  })

  it('沉默按原因分组计数（拦截率口径）', () => {
    recordSilence('not-enough')
    recordSilence('not-enough')
    recordSilence('energy-very-low')
    const s = getSilenceStats()
    expect(s['not-enough'].count).toBe(2)
    expect(s['energy-very-low'].count).toBe(1)
  })
})
