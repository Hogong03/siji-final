/**
 * keepalive.js — Android 后台常驻（4.35.0）
 *
 * 目标：退到后台 / 从最近任务划掉后，进程尽量不被系统回收，从而让 60s 轮询提醒、
 * 回前台的增量结算继续有效；配合 4.22.0 的本地推送（进程真被杀也能到点弹通知）双保险。
 *
 * 实现方式（为什么不是 uni.requireNativePlugin）：
 *   插件 nativeplugins/siji-keepalive 是一个**纯 Android Service**，没有 UniModule 类
 *   （不需要 uniapp 插件 SDK，aar 4KB，javac 就能构建，见 scripts/build-keepalive-aar.ps1）。
 *   这里用 plus.android 反射构造 Intent → startForegroundService 拉起它。
 *
 * 三条铁律（写错就是真机踩坑）：
 *  1. 插件没打进包（标准基座 / 旧包）时，importClass 会抛错 —— 必须 catch 并静默降级，
 *     否则启动即崩。判定结果缓存，避免每轮都抛异常。
 *  2. startForegroundService 是 API 26+；26 以下只能 startService。
 *  3. Android 14+ 前台服务必须在 manifest 里声明 foregroundServiceType（aar 里已声明
 *     specialUse）；渠道/通知被用户关掉时 Service 会自杀，这里不回滚开关 —— 用户关的是
 *     通知，不代表他不要后台常驻。
 *
 * 平台边界：仅 Android。iOS 无对应能力（H5 / 小程序 / iOS 全部走 no-op）。
 */

import { logger } from './logger.js'

/** 开关存储键（App 端本地） */
export const KEEPALIVE_KEY = 'siji_keepalive_enabled'
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

/* ─── 插件可用性探测（结果缓存）─── */
let supportedCache = null

/**
 * 前台服务插件是否可用：App 端 + Android + aar 已打进包（类能加载）。
 * 缓存结果，避免每轮 syncKeepAlive 都触发一次异常。
 */
export function isKeepAliveSupported() {
  if (supportedCache !== null) return supportedCache
  supportedCache = false
  // #ifdef APP-PLUS
  try {
    if (typeof plus !== 'undefined' && plus.android && plus.os && plus.os.name === 'Android') {
      // 类存在即说明 aar 打进包了；不存在会直接抛
      plus.android.importClass(SERVICE_CLASS)
      supportedCache = true
    }
  } catch (e) {
    supportedCache = false
    logger.log('[keepalive] 前台服务插件未打进包，后台常驻不可用（需自定义基座/云打包勾选本地插件）')
  }
  // #endif
  return supportedCache
}

/**
 * 组装启动 Instruction 的参数（纯函数，便于单测）
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
 * @param {{ title?: string, text?: string }} [opts]
 * @returns {boolean} 是否成功发起
 */
export function startKeepAlive(opts) {
  if (!isKeepAliveSupported()) return false
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
    logger.log('[keepalive] 前台服务已启动')
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
  // #ifdef APP-PLUS
  try {
    const main = plus.android.runtimeMainActivity()
    if (!main) return false
    const Intent = plus.android.importClass('android.content.Intent')
    const intent = new Intent()
    plus.android.importClass(intent)
    intent.setClassName(String(main.getPackageName()), SERVICE_CLASS)
    main.stopService(intent)
    logger.log('[keepalive] 前台服务已停止')
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
  const supported = isKeepAliveSupported()
  if (!shouldStartKeepAlive(on, supported)) {
    // 开关关掉（或本端不支持）时确保没有残留服务
    if (supported && !on) stopKeepAlive()
    return { on, supported, acted: false }
  }
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

/** 测试用：清掉探测缓存 */
export function __resetKeepAliveCache() {
  supportedCache = null
}
