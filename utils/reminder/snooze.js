/**
 * 提醒推迟（snooze）模块 — 「过会儿再响」（4.5.0）
 *
 * 存储键：siji_reminder_snoozed — { [fireKey]: { planId, fireAt, snoozedAt } }
 *
 * 语义（与 triggered 的分工）：
 *   - 推迟中的提醒【不】写 siji_reminders_triggered：到点由 scheduler 的 snooze 分支重新弹；
 *     用户选「打卡 / 查看计划」才算处理完（markTriggered + clearSnooze），当天不再打扰
 *   - 用户选「推迟」→ 覆写同 fireKey 的 fireAt，可连续推
 *   - 推迟期间杀进程：重启后 dueSnoozes 仍会命中（表在存储里），不丢提醒
 */
import { logger } from '../logger.js'
import { asyncSetStorageJSON } from './settings.js'

const STORAGE_KEY_SNOOZED = 'siji_reminder_snoozed'

function getSnoozedMap() {
  try {
    const raw = uni.getStorageSync(STORAGE_KEY_SNOOZED)
    if (raw) return typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch (e) { /* ignore */ }
  return {}
}

function saveMap(map) {
  asyncSetStorageJSON(STORAGE_KEY_SNOOZED, map)
}

/**
 * 推迟一条提醒：同 fireKey 覆写（可连续推）
 * @param {string} fireKey 调度层的触发键（planId 或 planId|YYYY-MM-DD）
 * @param {string} planId 计划 client_id（重响时要反查计划）
 * @param {number} minutes 推迟分钟数（最小 1）
 */
export function snoozeReminder(fireKey, planId, minutes, now = Date.now()) {
  if (!fireKey || !planId) return
  const min = Math.max(1, Number(minutes) || 5)
  const map = getSnoozedMap()
  map[fireKey] = { planId: planId, fireAt: now + min * 60 * 1000, snoozedAt: now }
  saveMap(map)
  logger.log(`[reminder] Snoozed ${fireKey} for ${min}min`)
}

/**
 * 还在推迟中的 fireKey 集合（未到点 + 已到点都算）：
 * 调度器用它跳过常规命中 —— 推迟已接管这条提醒，别两条路径同时弹
 */
export function getActiveSnoozeKeys() {
  return Object.keys(getSnoozedMap())
}

/**
 * 到点该重响的推迟条目（fireAt <= now），不删除 —— 处理完（打卡/查看）才 clear
 * 坏数据（缺字段）顺手清掉
 */
export function dueSnoozes(now = Date.now()) {
  const map = getSnoozedMap()
  const out = []
  let changed = false
  for (const key in map) {
    const item = map[key]
    if (!item || !item.planId || !item.fireAt) {
      delete map[key]
      changed = true
      continue
    }
    if (item.fireAt <= now) {
      out.push({ fireKey: key, planId: item.planId, fireAt: item.fireAt })
    }
  }
  if (changed) saveMap(map)
  return out
}

/** 处理完成：清掉推迟条目 */
export function clearSnooze(fireKey) {
  const map = getSnoozedMap()
  if (map[fireKey]) {
    delete map[fireKey]
    saveMap(map)
  }
}
