/**
 * keepalive.js — Android 后台常驻（4.35.0 首版，4.35.2 双路径）
 *
 * 目标：退到后台 / 从最近任务划掉后，进程尽量不被系统回收，从而让 60s 轮询提醒、
 * 回前台的增量结算继续有效；配合 4.22.0 的本地推送（进程真被杀也能到点弹通知）双保险。
 *
 * 实现方式（4.35.2 起双路径，4.48.2 修正可用性判据）：
 *   正路：uni.requireNativePlugin('siji-keepalive') → SijiKeepAliveModule
 *         （aar 里的原生模块，start/stop/isRunning；模块类为什么存在见 4.35.2 版本日志 ——
 *          HBuilderX 打包校验要求 plugins 非空且每条有 type/name/class）
 *   兜底：plus.android 反射构造 Intent → startForegroundService 拉起 Service
 *         （只在模块取到了、但 start 同步抛错时用；模块都取不到说明 aar 没进包，反射也起不来）
 *
 * 三条铁律（写错就是真机踩坑）：
 *  1. 「插件在不在基座里」只认 uni.requireNativePlugin 的返回值 —— plus.android.importClass
 *     对缺失类不一定抛错（4.48.2 真机日志实证：标准基座里类探测通过，紧接着框架报
 *     「当前运行的基座不包含原生插件」）。旧判据会把标准基座误判为支持，开关可点、
 *     每次启动还多一条框架错误。
 *  2. startForegroundService 是 API 26+；26 以下只能 startService（模块和反射两条路径都判）。
 *  3. Android 14+ 前台服务必须在 manifest 里声明 foregroundServiceType（aar 里已声明
 *     specialUse）；渠道/通知被用户关掉时 Service 会自杀，这里不回滚开关 —— 用户关的是
 *     通知，不代表他不要后台常驻。
 *
 * 降噪：开关关着时 syncKeepAlive 不做任何插件探测（默认用户不该在启动日志里看到
 * 「不包含原生插件」）；只有开关打开或设置页主动自查时才探测一次，结果缓存。
 *
 * 平台边界：仅 Android。iOS 无对应能力（H5 / 小程序 / iOS 全部走 no-op）。
 */

import { logger } from './logger.js'

/** 开关存储键（App 端本地） */
export const KEEPALIVE_KEY = 'siji_keepalive_enabled'
/** 原生模块名（= nativeplugins/siji-keepalive/package.json 的 plugins[0].name） */
export const MODULE_NAME = 'siji-keepalive'
/** Service 类名（与 native/keepalive 源码、aar manifest 保持一致） */
export const SERVICE_CLASS = 'com.siji.keepalive.SijiKeepAliveService'
export const ACTION_START = 'com.siji.keepalive.action.START'
export const ACTION_STOP = 'com.siji.keepalive.action.STOP'
export const EXTRA_TITLE = 'siji_title'
export const EXTRA_TEXT = 'siji_text'

/** 通知栏常驻文案（用户可以关开关，但不能改文案） */
export const NOTIFY_TITLE = '思迹正在后台运行'
export const NOTIFY_TEXT = '计划提醒会准时送达；不需要时可在 设置 - 提示与提醒 关闭'

/**
 * 开关值归一（纯函数）：只认显式真值，'0' / 'false' / 空 / null 一律算关。
 * 默认关 —— 常驻通知是用户可见的副作用，必须用户自己打开。
 */
export function normalizeKeepAliveFlag(raw) {
  if (raw === true) return true
  if (raw === false || raw === null || raw === undefined) return false
  const s = String(raw).trim().toLowerCase()
  return s === '1' || s === 'true' || s === 'yes' || s === 'on'
}

/**
 * 是否应该拉起常驻服务（纯函数）：开关打开 + 平台支持，两个条件都满足才启动。
 */
export function shouldStartKeepAlive(raw, supported) {
  return normalizeKeepAliveFlag(raw) && !!supported
}

/** 读开关（任何端都安全） */
export function isKeepAliveOn() {
  try {
    return normalizeKeepAliveFlag(uni.getStorageSync(KEEPALIVE_KEY))
  } catch (e) {
    return false
  }
}

/** 写开关，返回归一后的值 */
export function setKeepAliveOn(on) {
  const v = normalizeKeepAliveFlag(on)
  try {
    uni.setStorageSync(KEEPALIVE_KEY, v ? '1' : '0')
  } catch (e) {
    logger.warn('[keepalive] 写开关失败:', e && e.message)
  }
  return v
}

