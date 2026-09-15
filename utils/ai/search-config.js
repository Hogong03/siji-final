/**
 * search-config.js — 联网搜索配置与可用性裁决（3.5.18）
 *
 * 联网搜索不再由聊天厂商决定，改为「搜索后端 + 独立开关 + 独立 Key」三件套：
 *   1. 显式配置的搜索 Key（加密存储，见 crypto.js）
 *   2. 回落复用同名 AI 厂商 Key（智谱用户零配置继续可用）
 *
 * 可用性裁决顺序：开关关闭 → 不可用；有独立 Key → 可用；有同名厂商 Key → 可用；否则不可用。
 * 依据此结果，agent-transport 的 buildToolList 决定是否把 web_search 注给模型。
 *
 * 存储键：
 *   siji_web_search_enabled  'true' / 'false'（缺省视为开启）
 *   siji_web_search_backend  后端 id（缺省 zhipu）
 *   siji_web_search_key      独立 Key（enc2: 加密串）
 */
import { decryptKey, encryptKey } from '@/utils/crypto.js'
import { getProviderKeys } from './providers.js'
import { SEARCH_BACKENDS, DEFAULT_SEARCH_BACKEND, getSearchBackend } from './search-adapters.js'

export const SEARCH_KEYS = {
  enabled: 'siji_web_search_enabled',
  backend: 'siji_web_search_backend',
  key: 'siji_web_search_key'
}

/** 搜索总开关（未写过配置视为开启，但没 Key 时依然不可用） */
export function isSearchEnabled() {
  const raw = uni.getStorageSync(SEARCH_KEYS.enabled)
  if (raw === '' || raw === undefined || raw === null) return true
  return raw === true || raw === 'true'
}

export function setSearchEnabled(on) {
  uni.setStorageSync(SEARCH_KEYS.enabled, on ? 'true' : 'false')
}

/** 当前后端 id（非法值回落默认） */
export function getSearchBackendId() {
  const raw = uni.getStorageSync(SEARCH_KEYS.backend)
  return SEARCH_BACKENDS[raw] ? raw : DEFAULT_SEARCH_BACKEND
}

export function setSearchBackend(id) {
  if (SEARCH_BACKENDS[id]) {
    uni.setStorageSync(SEARCH_KEYS.backend, id)
  } else {
    uni.removeStorageSync(SEARCH_KEYS.backend)
  }
}

/** 读取独立搜索 Key 明文（解密失败按未配置处理） */
export function getOwnSearchKey() {
  const raw = uni.getStorageSync(SEARCH_KEYS.key)
  if (!raw) return ''
  try {
    return decryptKey(raw) || ''
  } catch {
    return ''
  }
}

/** 写入独立搜索 Key（空值即清除） */
export function setOwnSearchKey(plain) {
  const value = String(plain || '').trim()
  if (!value) {
    uni.removeStorageSync(SEARCH_KEYS.key)
    return
  }
  uni.setStorageSync(SEARCH_KEYS.key, encryptKey(value))
}

/** 是否配置了独立 Key（界面判断显示「清除」用） */
export function hasOwnSearchKey() {
  return !!getOwnSearchKey()
}

/**
 * 裁决当前搜索配置
 * @returns {{available:boolean, reason:string, backendId:string, backend:Object, key:string, source:string}}
 *   reason: ok | disabled | no_key
 *   source: own（独立 Key）| provider（复用同名 AI 厂商 Key）| none
 */
export function resolveSearchConfig() {
  const backendId = getSearchBackendId()
  const backend = getSearchBackend(backendId)

  if (!isSearchEnabled()) {
    return { available: false, reason: 'disabled', backendId, backend, key: '', source: 'none' }
  }

  const own = getOwnSearchKey()
  if (own) {
    return { available: true, reason: 'ok', backendId, backend, key: own, source: 'own' }
  }

  if (backend.providerId) {
    const providerKeys = getProviderKeys()
    const reused = providerKeys[backend.providerId] || ''
    if (reused) {
      return { available: true, reason: 'ok', backendId, backend, key: reused, source: 'provider' }
    }
  }

  return { available: false, reason: 'no_key', backendId, backend, key: '', source: 'none' }
}

/** 联网搜索是否可用（agent-transport 的注入依据） */
export function isWebSearchAvailable() {
  return resolveSearchConfig().available
}

/** 界面用状态文案 */
export function searchStatusText() {
  const cfg = resolveSearchConfig()
  if (cfg.available) {
    return cfg.source === 'own' ? '已配置（独立 Key）' : '已配置（复用 AI 厂商 Key）'
  }
  if (cfg.reason === 'disabled') return '已关闭'
  return '未配置 Key，无法联网'
}