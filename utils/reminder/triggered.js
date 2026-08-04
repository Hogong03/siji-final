/**
 * 提醒触发记录模块 — 持久化已触发提醒，防重复
 *
 * 存储键：siji_reminders_triggered
 */

import { asyncSetStorageJSON } from './settings.js'

const STORAGE_KEY_TRIGGERED = 'siji_reminders_triggered'

function getTriggeredMap() {
  try {
    const raw = uni.getStorageSync(STORAGE_KEY_TRIGGERED)
    if (raw) return typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch (e) { /* ignore */ }
  return {}
}

function markTriggered(planId) {
  const map = getTriggeredMap()
  map[planId] = Date.now()
  asyncSetStorageJSON(STORAGE_KEY_TRIGGERED, map)
}

function isTriggered(planId) {
  const map = getTriggeredMap()
  return !!map[planId]
}

function clearTriggered(planId) {
  const map = getTriggeredMap()
  delete map[planId]
  asyncSetStorageJSON(STORAGE_KEY_TRIGGERED, map)
}

/**
 * 清理超过 7 天的已触发记录
 */
export function cleanupTriggered() {
  const map = getTriggeredMap()
  const now = Date.now()
  let changed = false
  for (const k in map) {
    if (now - map[k] > 7 * 24 * 60 * 60 * 1000) {
      delete map[k]
      changed = true
    }
  }
  if (changed) asyncSetStorageJSON(STORAGE_KEY_TRIGGERED, map)
}

export { markTriggered, isTriggered, clearTriggered }
