/**
 * push-probe.js — Push 模块可用性探测（4.35.1 从 push-schedule.js 抽出）
 *
 * 为什么单独一个文件：notifier.js 原来用**动态 import** 去拿 push-schedule 的 probePushModule，
 * 而依赖链是 push-schedule → scheduler → notifier —— 环，所以只能动态。
 * 构建因此报两条警告（dynamically imported ... but also statically imported ...）。
 * 探测本身只依赖 logger（叶子），抽出来之后 notifier 与 push-schedule 都能静态引用，环被打断。
 *
 * 逻辑与 4.29.3 真机修复后的版本逐字一致，别在这里加新依赖。
 */
import { logger } from '../logger.js'

/** null = 未探测；true/false = 已探测（结果缓存，进程内只探测一次） */
let pushModuleAvail = null

/**
 * WidgetInfo 是否声明了 Push 模块（纯函数，可测）
 *
 * 4.29.3 修正：plus.runtime.getProperty 的回调参数是 WidgetInfo，官方字段只有
 * appid / version / versionCode / name / description / author / email / features，
 * **没有 manifest**。旧写法读 info.manifest 恒为 undefined → 判定恒为「未声明」
 * → probePushModule 恒 false → 本地推送全部被跳过（这才是「应用外收不到通知」的直接原因）。
 * features = manifest 里 5+ 模块声明的键名列表，含 Push 即模块可用。
 */
export function widgetHasPush(info) {
  const feats = info && info.features
  // features 拿不到（字段缺失 / 非预期基座）时不拦：宁可多发一次，也不静默不发
  if (!Array.isArray(feats) || feats.length === 0) return true
  return feats.some(f => String(f).toLowerCase() === 'push')
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
    // plus.push 本体缺失 = 模块没打进包，直接停用（不碰就不会弹基座提示）
    if (typeof plus === 'undefined' || !plus.runtime || !plus.push || typeof plus.push.createMessage !== 'function') {
      pushModuleAvail = false
      cb(false)
      return
    }
    plus.runtime.getProperty(plus.runtime.appid, (info) => {
      pushModuleAvail = widgetHasPush(info)
      if (!pushModuleAvail) logger.warn('[push-probe] 包内未声明 Push 模块，本地推送停用（重新云打包后自动启用）')
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

/** 测试用：清掉探测缓存 */
export function __resetPushProbeCache() {
  pushModuleAvail = null
}
