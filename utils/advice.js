/**
 * advice.js — 建议引擎（4.35.0）
 *
 * 打开应用时按「应用内容 + 当前时段 + 运行环境」给建议；
 * 三者任一变化（上下文签名变了）就值得重出 —— 见 utils/advice-context.js。
 *
 * 职责边界：
 *   - 本文件负责「调规则表 → 加门控」
 *   - 取数与归一（collectSnapshot）4.51.0 起平移到 utils/context-pack.js，
 *     由 advice 与情境包共用一份 —— 两处各算一遍必然对不上数字。
 *   - 规则与文案全在 utils/advice-rules.js（纯函数，可单测）
 *   - 呈现全在 components/advice/AdviceSheet.vue（只渲染与 emit，不读存储）
 *
 * 门控（沿用项目「少提示」口径）：
 *   - 开关关了（提示与提醒 → 建议）→ 永不自动弹
 *   - 每天第一次进来自动弹一次
 *   - 同一天内，签名变了（数据变了 / 跨时段 / 环境变了）且距上次 >= MIN_GAP_MS 才再弹
 *   - 一天最多自动弹 MAX_AUTO_PER_DAY 次
 *   - 手动打开不受门控限制
 *
 * 依赖 uni 存储（门控状态），但 snapshot 的取数可注入（deps），便于单测。
 * 日期相关一律用「本地日」口径，与 next-step / plan-summary 保持一致。
 */
import { collectSnapshot, RELATION_STALE_DAYS } from './context-pack.js'
import { timeBucket, ymdOf, buildAdviceSignature } from './advice-context.js'
import { collectAdvice, pickAdviceFocus, ADVICE_LIMIT } from './advice-rules.js'
import { buildCandidates } from './advice-candidates.js'
import { filterCandidates } from './advice-select.js'
import { pickForPanel } from './advice-timing.js'

/** 4.51.0：取数已平移，此处只做再导出，保持对外 API 不变（tests/advice.test.js 直接 import collectSnapshot） */
export { collectSnapshot, RELATION_STALE_DAYS }

/** 门控状态存储键：{ day, count, lastTs, sig } */
export const ADVICE_STATE_KEY = 'siji_advice_state'

/** 一天最多自动弹几次 */
export const MAX_AUTO_PER_DAY = 2

/** 两次自动弹的最小间隔（3 小时）——防连续弹 */
export const MIN_GAP_MS = 3 * 60 * 60 * 1000

/** 时段问候语 */
export function buildAdviceGreeting(now = Date.now()) {
  const b = timeBucket(now)
  if (b === 'dawn') return '这么早就醒了'
  if (b === 'morning') return '早上好'
  if (b === 'noon') return '中午好'
  if (b === 'afternoon') return '下午好'
  if (b === 'evening') return '晚上好'
  return '夜深了'
}

/**
 * 多来源候选 → 五层过滤 → 方向（M3）
 * 只返回最终要展示的 2~3 条；不足下限时 items 为空（沉默是合法结果）。
 * @param {{ snapshot?: Object, now?: number, loops?: Array, goals?: Array, energy?: string, coolingDown?: Function }} [opts]
 */
export function buildDirections(opts = {}) {
  const now = Number.isFinite(opts.now) ? opts.now : Date.now()
  const cands = buildCandidates(opts.snapshot || {}, { now, loops: opts.loops, goals: opts.goals })
  const filtered = filterCandidates(cands, { now, coolingDown: opts.coolingDown })
  const timing = pickForPanel(filtered.items, { energy: opts.energy })
  return {
    items: timing.items,
    reason: timing.reason,
    stats: {
      considered: cands.length,
      available: filtered.items.length,
      droppedNoRef: filtered.droppedNoRef,
      droppedDup: filtered.droppedDup,
      droppedCooldown: filtered.droppedCooldown
    }
  }
}

/**
 * 生成一份完整建议（供面板渲染）
 * @param {{ now?: number, env?: Object, deps?: Object, limit?: number }} [opts]
 */
