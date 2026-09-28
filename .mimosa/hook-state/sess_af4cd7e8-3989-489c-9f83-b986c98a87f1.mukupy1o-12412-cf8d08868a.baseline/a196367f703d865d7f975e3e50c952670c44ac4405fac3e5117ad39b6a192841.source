/**
 * 设备标识管理
 * 使用 deviceId 作为用户唯一标识，无登录体系
 */

const STORAGE_KEY = 'siji_device_id'

/** 获取或创建设备ID，持久化到 Storage */
export function getDeviceId() {
  let id = uni.getStorageSync(STORAGE_KEY)
  if (!id) {
    id = generateDeviceId()
    uni.setStorageSync(STORAGE_KEY, id)
  }
  return id
}

/** 生成设备ID */
function generateDeviceId() {
  const ts = Date.now().toString(36)
  const rnd = Math.random().toString(36).substring(2, 10)
  return `dev_${ts}_${rnd}`
}

/** 清除设备ID（重置场景） */
export function clearDeviceId() {
  uni.removeStorageSync(STORAGE_KEY)
}
