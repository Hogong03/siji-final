/**
 * advice-instrumentation.test.js — M3 埋点补丁（只测采集，不改行为）
 *
 * 对应授权里的 9 条验证：关闭只记未动作、三态互不污染、拒绝 14 天、
 * 自动/手动分开、手动不影响自动沉默率、全局关闭不算拒绝、诊断可持久化、
 * 统计异常不影响主流程、原有测试全过（由全量跑保障）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { newSession, markShown, markActed, ignoredIds, actedKind } from '../utils/advice-session.js'
import {
  bumpDiag,
  getDiag,
  getDiagTotals,
  clearDiag,
  ADVICE_DIAG_KEY,
  DIAG_KEEP_DAYS
} from '../utils/advice-diag.js'
import {
  recordAccepted,
  recordRejected,
  recordIgnored,
  isCoolingDown,
  getAdviceStats,
  clearAdviceSeen,
  COOLDOWN_REJECTED
} from '../utils/advice-feedback.js'

const DAY = 86400000
const NOW = Date.now()
const dirs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

beforeEach(() => {
  uni.clearStorageSync()
})

describe('会话追踪：三态互不污染', () => {
  it('关闭面板只记未动作的方向', () => {
    const s = newSession()
    markShown(s, dirs)
    markActed(s, 'a', 'accepted')
    expect(ignoredIds(s)).toEqual(['b', 'c'])
  })

  it('点过不相关的不会再算忽略', () => {
    const s = newSession()
    markShown(s, dirs)
    markActed(s, 'b', 'rejected')
    expect(ignoredIds(s)).toEqual(['a', 'c'])
    expect(actedKind(s, 'b')).toBe('rejected')
  })

  it('全部有动作 → 关闭不产生忽略', () => {
    const s = newSession()
    markShown(s, [{ id: 'a' }])
    markActed(s, 'a', 'accepted')
    expect(ignoredIds(s)).toEqual([])
  })

  it('重复 markShown 不重复计数', () => {
    const s = newSession()
    markShown(s, dirs)
    markShown(s, dirs)
    expect(s.shown).toHaveLength(3)
  })

  it('非法动作值被忽略', () => {
    const s = newSession()
    markShown(s, dirs)
    markActed(s, 'a', 'closed')
    expect(actedKind(s, 'a')).toBe('')
    expect(ignoredIds(s)).toContain('a')
  })
})

describe('三态计数：accept / ignore / reject 分开', () => {
  it('关闭 → ignored，接受 → accepted，不相关 → rejected，互不污染', () => {
    recordIgnored('x', NOW)
    recordAccepted('y', NOW)
    recordRejected('z', NOW)
    const s = getAdviceStats()
    expect(s.ignored).toBe(1)
    expect(s.accepted).toBe(1)
    expect(s.rejected).toBe(1)
  })

  it('拒绝进入 14 天冷却', () => {
    recordRejected('z', NOW)
    expect(isCoolingDown('z', NOW + 10 * DAY)).toBe(true)
    expect(isCoolingDown('z', NOW + COOLDOWN_REJECTED + 1)).toBe(false)
  })

  it('忽略一次不会立刻冷却成拒绝的时长', () => {
    recordIgnored('i', NOW)
    // 忽略 1 次仍按普通曝光窗口（7 天），不是 14 天
    expect(isCoolingDown('i', NOW + 8 * DAY)).toBe(false)
  })
})

describe('诊断聚合：按日、可持久化、分开自动与手动', () => {
  it('同日累加，跨日分开', () => {
    bumpDiag({ autoEntries: 1, autoShown: 2 }, NOW)
    bumpDiag({ autoEntries: 1, autoShown: 3 }, NOW + 60 * 1000)
    const d = getDiag().days
    const today = Object.keys(d).sort().pop()
    expect(d[today].autoEntries).toBe(2)
    expect(d[today].autoShown).toBe(5)
  })

  it('自动与手动分别计数，手动不进 auto 字段', () => {
    bumpDiag({ manualOpens: 1, manualShown: 3 }, NOW)
    const t = getDiagTotals()
    expect(t.manualOpens).toBe(1)
    expect(t.manualShown).toBe(3)
    expect(t.autoEntries).toBe(0)
    expect(t.autoShown).toBe(0)
  })

  it('各层拦截计数可跨读持久化', () => {
    bumpDiag({ considered: 6, available: 2, droppedNoRef: 0, droppedDup: 3, droppedCooldown: 1, srcRule: 5, srcLoop: 1 }, NOW)
    const raw = JSON.parse(uni.getStorageSync(ADVICE_DIAG_KEY))
    expect(Object.keys(raw.days).length).toBe(1)
    const t = getDiagTotals()
    expect(t.considered).toBe(6)
    expect(t.droppedDup).toBe(3)
    expect(t.srcLoop).toBe(1)
  })

  it('保留最近 30 天，超出被剪掉', () => {
    for (let i = 0; i < 40; i++) bumpDiag({ autoEntries: 1 }, NOW - (39 - i) * DAY)
    const days = Object.keys(getDiag().days)
    expect(days.length).toBeLessThanOrEqual(DIAG_KEEP_DAYS)
    const t = getDiagTotals()
    expect(t.from).toBeTruthy()
    expect(t.to).toBeTruthy()
  })

  it('空 patch 不写盘', () => {
    bumpDiag({}, NOW)
    expect(uni.getStorageSync(ADVICE_DIAG_KEY)).toBe('')
  })

  it('统计写失败不抛错（主流程不受影响）', () => {
    const spy = vi.spyOn(uni, 'setStorageSync').mockImplementation(() => { throw new Error('quota') })
    expect(() => bumpDiag({ autoEntries: 1 }, NOW)).not.toThrow()
    spy.mockRestore()
  })

  it('清空诊断', () => {
    bumpDiag({ autoEntries: 1 }, NOW)
    clearDiag()
    expect(getDiagTotals().autoEntries).toBe(0)
  })
})

describe('全局关闭不计拒绝', () => {
  it('autoDisabled 只记设置变化，rejected 仍为 0', () => {
    clearAdviceSeen()
    bumpDiag({ autoDisabled: 1 }, NOW)
    expect(getDiagTotals().autoDisabled).toBe(1)
    expect(getAdviceStats().rejected).toBe(0)
  })
})
