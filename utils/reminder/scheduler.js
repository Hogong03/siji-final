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

/** 计划里的时间是否带具体时刻（HH:MM） */
function hasClockTime(s) {
  return /(\d{1,2}):(\d{2})/.test(String(s || ''))
}

/**
 * 3.10.0：没手动设过提醒的计划，默认怎么提醒
 *
 * 原来是「没设过提醒就不提醒」（checkAllReminders 里 `if (!reminderCfg || !reminderCfg.enabled) continue`），
 * 于是 AI 建的计划、随手建的计划全都不会有任何提示 —— 用户要的是「到了时间就提醒」。
 * 规则：
 *   - 有具体时刻（deadline/due_date/start_time/estimated_time 带 HH:MM）→ 该时刻前 defaultAdvanceMin 分钟
 *   - 只有日期 → 当天 09:00 提醒一次
 *   - 用户自己关过的计划（配置存在但 enabled=false）仍然不提醒
 * @returns {{ ts: number, dateKey: string } | null}
 */
export function computeDefaultFire(plan, settings, now = Date.now()) {
  const raw = plan && (plan.deadline || plan.due_date || plan.start_time || plan.estimated_time)
  if (!raw) return null
  const baseTs = parseDateTimeToTs(raw)
  if (baseTs == null) return null
  const advanceMin = Number(settings && settings.defaultAdvanceMin)
  const advance = Number.isFinite(advanceMin) && advanceMin >= 0 ? advanceMin : 30
  let fireTs = 0
  if (hasClockTime(raw)) {
    fireTs = baseTs - advance * 60 * 1000
  } else {
    const d = new Date(baseTs)
    d.setHours(9, 0, 0, 0)
    fireTs = d.getTime()
  }
  return { ts: fireTs, dateKey: ymdOf(fireTs) }
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
      // 3.10.0：单条计划出问题（缺字段 / 通知 API 抛错）不能拖垮后面所有计划
      try {
      if (plan.is_deleted === 1) continue
      if (plan.status === 2) continue
      if (plan.frozen_at || plan.someday_at) continue

      const reminderCfg = planMap[plan.client_id]
      if (reminderCfg && !reminderCfg.enabled) continue   // 用户明确关掉的，不提醒

      // 没手动设过提醒 → 用默认规则（有截止/开始时间就自动提醒，3.10.0）
      const effectiveCfg = reminderCfg || { enabled: true, advanceMin: Number(settings.defaultAdvanceMin) || 30 }
      const fire = reminderCfg
        ? computeReminderFire(plan, reminderCfg, now)
        : computeDefaultFire(plan, settings, now)
      if (!fire || now < fire.ts) continue

      const fireKey = fire.dateKey ? plan.client_id + '|' + fire.dateKey : plan.client_id
      if (isTriggered(fireKey)) continue

      const isOverdue = plan.deadline && now > parseDateTimeToTs(plan.deadline)
      if (!isOverdue && isInQuietHours(settings)) {
        logger.log(`[reminder] ${plan.title} in quiet hours, skip`)
        continue
      }
      triggerReminder(plan, effectiveCfg, isOverdue)
      markTriggered(fireKey)
      } catch (planErr) {
        logger.warn('[reminder] plan failed:', plan && plan.title, planErr && planErr.message)
      }
    }
  } catch (e) {
    logger.warn('[reminder] checkAllReminders error:', e)
  } finally {
    isChecking = false
  }
}

export { cleanupTriggered }
