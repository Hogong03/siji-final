/**
 * context-pack.js — 情境包（4.51.0 / M1）
 *
 * 解决的问题：一次对话要注入 10 段上下文，每段自己取数、自己决定要不要注入，
 * 没有任何一处回答「这一轮 AI 到底知道什么」。本文件把取数收敛成一份 packet，
 * 再渲染成一段 ≤300 字的【当前情境】，固定注入 system 末尾。
 *
 * 边界（不要越界）：
 *   - 只聚合，不新增存储、不改任何领域取数口径
 *   - collectSnapshot 从 advice.js 平移过来，语义逐字保留 —— advice 的输出必须不受影响
 *   - 只陈述事实：不出现「应该 / 建议 / 需要 / 还没」这类推断或催促词
 *   - 零数据返回空串（调用方据此跳过注入）
 *
 * 缓存：M1 不做缓存。每次对话多读一次 plan_all / 账单 / 记录 / 人脉，H5 实测若 P95 超过 5ms
 * 再加「按数据指纹失效」的缓存 —— 单纯 TTL 会让测试之间串数据（同一天同一时段读到的可能是
 * 上一个用例的库），得不偿失。
 */

import { getPlanList, getBillList, getMonthlyBudget, getDiariesBetween } from './storage.js'
import { collectPlanAlerts } from './plan-alerts.js'
import { getAllRelations, getAllInteractions } from './relations.js'
import { getProfile } from './profile.js'
import { getOpenLoops } from './open-loops.js'
import { weekCheckinDays } from './plan-heatmap.js'
import { timeBucket, bucketLabel, isWeekend } from './advice-context.js'

/** 人脉多久没联系算「久未联系」（天）——与 advice 同一口径，别各写一份 */
export const RELATION_STALE_DAYS = 30

/** 情境包渲染后的硬上限（字符，含标题） */
export const CONTEXT_PACK_MAX_CHARS = 300

/** 画像里代表「长期方向」的字段，按优先级取前两个 */
const GOAL_FIELDS = ['职业方向', '人生关键词', '当前阶段']
const GOAL_MAX_CHARS = 40

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
 * 4.35.0 起在 advice.js；4.51.0 平移到本文件，advice.js 改为 re-export —— 语义不变。
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

// ==================== 情境包 ====================

/** 未闭环事项：最多 3 条，带「悬了几天」；open 才有 */
export const PENDING_LIMIT = 3
/** 悬着行渲染上限（字） */
export const PENDING_LINE_MAX = 60

/**
 * 画像里的长期方向（只取 portrait 卡；没有返回空数组） */
function readGoals(getProfileFn) {
  try {
    const p = (getProfileFn || getProfile)() || {}
    if (p.enabled !== true) return []
    const cards = Array.isArray(p.cards) ? p.cards : []
    const card = cards.find((c) => c && (c.id === 'portrait' || c.title === '我的画像'))
    if (!card || !card.fields) return []
    const out = []
    for (const k of GOAL_FIELDS) {
      const v = card.fields[k]
      const text = Array.isArray(v) ? v.join('、') : String(v == null ? '' : v)
      if (text.trim()) out.push(text.trim())
      if (out.length >= 2) break
    }
    return out
  } catch (e) {
    return []
  }
}

/**
 * 构建情境包（纯数据）
 * @param {{ now?: number, env?: Object, deps?: Object, energyLevel?: string }} [opts]
 *   energyLevel = 'very_low' 时隐去「计划」与「人脉」两行：这两行是最典型的
 *   「你还差什么」盘点，低能量时看到就会变成催促（4.5.1 跳过动静摘要同一口径）。
 * @returns {{ now, bucket, bucketLabel, facts, goals, pending, threads, empty }}
 */
