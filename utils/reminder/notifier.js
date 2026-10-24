/**
 * 提醒通知触发模块 — 多端通知（App/H5/小程序）
 *
 * 4.29.3 两处真机根治（此前「应用内弹窗烦人 + 应用外完全收不到通知」）：
 *  1. 应用内：ActionSheet 弹窗改 toast 轻提示（不打断当前操作）。随之取消
 *     「立即打卡 / 推迟 / 查看」三个选择动作，触发后直接按当天已处理落账，
 *     否则同一提醒会按轮询周期反复弹 toast。
 *  2. 应用外：plus.push.createPushMessage 这个 API 不存在（官方只有 createMessage），
 *     调用即抛错被 try/catch 吞掉 —— 应用外通知一直没发出去。
 */

import { logger } from '../logger.js'
import { formatDisplayTime, formatDuration, getPromptFlag } from './settings.js'
import { probePushModule } from './push-probe.js'
import { vibrateForReminder } from './vibrate.js'

/**
 * 该设备是否需要运行时申请通知权限（纯函数，便于单测）
 *
 * Android 13（API 33）起 plus.push / 本地推送需要 POST_NOTIFICATIONS，
 * 不申请则通知被系统静默丢弃。读不到版本时按「需要」处理 ——
 * 低版本上 requestPermissions 是空操作，多问一次的代价远小于通知收不到。
 */
export function needsNotifyPermission(sdkInt, osVersion) {
  const n = Number(sdkInt)
  if (Number.isFinite(n) && n > 0) return n >= 33
  const major = parseInt(String(osVersion || '').split('.')[0], 10)
  if (Number.isFinite(major) && major > 0) return major >= 13
  return true
}

/**
 * Android 13+（API 33）需要运行时通知权限，否则 plus.push 建了消息也不会显示。
 * 启动时请求一次；非 Android / 低版本 / 已授权都是空操作。
 */
export function ensureNotifyPermission() {
  // #ifdef APP-PLUS
  try {
    if (!plus || !plus.android || plus.os.name !== 'Android') return
    // Build.VERSION 是嵌套类：importClass('android.os.Build') 拿不到 SDK_INT（4.29.3 实证，
    // 旧写法 Build.VERSION 恒 undefined → sdk=0 → 提前 return，权限从来没申请过）
    let sdkInt = 0
    try {
      const VERSION = plus.android.importClass('android.os.Build$VERSION')
      sdkInt = Number(VERSION && VERSION.SDK_INT) || 0
    } catch (e) { /* 走 os.version 兜底 */ }
    if (!needsNotifyPermission(sdkInt, plus.os.version)) return
    if (typeof plus.android.requestPermissions !== 'function') return
    plus.android.requestPermissions(
      ['android.permission.POST_NOTIFICATIONS'],
      function () { logger.log('[reminder] POST_NOTIFICATIONS granted') },
      function () { logger.warn('[reminder] POST_NOTIFICATIONS denied（通知不会显示，需去系统设置手动开）') }
    )
  } catch (e) {
    logger.warn('[reminder] request notify permission failed:', e && e.message)
  }
  // #endif
}

/**
 * 前台提醒用 toast 轻提示（4.29.3 取代 ActionSheet 弹窗）
 * 只提示不阻塞：用户知道到点了，处理去计划页，不在当前操作上插一层弹窗。
 * 4.30.0：补上提示开关（prompts.reminderToast）—— 关了应用内不再弹 toast，
 * 落账仍由调用方在 toast 之前完成，所以关掉提示不影响「已提醒过」的去重。
 */
function showReminderToast(plan, isOverdue) {
  if (!getPromptFlag('reminderToast')) return
  const prefix = isOverdue ? '计划已过期' : '计划提醒'
  const title = plan && plan.title ? plan.title : '未命名计划'
  try {
    uni.showToast({ title: `${prefix}：${title}`, icon: 'none', duration: 3000 })
  } catch (e) {
    logger.warn('[reminder] toast failed:', e && e.message)
  }
}

/**
 * 触发提醒通知
 * @param {Object} plan 计划
 * @param {Object} reminderCfg 提醒配置
 * @param {boolean} isOverdue 是否已过截止
 * @param {{ onDone?: Function, onSnooze?: Function }} [handlers] 落账回调（4.5.0，见 scheduler.reminderHandlers）
 */
export function triggerReminder(plan, reminderCfg, isOverdue, handlers = null) {
  const title = isOverdue ? '计划已过期' : '计划提醒'
  let body = plan.title
  if (plan.deadline) {
    body += `\n截止时间：${formatDisplayTime(plan.deadline)}`
  }
  if (isOverdue) {
    body += '\n请尽快处理或更新计划状态'
  } else {
    const advanceMin = (reminderCfg && reminderCfg.advanceMin != null) ? reminderCfg.advanceMin : 30
    if (advanceMin > 0) {
      body += `\n还有约${formatDuration(advanceMin)}到达截止时间`
    }
  }

  logger.log(`[reminder] Triggering: ${plan.title}`)

  // 前台：toast 轻提示 + 震动
  // 4.48.2：震动改走 vibrate.js 三级降级 —— 旧写法 uni.vibrate 不存在（官方只有
  // vibrateShort/vibrateLong），真机每次提醒都有一条 failed 日志且从未震过
  // #ifdef APP-PLUS
  if (!vibrateForReminder()) {
    logger.log('[reminder] 本端不支持震动，跳过')
  }
  // #endif

  showReminderToast(plan, isOverdue)
  // 4.29.3：toast 没有可选项 = 弹完即已告知，直接按当天已处理落账（不再按轮询周期反复弹）
  if (handlers && handlers.onDone) handlers.onDone()

  // 后台通知（App 端）
  // #ifdef APP-PLUS
  // 4.27.1：先探测 push 模块是否可用 —— 未声明的包调 plus.push 会弹基座级系统弹窗且 catch 不住
  // 4.35.1：探测搬到 push-probe.js（叶子模块），这里改成静态引用，打断 notifier→push-schedule→scheduler→notifier 的环
  probePushModule((ok) => {
    if (!ok) return
    try {
      // 4.29.3：官方 API 是 createMessage(content, payload, options) ——
      // 旧代码写的 createPushMessage 不存在，调用即抛错被 catch 吞掉，应用外通知从未发出
      const payload = JSON.stringify({ type: 'plan_reminder', planId: plan.client_id })
      plus.push.createMessage(body, payload, { title, sound: 'system', cover: false })
      logger.log('[reminder] push message created')
    } catch (e) {
      logger.warn('[reminder] push create failed:', e && e.message)
    }
  })
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
      tmplIds: ['plan_reminder_template'],
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

/**
 * 免打扰时段检查
 */
export function isInQuietHours(settings) {
  if (!settings.quietHoursStart || !settings.quietHoursEnd) return false
  const now = new Date()
  const currentMin = now.getHours() * 60 + now.getMinutes()
  const [startH, startM] = settings.quietHoursStart.split(':').map(Number)
  const [endH, endM] = settings.quietHoursEnd.split(':').map(Number)
  const startMin = startH * 60 + startM
  const endMin = endH * 60 + endM

  if (startMin < endMin) {
    return currentMin >= startMin && currentMin < endMin
  } else {
    return currentMin >= startMin || currentMin < endMin
  }
}
