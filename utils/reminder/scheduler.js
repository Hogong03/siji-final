/**
 * 提醒检查调度器 — 遍历计划、判断时间、触发通知
 */

import { logger } from '../logger.js'
import { getReminderSettings, calcReminderTime, parseDateTimeToTs } from './settings.js'
import { cleanupTriggered, markTriggered, isTriggered } from './triggered.js'
import { triggerReminder, isInQuietHours } from './notifier.js'

let isChecking = false
let _getPlanList = null

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

      const reminderCfg = planMap[plan.client_id]
      if (!reminderCfg || !reminderCfg.enabled) continue
      if (isTriggered(plan.client_id)) continue

      const reminderTs = calcReminderTime(plan, reminderCfg)
      if (!reminderTs) continue

      if (now >= reminderTs) {
        const isOverdue = plan.deadline && now > parseDateTimeToTs(plan.deadline)
        if (!isOverdue && isInQuietHours(settings)) {
          logger.log(`[reminder] ${plan.title} in quiet hours, skip`)
          continue
        }
        triggerReminder(plan, reminderCfg, isOverdue)
        markTriggered(plan.client_id)
      }
    }
  } catch (e) {
    logger.warn('[reminder] checkAllReminders error:', e)
  } finally {
    isChecking = false
  }
}

export { cleanupTriggered }
