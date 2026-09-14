/**
 * 提醒检查调度器 — 遍历计划、判断时间、触发通知
 */

import { logger } from '../logger.js'
import { getReminderSettings, calcReminderTime, parseDateTimeToTs } from './settings.js'
import { cleanupTriggered, markTriggered, isTriggered } from './triggered.js'
import { triggerReminder, isInQuietHours } from './notifier.js'

let isChecking = false
let _getPlanList = null

const DAY_MS = 24 * 60 * 60 * 1000

/** YYYY-MM-DD（本地） */
function ymdOf(ts) {
  const d = new Date(ts)
  const pad = n => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

/** 计划结束日 23:59:59（deadline/due_date 的日期部分），无则 null */
function planEndTsOf(plan) {
  const s = plan && (plan.deadline || plan.due_date)
  if (!s) return null
  const m = String(s).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (!m) return null
  return new Date(+m[1], +m[2] - 1, +m[3], 23, 59, 59, 999).getTime()
}

/** 重复模式是否命中某天：daily 每天 / weekly 每周固定星期 / weekdays 周一至周五 */
function repeatMatchesOn(repeat, day, baseDay) {
  if (repeat === 'daily') return true
  if (repeat === 'weekly') return day.getDay() === baseDay.getDay()
  if (repeat === 'weekdays') {
    const wd = day.getDay()
    return wd >= 1 && wd <= 5
  }
  return false
}

/**
 * 3.5.0：计算计划提醒的本次触发点（纯函数，供调度与测试）
 *  - 不重复（none）：沿用 calcReminderTime（截止提前量或自定义时刻），一次性触发
 *  - 重复（daily/weekly/weekdays）：以自定义日期时刻为基准，从今天起找下一个命中日；
 *    到计划截止日结束；同一计划每天最多触发一次（key: planId|YYYY-MM-DD）
 * @returns {{ ts: number, dateKey: string } | null} dateKey 空串 = 一次性提醒
 */
export function computeReminderFire(plan, cfg, now = Date.now()) {
  if (!cfg || !cfg.enabled) return null
  const repeat = cfg.repeatType || 'none'
  const customTime = cfg.customTime || ''
  if (repeat === 'none') {
    const ts = calcReminderTime(plan, cfg)
    return ts ? { ts, dateKey: '' } : null
  }
  // 循环提醒必须带「日期 + 时刻」作为基准（UI 有提示）
  const baseTs = customTime ? parseDateTimeToTs(customTime) : null
  if (baseTs == null) return null
  const base = new Date(baseTs)
  const nowD = new Date(now)
  const todayStart = new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate()).getTime()
  const endTs = planEndTsOf(plan)
  const cursor = new Date(todayStart)
  for (let i = 0; i < 400; i += 1) {
    const dayStart = cursor.getTime()
    if (endTs != null && dayStart > endTs) return null
    if (repeatMatchesOn(repeat, cursor, base)) {
      const fireTs = new Date(
        cursor.getFullYear(), cursor.getMonth(), cursor.getDate(),
        base.getHours(), base.getMinutes()
      ).getTime()
      if (fireTs <= now) {
        return { ts: fireTs, dateKey: ymdOf(dayStart) }
      }
      // 今天之后才有命中 → 未到时间，不触发也不提前标记
      return null
    }
    cursor.setTime(cursor.getTime() + DAY_MS)
  }
  return null
}

/**
 * 初始化提醒模块，注入获取计划列表的函数
 * @param {function} getPlanListFn - 返回计划数组的函数
 */
export function initReminder(getPlanListFn) {
  _getPlanList = getPlanListFn
}

/**
 * 检查所有计划的提醒
 */
export function checkAllReminders() {
  if (isChecking) return
  if (!_getPlanList) return

  const settings = getReminderSettings()
  if (!settings.enabled) return

  isChecking = true
  try {
    const plans = _getPlanList()
    const planMap = settings.plans || {}
    const now = Date.now()

    for (const plan of plans) {
      if (plan.is_deleted === 1) continue
      if (plan.status === 2) continue
      if (plan.frozen_at || plan.someday_at) continue

      const reminderCfg = planMap[plan.client_id]
      if (!reminderCfg || !reminderCfg.enabled) continue

      const fire = computeReminderFire(plan, reminderCfg, now)
      if (!fire || now < fire.ts) continue

      const fireKey = fire.dateKey ? plan.client_id + '|' + fire.dateKey : plan.client_id
      if (isTriggered(fireKey)) continue

      const isOverdue = plan.deadline && now > parseDateTimeToTs(plan.deadline)
      if (!isOverdue && isInQuietHours(settings)) {
        logger.log(`[reminder] ${plan.title} in quiet hours, skip`)
        continue
      }
      triggerReminder(plan, reminderCfg, isOverdue)
      markTriggered(fireKey)
    }
  } catch (e) {
    logger.warn('[reminder] checkAllReminders error:', e)
  } finally {
    isChecking = false
  }
}

export { cleanupTriggered }
