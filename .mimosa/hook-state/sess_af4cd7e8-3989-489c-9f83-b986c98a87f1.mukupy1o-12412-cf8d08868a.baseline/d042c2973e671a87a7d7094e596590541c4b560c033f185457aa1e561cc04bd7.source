/**
 * API Key 本地加密工具（F1 升级）
 *
 * 分级方案（纯客户端无法做到密码学安全，防的是"明文直接可读"）：
 * - 新格式 enc2: 每把 Key 独立随机盐 + 链式密钥流 XOR + FNV-1a 完整性校验
 *   （同明文每次密文不同；校验和防篡改/防误判）
 * - 旧格式 enc:  兼容读取（v2.2.13 及之前写入的 XOR+Base64）
 * - 明文：       兼容读取（更早版本直接存储）
 *
 * 说明：真正的安全需要服务端网关（Key 不进客户端），本模块负责把
 * 本地存储从"可被一键还原"升级为"需还原算法 + 校验"的混淆层。
 *
 * 存储格式：enc2:<salt><ciphertext-b64><checksum-hex>
 */

import { logger } from './logger.js'

const SECRET = 'siji_2026_xor_key_!@#'
const PREFIX = 'enc2:'
const PREFIX_LEGACY = 'enc:'
const SALT_LEN = 8
const FNV_OFFSET = 0x811C9DC5
const SALT_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'

// ==================== 基础工具 ====================

/** FNV-1a 32 位哈希 */
function fnv1a(str, seed) {
  let h = (seed === undefined ? FNV_OFFSET : seed) >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/** 随机盐（去易混淆字符） */
function randomSalt(len) {
  let s = ''
  for (let i = 0; i < len; i++) {
    s += SALT_CHARS[Math.floor(Math.random() * SALT_CHARS.length)]
  }
  return s
}

/** 由 SECRET + 盐派生种子 */
function deriveSeed(salt) {
  return fnv1a(SECRET + '#' + salt + '#siji', fnv1a(salt + '#' + SECRET, FNV_OFFSET))
}

/** 生成字节级密钥流 */
function buildKeystream(seed, length) {
  const ks = []
  let state = seed >>> 0
  for (let i = 0; i < length; i++) {
    state = fnv1a(String(i) + ':' + state, FNV_OFFSET) >>> 0
    ks.push(state & 0xff)
  }
  return ks
}

// ==================== Base64（全端兼容） ====================

function toBase64(str) {
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

// ==================== enc2: 新方案 ====================

/** 是否为可安全加密的 ASCII 文本（API Key 均为可打印 ASCII） */
function isAsciiPrintable(plain) {
  for (let i = 0; i < plain.length; i++) {
    const c = plain.charCodeAt(i)
    if (c < 0x20 || c > 0x7E) return false
  }
  return true
}

function encryptV2(plain) {
  const salt = randomSalt(SALT_LEN)
  const seed = deriveSeed(salt)
  const ks = buildKeystream(seed, plain.length)
  let xored = ''
  for (let i = 0; i < plain.length; i++) {
    xored += String.fromCharCode(plain.charCodeAt(i) ^ ks[i])
  }
  const checksum = fnv1a(plain, seed).toString(16).padStart(8, '0')
  return PREFIX + salt + toBase64(xored) + checksum
}

function decryptV2(payload) {
  // payload = salt + b64 + checksum(8)
  const salt = payload.substring(0, SALT_LEN)
  const checksum = payload.substring(payload.length - 8)
  const b64 = payload.substring(SALT_LEN, payload.length - 8)
  const xored = fromBase64(b64)
  const seed = deriveSeed(salt)
  const ks = buildKeystream(seed, xored.length)
  let plain = ''
  for (let i = 0; i < xored.length; i++) {
    plain += String.fromCharCode(xored.charCodeAt(i) ^ ks[i])
  }
  // 完整性校验：校验和不匹配说明密文被改动或解密失败
  const calc = fnv1a(plain, seed).toString(16).padStart(8, '0')
  if (calc !== checksum) {
    logger.warn('[crypto] enc2 校验和不匹配，判定解密失败')
    return ''
  }
  return plain
}

// ==================== 旧方案（enc: 兼容读取） ====================

function xorEncrypt(plain, key) {
  const result = []
  for (let i = 0; i < plain.length; i++) {
    result.push(String.fromCharCode(plain.charCodeAt(i) ^ key.charCodeAt(i % key.length)))
  }
  return result.join('')
}

function decryptLegacy(b64) {
  const xored = fromBase64(b64)
  const decrypted = xorEncrypt(xored, SECRET) // XOR 是对称的
  // 合法性校验：API Key 应为可打印 ASCII
  for (let i = 0; i < decrypted.length; i++) {
    const c = decrypted.charCodeAt(i)
    if (c < 0x20 || c > 0x7E) {
      logger.warn('[crypto] 旧格式解密结果含非可打印字符，判定解密失败，返回空')
      return ''
    }
  }
  return decrypted
}

// ==================== 公开入口 ====================

/**
 * 加密 API Key
 * @param {string} apiKey - 明文 API Key
 * @returns {string} 加密后的字符串（enc2: 前缀，旧格式 enc: 可兼容读取）
 */
export function encryptKey(apiKey) {
  if (!apiKey) return ''
  // 非 ASCII（罕见）走旧 XOR 方案，避免字节截断损坏
  if (!isAsciiPrintable(apiKey)) {
    try {
      return PREFIX_LEGACY + toBase64(xorEncrypt(apiKey, SECRET))
    } catch { /* fallthrough */ }
  }
  try {
    return encryptV2(apiKey)
  } catch (e) {
    return apiKey // 加密失败返回原文
  }
}

/**
 * 解密 API Key（兼容 enc2: 新格式 / enc: 旧格式 / 明文）
 * @param {string} stored - 存储的值
 * @returns {string} 明文 API Key
 */
export function decryptKey(stored) {
  if (!stored) return ''
  // 不是加密格式，说明是旧版明文数据，直接返回
  if (!stored.startsWith(PREFIX) && !stored.startsWith(PREFIX_LEGACY)) return stored
  try {
    if (stored.startsWith(PREFIX)) {
      const plain = decryptV2(stored.slice(PREFIX.length))
      return validatePlain(plain)
    }
    const b64 = stored.slice(PREFIX_LEGACY.length)
    return decryptLegacy(b64)
  } catch (e) {
    logger.warn('[crypto] 解密异常:', e)
    return '' // 解密失败返回空，不返回乱码
  }
}

/** 校验明文合法性（可打印 ASCII） */
function validatePlain(plain) {
  if (!plain) return ''
  for (let i = 0; i < plain.length; i++) {
    const c = plain.charCodeAt(i)
    if (c < 0x20 || c > 0x7E) {
      logger.warn('[crypto] 解密结果含非可打印字符，判定解密失败，返回空')
      return ''
    }
  }
  return plain
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