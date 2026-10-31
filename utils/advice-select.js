/**
 * advice-select.js — 五层过滤的前三层（M3.1）
 *
 *   ① 依据校验：没有 evidence.ref 的候选直接丢
 *   ② 去重：同域只留分最高的一条；标题高相似（保守口径）只留一条
 *   ③ 冷却：同一 id 在冷却期内（曝光 7 天 / 拒绝 14 天 / 忽略 3 次 30 天）不出现
 *
 * 纯函数：cooldown 用注入的 isCoolingDown，测试可替。
 */

import { normalizeTitle, GENERIC_SUFFIXES } from './open-loops-rules.js'
import { isCoolingDown } from './advice-feedback.js'

/** 标题是否算同一件事（与开放事项同一口径：完全相同，或多出来的是通用后缀） */
function sameTitle(a, b) {
  const na = normalizeTitle(a)
  const nb = normalizeTitle(b)
  if (!na || !nb) return false
  if (na === nb) return true
  const [longer, shorter] = na.length >= nb.length ? [na, nb] : [nb, na]
  if (!longer.includes(shorter)) return false
  const extra = longer.replace(shorter, '')
  if (!extra) return true
  return GENERIC_SUFFIXES.some((s) => normalizeTitle(s) === extra)
}

/**
 * 过滤候选（不含能量与数量限制）
 * @param {Array} cands
 * @param {{ now?: number, coolingDown?: Function }} [opts]
 * @returns {{ items: Array, droppedNoRef: number, droppedDup: number, droppedCooldown: number }}
 */
export function filterCandidates(cands, opts = {}) {
  const now = Number.isFinite(opts.now) ? opts.now : Date.now()
  const cooling = typeof opts.coolingDown === 'function' ? opts.coolingDown : (id) => isCoolingDown(id, now)
  const list = Array.isArray(cands) ? cands.filter(Boolean) : []

  // ① 依据
  const withRef = list.filter((c) => c.evidence && c.evidence.ref)
  const droppedNoRef = list.length - withRef.length

  // ② 同域只留分最高
  const bestByDomain = new Map()
  for (const c of withRef) {
    const cur = bestByDomain.get(c.domain)
    if (!cur || (c.score || 0) > (cur.score || 0)) bestByDomain.set(c.domain, c)
  }
  const domainPicked = Array.from(bestByDomain.values())
  const droppedDomain = withRef.length - domainPicked.length

  // ②b 跨域标题相似（保守：只在明确同一件事时合并）
  const kept = []
  for (const c of domainPicked.sort((a, b) => (b.score || 0) - (a.score || 0))) {
    if (kept.some((k) => sameTitle(k.title, c.title))) continue
    kept.push(c)
  }
  const droppedDup = domainPicked.length - kept.length

  // ③ 冷却
  const available = kept.filter((c) => !cooling(c.id))
  const droppedCooldown = kept.length - available.length

  available.sort((a, b) => (b.score || 0) - (a.score || 0))

  return { items: available, droppedNoRef, droppedDup: droppedDomain + droppedDup, droppedCooldown }
}
