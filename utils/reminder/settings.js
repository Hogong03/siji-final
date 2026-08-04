/**
 * 提醒设置模块 — 读写全局提醒配置与计划级提醒
 *
 * 存储键：siji_reminder_settings
 */

import { logger } from '../logger.js'

const STORAGE_KEY_SETTINGS = 'siji_reminder_settings'

/**
 * 获取全局提醒设置
 * @returns {{ enabled: boolean, defaultAdvanceMin: number, quietHoursStart: string, quietHoursEnd: string, plans: object }}
 */
export function getReminderSettings() {
  try {
    const raw = uni.getStorageSync(STORAGE_KEY_SETTINGS)
    if (raw) {
      const s = typeof raw === 'string' ? JSON.parse(raw) : raw
      return {
        enabled: s.enabled !== false,
        defaultAdvanceMin: s.defaultAdvanceMin ?? 30,
        quietHoursStart: s.quietHoursStart || '22:00',
        quietHoursEnd: s.quietHoursEnd || '08:00',
        plans: s.plans || {}
      }
    }
  } catch (e) {
    logger.warn('[reminder] getReminderSettings error:', e)
  }
  return { enabled: true, defaultAdvanceMin: 30, quietHoursStart: '22:00', quietHoursEnd: '08:00', plans: {} }
}

/**
 * 保存全局提醒设置
 */
export function saveReminderSettings(settings) {
  try {
    asyncSetStorageJSON(STORAGE_KEY_SETTINGS, settings)
  } catch (e) {
    logger.warn('[reminder] saveReminderSettings error:', e)
  }
}

/**
 * 为计划设置提醒
 */
export function setPlanReminder(planId, reminder) {
  const settings = getReminderSettings()
  settings.plans[planId] = {
    enabled: reminder.enabled !== false,
    advanceMin: reminder.advanceMin ?? settings.defaultAdvanceMin,
    customTime: reminder.customTime || '',
    updatedAt: Date.now()
  }
  saveReminderSettings(settings)
  logger.log(`[reminder] Set reminder for ${planId}:`, settings.plans[planId])
}

/**
 * 获取计划的提醒设置
 */
export function getPlanReminder(planId) {
  const settings = getReminderSettings()
  return settings.plans?.[planId] || null
}

/**
 * 移除计划提醒
 */
export function removePlanReminder(planId) {
  const settings = getReminderSettings()
  if (settings.plans?.[planId]) {
    delete settings.plans[planId]
    saveReminderSettings(settings)
  }
}

// ==================== 工具函数 ====================

/**
 * 解析时间字符串为时间戳
 * 支持：YYYY-MM-DD HH:mm:ss / YYYY-MM-DD HH:mm / YYYY-MM-DD
 */
export function parseDateTimeToTs(str) {
  if (!str) return null
  let m = str.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (m) {
    return new Date(
      parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]),
      parseInt(m[4]), parseInt(m[5]), parseInt(m[6] || 0)
    ).getTime()
  }
  m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) {
    return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]), 23, 59, 59).getTime()
  }
  return null
}

export function formatDisplayTime(str) {
  const ts = parseDateTimeToTs(str)
  if (!ts) return str
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function formatDuration(min) {
  if (min < 60) return `${min}分钟`
  if (min < 1440) return `${Math.floor(min / 60)}小时${min % 60 > 0 ? `${min % 60}分钟` : ''}`
  return `${Math.floor(min / 1440)}天`
}

/**
 * 计算计划的实际提醒时间
 */
export function calcReminderTime(plan, reminder) {
  if (reminder.customTime) {
    const ts = parseDateTimeToTs(reminder.customTime)
    if (ts) return ts
  }
  const baseTimeStr = plan.deadline || plan.due_date || plan.start_time || plan.estimated_time
  if (!baseTimeStr) return null
  const baseTs = parseDateTimeToTs(baseTimeStr)
  if (!baseTs) return null
  const advanceMin = reminder.advanceMin ?? 30
  return baseTs - advanceMin * 60 * 1000
}

// ==================== 异步存储写入 ====================

export function asyncSetStorageJSON(key, value) {
  try {
    const json = JSON.stringify(value)
    // #ifdef APP-PLUS
    uni.setStorageSync(key, json)
    // #endif
    // #ifndef APP-PLUS
    setTimeout(() => {
      try { uni.setStorageSync(key, json) } catch (e) { /* ignore */ }
    }, 0)
    // #endif
  } catch (e) {
    logger.warn(`[reminder] asyncSetStorageJSON(${key}) error:`, e)
  }
}
