/**
 * open-loops.js — 开放事项（M2）
 *
 * 装的是「提过但没定、定了但没做、做了但没收尾」的事：有主题、没有截止日、没有打卡。
 * 与计划的边界：有截止日/要打卡/有子任务 → 计划；只有主题 → 这里。
 *
 * 铁律：
 *   - 写入必须经过用户确认（createFromCandidate 只接受确认后的候选，不认识"自动落库"）
 *   - open 永不自动淘汰；满 200 条时拒绝新增，不丢数据
 *   - 状态转换只能来自用户操作（canTransition 白名单），不接受时间驱动
 *   - next_hint 只存用户明确说出的卡点，缺失就是空串，不编
 *
 * 存储：siji_open_loops（单数组，软删除）；统计：siji_loop_stats；弃用记录：siji_loop_dismissed
 */
import { asyncSetStorageJSON } from './store-helpers.js'
import {
  normalizeTitle,
  GENERIC_SUFFIXES,
  TITLE_MAX,
  HINT_MAX
} from './open-loops-rules.js'
import {
  LOOP_STATS_KEY,
  LOOP_DISMISS_KEY,
  DISMISS_TTL,
  markDismissed,
  isDismissed,
  recordShown,
  recordAccepted,
  recordRejected,
  getLoopStats,
  LOOP_EVICT_LOG_KEY,
  EVICT_LOG_MAX,
  appendEvictLog,
  getEvictLog
} from './open-loops-stats.js'

/** 弃用表与计数在 open-loops-stats.js；这里再导出，保持对外 API 一处 */
export {
  LOOP_STATS_KEY,
  LOOP_DISMISS_KEY,
  DISMISS_TTL,
  markDismissed,
  isDismissed,
  recordShown,
  recordAccepted,
  recordRejected,
  getLoopStats,
  LOOP_EVICT_LOG_KEY,
  EVICT_LOG_MAX,
  appendEvictLog,
  getEvictLog
}

export const LOOP_KEY = 'siji_open_loops'
export const LOOP_MAX = 200
export const EVIDENCE_MAX = 5

export const LOOP_STATUS = ['open', 'paused', 'done', 'dropped']

// ==================== 存储 ====================

function readAll() {
  try {
    const raw = uni.getStorageSync(LOOP_KEY)
    const list = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : []
    return Array.isArray(list) ? list.filter((x) => x && x.id) : []
  } catch (e) {
    return []
  }
}

function persist(list) {
  try {
    asyncSetStorageJSON(LOOP_KEY, list)
  } catch (e) { /* 落盘失败不阻断对话，下次再写 */ }
}

/** 未删除的全部事项 */
export function getAllLoops() {
  return readAll().filter((l) => l.is_deleted !== 1)
}

/** 按状态取 */
export function getLoopsByStatus(status) {
  return getAllLoops().filter((l) => l.status === status)
}

/** 未闭环事项：按最近提到倒序 */
export function getOpenLoops(limit = 20) {
  return getLoopsByStatus('open')
    .sort((a, b) => (b.last_at || 0) - (a.last_at || 0))
    .slice(0, Math.max(0, limit))
}

export function getLoopById(id) {
  return getAllLoops().find((l) => l.id === id) || null
}

// ==================== 合并判定 ====================

/**
 * 两条事项是否同一件
 * 只有两种算同一件：归一化后完全相同；或包含关系且多出来的只是通用后缀（项目/计划/一下…）。
 * 「学 Python」vs「学 Python 爬虫」多出的是具体主题 → 不合并，宁可留两条。
 */
export function isSameLoop(a, b) {
  const na = normalizeTitle(a && a.title)
  const nb = normalizeTitle(b && b.title)
  if (!na || !nb) return false
  if (na === nb) return true
  const [longer, shorter] = na.length >= nb.length ? [na, nb] : [nb, na]
  if (!longer.includes(shorter)) return false
  const extra = longer.replace(shorter, '')
  if (!extra) return true
  return GENERIC_SUFFIXES.some((s) => normalizeTitle(s) === extra)
}

/** 在现有事项里找可合并目标（只看未删除） */
export function findMergeTarget(candidate, loops = getAllLoops()) {
  return loops.find((l) => isSameLoop(l, candidate)) || null
}

// ==================== 状态机 ====================

const TRANSITIONS = {
  open: ['paused', 'done', 'dropped'],
  paused: ['open', 'done', 'dropped'],
  done: ['open'],
  dropped: ['open']
}

/** 状态转换是否合法（同状态视为无需转换，返回 false） */
export function canTransition(from, to) {
  if (!LOOP_STATUS.includes(from) || !LOOP_STATUS.includes(to)) return false
  if (from === to) return false
  return (TRANSITIONS[from] || []).includes(to)
}

/**
 * 改状态（用户明确操作后调用）
 * @param {string} id
 * @param {string} to
 * @param {{ now?: number }} [opts]
 * @returns {{ ok: boolean, loop?: Object, reason?: string }}
 */
export function transitionLoop(id, to, opts = {}) {
  const now = Number.isFinite(opts.now) ? opts.now : Date.now()
  const list = readAll()
  const idx = list.findIndex((l) => l.id === id && l.is_deleted !== 1)
  if (idx < 0) return { ok: false, reason: 'not-found' }
  const cur = list[idx]
  if (!canTransition(cur.status, to)) return { ok: false, reason: 'illegal-transition' }
  const next = Object.assign({}, cur, { status: to, last_at: now })
  if (to === 'open') next.reopened_at = now
  list[idx] = next
  persist(list)
  return { ok: true, loop: next }
}

