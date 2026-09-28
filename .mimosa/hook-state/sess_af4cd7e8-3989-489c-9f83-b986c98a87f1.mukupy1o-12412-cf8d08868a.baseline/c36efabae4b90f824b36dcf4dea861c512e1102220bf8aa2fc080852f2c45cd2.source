/**
 * read-config.js — 读网址配置与可用性裁决（3.6.0）
 *
 * 与 search-config.js 同一套裁决顺序：
 *   开关关闭 → 不可用；直连后端 → 免 Key 可用；需要 Key 的后端 → 独立 Key → 复用搜索的 Tavily Key → 不可用。
 *
 * 存储键：
 *   siji_read_enabled    'true' / 'false'（缺省视为开启）
 *   siji_read_backend    后端 id（缺省 direct）
 *   siji_read_key        独立 Key（enc2: 加密串）
 */
import { decryptKey, encryptKey } from '@/utils/crypto.js'
import { READ_BACKENDS, DEFAULT_READ_BACKEND, getReadBackend } from './read-adapters.js'
import { getOwnSearchKey } from './search-config.js'

export const READ_KEYS = {
  enabled: 'siji_read_enabled',
  backend: 'siji_read_backend',
  key: 'siji_read_key'
}

/** 读网址总开关（未写过配置视为开启） */
export function isReadEnabled() {
  const raw = uni.getStorageSync(READ_KEYS.enabled)
  if (raw === '' || raw === undefined || raw === null) return true
  return raw === true || raw === 'true'
}

export function setReadEnabled(on) {
  uni.setStorageSync(READ_KEYS.enabled, on ? 'true' : 'false')
}

export function getReadBackendId() {
  const raw = uni.getStorageSync(READ_KEYS.backend)
  return READ_BACKENDS[raw] ? raw : DEFAULT_READ_BACKEND
}

export function setReadBackend(id) {
  if (READ_BACKENDS[id]) uni.setStorageSync(READ_KEYS.backend, id)
  else uni.removeStorageSync(READ_KEYS.backend)
}

/** 独立 Key 明文（解密失败按未配置处理） */
export function getOwnReadKey() {
  const raw = uni.getStorageSync(READ_KEYS.key)
  if (!raw) return ''
  try { return decryptKey(raw) || '' } catch (e) { return '' }
}

export function setOwnReadKey(plain) {
  const value = String(plain || '').trim()
  if (!value) { uni.removeStorageSync(READ_KEYS.key); return }
  uni.setStorageSync(READ_KEYS.key, encryptKey(value))
}

export function hasOwnReadKey() {
  return !!getOwnReadKey()
}

/**
 * 裁决当前读网址配置
 * @returns {{ available:boolean, reason:string, backendId:string, backend:Object, key:string, source:string }}
 *   reason: ok | disabled | no_key    source: own | search | none
 */
export function resolveReadConfig() {
  const backendId = getReadBackendId()
  const backend = getReadBackend(backendId)

  if (!isReadEnabled()) {
    return { available: false, reason: 'disabled', backendId, backend, key: '', source: 'none' }
  }
  // 直连后端不需要 Key，开着就能用
  if (!backend.needsKey) {
    return { available: true, reason: 'ok', backendId, backend, key: '', source: 'none' }
  }
  const own = getOwnReadKey()
  if (own) return { available: true, reason: 'ok', backendId, backend, key: own, source: 'own' }

  const search = getOwnSearchKey()
  if (search) return { available: true, reason: 'ok', backendId, backend, key: search, source: 'search' }

  return { available: false, reason: 'no_key', backendId, backend, key: '', source: 'none' }
}

/** 读网址是否可用（agent-transport 的注入依据） */
export function isReadUrlAvailable() {
  return resolveReadConfig().available
}

/** 界面状态文案 */
export function readStatusText() {
  const cfg = resolveReadConfig()
  if (cfg.reason === 'disabled') return '已关闭'
  if (!cfg.available) return '未配置 Key，无法用第三方阅读'
  if (cfg.source === 'own') return '已配置（独立 Key）'
  if (cfg.source === 'search') return '已配置（复用搜索的 Tavily Key）'
  return '直连抓取（免 Key）'
}