export function buildContextPacket(opts = {}) {
  const now = Number.isFinite(opts.now) ? opts.now : Date.now()
  const deps = opts.deps || {}

  const snap = collectSnapshot(now, opts.env || {}, deps)
  const goals = readGoals(deps.profile)
  const muted = opts.energyLevel === 'very_low'
  const pending = muted ? [] : readPending(opts.loops, now)

  const facts = {
    plans: snap.plans,
    diary: snap.diary,
    bill: snap.bill,
    relation: snap.relation,
    profile: snap.profile
  }
  if (muted) {
    delete facts.plans
    delete facts.relation
  }

  const packet = {
    now,
    bucket: snap.bucket,
    bucketLabel: snap.bucketLabel,
    facts,
    goals,
    muted,
    // 4.51.0 M1 只有事实层；M2 接入开放事项；主题聚合留给 M3
    pending,
    threads: [],
    empty: snap.empty && goals.length === 0 && pending.length === 0
  }

  return packet
}

/** 未闭环事项（可注入测试数据；默认读存储） */
function readPending(injected, now) {
  const src = Array.isArray(injected) ? injected : getOpenLoops(PENDING_LIMIT)
  return src
    .filter((l) => l && l.title && (l.status == null || l.status === 'open'))
    .slice(0, PENDING_LIMIT)
    .map((l) => ({
      id: l.id,
      title: String(l.title).slice(0, 20),
      days: Math.max(0, Math.floor((now - (l.last_at || now)) / DAY_MS))
    }))
}

/** 数字千分位不必要，直接取整省钱 */
function intOf(n) {
  return String(Math.round(Number(n) || 0))
}

/** 超预算时按行砍（不切半句），仍超则硬截断兜底 */
function clampLines(lines, maxChars, header) {
  const kept = []
  let used = header.length
  for (const line of lines) {
    if (used + line.length + 1 > maxChars) break
    kept.push(line)
    used += line.length + 1
  }
  let text = header + (kept.length ? '\n' + kept.join('\n') : '')
  if (text.length > maxChars) text = text.slice(0, maxChars - 1) + '…'
  return text
}

/**
 * 渲染成注入文本；零数据返回空串。
 * 只写事实与计数，不写评价、不写建议、不写缺口。
 * @param {Object} packet buildContextPacket 的产物
 * @returns {string}
 */
export function renderContextPacket(packet) {
  if (!packet || packet.empty) return ''
  const header = '【当前情境】'
  const lines = []
  const f = packet.facts || {}

  const p = f.plans || {}
  if (p.active || p.overdue || p.dueToday) {
    const segs = []
    if (p.active) segs.push('进行中 ' + intOf(p.active))
    if (p.overdue) segs.push('逾期 ' + intOf(p.overdue) + (p.overdueMaxDays ? '（最久 ' + intOf(p.overdueMaxDays) + ' 天）' : ''))
    if (p.dueToday) segs.push('今天到期 ' + intOf(p.dueToday))
    if (p.checkedToday) segs.push('今天已打卡')
    lines.push('计划：' + segs.join(' · '))
  }

  const d = f.diary || {}
  if (d.today) lines.push('记录：今天已写')
  else if (d.week) lines.push('记录：近 7 天 ' + intOf(d.week) + ' 篇')

  const b = f.bill || {}
  if (b.month) {
    let line = '账单：本月 ' + intOf(b.month) + ' 笔 ¥' + intOf(b.monthTotal)
    if (b.budgetPct) line += ' · 预算 ' + intOf(b.budgetPct) + '%'
    lines.push(line)
  }

  const r = f.relation || {}
  if (r.stale) lines.push('人脉：' + intOf(r.stale) + ' 人超过 ' + RELATION_STALE_DAYS + ' 天未联系')

  const pend = Array.isArray(packet.pending) ? packet.pending : []
  if (pend.length) {
    let line = '悬着：'
    for (const item of pend) {
      const seg = (line === '悬着：' ? '' : ' · ') + item.title + '（' + intOf(item.days) + ' 天）'
      if ((line + seg).length > PENDING_LINE_MAX) break
      line += seg
    }
    if (line !== '悬着：') lines.push(line)
  }

  if (Array.isArray(packet.goals) && packet.goals.length) {
    let g = packet.goals.join('；')
    if (g.length > GOAL_MAX_CHARS) g = g.slice(0, GOAL_MAX_CHARS - 1) + '…'
    lines.push('方向：' + g)
  }

  if (!lines.length) return ''
  return clampLines(lines, CONTEXT_PACK_MAX_CHARS, header)
}
