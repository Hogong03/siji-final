/**
 * 提醒设置模块 — 读写全局提醒配置与计划级提醒
 *
 * 存储键：siji_reminder_settings
 */

import { logger } from '../logger.js'

const STORAGE_KEY_SETTINGS = 'siji_reminder_settings'

/**
 * 获取全局提醒设置
 * @returns {{ enabled: boolean, defaultAdvanceMin: number, quietHoursStart: string, quietHoursEnd: string, snoozeMin: number, prompts: object, plans: object }}
 */
export function getReminderSettings() {
  try {
    const raw = uni.getStorageSync(STORAGE_KEY_SETTINGS)
    if (raw) {
      const s = typeof raw === 'string' ? JSON.parse(raw) : raw
      return {
        enabled: s.enabled !== false,
        defaultAdvanceMin: s.defaultAdvanceMin ?? 30,
        // 4.5.1：显式空串 = 关闭免打扰（isInQuietHours 对空串返回 false）；缺省才回落 22:00-08:00
        quietHoursStart: s.quietHoursStart === '' ? '' : (s.quietHoursStart || '22:00'),
        quietHoursEnd: s.quietHoursEnd === '' ? '' : (s.quietHoursEnd || '08:00'),
        snoozeMin: normalizeSnoozeMin(s.snoozeMin),
        prompts: normalizePromptFlags(s.prompts),
        plans: s.plans || {}
      }
    }
  } catch (e) {
    logger.warn('[reminder] getReminderSettings error:', e)
  }
  return { enabled: true, defaultAdvanceMin: 30, quietHoursStart: '22:00', quietHoursEnd: '08:00', snoozeMin: DEFAULT_SNOOZE_MIN, prompts: normalizePromptFlags(null), plans: {} }
}

/* ==================== 4.30.0：提示类开关 ==================== */

/**
 * 提示类开关默认值（全部落在 siji_reminder_settings 同一份文档的 prompts 字段里）
 * summarySheet：每天首次进聊天页自动弹「计划汇总表」
 * briefing：进入聊天页的简报卡（消息流里的开场结构化卡）
 * reminderToast：计划到点的应用内提醒 toast
 * advice：应用建议面板（按时段 + 数据 + 运行环境给建议，签名变了才重出）
 */
export const PROMPT_FLAG_DEFAULTS = {
  summarySheet: true,
  briefing: true,
  reminderToast: true,
  advice: true
}

/** 归一化提示开关：只认显式 false 为关，其余一律回落默认（存储坏了也不会静默关掉提示） */
function normalizePromptFlags(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const out = {}
  Object.keys(PROMPT_FLAG_DEFAULTS).forEach(k => {
    out[k] = src[k] === false ? false : PROMPT_FLAG_DEFAULTS[k]
  })
  return out
}

/** 读单个提示开关（未知 key 返回 true，调用方不会因此静默不提示） */
export function getPromptFlag(key) {
  if (PROMPT_FLAG_DEFAULTS[key] === undefined) return true
  return getReminderSettings().prompts[key] !== false
}

/** 写单个提示开关，返回写入后的值 */
export function setPromptFlag(key, on) {
  if (PROMPT_FLAG_DEFAULTS[key] === undefined) return true
  const s = getReminderSettings()
  s.prompts = Object.assign({}, s.prompts, { [key]: !!on })
  saveReminderSettings(s)
  return s.prompts[key]
}


/** 推迟默认档（分钟）：只认 5 / 15 / 30 三档，非法回落 5 */
export const DEFAULT_SNOOZE_MIN = 5
export const SNOOZE_OPTIONS = [5, 15, 30]

function normalizeSnoozeMin(v) {
  const n = Number(v)
  return SNOOZE_OPTIONS.includes(n) ? n : DEFAULT_SNOOZE_MIN
}

/** 读取推迟默认档（提醒弹窗「推迟 N 分钟」用，全局生效） */
export function getSnoozeMin() {
  return getReminderSettings().snoozeMin
}

/** 写入推迟默认档（非法值回落 5） */
export function setSnoozeMin(min) {
  const settings = getReminderSettings()
  settings.snoozeMin = normalizeSnoozeMin(min)
  saveReminderSettings(settings)
  return settings.snoozeMin
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
 * 4.5.0：repeatType 一并落盘 —— 之前 UI 采集了但这里丢掉，scheduler 读 cfg.repeatType
 * 永远是 undefined，循环提醒（daily/weekly/weekdays）实际存不进去，全部退化成一次性
 */
export function setPlanReminder(planId, reminder) {
  const settings = getReminderSettings()
  settings.plans[planId] = {
    enabled: reminder.enabled !== false,
    advanceMin: reminder.advanceMin ?? settings.defaultAdvanceMin,
    customTime: reminder.customTime || '',
    repeatType: reminder.repeatType || 'none',
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