/** 改标题 / 进度线索 / 关联计划（状态不在这里改） */
export function updateLoopFields(id, patch = {}, now = Date.now()) {
  const list = readAll()
  const idx = list.findIndex((l) => l.id === id && l.is_deleted !== 1)
  if (idx < 0) return { ok: false, reason: 'not-found' }
  const cur = list[idx]
  const next = Object.assign({}, cur)
  if (typeof patch.title === 'string' && patch.title.trim()) next.title = patch.title.trim().slice(0, TITLE_MAX)
  if (typeof patch.next_hint === 'string') next.next_hint = patch.next_hint.trim().slice(0, HINT_MAX)
  if (typeof patch.plan_id === 'string') next.plan_id = patch.plan_id
  if (patch.kind && ['idea', 'topic', 'plan', 'commitment'].includes(patch.kind)) next.kind = patch.kind
  next.last_at = now
  // 改标题可能撞上已有事项 —— 交给调用方决定，这里只落库
  list[idx] = next
  persist(list)
  return { ok: true, loop: next }
}

/** 软删除 */
export function softDeleteLoop(id, now = Date.now()) {
  const list = readAll()
  const idx = list.findIndex((l) => l.id === id)
  if (idx < 0) return { ok: false, reason: 'not-found' }
  list[idx] = Object.assign({}, list[idx], { is_deleted: 1, deleted_at: now })
  persist(list)
  return { ok: true }
}

// ==================== 容量 ====================

/** 淘汰优先级：已放下 → 已完成 → 已暂停（各自按 last_at 从旧到新）；open 永不淘汰 */
const EVICT_ORDER = ['dropped', 'done', 'paused']

/**
 * 为一次新增腾位
 * @returns {{ ok: true, evictIds: string[] } | { ok: false, reason: 'capacity' }}
 */
export function planCapacity(loops, max = LOOP_MAX) {
  const alive = (Array.isArray(loops) ? loops : []).filter((l) => l && l.is_deleted !== 1)
  if (alive.length < max) return { ok: true, evictIds: [] }
  const need = alive.length - max + 1
  const evictIds = []
  for (const status of EVICT_ORDER) {
    const pool = alive.filter((l) => l.status === status).sort((a, b) => (a.last_at || 0) - (b.last_at || 0))
    for (const l of pool) {
      if (evictIds.length >= need) break
      evictIds.push(l.id)
    }
    if (evictIds.length >= need) break
  }
  if (evictIds.length < need) return { ok: false, reason: 'capacity' }
  return { ok: true, evictIds }
}

// ==================== 写入（确认后） ====================

function makeId(now) {
  return `loop_${now}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 用户确认后落库
 * @param {{ title, kind, quote, hint, idem, conversation_id }} cand
 * @param {{ now?: number }} [opts]
 * @returns {{ ok: boolean, created?: boolean, merged?: boolean, duplicate?: boolean, loop?: Object, reason?: string }}
 */
export function createFromCandidate(cand, opts = {}) {
  const now = Number.isFinite(opts.now) ? opts.now : Date.now()
  const title = String((cand && cand.title) || '').trim()
  if (!title) return { ok: false, reason: 'empty-title' }
  const list = readAll()
  const alive = list.filter((l) => l.is_deleted !== 1)

  // 幂等：同一个候选（同一轮、同一标题）连点两次只算一次
  if (cand.idem) {
    const dup = alive.find((l) => l.idem === cand.idem)
    if (dup) {
      // 用户点了「改一下」再确认：同一候选只更新标题，不新建第二条
      if (title && normalizeTitle(title) !== normalizeTitle(dup.title)) {
        const r = updateLoopFields(dup.id, { title }, now)
        if (r.ok) return { ok: true, duplicate: true, loop: r.loop }
      }
      return { ok: true, duplicate: true, loop: dup }
    }
  }

  const evidence = { quote: String(cand.quote || title).slice(0, 120), conversation_id: cand.conversation_id || '', at: now }

  // 合并：已有同一件事 → 累加提及，不新建
  const target = alive.find((l) => isSameLoop(l, { title }))
  if (target) {
    const idx = list.findIndex((l) => l.id === target.id)
    const ev = Array.isArray(target.evidence) ? target.evidence.slice() : []
    ev.push(evidence)
    const merged = Object.assign({}, target, {
      touches: (target.touches || 1) + 1,
      last_at: now,
      evidence: ev.slice(-EVIDENCE_MAX),
      next_hint: (cand.hint && String(cand.hint).trim()) || target.next_hint || ''
    })
    if (cand.idem) merged.idem = cand.idem
    list[idx] = merged
    persist(list)
    return { ok: true, merged: true, loop: merged }
  }

  // 容量
  const cap = planCapacity(alive)
  if (!cap.ok) return { ok: false, reason: 'capacity' }
  let nextList = list
  if (cap.evictIds.length) {
    // 先记日志再删：至少能追溯被淘汰的是哪一条、什么状态、什么时候
    appendEvictLog(list.filter((l) => cap.evictIds.includes(l.id)), now)
    nextList = list.map((l) => (cap.evictIds.includes(l.id) ? Object.assign({}, l, { is_deleted: 1, deleted_at: now }) : l))
  }

  const loop = {
    id: makeId(now),
    kind: ['idea', 'topic', 'plan', 'commitment'].includes(cand.kind) ? cand.kind : 'idea',
    title: title.slice(0, TITLE_MAX),
    status: 'open',
    evidence: [evidence],
    first_at: now,
    last_at: now,
    touches: 1,
    next_hint: String(cand.hint || '').trim().slice(0, HINT_MAX),
    plan_id: '',
    idem: cand.idem || '',
    is_deleted: 0
  }
  nextList = nextList.concat([loop])
  persist(nextList)
  return { ok: true, created: true, loop }
}

