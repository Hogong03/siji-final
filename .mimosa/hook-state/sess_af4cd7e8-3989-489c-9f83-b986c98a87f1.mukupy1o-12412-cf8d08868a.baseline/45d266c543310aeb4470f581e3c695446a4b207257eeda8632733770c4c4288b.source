/**
 * 提醒推迟（snooze）测试（4.5.0）
 *
 * 锁死的语义：
 *  - 推迟 = 写 siji_reminder_snoozed，不写 triggered：到点重响，处理完才当天免打扰
 *  - onSnooze 可连续推（同 fireKey 覆写）；onDone = markTriggered + clearSnooze
 *  - 被推迟接管的 fireKey，常规分支不再重复弹（getActiveSnoozeKeys 跳过）
 *  - 弹窗直达打卡：ActionSheet 选「立即打卡」→ logPlanCheckIn 落库 + onDone
 *  - setPlanReminder 的 repeatType 落盘（4.5.0 修的缺口：UI 采集了但存储丢掉）
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { resetStorage } from './setup.js'
import './setup.js'
import { savePlan, getPlanList, deletePlan } from '../utils/storage/plan.js'
import { setPlanReminder, getPlanReminder, getSnoozeMin, setSnoozeMin, getReminderSettings, saveReminderSettings } from '../utils/reminder/settings.js'
import { snoozeReminder, dueSnoozes, getActiveSnoozeKeys, clearSnooze } from '../utils/reminder/snooze.js'
import { initReminder, checkAllReminders } from '../utils/reminder/scheduler.js'
import { isTriggered } from '../utils/reminder/triggered.js'

const DAY = 24 * 60 * 60 * 1000

beforeEach(() => {
  resetStorage()
})

/** 今天的 YYYY-MM-DD（本地时区，与调度器同口径） */
function ymdOf(ts) {
  const d = new Date(ts)
  const pad = n => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

/**
 * 打卡计划 + 5 分钟前的每日提醒（复刻上班模板子计划的形态）
 *  - 不带 deadline：循环提醒只发到计划截止日为止（computeReminderFire），带过期截止会永远 null
 *  - 不设 recur_type：getPlanList 的 reconcile 会把「daily 循环 + 过期截止」自动收尾成 status=2
 *  - 关掉免打扰时段：保证测试在任何时间运行（含夜间）都不被静默窗口挡掉
 */
function workReminderPlan(clientId) {
  const plan = {
    client_id: clientId,
    title: '上班打卡',
    status: 0,
    is_deleted: 0
  }
  savePlan(plan)
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
  const pad = n => String(n).padStart(2, '0')
  const customTime = `${ymdOf(fiveMinAgo.getTime())} ${pad(fiveMinAgo.getHours())}:${pad(fiveMinAgo.getMinutes())}:00`
  setPlanReminder(clientId, { enabled: true, customTime, repeatType: 'daily' })
  const settings = getReminderSettings()
  saveReminderSettings(Object.assign({}, settings, { quietHoursStart: '', quietHoursEnd: '' }))
  return { plan, customTime }
}

describe('snooze 模块（纯读写）', () => {
  it('推迟后条目存在、到期前 dueSnoozes 为空、到点后命中', () => {
    const now = Date.now()
    snoozeReminder('p1|2026-09-15', 'p1', 5, now)
    expect(getActiveSnoozeKeys()).toContain('p1|2026-09-15')
    expect(dueSnoozes(now)).toHaveLength(0)
    const due = dueSnoozes(now + 6 * 60 * 1000)
    expect(due).toHaveLength(1)
    expect(due[0].planId).toBe('p1')
  })

  it('同 fireKey 连续推迟：覆写 fireAt，不叠加', () => {
    const now = Date.now()
    snoozeReminder('k1', 'p1', 5, now)
    snoozeReminder('k1', 'p1', 15, now)
    const map = dueSnoozes(now + 16 * 60 * 1000)
    expect(map).toHaveLength(1)
    expect(map[0].fireKey).toBe('k1')
  })

  it('clearSnooze 后不再活跃', () => {
    snoozeReminder('k2', 'p1', 5)
    clearSnooze('k2')
    expect(getActiveSnoozeKeys()).not.toContain('k2')
  })

  it('非法输入（缺 key/planId）不写入', () => {
    snoozeReminder('', 'p1', 5)
    snoozeReminder('k3', '', 5)
    expect(getActiveSnoozeKeys()).toHaveLength(0)
  })
})

describe('snoozeMin 设置', () => {
  it('默认 5，只认 5/15/30 三档，非法回落 5', () => {
    expect(getSnoozeMin()).toBe(5)
    expect(setSnoozeMin(15)).toBe(15)
    expect(getSnoozeMin()).toBe(15)
    expect(setSnoozeMin(7)).toBe(5)
    expect(setSnoozeMin('abc')).toBe(5)
  })
})

describe('setPlanReminder：repeatType 落盘（4.5.0 修复）', () => {
  it('repeatType 存得进、读得出', () => {
    setPlanReminder('p1', { enabled: true, customTime: '2026-01-01 08:30:00', repeatType: 'daily' })
    const cfg = getPlanReminder('p1')
    expect(cfg.repeatType).toBe('daily')
    expect(cfg.customTime).toBe('2026-01-01 08:30:00')
  })

  it('不传 repeatType 落 none（旧行为兼容）', () => {
    setPlanReminder('p2', { enabled: true, advanceMin: 30 })
    expect(getPlanReminder('p2').repeatType).toBe('none')
  })
})

describe('checkAllReminders 集成：触发 → 推迟 → 重响 → 打卡收口', () => {
  // 注意：asyncSetStorageJSON 在非 APP 端是 setTimeout(0) 异步落盘 —— 每次写入后要 flush 再同步读
  const flush = () => new Promise(r => setTimeout(r, 30))

  it('触发后不立即标记（用户还没选），推迟后常规分支不再重复弹', async () => {
    const { plan } = workReminderPlan('w1')
    initReminder(() => getPlanList())
    await flush()
    const calls = []
    const orig = uni.showActionSheet
    uni.showActionSheet = (opts) => { calls.push(opts) }
    try {
      checkAllReminders()
      expect(calls).toHaveLength(1)
      const fireKey = 'w1|' + ymdOf(Date.now())
      await flush()
      expect(isTriggered(fireKey)).toBe(false)          // 不再立即标记
      expect(getActiveSnoozeKeys()).not.toContain(fireKey)

      // 用户选「推迟 5 分钟」（itemList[1] = 默认档推迟）
      calls[0].success({ tapIndex: 1 })
      await flush()
      expect(getActiveSnoozeKeys()).toContain(fireKey)
      expect(isTriggered(fireKey)).toBe(false)

      // 推迟期间再查：常规分支被 snooze 接管，不重复弹
      checkAllReminders()
      expect(calls).toHaveLength(1)

      // 把推迟条目改成已到期 → 重响
      snoozeReminder(fireKey, 'w1', 5, Date.now() - 10 * 60 * 1000)
      await flush()
      checkAllReminders()
      expect(calls).toHaveLength(2)
    } finally {
      uni.showActionSheet = orig
    }
  })

  it('弹窗选「立即打卡」→ 落库 + onDone（当天不再响，推迟清掉）', async () => {
    const { plan } = workReminderPlan('w2')
    initReminder(() => getPlanList())
    await flush()
    const orig = uni.showActionSheet
    let captured = null
    uni.showActionSheet = (opts) => { captured = opts }
    try {
      checkAllReminders()
      expect(captured).toBeTruthy()
      // itemList[0] = 立即打卡
      captured.success({ tapIndex: 0 })
      await flush()
      const fireKey = 'w2|' + ymdOf(Date.now())
      expect(isTriggered(fireKey)).toBe(true)
      expect(getActiveSnoozeKeys()).not.toContain(fireKey)
      // 打卡真的落库了（今天有 checkin）
      const stored = getPlanList().find(p => p.client_id === 'w2')
      expect(stored.checkins).toHaveLength(1)
      // 再查一轮：当天已处理，不再弹
      const callsAfter = []
      uni.showActionSheet = (opts) => { callsAfter.push(opts) }
      checkAllReminders()
      expect(callsAfter).toHaveLength(0)
    } finally {
      uni.showActionSheet = orig
    }
  })

  it('关掉弹窗（fail）= 默认档推迟，继续催但不轰炸', async () => {
    const { plan } = workReminderPlan('w3')
    initReminder(() => getPlanList())
    await flush()
    const orig = uni.showActionSheet
    let captured = null
    uni.showActionSheet = (opts) => { captured = opts }
    try {
      checkAllReminders()
      captured.fail()
      await flush()
      const fireKey = 'w3|' + ymdOf(Date.now())
      expect(getActiveSnoozeKeys()).toContain(fireKey)
      expect(isTriggered(fireKey)).toBe(false)
    } finally {
      uni.showActionSheet = orig
    }
  })

  it('计划被删除后，到期的推迟条目被清掉、不再弹', async () => {
    const { plan } = workReminderPlan('w4')
    initReminder(() => getPlanList())
    await flush()
    const fireKey = 'w4|' + ymdOf(Date.now())
    // 直接塞一条已到期的推迟
    snoozeReminder(fireKey, 'w4', 5, Date.now() - 10 * 60 * 1000)
    await flush()
    deletePlan('w4')
    await flush()
    const orig = uni.showActionSheet
    let calls = 0
    uni.showActionSheet = () => { calls++ }
    try {
      checkAllReminders()
      expect(calls).toBe(0)
      expect(getActiveSnoozeKeys()).not.toContain(fireKey)
    } finally {
      uni.showActionSheet = orig
    }
  })
})
