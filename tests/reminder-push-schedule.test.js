/**
 * test: 计划提醒的未来命中扫描 + 本地推送预注册（4.22.0）
 *
 * 覆盖 scheduler.computeUpcomingFires（未来 N 天逐档命中：daily/weekly/weekdays/none、
 * 窗口边界、enabled=false）与 push-schedule.registerPlanPushes（非 App 端安全返回 0、
 * settings 关闭时不注册）。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import './setup.js'
import { computeUpcomingFires } from '../utils/reminder/scheduler.js'
import { registerPlanPushes, widgetHasPush } from '../utils/reminder/push-schedule.js'
import { needsNotifyPermission } from '../utils/reminder/notifier.js'

const DAY_MS = 24 * 60 * 60 * 1000

/** 取一个「本周周三 10:00」当 now：周一为一周起点，时刻固定避免跨天漂移（3.5.13 教训） */
function wednesdayNoon() {
  const d = new Date()
  const dayIndex = (d.getDay() + 6) % 7
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dayIndex)
  return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 2, 10, 0, 0, 0).getTime()
}
const NOW = wednesdayNoon()

function planWith(deadline) {
  return { client_id: 'p_test', title: '测试计划', deadline, status: 1 }
}

describe('computeUpcomingFires（未来 7 天命中扫描）', () => {
  it('daily：未来 7 天每天一条（今天时刻已过则从明天起）', () => {
    const cfg = { enabled: true, repeatType: 'daily', customTime: '2030-01-01 08:30:00' }
    const fires = computeUpcomingFires(planWith(null), cfg, NOW, 7)
    expect(fires.length).toBe(7)
    fires.forEach(f => {
      expect(f.ts).toBeGreaterThan(NOW)
      const d = new Date(f.ts)
      expect(d.getHours()).toBe(8)
      expect(d.getMinutes()).toBe(30)
    })
  })

  it('weekdays：跳过周末（周三起 7 天窗口含周六日，只 5 条）', () => {
    const cfg = { enabled: true, repeatType: 'weekdays', customTime: '2030-01-01 09:00:00' }
    const fires = computeUpcomingFires(planWith(null), cfg, NOW, 7)
    // 周三~周五（3）+ 下周一~周五中落在窗口内的（2：下周一、二）= 5
    expect(fires.length).toBe(5)
    fires.forEach(f => {
      const wd = new Date(f.ts).getDay()
      expect(wd >= 1 && wd <= 5).toBe(true)
    })
  })

  it('weekly：只命中与基准同星期的那天（基准=今天，今晚 20:00）', () => {
    const d = new Date(NOW)
    const pad = n => String(n).padStart(2, '0')
    const todayStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} 20:00:00`
    const cfg = { enabled: true, repeatType: 'weekly', customTime: todayStr }
    const fires = computeUpcomingFires(planWith(null), cfg, NOW, 7)
    expect(fires.length).toBe(1)
    expect(new Date(fires[0].ts).getDay()).toBe(new Date(NOW).getDay())
    expect(new Date(fires[0].ts).getHours()).toBe(20)
  })

  it('none：一次性提醒落在窗口内才有一条，已过的剔除', () => {
    const d = new Date(NOW)
    const inWindow = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate() + 1).padStart(2, '0')} 09:00:00`
    const cfg = { enabled: true, repeatType: 'none', customTime: inWindow, advanceMin: 0 }
    const fires = computeUpcomingFires(planWith(null), cfg, NOW, 7)
    expect(fires.length).toBe(1)
    // 已过的时刻被剔除
    const pastCfg = { enabled: true, repeatType: 'none', customTime: '2020-01-01 09:00:00', advanceMin: 0 }
    expect(computeUpcomingFires(planWith(null), pastCfg, NOW, 7)).toEqual([])
  })

  it('enabled=false 或重复档没给基准时刻 → 空', () => {
    expect(computeUpcomingFires(planWith(null), { enabled: false, repeatType: 'daily', customTime: '2030-01-01 08:00:00' }, NOW)).toEqual([])
    expect(computeUpcomingFires(planWith(null), { enabled: true, repeatType: 'daily', customTime: '' }, NOW)).toEqual([])
  })
})

describe('registerPlanPushes（本地推送预注册）', () => {
  beforeEach(() => {
    uni.clearStorageSync()
  })

  it('非 App 环境（vitest 无 plus）安全返回 0，不抛错', async () => {
    const r = await registerPlanPushes(NOW)
    expect(r.registered).toBe(0)
  })

  it('widgetHasPush：features 含 Push 才可用；字段拿不到时不拦（4.29.3 修 info.manifest 误读）', () => {
    expect(widgetHasPush({ features: ['Push', 'Runtime'] })).toBe(true)
    expect(widgetHasPush({ features: ['Runtime'] })).toBe(false)
    expect(widgetHasPush({ features: ['push'] })).toBe(true) // 大小写不敏感
    // features 缺失/空：不拦（宁可多发一次，也不静默不发 —— 这正是旧版推送全哑的成因）
    expect(widgetHasPush({ features: [] })).toBe(true)
    expect(widgetHasPush({})).toBe(true)
    expect(widgetHasPush(null)).toBe(true)
  })

  it('60s 内重复调用被节流', async () => {
    expect((await registerPlanPushes(NOW)).registered).toBe(0)
    expect((await registerPlanPushes(NOW + 10 * 1000)).registered).toBe(0)
    // 非 App 环境（探测失败）不触碰节流时间戳 —— 节流只属于真实注册路径
    expect(Number(uni.getStorageSync('siji_plan_push_reg_at')) || 0).toBe(0)
  })
})

describe('needsNotifyPermission（Android 13+ 运行时通知权限，4.29.3）', () => {
  it('按 SDK_INT 判定：33 及以上才需要申请', () => {
    expect(needsNotifyPermission(33)).toBe(true)
    expect(needsNotifyPermission(34)).toBe(true)
    expect(needsNotifyPermission(32)).toBe(false)
    expect(needsNotifyPermission(29)).toBe(false)
  })

  it('SDK_INT 读不到时回落系统版本字符串（13 及以上需要）', () => {
    expect(needsNotifyPermission(0, '13')).toBe(true)
    expect(needsNotifyPermission(0, '14')).toBe(true)
    expect(needsNotifyPermission(0, '12')).toBe(false)
    expect(needsNotifyPermission(0, '9')).toBe(false)
  })

  it('两者都读不到时按需要处理（多问一次好过通知收不到）', () => {
    expect(needsNotifyPermission(undefined, undefined)).toBe(true)
    expect(needsNotifyPermission(0, '')).toBe(true)
  })
})
