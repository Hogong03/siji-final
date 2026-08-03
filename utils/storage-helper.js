/**
 * storage-helper.js — 统一数据访问层
 * 所有 storage 操作的单一入口，带错误处理、日志、默认值
 */

const PREFIX = 'siji_'

/**
 * 同步读取
 * @param {string} key - 存储 key（不含 siji_ 前缀）
 * @param {*} defaultValue - 默认值
 * @returns {*}
 */
export function getSync(key, defaultValue = null) {
  try {
    const fullKey = PREFIX + key
    const value = uni.getStorageSync(fullKey)
    if (value === '' || value === null || value === undefined) {
      return defaultValue
    }
    return value
  } catch (e) {
    console.error('[storage] getSync failed:', key, e)
    return defaultValue
  }
}

/**
 * 同步写入
 * @param {string} key - 存储 key
 * @param {*} value - 值
 * @returns {boolean} 是否成功
 */
export function setSync(key, value) {
  try {
    uni.setStorageSync(PREFIX + key, value)
    return true
  } catch (e) {
    console.error('[storage] setSync failed:', key, e)
    return false
  }
}

/**
 * 同步删除
 */
export function removeSync(key) {
  try {
    uni.removeStorageSync(PREFIX + key)
    return true
  } catch (e) {
    console.error('[storage] removeSync failed:', key, e)
    return false
  }
}

/**
 * 异步读取（Promise 封装）
 */
export function get(key, defaultValue = null) {
  return new Promise((resolve) => {
    uni.getStorage({
      key: PREFIX + key,
      success: (res) => resolve(res.data ?? defaultValue),
      fail: () => resolve(defaultValue)
    })
  })
}

/**
 * 异步写入（Promise 封装）
 */
export function set(key, value) {
  return new Promise((resolve) => {
    uni.setStorage({
      key: PREFIX + key,
      data: value,
      success: () => resolve(true),
      fail: (e) => {
        console.error('[storage] set failed:', key, e)
        resolve(false)
      }
    })
  })
}

/**
 * 异步删除
 */
export function remove(key) {
  return new Promise((resolve) => {
    uni.removeStorage({
      key: PREFIX + key,
      success: () => resolve(true),
      fail: () => resolve(false)
    })
  })
}

/**
 * 批量读取
 * @param {string[]} keys
 * @returns {Object} { key: value }
 */
export function getBatchSync(keys) {
  const result = {}
  for (const key of keys) {
    result[key] = getSync(key, null)
  }
  return result
}

/**
 * 批量写入
 * @param {Object} entries - { key: value }
 */
export function setBatchSync(entries) {
  for (const [key, value] of Object.entries(entries)) {
    setSync(key, value)
  }
}

/**
 * 获取所有以 siji_ 开头的 key
 */
export function getAllKeys() {
  try {
    const info = uni.getStorageInfoSync()
    return info.keys.filter(k => k.startsWith(PREFIX)).map(k => k.slice(PREFIX.length))
  } catch (e) {
    console.error('[storage] getAllKeys failed:', e)
    return []
  }
}

/**
 * 清除所有 siji_ 前缀的数据
 */
export function clearAll() {
  try {
    const keys = getAllKeys()
    for (const key of keys) {
      removeSync(key)
    }
    return true
  } catch (e) {
    console.error('[storage] clearAll failed:', e)
    return false
  }
}

/**
 * 兼容旧 key（不带前缀的直接调用）
 * 用于渐进迁移期间
 */
export const compat = {
  getRaw(key, defaultValue = null) {
    try {
      const value = uni.getStorageSync(key)
      return (value === '' || value === null || value === undefined) ? defaultValue : value
    } catch (e) {
      return defaultValue
    }
  },
  setRaw(key, value) {
    try {
      uni.setStorageSync(key, value)
      return true
    } catch (e) {
      return false
    }
  },
  removeRaw(key) {
    try {
      uni.removeStorageSync(key)
      return true
    } catch (e) {
      return false
    }
  }
}
