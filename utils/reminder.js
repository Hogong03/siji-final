/**
 * 计划提醒模块 — 本地通知调度
 *
 * 特性：
 * - 支持提前 N 分钟/小时/天提醒
 * - 支持精确到分钟的提醒时间
 * - App 在前台时弹出 uni.showModal
 * - App 在后台时使用 uni.createPushMessage（App 端）或 Notification API（H5）
 * - 提醒记录持久化，避免重复触发
 * - 支持开启/关闭单个计划的提醒
 *
 * 存储键：siji_reminders — 已触发的提醒记录 { planId: timestamp }
 * 存储键：siji_reminder_settings — 全局提醒设置
 */

import { logger } from './logger.js'

const STORAGE_KEY_TRIGGERED = 'siji_reminders_triggered'
const STORAGE_KEY_SETTINGS = 'siji_reminder_settings'
const CHECK_INTERVAL_MS = 60 * 1000 // 每分钟检查一次

let checkTimer = null
let isChecking = false

// ==================== 提醒设置 ====================

/**
 * 获取全局提醒设置
 * @returns {{ enabled: boolean, defaultAdvanceMin: number, quietHoursStart: string, quietHoursEnd: string }}
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
        quietHoursEnd: s.quietHoursEnd || '08:00'
      }
    }
  } catch (e) {
    logger.warn('[reminder] getReminderSettings error:', e)
  }
  return { enabled: true, defaultAdvanceMin: 30, quietHoursStart: '22:00', quietHoursEnd: '08:00' }
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

// ==================== 提醒调度 ====================

/**
 * 为计划设置提醒
 * @param {string} planId - 计划 client_id
 * @param {object} reminder - { enabled: boolean, advanceMin: number, customTime: 'YYYY-MM-DD HH:mm' }
 */
export function setPlanReminder(planId, reminder) {
  const settings = getReminderSettings()
  if (!settings.plans) settings.plans = {}
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
  // 同时清理已触发记录
  clearTriggered(planId)
}

/**
 * 计算计划的实际提醒时间
 * @param {object} plan - 计划对象（需含 deadline 或 start_time）
 * @param {object} reminder - 提醒设置 { advanceMin, customTime }
 * @returns {number|null} 提醒时间戳（ms），null 表示无法计算
 */
export function calcReminderTime(plan, reminder) {
  // 优先使用自定义提醒时间
  if (reminder.customTime) {
    const ts = parseDateTimeToTs(reminder.customTime)
    if (ts) return ts
  }

  // 基于截止时间或开始时间计算
  const baseTimeStr = plan.deadline || plan.due_date || plan.start_time || plan.estimated_time
  if (!baseTimeStr) return null

  const baseTs = parseDateTimeToTs(baseTimeStr)
  if (!baseTs) return null

  // 提前 N 分钟
  const advanceMin = reminder.advanceMin ?? 30
  return baseTs - advanceMin * 60 * 1000
}

/**
 * 解析时间字符串为时间戳
 * 支持：YYYY-MM-DD HH:mm:ss / YYYY-MM-DD HH:mm / YYYY-MM-DD
 */
function parseDateTimeToTs(str) {
  if (!str) return null
  // YYYY-MM-DD HH:mm:ss
  let m = str.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (m) {
    return new Date(
      parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]),
      parseInt(m[4]), parseInt(m[5]), parseInt(m[6] || 0)
    ).getTime()
  }
  // YYYY-MM-DD
  m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) {
    return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]), 23, 59, 59).getTime()
  }
  return null
}

// ==================== 已触发记录管理 ====================

