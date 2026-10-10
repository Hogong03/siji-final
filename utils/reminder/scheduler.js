/**
 * 提醒检查调度器 — 遍历计划、判断时间、触发通知
 */

import { logger } from '../logger.js'
import { getReminderSettings, calcReminderTime, parseDateTimeToTs, getSnoozeMin } from './settings.js'
import { cleanupTriggered, markTriggered, isTriggered } from './triggered.js'
import { snoozeReminder, dueSnoozes, getActiveSnoozeKeys, clearSnooze } from './snooze.js'
import { triggerReminder, isInQuietHours } from './notifier.js'

let isChecking = false
let _getPlanList = null

/** 弹窗还开着（用户还没选）的 fireKey：本轮轮询别再重复弹同一条 */
const openSheets = new Set()

/**
 * 触发结果回调（4.5.0）：弹窗的选择由这里落账
 *  - onDone（打卡 / 查看）：标记已处理 + 清推迟，今天不再响
 *  - onSnooze（推迟 / 关掉弹窗）：不标记，写到推迟表，到点由 snooze 分支重响
 */
function reminderHandlers(fireKey, planId) {
  return {
    onDone() {
      openSheets.delete(fireKey)
      markTriggered(fireKey)
      clearSnooze(fireKey)
    },
    onSnooze(minutes) {
      openSheets.delete(fireKey)
      snoozeReminder(fireKey, planId, minutes)
    }
  }
}

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
 * 未来 N 天内的所有命中时刻（4.22.0，纯函数）：供本地推送注册扫描「应用外可达」的提醒点
 * 与 computeReminderFire 的差别：不要求 fireTs <= now（要注册的是未来的通知），
 * 返回全部 [{ ts, dateKey }]（已过时刻剔除，超出窗口剔除，超过计划截止剔除）
 */
export function computeUpcomingFires(plan, cfg, now = Date.now(), days = 7) {
  if (!cfg || !cfg.enabled) return []
  const repeat = cfg.repeatType || 'none'
  const customTime = cfg.customTime || ''
  const horizon = now + days * DAY_MS
  const out = []
  if (repeat === 'none') {
    const ts = calcReminderTime(plan, cfg)
    if (ts && ts > now && ts <= horizon) out.push({ ts, dateKey: ymdOf(ts) })
    return out
  }
  const baseTs = customTime ? parseDateTimeToTs(customTime) : null
  if (baseTs == null) return []
  const base = new Date(baseTs)
  const nowD = new Date(now)
  const todayStart = new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate()).getTime()
  const endTs = planEndTsOf(plan)
  const cursor = new Date(todayStart)
  for (let i = 0; i <= days + 1 && cursor.getTime() <= horizon; i += 1) {
    const dayStart = cursor.getTime()
    if (endTs != null && dayStart > endTs) break
    if (repeatMatchesOn(repeat, cursor, base)) {
      const fireTs = new Date(
        cursor.getFullYear(), cursor.getMonth(), cursor.getDate(),
        base.getHours(), base.getMinutes()
      ).getTime()
      if (fireTs > now && fireTs <= horizon) out.push({ ts: fireTs, dateKey: ymdOf(dayStart) })
    }
    cursor.setTime(cursor.getTime() + DAY_MS)
  }
  return out
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
 * 检查所有计划的提醒（4.5.0：接入推迟/snooze）
 *
 * 两条触发路径，同一 fireKey 只会走一条：
 *   1. snooze 分支：推迟表里到点的条目（用户选过「推迟」，处理完才会 markTriggered）
 *   2. 常规分支：computeReminderFire / computeDefaultFire 命中且未触发、未被推迟接管
 * 弹窗的选择经 handlers 回调落账（onDone → 当天不再响；onSnooze → 到点重响）；
 * 用户直接关掉弹窗 = 默认档推迟（该打没打继续催，但不 60 秒一轮地轰炸）
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

    // ---- 1. snooze 分支：到点的推迟条目 ----
    const snoozedKeys = new Set(getActiveSnoozeKeys())
    for (const item of dueSnoozes(now)) {
      try {
        if (openSheets.has(item.fireKey)) continue
        const plan = plans.find(p => p && p.client_id === item.planId)
        if (!plan || plan.is_deleted === 1 || plan.status === 2 || plan.frozen_at || plan.someday_at) {
          // 计划没了/已完成：推迟条目没有意义，清掉
          clearSnooze(item.fireKey)
          continue
        }
        const reminderCfg = planMap[plan.client_id]
        if (reminderCfg && !reminderCfg.enabled) {
          clearSnooze(item.fireKey)
          continue
        }
        const isOverdue = plan.deadline && now > parseDateTimeToTs(plan.deadline)
        if (!isOverdue && isInQuietHours(settings)) continue // 留在推迟表，静默期过后再响
        openSheets.add(item.fireKey)
        const effectiveCfg = reminderCfg || { enabled: true, advanceMin: Number(settings.defaultAdvanceMin) || 30 }
        try {
          triggerReminder(plan, effectiveCfg, isOverdue, reminderHandlers(item.fireKey, plan.client_id))
        } catch (triggerErr) {
          openSheets.delete(item.fireKey)
          snoozeReminder(item.fireKey, plan.client_id, getSnoozeMin(), now)
          logger.warn('[reminder] snooze re-trigger failed:', triggerErr && triggerErr.message)
        }
      } catch (snoozeErr) {
        logger.warn('[reminder] snooze item failed:', snoozeErr && snoozeErr.message)
      }
    }

    // ---- 2. 常规分支 ----
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
      if (snoozedKeys.has(fireKey)) continue              // 已被推迟接管，到点走 snooze 分支
      if (openSheets.has(fireKey)) continue               // 弹窗还开着，等用户选

      const isOverdue = plan.deadline && now > parseDateTimeToTs(plan.deadline)
      if (!isOverdue && isInQuietHours(settings)) {
        logger.log(`[reminder] ${plan.title} in quiet hours, skip`)
        continue
      }
      openSheets.add(fireKey)
      try {
        triggerReminder(plan, effectiveCfg, isOverdue, reminderHandlers(fireKey, plan.client_id))
      } catch (triggerErr) {
        // 弹窗都没弹出来：按默认档推迟，别 60 秒一轮地重试
        openSheets.delete(fireKey)
        snoozeReminder(fireKey, plan.client_id, getSnoozeMin(), now)
        logger.warn('[reminder] trigger failed:', triggerErr && triggerErr.message)
      }
      // 4.5.0：不再在这里 markTriggered —— 用户选完（打卡/查看/推迟）由回调落账
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
