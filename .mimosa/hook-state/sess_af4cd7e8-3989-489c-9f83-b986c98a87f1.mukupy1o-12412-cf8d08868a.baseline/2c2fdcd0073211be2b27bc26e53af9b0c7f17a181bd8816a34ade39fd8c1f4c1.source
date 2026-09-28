/**
 * 版本更新检查
 *
 * 策略：
 *  - App 端：调用 uni.getUpdateManager()（微信小程序）或 plus.runtime.getProperty()（App）
 *  - H5 端：检查 manifest 中的版本号与 localStorage 记录的上次版本，有更新时提示
 *  - 检查频率：每次启动检查一次，24h 内不重复检查
 *  - 更新提示：非阻塞 toast/modal，用户可选择跳过
 */

import { logger } from './logger.js'
// 版本号唯一事实来源：编译进包的 manifest.json（构建期内联成常量，运行时零依赖）
// 反馈导出长期显示 v1.0.0 的根因就是这里 —— 基座里 plus.runtime.version 是宿主的版本，
// H5 的 __uniConfig.versionName 也不保证存在，两条路都回落到了默认值
import manifest from '@/manifest.json'

const LAST_CHECK_KEY = 'siji_last_version_check'
const LAST_VERSION_KEY = 'siji_last_known_version'
const CHECK_INTERVAL = 24 * 60 * 60 * 1000 // 24h

/**
 * App 端资源包版本：plus.runtime.getProperty 是异步的，读到后缓存在这里
 * （基座里 plus.runtime.version 给的是宿主 App 的版本，不是本项目的 versionName）
 */
let _appVersion = ''

/**
 * App 端预热真实版本号 —— 启动时调一次即可
 *
 * 坑：HBuilder 标准基座 / 自定义基座里 plus.runtime.version 返回的是宿主的版本（1.0.0），
 * 本项目的 manifest versionName 拿不到；于是版本历史、反馈导出、更新检查全部报 1.0.0
 * （反馈 2026-09-15 的导出头部就是 v1.0.0）。getProperty 读的是资源包，才是真实版本。
 */
export function primeAppVersion() {
  // #ifdef APP-PLUS
  try {
    if (typeof plus !== 'undefined' && plus.runtime && plus.runtime.getProperty) {
      plus.runtime.getProperty(plus.runtime.appid, (info) => {
        if (info && info.version) _appVersion = String(info.version)
      })
    }
  } catch (e) { /* 拿不到就用 plus.runtime.version 兜底 */ }
  // #endif
}

/**
 * 获取当前应用版本号
 *
 * 顺序：编译进包的 manifest.versionName（永远等于正在跑的这份代码）→
 *       App 资源包版本（primeAppVersion 异步读到，装的是 wgt 时更准）→
 *       平台自带版本 → 兜底 1.0.0
 */
function getCurrentVersion() {
  try {
    // #ifdef MP-WEIXIN
    const mpVersion = uni.getAccountInfoSync().miniProgram.version || ''
    return mpVersion || manifest.versionName || '1.0.0'
    // #endif
    // #ifdef APP-PLUS
    // 资源包版本（getProperty 读到）优先于 manifest：OTA 更新过 wgt 时以它为准；
    // 基座里它可能与 manifest 相同，无所谓
    if (_appVersion) return _appVersion
    return manifest.versionName || '1.0.0'
    // #endif
    // #ifdef H5
    if (typeof __uniConfig !== 'undefined' && __uniConfig.versionName) return __uniConfig.versionName
    return manifest.versionName || '1.0.0'
    // #endif
  } catch (e) {
    try { return manifest.versionName || '1.0.0' } catch (e2) { return '1.0.0' }
  }
}

/**
 * 比较版本号 — 语义化版本比较
 * @returns {number} -1: v1 < v2, 0: v1 == v2, 1: v1 > v2
 */
export function compareVersion(v1, v2) {
  const parts1 = (v1 || '0').split('.').map(n => parseInt(n, 10) || 0)
  const parts2 = (v2 || '0').split('.').map(n => parseInt(n, 10) || 0)
  const len = Math.max(parts1.length, parts2.length)
  for (let i = 0; i < len; i++) {
    const a = parts1[i] || 0
    const b = parts2[i] || 0
    if (a < b) return -1
    if (a > b) return 1
  }
  return 0
}

/**
 * 微信小程序更新检查
 */