export function buildAdvice(opts = {}) {
  const now = Number.isFinite(opts.now) ? opts.now : Date.now()
  const env = opts.env || {}
  const snapshot = collectSnapshot(now, env, opts.deps || {})
  const items = collectAdvice(snapshot, { limit: opts.limit || ADVICE_LIMIT })
  const dir = buildDirections({ snapshot, now, loops: opts.loops, goals: opts.goals, energy: opts.energy, coolingDown: opts.coolingDown })
  return {
    ymd: ymdOf(now),
    bucket: snapshot.bucket,
    bucketLabel: snapshot.bucketLabel,
    weekend: snapshot.weekend,
    greeting: buildAdviceGreeting(now),
    focus: pickAdviceFocus(items),
    items,
    directions: dir.items,
    directionsReason: dir.reason,
    directionsStats: dir.stats,
    env: snapshot.env,
    snapshot,
    signature: buildAdviceSignature({
      ymd: ymdOf(now),
      bucket: snapshot.bucket,
      env: snapshot.env,
      data: {
        planTotal: snapshot.plans.total,
        planOverdue: snapshot.plans.overdue,
        planDueToday: snapshot.plans.dueToday,
        planChecked: snapshot.plans.checkedToday,
        diaryWeek: snapshot.diary.week,
        diaryToday: snapshot.diary.today,
        billMonth: snapshot.bill.month,
        billBudgetPct: snapshot.bill.budgetPct,
        relationStale: snapshot.relation.stale,
        profilePct: snapshot.profile.pct,
        glimmerWeek: 0
      }
    })
  }
}

// ─── 门控（自动弹的节流）───

/** 读门控状态 */
export function readAdviceState() {
  try {
    const raw = uni.getStorageSync(ADVICE_STATE_KEY)
    const o = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null
    if (!o || typeof o !== 'object') return { day: '', count: 0, lastTs: 0, sig: '' }
    return {
      day: String(o.day || ''),
      count: Number(o.count) || 0,
      lastTs: Number(o.lastTs) || 0,
      sig: String(o.sig || '')
    }
  } catch (e) {
    return { day: '', count: 0, lastTs: 0, sig: '' }
  }
}

/** 记一次自动弹出 */
export function markAdviceShown(now = Date.now(), signature = '') {
  const day = ymdOf(now)
  const prev = readAdviceState()
  const count = prev.day === day ? prev.count + 1 : 1
  try {
    uni.setStorageSync(ADVICE_STATE_KEY, JSON.stringify({ day, count, lastTs: now, sig: String(signature || '') }))
  } catch (e) { /* 落盘失败不影响本次展示 */ }
}

/**
 * 该不该自动弹（纯判定，便于单测）
 * @param {{ now?: number, signature?: string, state?: Object, flagOn?: boolean }} opts
 * @returns {{ show: boolean, reason: string }}
 */
export function decideAutoShow(opts = {}) {
  const now = Number.isFinite(opts.now) ? opts.now : Date.now()
  const state = opts.state || { day: '', count: 0, lastTs: 0, sig: '' }
  const sig = String(opts.signature || '')
  if (opts.flagOn === false) return { show: false, reason: 'flag-off' }
  const day = ymdOf(now)
  // 新的一天：重置计数，直接给一次
  if (state.day !== day) return { show: true, reason: 'new-day' }
  // 同一天内签名没变 → 内容一样，不重复打扰
  if (sig && state.sig && sig === state.sig) return { show: false, reason: 'same-signature' }
  if (state.count >= MAX_AUTO_PER_DAY) return { show: false, reason: 'capped' }
  if (state.lastTs && now - state.lastTs < MIN_GAP_MS) return { show: false, reason: 'too-soon' }
  return { show: true, reason: 'changed' }
}

/** 组合判定：用当前状态与签名判一次 */
export function shouldShowAdvice(now, signature, flagOn) {
  return decideAutoShow({ now, signature, state: readAdviceState(), flagOn })
}
