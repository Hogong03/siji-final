/**
 * advice-candidates.js — 多来源候选池（M3.1）
 *
 * 三个来源，职责不同：
 *   15 条现有规则 → 生成候选（文案不改，原样包装）
 *   Open Loops    → 独立生成候选（open + 悬置 ≥3 天 + 未挂计划）
 *   用户画像      → 只做评分/过滤的「镜头」，不单独产出候选
 *
 * 每条候选必须带 evidence.ref：指得回真实数据才算数（层 ① 校验）。
 */

import { collectAdvice } from './advice-rules.js'
import { getOpenLoops } from './open-loops.js'
import { getProfile } from './profile.js'

/** 开放事项进入候选池的最小悬置天数 */
export const LOOP_MIN_DAYS = 3

/** 规则 key → 领域（同域只留一条） */
export const DOMAIN_OF = {
  'env-ai': 'env',
  'env-guide': 'env',
  'env-offline': 'env',
  'plan-overdue': 'plan',
  'plan-today': 'plan',
  'plan-soon': 'plan',
  'bill-budget': 'bill',
  'bill-none': 'bill',
  'bill-stale': 'bill',
  'diary-today': 'diary',
  'relation-stale': 'relation',
  'profile-pct': 'profile',
  'time-morning': 'time',
  'time-evening': 'time',
  'start-empty': 'start'
}

/** 规则 key → evidence.ref（字段路径，可点回数据） */
export const REF_OF = {
  'env-ai': 'snapshot.env.aiReady',
  'env-guide': 'snapshot.env.firstRun',
  'env-offline': 'snapshot.env.offline',
  'plan-overdue': 'snapshot.plans.overdue',
  'plan-today': 'snapshot.plans.dueToday',
  'plan-soon': 'snapshot.plans.soonCount',
  'bill-budget': 'snapshot.bill.budgetPct',
  'bill-none': 'snapshot.bill.month',
  'bill-stale': 'snapshot.bill.lastDays',
  'diary-today': 'snapshot.diary.today',
  'relation-stale': 'snapshot.relation.stale',
  'profile-pct': 'snapshot.profile.pct',
  'time-morning': 'snapshot.bucket',
  'time-evening': 'snapshot.bucket',
  'start-empty': 'snapshot.empty'
}

/** 规则 key → 5 分钟内能开始的一步（没有就不写） */
const FIRST_STEP = {
  'env-ai': '填一个厂商 Key',
  'env-guide': '走一遍三步引导',
  'env-offline': '先记一笔，联网功能等会儿再说',
  'plan-overdue': '只挑最久的那一条，处理 5 分钟',
  'plan-today': '先做今天到期那件，5 分钟起步',
  'plan-soon': '花 2 分钟排一下这周的时间',
  'bill-budget': '看一眼这个月最大的三笔',
  'bill-none': '记一笔，一句话就行',
  'bill-stale': '凭记忆补一笔大概的',
  'diary-today': '写一句今天，不用成篇',
  'relation-stale': '发一句话问候',
  'profile-pct': '补一个字段就够',
  'time-morning': '定下今天三件事',
  'time-evening': '记一句今天',
  'start-empty': '说一句话开始'
}

const DAY_MS = 86400000

/** 规则候选：直接把现有规则条目包成候选，不改文案 */
function fromRules(snapshot) {
  const items = collectAdvice(snapshot, { limit: 20 })
  return items.map((it) => ({
    id: 'rule:' + it.key,
    source: 'rule',
    domain: DOMAIN_OF[it.key] || 'other',
    title: it.title,
    why: it.desc,
    firstStep: FIRST_STEP[it.key] || '',
    evidence: { ref: REF_OF[it.key] || '', text: it.desc },
    tone: it.tone,
    action: it.action || null,
    days: 0,
    taskLike: (DOMAIN_OF[it.key] || '') === 'plan' || (DOMAIN_OF[it.key] || '') === 'bill'
  }))
}

/** 循环候选：open + 悬置 ≥3 天 + 没挂计划 */
export function loopsOf(loops, now, minDays = LOOP_MIN_DAYS) {
  return (Array.isArray(loops) ? loops : [])
    .filter((l) => l && l.status === 'open' && !l.is_deleted && !l.plan_id)
    .map((l) => ({ loop: l, days: Math.max(0, Math.floor((now - (l.last_at || now)) / DAY_MS)) }))
    .filter((x) => x.days >= minDays)
}

function fromLoops(loops, now) {
  return loopsOf(loops, now).map(({ loop, days }) => ({
    id: 'loop:' + loop.id,
    source: 'loop',
    domain: 'loop',
    title: loop.title,
    why: '你 ' + days + ' 天前提过，还没收尾',
    firstStep: loop.next_hint ? '先动 5 分钟：' + loop.next_hint : '先做 5 分钟，做完记一句',
    evidence: { ref: 'loop:' + loop.id, text: '「' + loop.title + '」· ' + days + ' 天前' },
    tone: 'nudge',
    action: { type: 'prefill', text: loop.title },
    days,
    taskLike: true,
    loopId: loop.id
  }))
}

/** 画像方向（只读两个字段，作为镜头） */
export function readGoals() {
  try {
    const p = getProfile() || {}
    if (p.enabled !== true) return []
    const card = (p.cards || []).find((c) => c && (c.id === 'portrait' || c.title === '我的画像'))
    if (!card || !card.fields) return []
    const out = []
    for (const k of ['职业方向', '人生关键词']) {
      const v = card.fields[k]
      const text = Array.isArray(v) ? v.join('、') : String(v == null ? '' : v)
      if (text.trim()) out.push(text.trim())
    }
    return out
  } catch (e) {
    return []
  }
}

/** 字符二元组集合（浮点小，够用且可解释） */
function bigrams(text) {
  const s = String(text || '').replace(/\s/g, '')
  const set = new Set()
  for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2))
  return set
}

function fitScore(cand, goals) {
  if (!Array.isArray(goals) || goals.length === 0) return 0.5
  const g = bigrams(goals.join(''))
  const c = bigrams((cand.title || '') + (cand.why || ''))
  if (!c.size || !g.size) return 0.5
  let hit = 0
  for (const t of c) if (g.has(t)) hit += 1
  return Math.min(1, hit / Math.min(6, Math.max(2, c.size)))
}

const URGENCY = { urgent: 1, nudge: 0.7, info: 0.3 }

/** 分数：紧急度 0.5 + 方向贴合 0.3 + 新鲜度 0.2（不展示给用户） */
export function scoreCandidate(cand, opts = {}) {
  const goals = opts.goals || []
  const urgency = URGENCY[cand.tone] || 0.3
  const fit = fitScore(cand, goals)
  const fresh = cand.source === 'loop' ? Math.min(1, (cand.days || 0) / 30) : 0.5
  return Math.round((urgency * 0.5 + fit * 0.3 + fresh * 0.2) * 1000) / 1000
}

/**
 * 生成候选池（未过滤）
 * @param {Object} snapshot collectSnapshot 的产物
 * @param {{ loops?: Array, goals?: Array, now?: number }} [opts]
 */
export function buildCandidates(snapshot, opts = {}) {
  const now = Number.isFinite(opts.now) ? opts.now : Date.now()
  const loops = Array.isArray(opts.loops) ? opts.loops : getOpenLoops(20)
  const goals = Array.isArray(opts.goals) ? opts.goals : readGoals()
  const list = fromRules(snapshot).concat(fromLoops(loops, now))
  return list.map((c) => Object.assign({}, c, { score: scoreCandidate(c, { goals }) }))
}
