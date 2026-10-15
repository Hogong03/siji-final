/**
 * push-schedule.js — 计划提醒的本地推送预注册（4.22.0）
 *
 * 解决「计划到期时 App 没开着 → 应用外完全收不到提醒」：
 * 轮询（scheduler）只在 App 进程活着 + JS 定时器未被冻结时有效，退后台/被杀全盲。
 * 本地推送（plus.push.createMessage + delay）把触发交给系统层：注册后到点由系统发通知，
 * App 被杀也能送达（iOS 走 UNUserNotificationCenter 系统级；Android 由基座代理，
 * 个别激进 ROM 杀后台会失效 —— 如实已知边界）。
 *
 * 策略：启动 / 回前台时清掉旧注册，按当前提醒配置重注册未来 7 天内的全部命中点
 * （滚动窗口；提醒配置或计划一变，下次回前台自动对齐）。纯本地 API，零插件零服务端。
 */
import { logger } from '../logger.js'
import { getPlanList } from '../storage.js'
import { getReminderSettings } from './settings.js'
import { computeUpcomingFires, computeDefaultFire } from './scheduler.js'

/** 上次注册时间（节流：回前台高频触发，60s 内不重复注册） */
const REG_AT_KEY = 'siji_plan_push_reg_at'
/** 注册窗口（天） */
const WINDOW_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000

/* ─── push 模块可用性探测（4.27.1）───
 * 打包时 manifest 未声明 Push 模块时，任何 plus.push 调用都会弹基座级系统弹窗
 * 「打包时未添加 push 模块」（同步 alert，JS try-catch 拦不住）—— 4.22.0 上线后必现。
 * 解法：运行时读打包进包的 manifest，声明了 Push 才碰 plus.push；
 * 旧包（未声明）自动跳过不再弹窗，新包（4.27.1 起声明）自动启用。 */
let pushModuleAvail = null // null = 未探测；true/false = 已探测

/** 解析 manifest 文本判断是否声明了 Push 模块（纯函数，可测） */
export function manifestHasPush(manifestText) {
  try {
    const m = typeof manifestText === 'string' ? JSON.parse(manifestText) : manifestText
    const mods = m && m['app-plus'] && m['app-plus'].modules
    return !!(mods && mods.Push)
  } catch (e) {
    return false
  }
}

/**
 * 探测当前包是否可用 push（异步，结果缓存；非 App 端恒 false）
 * @param {(ok: boolean) => void} cb
 */
export function probePushModule(cb) {
  // #ifdef APP-PLUS
  if (pushModuleAvail !== null) {
    cb(pushModuleAvail)
    return
  }
  try {
    if (typeof plus === 'undefined' || !plus.runtime || !plus.push) {
      pushModuleAvail = false
      cb(false)
      return
    }
    plus.runtime.getProperty(plus.runtime.appid, (info) => {
      pushModuleAvail = manifestHasPush(info && info.manifest)
      if (!pushModuleAvail) logger.warn('[push-schedule] manifest 未声明 Push 模块，本地推送停用（重新云打包后自动启用）')
      cb(pushModuleAvail)
    })
  } catch (e) {
    pushModuleAvail = false
    cb(false)
  }
  // #endif
  // #ifndef APP-PLUS
  cb(false)
  // #endif
}

/**
 * 清掉本模块注册的全部本地推送（重注册前调用，防止堆积）
 */
function clearRegisteredPushes() {
  // #ifdef APP-PLUS
  try {
    if (!plus || !plus.push) return
    const list = plus.push.getAllMessage() || []
    list.forEach(msg => {
      try { plus.push.removeMessage(msg) } catch (e) { /* 单条失败不影响其余 */ }
    })
  } catch (e) {
    logger.warn('[push-schedule] clear failed:', e && e.message)
  }
  // #endif
}

/**
 * 按当前提醒配置注册未来 7 天内的全部计划提醒为本地推送（幂等：先清后注册）
 * @param {number} [now] 注入时间（测试用）
 * @returns {{ registered: number }} 注册条数（非 App 端恒 0）
 */
/**
 * 按当前提醒配置注册未来 7 天内的全部计划提醒为本地推送（幂等：先清后注册）
 * 4.27.1：先探测 manifest 是否声明 Push 模块 —— 未声明的包（旧包）直接跳过，不再触发基座弹窗
 * @param {number} [now] 注入时间（测试用）
 * @returns {Promise<{ registered: number }>} 注册条数（非 App 端/未声明 Push 恒 0）
 */
export function registerPlanPushes(now = Date.now()) {
  return new Promise((resolve) => {
    probePushModule((ok) => {
      if (!ok) {
        resolve({ registered: 0 })
        return
      }
      resolve(registerPlanPushesInner(now))
    })
  })
}

function registerPlanPushesInner(now = Date.now()) {
  try {
    const last = Number(uni.getStorageSync(REG_AT_KEY) || 0)
    if (now - last < 60 * 1000) return { registered: 0 }
    uni.setStorageSync(REG_AT_KEY, String(now))
  } catch (e) { /* 节流失败不阻断注册 */ }

  // #ifdef APP-PLUS
  try {
    if (typeof plus === 'undefined' || !plus.push) return { registered: 0 }
    const settings = getReminderSettings()
    if (!settings.enabled) return { registered: 0 }
    const plans = getPlanList() || []
    clearRegisteredPushes()

    let registered = 0
    plans.forEach(plan => {
      try {
        if (!plan || plan.is_deleted === 1 || plan.status === 2 || plan.frozen_at || plan.someday_at) return
        const reminderCfg = settings.plans && settings.plans[plan.client_id]
        if (reminderCfg && !reminderCfg.enabled) return
        // 手动配置过 → 按配置（含循环档）；没配置过 → 默认规则（有截止/开始时间自动提醒）
        const fires = reminderCfg
          ? computeUpcomingFires(plan, reminderCfg, now, WINDOW_DAYS)
          : (() => {
              const f = computeDefaultFire(plan, settings, now)
              return (f && f.ts > now && f.ts <= now + WINDOW_DAYS * DAY_MS) ? [f] : []
            })()
        fires.forEach(f => {
          try {
            plus.push.createMessage(JSON.stringify({
              type: 'plan_reminder',
              planId: plan.client_id,
              fireKey: plan.client_id + '|' + f.dateKey
            }), {
              title: '📋 计划提醒',
              content: plan.title + '（到点打开思迹可直达打卡）',
              delay: Math.max(1000, f.ts - now),
              sound: 'system',
              cover: false
            })
            registered++
          } catch (e) { /* 单条失败不拖垮 */ }
        })
      } catch (e) { /* 单计划失败不拖垮 */ }
    })
    logger.log('[push-schedule] registered', registered, 'local pushes for', WINDOW_DAYS, 'days')
    return { registered }
  } catch (e) {
    logger.warn('[push-schedule] register failed:', e && e.message)
    return { registered: 0 }
  }
  // #endif

  // #ifndef APP-PLUS
  return { registered: 0 }
  // #endif
}
