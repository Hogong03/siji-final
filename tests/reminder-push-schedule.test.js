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
import { registerPlanPushes } from '../utils/reminder/push-schedule.js'

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

  it('非 App 环境（vitest 无 plus）安全返回 0，不抛错', () => {
    const r = registerPlanPushes(NOW)
    expect(r.registered).toBe(0)
  })

  it('60s 内重复调用被节流', () => {
    expect(registerPlanPushes(NOW).registered).toBe(0)
    expect(registerPlanPushes(NOW + 10 * 1000).registered).toBe(0)
    // 节流时间戳已写入（60s 后才会真正重注册）
    expect(Number(uni.getStorageSync('siji_plan_push_reg_at'))).toBe(NOW)
  })
})
