/**
 * API Key 安全存储模块
 *
 * 使用简单的异或+Base64 混淆存储，防止 Storage 直接可见明文。
 * 不是加密学级别的安全——真要防反编译需要原生插件 + Keychain/Keystore。
 * 但比裸存 Storage 强：至少 ls Storage 看不到 Key。
 */

const OBFUSCATE_SALT = 'siji_2024_salt_key'

/** 简单异或混淆 */
function xorEncode(plain, salt) {
  const result = []
  for (let i = 0; i < plain.length; i++) {
    result.push(
      String.fromCharCode(
        plain.charCodeAt(i) ^ salt.charCodeAt(i % salt.length)
      )
    )
  }
  return result.join('')
}

/** Base64 编码（兼容 uni-app） */
function toBase64(str) {
  try {
    // #ifdef H5
    return btoa(unescape(encodeURIComponent(str)))
    // #endif
    // #ifndef H5
    return uni.arrayBufferToBase64(
      new TextEncoder().encode(str).buffer
    )
    // #endif
  } catch {
    return str
  }
}

/** Base64 解码 */
function fromBase64(b64) {
  try {
    // #ifdef H5
    return decodeURIComponent(escape(atob(b64)))
    // #endif
    // #ifndef H5
    const buf = uni.base64ToArrayBuffer(b64)
    return new TextDecoder().decode(buf)
    // #endif
  } catch {
    return b64
  }
}

/** 加密存储 Key */
export function saveApiKey(providerId, apiKey) {
  if (!apiKey) {
    removeApiKey(providerId)
    return
  }
  const encoded = toBase64(xorEncode(apiKey, OBFUSCATE_SALT))
  const keys = getAllKeys(true)
  keys[providerId] = encoded
  uni.setStorageSync('siji_provider_keys', JSON.stringify(keys))
}

/** 读取解密后的 Key */
export function getApiKey(providerId) {
  const keys = getAllKeys(true)
  const encoded = keys[providerId]
  if (!encoded) return ''
  try {
    return xorEncode(fromBase64(encoded), OBFUSCATE_SALT)
  } catch {
    // 解密失败，可能是旧版明文数据，直接返回
    return encoded
  }
}

/** 删除 Key */
export function removeApiKey(providerId) {
  const keys = getAllKeys(true)
  delete keys[providerId]
  uni.setStorageSync('siji_provider_keys', JSON.stringify(keys))
}

/** 获取所有 Key（原始存储格式） */
function getAllKeys(raw = false) {
  try {
    return JSON.parse(uni.getStorageSync('siji_provider_keys') || '{}')
  } catch {
    return {}
  }
}

/** 检查是否有旧版明文 Key，自动迁移 */
export function migratePlainTextKeys() {
  try {
    const raw = uni.getStorageSync('siji_provider_keys')
    if (!raw) return
    const keys = JSON.parse(raw)
    let migrated = false
    for (const [providerId, value] of Object.entries(keys)) {
      // 如果值不是 Base64 编码的（即明文），则加密存储
      if (value && !value.match(/^[A-Za-z0-9+/=]+$/) || value.startsWith('sk-')) {
        saveApiKey(providerId, value)
        migrated = true
      }
    }
    if (migrated) {
      console.log('[api-key-store] 明文 Key 已迁移为混淆存储')
    }
  } catch {
    // ignore
  }
}

/** 获取所有已配置的厂商 ID */
export function getConfiguredProviders() {
  const keys = getAllKeys(true)
  return Object.keys(keys).filter(id => keys[id])
}
