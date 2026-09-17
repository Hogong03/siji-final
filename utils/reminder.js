/**
 * 计划提醒模块 — 本地通知调度
 *
 * 拆分为 4 个子模块，本文件为聚合入口：
 * - reminder/settings.js   — 设置读写 + 时间工具
 * - reminder/triggered.js   — 已触发记录管理
 * - reminder/notifier.js    — 多端通知触发
 * - reminder/scheduler.js   — 检查调度逻辑
 *
 * 外部引用无需改动，API 完全兼容。
 */

import { logger } from './logger.js'
import { getReminderSettings, saveReminderSettings, setPlanReminder, getPlanReminder, removePlanReminder } from './reminder/settings.js'
import { cleanupTriggered } from './reminder/scheduler.js'
import { initReminder, checkAllReminders } from './reminder/scheduler.js'
import { ensureNotifyPermission } from './reminder/notifier.js'

const CHECK_INTERVAL_MS = 60 * 1000

let checkTimer = null

// ==================== 定时器管理 ====================

/**
 * 启动提醒定时检查
 * 应在 App.vue onLaunch 中调用
 */
export function startReminderChecker() {
  if (checkTimer) return
  // 安卓 13+ 先要通知权限，否则到点提醒弹不出来（3.10.0）
  ensureNotifyPermission()
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

// ==================== Re-export 公共 API ====================

export {
  getReminderSettings,
  saveReminderSettings,
  setPlanReminder,
  getPlanReminder,
  removePlanReminder,
  initReminder,
  checkAllReminders,
  cleanupTriggered
}
