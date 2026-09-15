/**
 * useEnterSummary 集成测试（3.5.12：前台恢复增量总结）
 *
 * 覆盖冷启动武装/空窗口推进，以及 onHide 离开基线 + onShow 增量结算两条路径：
 * 只有「你不在时」的新事件进卡片、60s 节流不推进窗口、未读卡片不重算。
 * 时间用假定时器控制，避免依赖真实钟。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { resetStorage } from './setup.js'
import {
  initEnterSummary, markLeaveBaseline, refreshEnterSummary, dismissEnterSummary, useEnterSummary
} from '../composables/useEnterSummary.js'

const T0 = new Date(2026, 8, 14, 10, 0, 0).getTime()
const MIN = 60 * 1000
const CONFIRM_KEY = 'siji_enter_summary_at'
const LEAVE_KEY = 'siji_enter_summary_leave_at'

function seedPlans(list) {
  uni.setStorageSync('plan_all', JSON.stringify(list))
}

function planDone(at, id) {
  return {
    client_id: id,
    title: '计划' + id,
    is_deleted: 0,
    status: 2,
    parent_id: null,
    checkins: [],
    executions: [{ action: 'done', at: at }]
  }
}

function storageTs(key) {
  return Number(uni.getStorageSync(key)) || 0
}

beforeEach(() => {
  // 模块级单例（pending / 基线）跨用例存活，先清干净再铺数据
  dismissEnterSummary()
  resetStorage()
  vi.useFakeTimers()
  vi.setSystemTime(T0)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('initEnterSummary：冷启动', () => {
  it('首次升级静默武装两条基线，不弹存量数据', () => {
    seedPlans([planDone(T0 - 10 * MIN, 'a')])
    initEnterSummary()
    expect(useEnterSummary().pending.value).toBeNull()
    expect(storageTs(CONFIRM_KEY)).toBe(T0)
    expect(storageTs(LEAVE_KEY)).toBe(T0)
  })

  it('有确认基线时算出窗口内事件并标记来源 cold', () => {
    uni.setStorageSync(CONFIRM_KEY, T0 - 5 * MIN)
    seedPlans([planDone(T0 - 2 * MIN, 'a'), planDone(T0 - 30 * MIN, 'old')])
    initEnterSummary()
    const pending = useEnterSummary().pending.value
    expect(pending).not.toBeNull()
    expect(pending.source).toBe('cold')
    expect(pending.awayMs).toBe(5 * MIN)
    expect(pending.eventsTotal).toBe(1)
    expect(pending.events[0].title).toBe('计划a')
  })

  it('卡片已展示就把离开基线推进到 now（不点「知道了」也不重复报）', () => {
    uni.setStorageSync(CONFIRM_KEY, T0 - 60 * MIN)
    seedPlans([planDone(T0 - 30 * MIN, 'a')])
    initEnterSummary()
    expect(useEnterSummary().pending.value.eventsTotal).toBe(1)
    expect(storageTs(LEAVE_KEY)).toBe(T0)
    expect(storageTs(CONFIRM_KEY)).toBe(T0 - 60 * MIN)
  })

  it('冷启动顺序 onShow → appReady：init 不覆盖已挂起的卡片', () => {
    uni.setStorageSync(CONFIRM_KEY, T0 - 10 * MIN)
    markLeaveBaseline()
    vi.setSystemTime(T0 + 20 * MIN)
    seedPlans([planDone(T0 + 5 * MIN, 'a')])
    expect(refreshEnterSummary().reason).toBe('ready')
    const card = useEnterSummary().pending.value
    expect(card.source).toBe('away')
    initEnterSummary()
    expect(useEnterSummary().pending.value).toBe(card)
  })

  it('进程重启后：同一批进展不再重复弹（模块状态清空，只靠存储里的基线）', async () => {
    uni.setStorageSync(CONFIRM_KEY, T0 - 60 * MIN)
    seedPlans([planDone(T0 - 30 * MIN, 'a')])
    initEnterSummary()
    expect(useEnterSummary().pending.value.eventsTotal).toBe(1)

    vi.setSystemTime(T0 + 5 * MIN)
    vi.resetModules()
    const fresh = await import('../composables/useEnterSummary.js')
    fresh.initEnterSummary()
    expect(fresh.useEnterSummary().pending.value).toBeNull()
    // 空窗口：两条基线一起推进到 now（没有内容可丢），同一批进展不会再报第二次
    expect(storageTs(CONFIRM_KEY)).toBe(T0 + 5 * MIN)
  })

  it('空窗口推进确认基线，不挂卡片', () => {
    uni.setStorageSync(CONFIRM_KEY, T0 - 5 * MIN)
    initEnterSummary()
    expect(useEnterSummary().pending.value).toBeNull()
    expect(storageTs(CONFIRM_KEY)).toBe(T0)
  })
})

describe('refreshEnterSummary：回前台增量', () => {
  it('窗口取离开基线，只报「你不在时」的新进展', () => {
    uni.setStorageSync(CONFIRM_KEY, T0 - 60 * MIN)
    seedPlans([planDone(T0 - 30 * MIN, 'old')])
    initEnterSummary()
    expect(useEnterSummary().pending.value.source).toBe('cold')
    dismissEnterSummary()

    vi.setSystemTime(T0 + 10 * MIN)
    markLeaveBaseline()
    expect(storageTs(LEAVE_KEY)).toBe(T0 + 10 * MIN)

    vi.setSystemTime(T0 + 70 * MIN)
    seedPlans([planDone(T0 - 30 * MIN, 'old'), planDone(T0 + 40 * MIN, 'new')])
    const win = refreshEnterSummary()

    expect(win).toMatchObject({ skip: false, reason: 'ready', since: T0 + 10 * MIN, awayMs: 60 * MIN })
    const pending = useEnterSummary().pending.value
    expect(pending.source).toBe('away')
    expect(pending.awayMs).toBe(60 * MIN)
    expect(pending.eventsTotal).toBe(1)
    expect(pending.events[0].title).toBe('计划new')
    // 未确认前不推进确认基线；离开基线推到 now，同一段不重复算
    expect(storageTs(CONFIRM_KEY)).toBe(T0)
    expect(storageTs(LEAVE_KEY)).toBe(T0 + 70 * MIN)
  })

  it('已有未读卡片时不重算，卡片原样保留', () => {
    uni.setStorageSync(CONFIRM_KEY, T0 - 5 * MIN)
    seedPlans([planDone(T0 - 2 * MIN, 'a')])
    initEnterSummary()
    const card = useEnterSummary().pending.value
    vi.setSystemTime(T0 + 30 * MIN)
    seedPlans([planDone(T0 - 2 * MIN, 'a'), planDone(T0 + 10 * MIN, 'b')])
    const win = refreshEnterSummary()
    expect(win.reason).toBe('pending')
    expect(useEnterSummary().pending.value).toBe(card)
    expect(useEnterSummary().pending.value.eventsTotal).toBe(1)
  })

  it('60s 内重复回前台被节流且不推进窗口，被跳过时段的进展下次补上', () => {
    uni.setStorageSync(CONFIRM_KEY, T0 - MIN)
    markLeaveBaseline()
    seedPlans([planDone(T0 + 5 * MIN, 'a')])
    vi.setSystemTime(T0 + 10 * MIN)
    expect(refreshEnterSummary().reason).toBe('ready')
    expect(useEnterSummary().pending.value.eventsTotal).toBe(1)
    dismissEnterSummary() // 确认到 T0+10：两条基线一起推进

    vi.setSystemTime(T0 + 12 * MIN)
    expect(refreshEnterSummary().reason).toBe('ready')
    expect(useEnterSummary().pending.value).toBeNull()
    expect(storageTs(LEAVE_KEY)).toBe(T0 + 12 * MIN)

    // 20s 后再回前台：节流跳过，离开基线不动
    vi.setSystemTime(T0 + 12 * MIN + 20 * 1000)
    expect(refreshEnterSummary()).toMatchObject({ skip: true, reason: 'throttled' })
    expect(storageTs(LEAVE_KEY)).toBe(T0 + 12 * MIN)

    // 被跳过那段时间新增的进展，下次结算必须补上
    vi.setSystemTime(T0 + 14 * MIN)
    seedPlans([planDone(T0 + 5 * MIN, 'a'), planDone(T0 + 12 * MIN + 30 * 1000, 'b')])
    expect(refreshEnterSummary().reason).toBe('ready')
    const pending = useEnterSummary().pending.value
    expect(pending.eventsTotal).toBe(1)
    expect(pending.events[0].title).toBe('计划b')
  })

  it('空窗口推进确认基线，窗口不滚雪球', () => {
    uni.setStorageSync(CONFIRM_KEY, T0 - 10 * MIN)
    markLeaveBaseline()
    vi.setSystemTime(T0 + 20 * MIN)
    expect(refreshEnterSummary().reason).toBe('ready')
    expect(useEnterSummary().pending.value).toBeNull()
    expect(storageTs(CONFIRM_KEY)).toBe(T0 + 20 * MIN)
    expect(storageTs(LEAVE_KEY)).toBe(T0 + 20 * MIN)
  })

  it('连续两天低落：卡片带上休息提示标记（不催、不评分）', () => {
    const DAY_MS = 24 * 60 * 60 * 1000
    uni.setStorageSync(CONFIRM_KEY, T0 - 3 * DAY_MS)
    uni.setStorageSync('diary_2026-09', JSON.stringify([
      { client_id: 'd1', created_at: T0 - DAY_MS, is_deleted: 0, emotion: '低落' },
      { client_id: 'd2', created_at: T0 - MIN, is_deleted: 0, emotion: '低落' }
    ]))
    vi.setSystemTime(T0 + 20 * MIN)
    expect(refreshEnterSummary().reason).toBe('ready')
    expect(useEnterSummary().pending.value.moodDip).toBe(true)
  })

  it('进程被杀没写离开基线时回落确认基线', () => {
    uni.setStorageSync(CONFIRM_KEY, T0 - 30 * MIN)
    seedPlans([planDone(T0 - 10 * MIN, 'a')])
    vi.setSystemTime(T0 + 5 * MIN)
    const win = refreshEnterSummary()
    expect(win).toMatchObject({ skip: false, reason: 'ready', since: T0 - 30 * MIN, awayMs: 35 * MIN })
    expect(useEnterSummary().pending.value.source).toBe('away')
  })
})
