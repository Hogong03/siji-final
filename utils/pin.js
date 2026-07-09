/**
 * 隐私锁模块 — 本地 PIN 码验证
 * 
 * 功能：
 * - 设置/修改/关闭 PIN 码
 * - APP 启动时验证（如已设置）
 * - 5 次错误锁定 30 秒
 */

const PIN_KEY = 'siji_pin'
const PIN_FAIL_KEY = 'siji_pin_fail'
const PIN_LOCK_KEY = 'siji_pin_lock_until'

/** 是否已设置 PIN */
export function hasPin() {
  return !!uni.getStorageSync(PIN_KEY)
}

/** 验证 PIN */
export function verifyPin(input) {
  // 检查是否被锁定
  const lockUntil = uni.getStorageSync(PIN_LOCK_KEY) || 0
  if (Date.now() < lockUntil) {
    const remain = Math.ceil((lockUntil - Date.now()) / 1000)
    return { success: false, locked: true, remain }
  }

  const stored = uni.getStorageSync(PIN_KEY)
  if (!stored) {
    return { success: true }  // 未设置 PIN，直接通过
  }

  if (input === stored) {
    // 验证成功，清除失败计数
    uni.removeStorageSync(PIN_FAIL_KEY)
    uni.removeStorageSync(PIN_LOCK_KEY)
    return { success: true }
  }

  // 验证失败
  const failCount = (uni.getStorageSync(PIN_FAIL_KEY) || 0) + 1
  uni.setStorageSync(PIN_FAIL_KEY, String(failCount))

  if (failCount >= 5) {
    // 锁定 30 秒
    const lockUntil = Date.now() + 30000
    uni.setStorageSync(PIN_LOCK_KEY, String(lockUntil))
    uni.removeStorageSync(PIN_FAIL_KEY)
    return { success: false, locked: true, remain: 30 }
  }

  return { success: false, attemptsLeft: 5 - failCount }
}

/** 设置 PIN */
export function setPin(pin) {
  if (!pin || pin.length < 4) return false
  uni.setStorageSync(PIN_KEY, pin)
  return true
}

/** 修改 PIN（需验证旧 PIN） */
export function changePin(oldPin, newPin) {
  const verify = verifyPin(oldPin)
  if (!verify.success) return false
  return setPin(newPin)
}

/** 关闭 PIN */
export function removePin(pin) {
  const verify = verifyPin(pin)
  if (!verify.success) return false
  uni.removeStorageSync(PIN_KEY)
  uni.removeStorageSync(PIN_FAIL_KEY)
  uni.removeStorageSync(PIN_LOCK_KEY)
  return true
}

/** 获取剩余失败次数 */
export function getFailCount() {
  return parseInt(uni.getStorageSync(PIN_FAIL_KEY) || '0')
}

/** 是否当前被锁定 */
export function isLocked() {
  const lockUntil = uni.getStorageSync(PIN_LOCK_KEY) || 0
  return Date.now() < lockUntil
}

/** 获取锁定剩余秒数 */
export function getLockRemain() {
  const lockUntil = uni.getStorageSync(PIN_LOCK_KEY) || 0
  return Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000))
}
