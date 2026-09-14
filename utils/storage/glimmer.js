/**
 * 微光本（3.4 M2：慢恢复）— 每天一件「还行的小事」
 *
 * 存储策略：不分片 → storage key: siji_glimmers
 * 数据模型：每日至多一条，date（YYYY-MM-DD）即主键，同日覆盖；允许空（空 = 无记录）
 * 行为口径：AI 主动捡拾（create_glimmer）只收集不评判；本模块不做打卡/连击/统计激励
 */
import { asyncSetStorageJSON } from '../store-helpers.js'

const GLIMMER_KEY = 'siji_glimmers'

function readAll() {
  try {
    const raw = uni.getStorageSync(GLIMMER_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

/** 今天（或偏移 N 天）日期 YYYY-MM-DD */
export function todayStr(offsetDays = 0) {
  const d = new Date(Date.now() + (Number(offsetDays) || 0) * 86400000)
  const pad = n => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

/** 获取全部微光，按日期倒序 */
export function getGlimmers() {
  return readAll()
    .filter(g => g && g.date)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
}

/** 获取某天的微光 */
export function getGlimmerByDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return null
  return getGlimmers().find(g => g.date === date) || null
}

/** 保存一条微光（同日覆盖），返回记录；内容为空返回 null */
export function saveGlimmer(content, opts = {}) {
  const text = String(content || '').trim().slice(0, 300)
  if (!text) return null
  const date = /^\d{4}-\d{2}-\d{2}$/.test((opts && opts.date) || '') ? opts.date : todayStr()
  const list = readAll()
  const idx = list.findIndex(g => g.date === date)
  const rec = { id: date, date, content: text, created_at: Date.now() }
  if (idx >= 0) list[idx] = rec
  else list.push(rec)
  asyncSetStorageJSON(GLIMMER_KEY, list)
  return rec
}

/** 删除某天的微光（物理删除，数据量小无需软删/撤销） */
export function removeGlimmer(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return
  asyncSetStorageJSON(GLIMMER_KEY, readAll().filter(g => g.date !== date))
}

/** 微光条数（可限近 N 天） */
export function countGlimmers(days) {
  const list = getGlimmers()
  if (!days) return list.length
  const min = todayStr(-(Math.min(Math.max(Number(days) || 30, 1), 365) - 1))
  return list.filter(g => g.date >= min).length
}