/* ─── 原生模块探测（插件是否真的打进当前基座）─── */
let supportedCache = null
let moduleCache = null
let moduleProbed = false
/** 本进程内是否真的拉起过服务（开关关掉时据此收尾，避免无谓 stop） */
let startedThisSession = false

/**
 * 探测原生模块（uni.requireNativePlugin）。
 * 这是「插件在不在基座里」的唯一可靠判据 —— 不能用 plus.android.importClass：
 * 标准基座里它对缺失类不抛错，会把「不支持」误判成「支持」（4.48.2 真机日志实证）。
 * 结果缓存，整个进程只探测一次，避免重复打基座级提示。
 * @returns {{ start: Function, stop: Function } | null}
 */
function probeKeepAliveModule() {
  if (moduleProbed) return moduleCache
  moduleProbed = true
  moduleCache = null
  // #ifdef APP-PLUS
  try {
    if (typeof uni !== 'undefined' && typeof uni.requireNativePlugin === 'function') {
      const m = uni.requireNativePlugin(MODULE_NAME)
      if (m && typeof m.start === 'function' && typeof m.stop === 'function') {
        moduleCache = m
      } else {
        logger.log('[keepalive] 当前基座不含 siji-keepalive 原生插件，后台常驻跳过（标准基座属正常；云打包/自定义基座勾选本地插件后生效）')
      }
    }
  } catch (e) {
    moduleCache = null
    logger.log('[keepalive] 原生模块探测失败，后台常驻跳过:', e && e.message)
  }
  // #endif
  return moduleCache
}

/**
 * 前台服务插件是否可用：App 端 + Android + 原生模块取得到。
 * 缓存结果，避免每次 syncKeepAlive 都触发一次探测。
 */
export function isKeepAliveSupported() {
  if (supportedCache !== null) return supportedCache
  supportedCache = false
  // #ifdef APP-PLUS
  try {
    if (typeof plus !== 'undefined' && plus.android && plus.os && plus.os.name === 'Android') {
      supportedCache = !!probeKeepAliveModule()
    }
  } catch (e) {
    supportedCache = false
  }
  // #endif
  return supportedCache
}

/** 取原生模块句柄（探测结果缓存） */
function getKeepAliveModule() {
  return probeKeepAliveModule()
}

/**
 * 组装启动参数（纯函数，便于单测）：模块路径与反射路径共用同一份文案兜底。
 * @returns {{ className: string, action: string, extraTitle: string, extraText: string }}
 */
export function buildStartSpec(title, text) {
  return {
    className: SERVICE_CLASS,
    action: ACTION_START,
    extraTitle: title && String(title).length ? String(title) : NOTIFY_TITLE,
    extraText: text && String(text).length ? String(text) : NOTIFY_TEXT
  }
}

/** Android 主版本号 → 用于判断 startForegroundService（API 26 = Android 8.0） */
export function androidMajorVersion(osVersion) {
  const major = parseInt(String(osVersion || '').split('.')[0], 10)
  return Number.isFinite(major) && major > 0 ? major : 0
}

/**
 * 启动常驻服务（幂等：重复调用只会让 Service 更新通知文案）
 * 正路 = 原生模块；模块同步抛错才落反射兜底。两条路径打的是同一个 Service。
 * @param {{ title?: string, text?: string }} [opts]
 * @returns {boolean} 是否成功发起
 */
export function startKeepAlive(opts) {
  if (!isKeepAliveSupported()) return false
  const mod = getKeepAliveModule()
  if (mod) {
    // #ifdef APP-PLUS
    try {
      const spec = buildStartSpec(opts && opts.title, opts && opts.text)
      // 异步回执只用于日志：真失败（权限被拒）反射路径也一样失败，不重试
      mod.start({ title: spec.extraTitle, text: spec.extraText }, (res) => {
        if (!res || res.ok !== true) {
          logger.warn('[keepalive] 模块路径启动失败:', res && res.error)
        }
      })
      logger.log('[keepalive] 前台服务已启动（模块路径）')
      startedThisSession = true
      return true
    } catch (e) {
      logger.warn('[keepalive] 模块路径异常，转反射兜底:', e && e.message)
    }
    // #endif
  }
  return startKeepAliveByReflection(opts)
}

