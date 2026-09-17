/**
 * 提醒通知触发模块 — 多端通知（App/H5/小程序）
 */

import { logger } from '../logger.js'
import { formatDisplayTime, formatDuration } from './settings.js'

/**
 * Android 13+（API 33）需要运行时通知权限，否则 plus.push 建了消息也不会显示。
 * 启动时请求一次；非 Android / 低版本 / 已授权都是空操作。
 */
export function ensureNotifyPermission() {
  // #ifdef APP-PLUS
  try {
    if (!plus || !plus.android || plus.os.name !== 'Android') return
    const Build = plus.android.importClass('android.os.Build')
    const sdk = Build && Build.VERSION ? Number(Build.VERSION.SDK_INT) : 0
    if (!(sdk >= 33)) return
    if (typeof plus.android.requestPermissions !== 'function') return
    plus.android.requestPermissions(
      ['android.permission.POST_NOTIFICATIONS'],
      function () { logger.log('[reminder] POST_NOTIFICATIONS granted') },
      function () { logger.log('[reminder] POST_NOTIFICATIONS denied') }
    )
  } catch (e) {
    logger.warn('[reminder] request notify permission failed:', e && e.message)
  }
  // #endif
}

/**
 * 触发提醒通知
 */
export function triggerReminder(plan, reminderCfg, isOverdue) {
  const title = isOverdue ? '⏰ 计划已过期' : '📋 计划提醒'
  let body = plan.title
  if (plan.deadline) {
    body += `\n截止时间：${formatDisplayTime(plan.deadline)}`
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
  // 3.10.0：震动单独兜住 —— 没震动权限 / 机型不支持时抛错，会把下面的弹窗与推送一起带走
  // #ifdef APP-PLUS
  try {
    uni.vibrate({ type: 'medium' })
  } catch (e) {
    logger.warn('[reminder] vibrate failed:', e && e.message)
  }
  // #endif

  uni.showModal({
    title,
    content: body,
    confirmText: '查看',
    cancelText: '关闭',
    success(res) {
      if (res.confirm) {
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
  } catch (e) { /* plus.push 可能不可用 */ }
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
