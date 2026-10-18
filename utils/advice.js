/**
 * advice.js — 建议引擎（4.35.0）
 *
 * 打开应用时按「应用内容 + 当前时段 + 运行环境」给建议；
 * 三者任一变化（上下文签名变了）就值得重出 —— 见 utils/advice-context.js。
 *
 * 职责边界：
 *   - 本文件负责「取真实数据 → 归一到 snapshot → 调规则表 → 加门控」
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
import {
  getPlanList,
  getBillList,
  getMonthlyBudget,
  getDiariesBetween
} from './storage.js'
import { collectPlanAlerts } from './plan-alerts.js'
import { getAllRelations, getAllInteractions } from './relations.js'
import { getProfile } from './profile.js'
import { weekCheckinDays } from './plan-heatmap.js'
import {
  timeBucket,
  bucketLabel,
  isWeekend,
  ymdOf,
  buildAdviceSignature
} from './advice-context.js'
import { collectAdvice, pickAdviceFocus, ADVICE_LIMIT } from './advice-rules.js'

/** 门控状态存储键：{ day, count, lastTs, sig } */
export const ADVICE_STATE_KEY = 'siji_advice_state'

/** 一天最多自动弹几次 */
export const MAX_AUTO_PER_DAY = 2

/** 两次自动弹的最小间隔（3 小时）——防连续弹 */
export const MIN_GAP_MS = 3 * 60 * 60 * 1000

/** 人脉多久没联系算「久未联系」（天） */
export const RELATION_STALE_DAYS = 30

const DAY_MS = 24 * 60 * 60 * 1000

/** 本地月份 YYYY-MM */
function monthStrOf(now) {
  const d = new Date(now)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
}

