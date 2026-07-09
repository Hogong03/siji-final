/**
 * API Key 本地加密工具
 *
 * 策略：XOR + Base64 混淆（轻量，无需原生 API，全端兼容）
 * 不是密码学安全级别，但防止明文直接被读取
 *
 * 存储格式：enc:base64string
 * 解密时检测前缀 "enc:" 判断是否已加密
 */

const SECRET = 'siji_2026_xor_key_!@#'
const PREFIX = 'enc:'

function xorEncrypt(plain, key) {
  const result = []
  for (let i = 0; i < plain.length; i++) {
    result.push(String.fromCharCode(plain.charCodeAt(i) ^ key.charCodeAt(i % key.length)))
  }
  return result.join('')
}

function toBase64(str) {
  // uni-app 全端兼容的 Base64 编码
  // #ifdef H5
  return btoa(unescape(encodeURIComponent(str)))
  // #endif
  // #ifndef H5
  try {
    return uni.arrayBufferToBase64(
      new Uint8Array(Array.from(str).map(c => c.charCodeAt(0))).buffer
    )
  } catch (e) {
    return str // 降级：原样返回
  }
  // #endif
}

function fromBase64(b64) {
  // #ifdef H5
  return decodeURIComponent(escape(atob(b64)))
  // #endif
  // #ifndef H5
  try {
    const buf = uni.base64ToArrayBuffer(b64)
    return String.fromCharCode(...new Uint8Array(buf))
  } catch (e) {
    return b64 // 降级
  }
  // #endif
}

/**
 * 加密 API Key
 * @param {string} apiKey - 明文 API Key
 * @returns {string} 加密后的字符串（带 enc: 前缀）
 */
export function encryptKey(apiKey) {
  if (!apiKey) return ''
  try {
    const xored = xorEncrypt(apiKey, SECRET)
    return PREFIX + toBase64(xored)
  } catch (e) {
    return apiKey // 加密失败返回原文
  }
}

/**
 * 解密 API Key
 * @param {string} stored - 存储的值（可能是加密的或明文）
 * @returns {string} 明文 API Key
 */
export function decryptKey(stored) {
  if (!stored) return ''
  // 不是加密格式，说明是旧版明文数据，直接返回
  if (!stored.startsWith(PREFIX)) return stored
  try {
    const b64 = stored.slice(PREFIX.length)
    const xored = fromBase64(b64)
    return xorEncrypt(xored, SECRET) // XOR 是对称的
  } catch (e) {
    return stored // 解密失败返回原值
  }
}

/**
 * 加密整个 providerKeys 对象
 * @param {Object} keys - { deepseek: 'sk-xxx', openai: 'sk-yyy' }
 * @returns {string} 加密后的 JSON 字符串
 */
export function encryptKeys(keys) {
  const encrypted = {}
  for (const provider in keys) {
    if (keys[provider]) {
      encrypted[provider] = encryptKey(keys[provider])
    }
  }
  return JSON.stringify(encrypted)
}

/**
 * 解密整个 providerKeys 对象
 * @param {string} jsonStr - 存储的 JSON 字符串
 * @returns {Object} { deepseek: 'sk-xxx', openai: 'sk-yyy' }
 */
export function decryptKeys(jsonStr) {
  if (!jsonStr) return {}
  try {
    const obj = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr
    const decrypted = {}
    for (const provider in obj) {
      if (obj[provider]) {
        decrypted[provider] = decryptKey(obj[provider])
      }
    }
    return decrypted
  } catch (e) {
    // 解密失败，可能是旧版明文数据
    try {
      return typeof jsonStr === 'string' ? JSON.parse(jsonStr) : (jsonStr || {})
    } catch {
      return {}
    }
  }
}
