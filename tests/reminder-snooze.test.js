/**
 * 提醒推迟（snooze）测试（4.5.0；4.29.3 改弹窗为 toast 后重写集成段）
 *
 * 锁死的语义：
 *  - 推迟 = 写 siji_reminder_snoozed，不写 triggered：到点重响，处理完才当天免打扰
 *  - onSnooze 可连续推（同 fireKey 覆写）；onDone = markTriggered + clearSnooze
 *  - 被推迟接管的 fireKey，常规分支不再重复弹（getActiveSnoozeKeys 跳过）
 *  - 4.29.3：应用内提醒从 ActionSheet 弹窗改为 toast —— 无可选项，触发即 onDone
 *    （当天不再响）；snooze 分支仍在（到期重响 / 触发异常兜底都走它）
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
  // 「5 分钟前」必须落在今天：凌晨 00:00~00:05 跑测试时 5 分钟前是昨天，而调度器按
  // 「今天 + customTime 的钟点」算触发，昨天的日期永远不命中（3 例假失败，4.12.3 修）
  let probe = new Date(Date.now() - 5 * 60 * 1000)
  if (ymdOf(probe.getTime()) !== ymdOf(Date.now())) {
    probe = new Date()
    probe.setHours(0, 0, 1, 0)
  }
  const pad = n => String(n).padStart(2, '0')
  const customTime = `${ymdOf(probe.getTime())} ${pad(probe.getHours())}:${pad(probe.getMinutes())}:00`
  // 顺序有讲究：先写免打扰关闭（此刻 plans 表为空，读改写无竞争），再 setPlanReminder
  // —— 它内部会重读设置再合并落盘，空串免打扰语义（settings.js 4.5.1）得以保留
  saveReminderSettings(Object.assign({}, getReminderSettings(), { quietHoursStart: '', quietHoursEnd: '' }))
  setPlanReminder(clientId, { enabled: true, customTime, repeatType: 'daily' })
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

describe('checkAllReminders 集成：触发 → toast 提示 → 当天落账（4.29.3 弹窗改 toast）', () => {
  // 注意：asyncSetStorageJSON 在非 APP 端是 setTimeout(0) 异步落盘 —— 每次写入后要 flush 再同步读
  const flush = () => new Promise(r => setTimeout(r, 30))

  it('触发后弹 toast 并当天落账，不再按轮询周期重复弹', async () => {
    workReminderPlan('w1')
    initReminder(() => getPlanList())
    await flush()
    const toasts = []
    const orig = uni.showToast
    uni.showToast = (opts) => { toasts.push(opts) }
    try {
      const fireKey = 'w1|' + ymdOf(Date.now())
      checkAllReminders()
      expect(toasts).toHaveLength(1)
      expect(String(toasts[0].title)).toContain('计划提醒')
      await flush()
      // 4.29.3：toast 没有可选项 = 弹完即已告知，直接按当天已处理落账
      expect(isTriggered(fireKey)).toBe(true)
      expect(getActiveSnoozeKeys()).not.toContain(fireKey)

      // 再查一轮：当天已处理，不再弹
      checkAllReminders()
      expect(toasts).toHaveLength(1)
    } finally {
      uni.showToast = orig
    }
  })

  it('到期的推迟条目走 snooze 分支重响一次，随后落账', async () => {
    workReminderPlan('w2')
    initReminder(() => getPlanList())
    await flush()
    const fireKey = 'w2|' + ymdOf(Date.now())
    // 塞一条已到期的推迟（复刻「程序化推迟 / 触发异常兜底」写下的条目）
    snoozeReminder(fireKey, 'w2', 5, Date.now() - 10 * 60 * 1000)
    await flush()
    const toasts = []
    const orig = uni.showToast
    uni.showToast = (opts) => { toasts.push(opts) }
    try {
      checkAllReminders()
      expect(toasts).toHaveLength(1)
      await flush()
      expect(isTriggered(fireKey)).toBe(true)
      expect(getActiveSnoozeKeys()).not.toContain(fireKey)
    } finally {
      uni.showToast = orig
    }
  })

  it('免打扰时段内不弹 toast，也不落账（等静默期过去再说）', async () => {
    workReminderPlan('w3')
    // 把免打扰设成覆盖「现在」的一小时窗口（workReminderPlan 内部先清空了，这里覆盖）
    const now = new Date()
    const pad = n => String(n).padStart(2, '0')
    saveReminderSettings(Object.assign({}, getReminderSettings(), {
      quietHoursStart: `${pad(now.getHours())}:00`,
      quietHoursEnd: `${pad((now.getHours() + 1) % 24)}:00`
    }))
    initReminder(() => getPlanList())
    await flush()
    const toasts = []
    const orig = uni.showToast
    uni.showToast = (opts) => { toasts.push(opts) }
    try {
      checkAllReminders()
      expect(toasts).toHaveLength(0)
      expect(isTriggered('w3|' + ymdOf(Date.now()))).toBe(false)
    } finally {
      uni.showToast = orig
    }
  })

  it('计划被删除后，到期的推迟条目被清掉、不再弹', async () => {
    workReminderPlan('w4')
    initReminder(() => getPlanList())
    await flush()
    const fireKey = 'w4|' + ymdOf(Date.now())
    // 直接塞一条已到期的推迟
    snoozeReminder(fireKey, 'w4', 5, Date.now() - 10 * 60 * 1000)
    await flush()
    deletePlan('w4')
    await flush()
    const orig = uni.showToast
    let calls = 0
    uni.showToast = () => { calls++ }
    try {
      checkAllReminders()
      expect(calls).toBe(0)
      expect(getActiveSnoozeKeys()).not.toContain(fireKey)
    } finally {
      uni.showToast = orig
    }
  })
})
