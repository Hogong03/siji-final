/**
 * advice-feedback.js — 建议的曝光表与三态反馈（M3.2）
 *
 * 三态不能混：
 *   shown    弹过（冷却 7 天）
 *   ignored  弹过但没点（累计 3 次 → 冷却 30 天）
 *   rejected 明确点「不相关」（冷却 14 天）
 *
 * 存储：siji_advice_seen = { [id]: { shown, ignored, rejected, lastAt, rejectAt } }
 * 只记 id 级别的计数，不记内容 —— 内容在候选层可重建。
 */

export const ADVICE_SEEN_KEY = 'siji_advice_seen'
/** 沉默计数：有候选但没弹的原因分布（拦下多少、为什么拦） */
export const ADVICE_SILENCE_KEY = 'siji_advice_silence'

/** 冷却窗口（毫秒） */
export const COOLDOWN_SHOWN = 7 * 86400000
export const COOLDOWN_REJECTED = 14 * 86400000
export const COOLDOWN_IGNORED = 30 * 86400000
/** 忽略几次后进入长冷却 */
export const IGNORE_STRIKES = 3

function readAll() {
  try {
    const raw = uni.getStorageSync(ADVICE_SEEN_KEY)
    const o = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {}
    return o && typeof o === 'object' ? o : {}
  } catch (e) {
    return {}
  }
}

function writeAll(map) {
  try {
    // 只保留最近 200 个 id，避免无限增长
    const entries = Object.entries(map).sort((a, b) => (b[1].lastAt || 0) - (a[1].lastAt || 0)).slice(0, 200)
    uni.setStorageSync(ADVICE_SEEN_KEY, JSON.stringify(Object.fromEntries(entries)))
  } catch (e) { /* 落盘失败不影响本次展示 */ }
}

function bump(id, field, now) {
  if (!id) return
  const map = readAll()
  const cur = map[id] || { shown: 0, ignored: 0, rejected: 0, lastAt: 0, rejectAt: 0 }
  cur[field] = (Number(cur[field]) || 0) + 1
  cur.lastAt = now
  if (field === 'rejected') cur.rejectAt = now
  map[id] = cur
  writeAll(map)
}

export function recordShown(id, now = Date.now()) { bump(id, 'shown', now) }
export function recordIgnored(id, now = Date.now()) { bump(id, 'ignored', now) }
export function recordRejected(id, now = Date.now()) { bump(id, 'rejected', now) }
export function recordAccepted(id, now = Date.now()) { bump(id, 'accepted', now) }

/** 读一条的曝光记录 */
export function getSeen(id) {
  return readAll()[id] || null
}

/** 全部曝光记录（调试与统计用） */
export function getAllSeen() {
  return readAll()
}

/**
 * 该 id 现在是否还在冷却
 * 规则：拒绝 14 天 > 忽略满 3 次 30 天 > 普通曝光 7 天
 */
export function isCoolingDown(id, now = Date.now()) {
  const rec = getSeen(id)
  if (!rec) return false
  if (rec.rejectAt && now - rec.rejectAt < COOLDOWN_REJECTED) return true
  if ((Number(rec.ignored) || 0) >= IGNORE_STRIKES && now - (rec.lastAt || 0) < COOLDOWN_IGNORED) return true
  if (rec.lastAt && now - rec.lastAt < COOLDOWN_SHOWN) return true
  return false
}

/** 汇总：给验收指标用 */
export function getAdviceStats() {
  const map = readAll()
  const out = { ids: 0, shown: 0, accepted: 0, ignored: 0, rejected: 0 }
  for (const rec of Object.values(map)) {
    out.ids += 1
    out.shown += Number(rec.shown) || 0
    out.accepted += Number(rec.accepted) || 0
    out.ignored += Number(rec.ignored) || 0
    out.rejected += Number(rec.rejected) || 0
  }
  return out
}

export function clearAdviceSeen() {
  try { uni.removeStorageSync(ADVICE_SEEN_KEY) } catch (e) { /* ignore */ }
}

/**
 * 记一次「该弹但没弹」
 * reason 取自 advice-timing：not-enough / no-candidate / low-no-gentle / energy-very-low
 */
export function recordSilence(reason, now = Date.now()) {
  const key = String(reason || 'unknown')
  try {
    const raw = uni.getStorageSync(ADVICE_SILENCE_KEY)
    const map = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {}
    const rec = map[key] || { count: 0 }
    rec.count += 1
    rec.lastAt = now
    map[key] = rec
    uni.setStorageSync(ADVICE_SILENCE_KEY, JSON.stringify(map))
  } catch (e) { /* ignore */ }
}

export function getSilenceStats() {
  try {
    const raw = uni.getStorageSync(ADVICE_SILENCE_KEY)
    const map = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {}
    return map && typeof map === 'object' ? map : {}
  } catch (e) {
    return {}
  }
}
