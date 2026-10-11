/**
 * week-focus.js — 本周唯一焦点（4.27.0）
 *
 * 画像药方：「每周定一个焦点，对抗摊大饼与『以后再说』」。
 * 周一简报给「定本周焦点」按钮 → AI 收下存这里；周内对话可提醒；
 * 下周周报对照（上周焦点推进了没）。
 *
 * 存储：siji_week_focus = { weekKey, text, updated_at }
 * weekKey = 本周周一的 YYYY-MM-DD（与提醒/周报同一周界口径）
 */
import { weekRangeTsOf } from './plan-recur.js'

const KEY = 'siji_week_focus'

/** 本周 key（本周周一 YYYY-MM-DD） */
export function focusWeekKeyOf(now = Date.now()) {
  const d = new Date(weekRangeTsOf(now).weekStart)
  const pad = n => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

function readRaw() {
  try {
    const raw = uni.getStorageSync(KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

/** 读取本周焦点记录：{ text, weekKey, isCurrent }；本周没定返回 null（isCurrent=false 表示存的是往周） */
export function getWeekFocus(now = Date.now()) {
  const raw = readRaw()
  if (!raw || !raw.text) return null
  const wk = focusWeekKeyOf(now)
  return {
    text: String(raw.text).slice(0, 60),
    weekKey: raw.weekKey || '',
    isCurrent: raw.weekKey === wk
  }
}

/** 保存本周焦点（覆盖式：一周一条） */
export function setWeekFocus(text, now = Date.now()) {
  const t = String(text || '').trim().slice(0, 60)
  if (!t) return null
  const rec = { weekKey: focusWeekKeyOf(now), text: t, updated_at: now }
  uni.setStorageSync(KEY, JSON.stringify(rec))
  return rec
}
