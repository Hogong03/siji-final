/**
 * advice-timing.js — 第四、五层：时机与节制（M3.2）
 *
 *   ④ 时机：very_low 不说；low 只说 1 条「不用使劲」的
 *   ⑤ 节制：2~3 条；不足下限就**不展示**（沉默是合法结果，禁止凑数）
 *
 * 2 条是「展示下限」而不是「必须推荐数」：够 2 条才弹，只有 1 条就不弹。
 * low 是唯一例外：0~1 条，且只留非任务类（记录/账单/环境这类轻动作）。
 */

import { getLastEnergy } from './energy-state.js'

export const MAX_DIRECTIONS = 3
export const MIN_DIRECTIONS = 2

/** 各能量档的展示口径 */
export const LIMITS = {
  very_low: { min: 0, max: 0, gentleOnly: false },
  low: { min: 1, max: 1, gentleOnly: true },
  medium: { min: MIN_DIRECTIONS, max: MAX_DIRECTIONS, gentleOnly: false },
  high: { min: MIN_DIRECTIONS, max: MAX_DIRECTIONS, gentleOnly: false }
}

/**
 * 从已过滤候选里挑出面板要展示的方向
 * @param {Array} cands 已过 ①~③ 的候选（按分排序）
 * @param {{ energy?: string }} [opts]
 * @returns {{ items: Array, reason: string, considered: number }}
 */
export function pickForPanel(cands, opts = {}) {
  const list = Array.isArray(cands) ? cands : []
  const energy = opts.energy || getLastEnergy()
  const limit = LIMITS[energy] || LIMITS.medium
  const considered = list.length

  if (limit.max === 0) return { items: [], reason: 'energy-very-low', considered }

  let pool = list
  if (limit.gentleOnly) pool = list.filter((c) => !c.taskLike)
  if (pool.length === 0) return { items: [], reason: limit.gentleOnly ? 'low-no-gentle' : 'no-candidate', considered }

  if (pool.length < limit.min) {
    // 不够下限：不弹。绝不为了凑数把下一档的候选拉进来
    return { items: [], reason: 'not-enough', considered }
  }

  return { items: pool.slice(0, limit.max), reason: 'ok', considered }
}
