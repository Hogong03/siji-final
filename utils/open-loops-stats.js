/**
 * open-loops-stats.js — 开放事项的弃用表与计数（M2，从 open-loops.js 拆出）
 *
 * 只做两件事：记住「用户点过不用了」的标题（7 天内不再问），以及记展示/接受/拒绝次数。
 * 三个数字是「误提取率」的唯一真值来源：rejected / shown。
 */
import { asyncSetStorageJSON } from './store-helpers.js'

export const LOOP_STATS_KEY = 'siji_loop_stats'
export const LOOP_DISMISS_KEY = 'siji_loop_dismissed'
/** 用户点「不用了」后，同一标题 7 天内不再问 */
export const DISMISS_TTL = 7 * 24 * 60 * 60 * 1000

function readJson(key, fallback) {
  try {
    const raw = uni.getStorageSync(key)
    return raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : fallback
  } catch (e) {
    return fallback
  }
}

function writeJson(key, value) {
  try { asyncSetStorageJSON(key, value) } catch (e) { /* 落盘失败不阻断对话 */ }
}

/** 用户点「不用了」 */
export function markDismissed(title, now = Date.now()) {
  const key = normalizeKey(title)
  if (!key) return
  const map = readJson(LOOP_DISMISS_KEY, {})
  map[key] = now
  writeJson(LOOP_DISMISS_KEY, map)
}

/** 7 天内是否已被拒绝过（同一标题不再问） */
export function isDismissed(title, now = Date.now()) {
  const key = normalizeKey(title)
  if (!key) return false
  const map = readJson(LOOP_DISMISS_KEY, {})
  const ts = Number(map[key] || 0)
  if (!ts) return false
  return now - ts <= DISMISS_TTL
}

function bumpStat(field, now = Date.now()) {
  const st = readJson(LOOP_STATS_KEY, { shown: 0, accepted: 0, rejected: 0, capacityBlocked: 0 })
  st[field] = (Number(st[field]) || 0) + 1
  st.last_at = now
  writeJson(LOOP_STATS_KEY, st)
}

export function recordShown(now) { bumpStat('shown', now) }
export function recordAccepted(now) { bumpStat('accepted', now) }
export function recordRejected(now) { bumpStat('rejected', now) }

export function getLoopStats() {
  return readJson(LOOP_STATS_KEY, { shown: 0, accepted: 0, rejected: 0, capacityBlocked: 0 })
}

/** 与规则层的 normalizeTitle 同口径，但不引它，避免统计依赖规则细节 */
function normalizeKey(title) {
  return String(title == null ? '' : title)
    .replace(/[\uff01-\uff5e]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[，。！？、；：""''（）【】《》…—\s~!?,.;:'"()\[\]<>]/g, '')
    .toLowerCase()
    .trim()
}
