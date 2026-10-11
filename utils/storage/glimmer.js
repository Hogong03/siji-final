/**
 * 微光本（3.4 M2：慢恢复）— 每天一件「还行的小事」
 *
 * 存储策略：不分片 → storage key: siji_glimmers
 * 数据模型：每日至多一条，date（YYYY-MM-DD）即主键，同日覆盖；允许空（空 = 无记录）
 * 4.24.0 升级成果引擎：kind 字段（win=今日成果 / moment=还行的小事，老数据归一 moment）+
 * getGlimmerStats（连续天数 / 今日是否已记 / 晚间收尾问询条件）——
 * 行为口径不变：AI 收集不评判；统计只做可见反馈，不做打卡轰炸
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

/** kind 归一：老数据无 kind 字段视为 moment（4.25.1） */
function kindOf(g) {
  return (g && g.kind === 'win') ? 'win' : 'moment'
}

/** 获取全部微光/成果，按日期倒序；读侧统一补 kind（老数据归一 moment） */
export function getGlimmers() {
  return readAll()
    .filter(g => g && g.date)
    .map(g => (g.kind === 'win' || g.kind === 'moment') ? g : Object.assign({}, g, { kind: 'moment' }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
}

/** 获取某天的微光（同日可能 win+moment 两条，返回第一条） */
export function getGlimmerByDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return null
  return getGlimmers().find(g => g.date === date) || null
}

/**
 * 保存一条微光/成果；内容为空返回 null
 * 4.25.0：opts.kind —— 'win'（今日成果："完成了/看懂了/写完了 X"）| 'moment'（还行的小事，默认）
 * 4.25.1：主键从 date 改为 date+kind —— 成果和小事同日并存（白天记的成果不会被晚上记的小事顶掉），
 * 同日同 kind 仍覆盖；老数据（无 kind）读侧归一 moment，自然迁移
 */
export function saveGlimmer(content, opts = {}) {
  const text = String(content || '').trim().slice(0, 300)
  if (!text) return null
  const date = /^\d{4}-\d{2}-\d{2}$/.test((opts && opts.date) || '') ? opts.date : todayStr()
  const kind = (opts && opts.kind === 'win') ? 'win' : 'moment'
  const list = readAll()
  const idx = list.findIndex(g => g.date === date && kindOf(g) === kind)
  const rec = { id: date + ':' + kind, date, kind: kind, content: text, created_at: Date.now() }
  if (idx >= 0) list[idx] = rec
  else list.push(rec)
  asyncSetStorageJSON(GLIMMER_KEY, list)
  return rec
}

/**
 * 成果/微光统计（4.24.0，纯函数）：成果引擎的反馈数字
 *  - streakDays：连续记录天数（微光或成果都算）——今天没记时从昨天往回数，
 *    不把今天算断档（一天没结束就不算失败，防失败感铁律）
 *  - needWinPrompt：晚间收尾问询条件 —— 21 点后今天还没记，进入消息里该问了
 * @param {number} [now] 注入时间（测试用）
 * @returns {{ todayCount, streakDays, weekCount, needWinPrompt }}
 */
export function getGlimmerStats(now = Date.now()) {
  const list = getGlimmers()
  const dayMs = 86400000
  const dayKeyOf = (ts) => {
    const d = new Date(ts)
    const pad = n => String(n).padStart(2, '0')
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
  }
  const dates = new Set(list.map(g => g.date))
  const today = dayKeyOf(now)
  const todayCount = dates.has(today) ? 1 : 0

  let streakDays = 0
  let cursor = dates.has(today) ? today : dayKeyOf(now - dayMs)
  while (dates.has(cursor)) {
    streakDays++
    const d = new Date(cursor.replace(/-/g, '/'))
    cursor = dayKeyOf(d.getTime() - dayMs)
  }

  const min = dayKeyOf(now - 6 * dayMs)
  const weekCount = list.filter(g => g.date >= min).length

  const hour = new Date(now).getHours()
  const needWinPrompt = hour >= 21 && todayCount === 0

  return { todayCount: todayCount, streakDays: streakDays, weekCount: weekCount, needWinPrompt: needWinPrompt }
}

/** 删除：带 kind 只删该日该条；不带删该日全部（兼容 AI delete_glimmer {date} 旧调用） */
export function removeGlimmer(date, kind) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return
  const byKind = (kind === 'win' || kind === 'moment')
  asyncSetStorageJSON(GLIMMER_KEY, readAll().filter(g => {
    if (g.date !== date) return true
    if (!byKind) return false
    return kindOf(g) !== kind
  }))
}

/** 微光条数（可限近 N 天） */
export function countGlimmers(days) {
  const list = getGlimmers()
  if (!days) return list.length
  const min = todayStr(-(Math.min(Math.max(Number(days) || 30, 1), 365) - 1))
  return list.filter(g => g.date >= min).length
}
