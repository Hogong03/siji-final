/**
 * record-review.js — 记录回顾（4.2.0，纯函数）
 *
 * 市面方案的共识：记录写完不看等于没记。flomo 靠「每日回顾」把旧卡片推回眼前。
 * 这里做同一件事，不引入新机制：
 *   从「7 天前 / 30 天前 / 去年今日」三个时间窗各挑一条，最多 3 条
 *
 * 挑选规则：窗口内按「内容长度适中」优先（太短没信息、太长读不完），同窗口只取一条。
 */

const DAY = 24 * 60 * 60 * 1000

/** 三个回顾窗口 */
export const REVIEW_WINDOWS = [
  { key: 'week', label: '7 天前', days: 7, tolerance: 1 },
  { key: 'month', label: '30 天前', days: 30, tolerance: 2 },
  { key: 'year', label: '去年今日', days: 365, tolerance: 3 },
  { key: 'old', label: '更早', days: 0, tolerance: 0 }
]

/** 内容长度打分：30-160 字最舒服 */
function lengthScore(text) {
  const n = String(text || '').replace(/\s+/g, '').length
  if (n < 10) return 0
  if (n < 30) return 1
  if (n <= 160) return 3
  if (n <= 400) return 2
  return 1
}

/**
 * 挑几条旧记录来回顾
 * @param {Array} diaries 全部记录（含 created_at / title / content）
 * @param {number} [now]
 * @param {Object} [opts] { limit: 3, excludeId: '' }
 * @returns {Array<{ id, title, preview, why, createdAt }>}
 */
export function pickReviewRecords(diaries, now, opts) {
  const at = Number(now) || Date.now()
  const list = (Array.isArray(diaries) ? diaries : []).filter(d => d && d.is_deleted !== 1 && d.created_at)
  const limit = Number(opts && opts.limit) > 0 ? Number(opts.limit) : 3
  const excludeId = (opts && opts.excludeId) || ''
  const out = []
  const used = new Set()

  const windows = REVIEW_WINDOWS.filter(w => w.days > 0)
  for (const win of windows) {
    if (out.length >= limit) break
    const center = at - win.days * DAY
    let best = null
    let bestScore = -1
    for (const d of list) {
      if (used.has(d.client_id) || d.client_id === excludeId) continue
      const gap = Math.abs(d.created_at - center)
      if (gap > win.tolerance * DAY) continue
      const score = lengthScore(d.content) * 10 - Math.round(gap / DAY)
      if (score > bestScore) { best = d; bestScore = score }
    }
    if (best) {
      used.add(best.client_id)
      out.push({
        id: best.client_id,
        title: best.title || '',
        preview: String(best.content || '').replace(/\s+/g, ' ').slice(0, 60),
        why: win.label,
        createdAt: best.created_at
      })
    }
  }
  return out
}