/** 本地当天零点 */
function midnightOf(now) {
  const d = new Date(now)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/**
 * 从任意日期字段猜时间戳（关系 / 互动记录字段名不完全统一，做兼容探测）
 * 取不到返回 0 —— 调用方一律按「无数据」处理，不猜、不编。
 */
function tsOf(o) {
  if (!o) return 0
  const cands = [o.ts, o.time, o.date, o.created_at, o.updated_at, o.occurred_at, o.interaction_date]
  for (const c of cands) {
    if (typeof c === 'number' && c > 0) return c
    if (typeof c === 'string' && c) {
      const t = Date.parse(c.length <= 10 ? c + 'T00:00:00' : c)
      if (Number.isFinite(t)) return t
    }
  }
  return 0
}

/** 画像完整度百分比；拿不到结构返回 -1（规则据此跳过，避免误报 0%） */
function profilePctOf(getProfileFn) {
  try {
    const p = getProfileFn() || {}
    const cards = Array.isArray(p.cards) ? p.cards : []
    let filled = 0
    let total = 0
    for (const c of cards) {
      const fields = (c && c.fields) || {}
      for (const k of Object.keys(fields)) {
        total += 1
        const v = fields[k]
        const has = Array.isArray(v) ? v.length > 0 : (v != null && String(v).trim() !== '')
        if (has) filled += 1
      }
    }
    return total > 0 ? Math.round((filled / total) * 100) : -1
  } catch (e) {
    return -1
  }
}

/** 记账距今多少天（无账单返回 -1） */
function daysSinceLastBill(bills, now) {
  let latest = 0
  for (const b of Array.isArray(bills) ? bills : []) {
    const t = tsOf(b)
    if (t > latest) latest = t
  }
  if (!latest) return -1
  return Math.max(0, Math.floor((midnightOf(now) - midnightOf(latest)) / DAY_MS))
}

/** 人脉：久未联系的人数与最久者（取不到互动数据 → 0 人，规则不触发） */
function relationStaleOf(now, getRelationsFn, getInteractionsFn) {
  try {
    const rels = (getRelationsFn || getAllRelations)() || []
    if (!rels.length) return { total: 0, stale: 0, staleName: '', staleMaxDays: 0 }
    const lastByRel = {}
    const ints = (getInteractionsFn || getAllInteractions)() || []
    for (const it of ints) {
      const rid = it && (it.relation_id || it.relationId || it.rel_id)
      if (!rid) continue
      const t = tsOf(it)
      if (t > (lastByRel[rid] || 0)) lastByRel[rid] = t
    }
    const cutoff = midnightOf(now) - RELATION_STALE_DAYS * DAY_MS
    const stale = []
    for (const r of rels) {
      const id = r && (r.id || r.client_id)
      const own = tsOf(r)
      const last = Math.max(lastByRel[id] || 0, own || 0)
      if (!last) continue // 无任何时间线索 → 不判定
      if (last < cutoff) {
        stale.push({ name: String(r.name || '某人'), days: Math.floor((midnightOf(now) - midnightOf(last)) / DAY_MS) })
      }
    }
    stale.sort((a, b) => b.days - a.days)
    return {
      total: rels.length,
      stale: stale.length,
      staleName: stale.length ? stale[0].name : '',
      staleMaxDays: stale.length ? stale[0].days : 0
    }
  } catch (e) {
    return { total: 0, stale: 0, staleName: '', staleMaxDays: 0 }
  }
}

/**
 * 归一 snapshot（所有取数都走这里，失败一律退化成「没有这项数据」）
 * @param {number} now
 * @param {Object} env { aiReady, firstRun, offline, dark }
 * @param {Object} deps 可注入的取数函数（单测用）
 */
export function collectSnapshot(now = Date.now(), env = {}, deps = {}) {
  const getPlans = deps.plans || getPlanList
  const getBills = deps.bills || ((month) => getBillList(month))
  const getBudget = deps.budget || ((month) => getMonthlyBudget(month))
  const getDiaries = deps.diaries || ((from, to) => getDiariesBetween(from, to))
  const getProfileFn = deps.profile || getProfile
  const getRelations = deps.relations || getAllRelations
  const getInteractions = deps.interactions || getAllInteractions

  let plans = []
  try { plans = getPlans() || [] } catch (e) { plans = [] }

  let overdue = []
  let dueSoon = []
  try {
    const alerts = collectPlanAlerts(plans, now)
    overdue = alerts.overdue || []
    dueSoon = alerts.dueSoon || []
  } catch (e) { /* 计划预警失败按无预警处理 */ }

  let checkedToday = false
  try {
    const flags = weekCheckinDays(plans, now) || []
    const idx = (new Date(now).getDay() + 6) % 7 // 周一为 0
    checkedToday = !!flags[idx]
  } catch (e) { /* 打卡数据取不到按未打卡处理 */ }

  const liveTop = plans.filter((p) => p && p.is_deleted !== 1 && !p.parent_id &&
    (p.status === 0 || p.status === 1) && !p.frozen_at && !p.someday_at)

  const month = monthStrOf(now)
  let bills = []
  try { bills = getBills(month) || [] } catch (e) { bills = [] }
  let budget = 0
  try { budget = Number(getBudget(month)) || 0 } catch (e) { budget = 0 }
  let monthTotal = 0
  for (const b of bills) monthTotal += Number(b && b.amount) || 0

  let diaryWeek = 0
  let diaryToday = false
  try {
    const from = midnightOf(now) - 6 * DAY_MS
    const week = getDiaries(from, now) || []
    diaryWeek = week.length
    const todayMd = midnightOf(now)
    diaryToday = week.some((d) => tsOf(d) >= todayMd)
  } catch (e) { /* 记录取不到按无记录处理 */ }

  const rel = relationStaleOf(now, getRelations, getInteractions)
  const pct = profilePctOf(getProfileFn)

  return {
    bucket: timeBucket(now),
    bucketLabel: bucketLabel(timeBucket(now)),
    weekend: isWeekend(now),
    env: {
      aiReady: env.aiReady !== false,
      firstRun: !!env.firstRun,
      offline: !!env.offline,
      dark: !!env.dark
    },
    plans: {
      total: plans.length,
      active: liveTop.length,
      hasActive: liveTop.length > 0,
      overdue: overdue.length,
      overdueTopName: overdue.length ? overdue[0].name : '',
      overdueMaxDays: overdue.length ? overdue[0].lateDays : 0,
      dueToday: dueSoon.filter((a) => a.leftDays === 0).length,
      soonCount: dueSoon.length,
      soonMinDays: dueSoon.length ? dueSoon[0].leftDays : 0,
      checkedToday
    },
    diary: { today: diaryToday, week: diaryWeek },
    bill: {
      month: bills.length,
      monthTotal: Math.round(monthTotal * 100) / 100,
      budgetPct: budget > 0 ? Math.min(999, Math.round((monthTotal / budget) * 100)) : 0,
      lastDays: daysSinceLastBill(bills, now)
    },
    relation: rel,
    profile: { pct },
    empty: plans.length === 0 && bills.length === 0 && diaryWeek === 0 && !rel.total
  }
}

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
 * 生成一份完整建议（供面板渲染）
 * @param {{ now?: number, env?: Object, deps?: Object, limit?: number }} [opts]
 */
export function buildAdvice(opts = {}) {
  const now = Number.isFinite(opts.now) ? opts.now : Date.now()
  const env = opts.env || {}
  const snapshot = collectSnapshot(now, env, opts.deps || {})
  const items = collectAdvice(snapshot, { limit: opts.limit || ADVICE_LIMIT })
  return {
    ymd: ymdOf(now),
    bucket: snapshot.bucket,
    bucketLabel: snapshot.bucketLabel,
    weekend: snapshot.weekend,
    greeting: buildAdviceGreeting(now),
    focus: pickAdviceFocus(items),
    items,
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