/** 反射兜底启动（原 4.35.0 实现，保留原因：模块桥在个别基座上不可赌） */
function startKeepAliveByReflection(opts) {
  // #ifdef APP-PLUS
  try {
    const spec = buildStartSpec(opts && opts.title, opts && opts.text)
    const main = plus.android.runtimeMainActivity()
    if (!main) return false
    const Intent = plus.android.importClass('android.content.Intent')
    const intent = new Intent()
    plus.android.importClass(intent)
    intent.setClassName(String(main.getPackageName()), spec.className)
    intent.setAction(spec.action)
    intent.putExtra(EXTRA_TITLE, spec.extraTitle)
    intent.putExtra(EXTRA_TEXT, spec.extraText)
    if (androidMajorVersion(plus.os.version) >= 8) {
      main.startForegroundService(intent)
    } else {
      main.startService(intent)
    }
    logger.log('[keepalive] 前台服务已启动（反射路径）')
    startedThisSession = true
    return true
  } catch (e) {
    logger.warn('[keepalive] 启动失败:', e && e.message)
    return false
  }
  // #endif
  // #ifndef APP-PLUS
  return false
  // #endif
}

/**
 * 停止常驻服务（含移除通知）
 * 用 stopService 而不是发 ACTION_STOP —— 进程被杀时注册的通知也不会残留。
 */
export function stopKeepAlive() {
  if (!isKeepAliveSupported()) return false
  const mod = getKeepAliveModule()
  if (mod) {
    // #ifdef APP-PLUS
    try {
      mod.stop((res) => {
        if (!res || res.ok !== true) {
          logger.warn('[keepalive] 模块路径停止失败:', res && res.error)
        }
      })
      logger.log('[keepalive] 前台服务已停止（模块路径）')
      startedThisSession = false
      return true
    } catch (e) {
      logger.warn('[keepalive] 模块路径停止异常，转反射兜底:', e && e.message)
    }
    // #endif
  }
  return stopKeepAliveByReflection()
}

/** 反射兜底停止 */
function stopKeepAliveByReflection() {
  // #ifdef APP-PLUS
  try {
    const main = plus.android.runtimeMainActivity()
    if (!main) return false
    const Intent = plus.android.importClass('android.content.Intent')
    const intent = new Intent()
    plus.android.importClass(intent)
    intent.setClassName(String(main.getPackageName()), SERVICE_CLASS)
    main.stopService(intent)
    logger.log('[keepalive] 前台服务已停止（反射路径）')
    startedThisSession = false
    return true
  } catch (e) {
    logger.warn('[keepalive] 停止失败:', e && e.message)
    return false
  }
  // #endif
  // #ifndef APP-PLUS
  return false
  // #endif
}

/**
 * 按开关同步服务状态（唯一入口）
 * 启动路径：App.vue onLaunch(appReady) + onShow 都调一次，幂等。
 * @returns {{ on: boolean, supported: boolean, acted: boolean }}
 */
export function syncKeepAlive() {
  const on = isKeepAliveOn()
  // 开关关着：不探测插件（标准基座默认用户不该在启动日志里看到「不包含原生插件」）。
  // 只有本进程拉起过、或之前已确认支持时才收尾。
  if (!on) {
    if (startedThisSession || supportedCache === true) stopKeepAlive()
    return { on, supported: supportedCache === true, acted: false }
  }
  const supported = isKeepAliveSupported()
  if (!supported) return { on, supported: false, acted: false }
  const acted = startKeepAlive()
  return { on, supported, acted }
}

/**
 * 打开系统的「电池优化」列表，引导用户给思迹豁免（国产 ROM 杀后台的第一现场）。
 * 打不开列表就退到应用详情页 —— 两个入口都不能保证机型，所以一律 try 两级。
 */
export function openBatteryOptimizationSettings() {
  // #ifdef APP-PLUS
  try {
    if (typeof plus === 'undefined' || !plus.android) return false
    const main = plus.android.runtimeMainActivity()
    const Intent = plus.android.importClass('android.content.Intent')
    const Settings = plus.android.importClass('android.provider.Settings')
    try {
      const intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
      plus.android.importClass(intent)
      main.startActivity(intent)
      return true
    } catch (e) {
      // 部分 ROM 没有这个列表页，退到应用详情页
      const Uri = plus.android.importClass('android.net.Uri')
      const intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
      plus.android.importClass(intent)
      intent.setData(Uri.parse('package:' + main.getPackageName()))
      main.startActivity(intent)
      return true
    }
  } catch (e) {
    logger.warn('[keepalive] 打开电池优化设置失败:', e && e.message)
    return false
  }
  // #endif
  // #ifndef APP-PLUS
  return false
  // #endif
}

/** 测试用：清掉探测缓存（支持判定 + 模块探测 + 会话内启动标记） */
export function __resetKeepAliveCache() {
  supportedCache = null
  moduleCache = null
  moduleProbed = false
  startedThisSession = false
}