function getTriggeredMap() {
  try {
    const raw = uni.getStorageSync(STORAGE_KEY_TRIGGERED)
    if (raw) return typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch (e) { /* ignore */ }
  return {}
}

function markTriggered(planId) {
  const map = getTriggeredMap()
  map[planId] = Date.now()
  asyncSetStorageJSON(STORAGE_KEY_TRIGGERED, map)
}

function isTriggered(planId) {
  const map = getTriggeredMap()
  return !!map[planId]
}

function clearTriggered(planId) {
  const map = getTriggeredMap()
  delete map[planId]
  asyncSetStorageJSON(STORAGE_KEY_TRIGGERED, map)
}

/**
 * 清理超过 7 天的已触发记录
 */
export function cleanupTriggered() {
  const map = getTriggeredMap()
  const now = Date.now()
  let changed = false
  for (const k in map) {
    if (now - map[k] > 7 * 24 * 60 * 60 * 1000) {
      delete map[k]
      changed = true
    }
  }
  if (changed) asyncSetStorageJSON(STORAGE_KEY_TRIGGERED, map)
}

// ==================== 免打扰时段检查 ====================

function isInQuietHours(settings) {
  if (!settings.quietHoursStart || !settings.quietHoursEnd) return false
  const now = new Date()
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  const currentTime = `${h}:${m}`

  const [startH, startM] = settings.quietHoursStart.split(':').map(Number)
  const [endH, endM] = settings.quietHoursEnd.split(':').map(Number)
  const currentMin = now.getHours() * 60 + now.getMinutes()
  const startMin = startH * 60 + startM
  const endMin = endH * 60 + endM

  if (startMin < endMin) {
    // 同一天：如 14:00 - 16:00
    return currentMin >= startMin && currentMin < endMin
  } else {
    // 跨天：如 22:00 - 08:00
    return currentMin >= startMin || currentMin < endMin
  }
}

// ==================== 核心检查逻辑 ====================

/**
 * 获取所有需要检查的计划
 * 需要外部传入 getPlanList 函数，避免循环依赖
 */
let _getPlanList = null

export function initReminder(getPlanListFn) {
  _getPlanList = getPlanListFn
}

/**
 * 检查所有计划的提醒
 * 遍历有提醒设置的计划，判断是否到达提醒时间，触发通知
 */
export function checkAllReminders() {
  if (isChecking) return
  if (!_getPlanList) {
    // initReminder 尚未执行（onLaunch 延迟加载），静默跳过
    return
  }

  const settings = getReminderSettings()
  if (!settings.enabled) return

  isChecking = true
  try {
    const plans = _getPlanList()
    const planMap = settings.plans || {}
    const now = Date.now()

    for (const plan of plans) {
      // 跳过已删除/已完成的计划
      if (plan.is_deleted === 1) continue
      if (plan.status === 2) continue // status 2 = 已完成

      const reminderCfg = planMap[plan.client_id]
      if (!reminderCfg || !reminderCfg.enabled) continue

      // 已触发过则跳过
      if (isTriggered(plan.client_id)) continue

      const reminderTs = calcReminderTime(plan, reminderCfg)
      if (!reminderTs) continue

      // 提醒时间已到（当前时间 >= 提醒时间）
      if (now >= reminderTs) {
        // 免打扰检查（但如果是已过截止时间的紧急提醒，仍然触发）
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

/**
 * 触发提醒通知
 */
function triggerReminder(plan, reminderCfg, isOverdue) {
  const title = isOverdue ? '⏰ 计划已过期' : '📋 计划提醒'
  let body = plan.title
  if (plan.deadline) {
    const dl = formatDisplayTime(plan.deadline)
    body += `\n截止时间：${dl}`
  }
  if (isOverdue) {
    body += '\n请尽快处理或更新计划状态'
  } else {
    const advanceMin = reminderCfg.advanceMin ?? 30
    if (advanceMin > 0) {
      body += `\n还有约${formatDuration(advanceMin)}到达截止时间`
    }
  }

  logger.log(`[reminder] Triggering: ${plan.title}`)

  // 前台：弹窗 + 震动
  // #ifdef APP-PLUS
  uni.vibrate({ type: 'medium' })
  // #endif

  uni.showModal({
    title,
    content: body,
    confirmText: '查看',
    cancelText: '关闭',
    success(res) {
      if (res.confirm) {
        // 跳转到计划详情
        uni.navigateTo({
          url: `/pages/plan/detail?clientId=${plan.client_id}`
        })
      }
    }
  })

  // 后台通知（App 端）
  // #ifdef APP-PLUS
  try {
    const pushMsg = plus.push.createPushMessage(body, {
      title,
      sound: 'system',
      cover: false
    })
    if (pushMsg) logger.log('[reminder] Push message created')
  } catch (e) {
    // plus.push 可能不可用，忽略
  }
  // #endif

  // H5 通知
  // #ifdef H5
  try {
    if (window.Notification && Notification.permission === 'granted') {
      new Notification(title, { body })
    } else if (window.Notification && Notification.permission !== 'denied') {
      Notification.requestPermission().then(p => {
        if (p === 'granted') new Notification(title, { body })
      })
    }
  } catch (e) { /* ignore */ }
  // #endif

  // 小程序订阅消息
  // #ifdef MP-WEIXIN
  try {
    uni.requestSubscribeMessage({
      tmplIds: ['plan_reminder_template'], // 需要在小程序后台配置模板
      success() {
        logger.log('[reminder] Subscribe message sent')
      },
      fail(e) {
        logger.warn('[reminder] Subscribe message failed:', e)
      }
    })
  } catch (e) { /* ignore */ }
  // #endif
}

function formatDisplayTime(str) {
  const ts = parseDateTimeToTs(str)
  if (!ts) return str
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatDuration(min) {
  if (min < 60) return `${min}分钟`
  if (min < 1440) return `${Math.floor(min / 60)}小时${min % 60 > 0 ? `${min % 60}分钟` : ''}`
  return `${Math.floor(min / 1440)}天`
}

// ==================== 定时器管理 ====================

/**
 * 启动提醒定时检查
 * 应在 App.vue onLaunch 中调用
 */
export function startReminderChecker() {
  if (checkTimer) return
  // 首次延迟 5 秒执行（等待存储初始化）
  setTimeout(() => {
    cleanupTriggered()
    checkAllReminders()
  }, 5000)

  checkTimer = setInterval(() => {
    checkAllReminders()
  }, CHECK_INTERVAL_MS)

  logger.log('[reminder] Checker started')
}

/**
 * 停止提醒检查
 */
export function stopReminderChecker() {
  if (checkTimer) {
    clearInterval(checkTimer)
    checkTimer = null
    logger.log('[reminder] Checker stopped')
  }
}

// ==================== 异步存储写入 ====================

function asyncSetStorageJSON(key, value) {
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