function checkMPUpdate() {
  if (typeof uni.getUpdateManager !== 'function') return
  const updateManager = uni.getUpdateManager()
  updateManager.onCheckForUpdate(res => {
    if (res.hasUpdate) {
      logger.log('[思迹] 发现新版本（小程序）')
    }
  })
  updateManager.onUpdateReady(() => {
    uni.showModal({
      title: '更新提示',
      content: '新版本已就绪，是否重启应用？',
      success: res => {
        if (res.confirm) updateManager.applyUpdate()
      }
    })
  })
  updateManager.onUpdateFailed(() => {
    uni.showToast({ title: '更新失败，请清除缓存后重试', icon: 'none' })
  })
}

/**
 * App 端更新检查（plus.runtime）
 */
function checkAppUpdate() {
  // #ifdef APP-PLUS
  try {
    plus.runtime.getProperty(plus.runtime.appid, (info) => {
      if (!info) return
      const currentVersion = info.version
      const lastKnown = uni.getStorageSync(LAST_VERSION_KEY)
      
      if (lastKnown && compareVersion(currentVersion, lastKnown) > 0) {
        // 版本已更新（热更新场景）
        uni.showModal({
          title: '已更新',
          content: `已更新至 v${currentVersion}\n看看有什么新变化`,
          showCancel: true,
          cancelText: '跳过',
          confirmText: '查看',
          success: (res) => {
            if (res.confirm) goVersionHistory()
          }
        })
      }
      uni.setStorageSync(LAST_VERSION_KEY, currentVersion)
    })
  } catch (e) {
    logger.warn('[思迹] App update check failed:', e.message)
  }
  // #endif
}

/** 跳转到版本历史页（启动弹窗时路由可能未就绪，延迟执行） */
function goVersionHistory() {
  setTimeout(() => {
    uni.navigateTo({
      url: '/pages/settings/sub/version-history',
      fail: () => {
        uni.redirectTo({ url: '/pages/settings/sub/version-history' })
      }
    })
  }, 300)
}

/**
 * H5 端版本检查
 */
function checkH5Update() {
  const currentVersion = getCurrentVersion()
  const lastKnown = uni.getStorageSync(LAST_VERSION_KEY)
  
  if (lastKnown && compareVersion(currentVersion, lastKnown) > 0) {
    uni.showModal({
      title: '已更新',
      content: `已更新至 v${currentVersion}`,
      showCancel: true,
      cancelText: '跳过',
      confirmText: '查看',
      success: (res) => {
        if (res.confirm) goVersionHistory()
      }
    })
  }
  uni.setStorageSync(LAST_VERSION_KEY, currentVersion)
}

/**
 * 主入口 — 启动时调用
 * @param {boolean} force - 强制检查（忽略 24h 限制）
 */
export function checkVersionUpdate(force = false) {
  const now = Date.now()
  const lastCheck = uni.getStorageSync(LAST_CHECK_KEY) || 0
  
  if (!force && now - lastCheck < CHECK_INTERVAL) return
  
  uni.setStorageSync(LAST_CHECK_KEY, now)
  
  // #ifdef MP-WEIXIN
  checkMPUpdate()
  // #endif
  
  // #ifdef APP-PLUS
  checkAppUpdate()
  // #endif
  
  // #ifdef H5
  checkH5Update()
  // #endif
  
  logger.log('[思迹] Version check done, current:', getCurrentVersion())
}

/**
 * 获取当前版本号
 */
export function getVersion() {
  return getCurrentVersion()
}

/**
 * 获取版本检查状态摘要
 */
/**
 * 正在运行的版本是否落后于版本日志里最新的一条
 * 用途：版本历史页自证「你跑的是不是旧构建」——反馈里长期分不清「日志最新」与「运行版本」
 * @param {string} latest 版本日志最新条目的版本号
 * @returns {boolean} 无法判断时返回 false（不误报）
 */
export function isRunningOlderThan(latest) {
  if (!latest) return false
  const running = getVersion()
  if (!running) return false
  return compareVersion(running, String(latest)) < 0
}

export function getVersionStatus() {
  const current = getCurrentVersion()
  const lastKnown = uni.getStorageSync(LAST_VERSION_KEY) || current
  const lastCheck = uni.getStorageSync(LAST_CHECK_KEY) || 0
  const updated = compareVersion(current, lastKnown) > 0
  
  return {
    current,
    lastKnown,
    updated,
    lastCheckTime: lastCheck ? new Date(lastCheck).toLocaleString() : '从未检查'
  }
}
