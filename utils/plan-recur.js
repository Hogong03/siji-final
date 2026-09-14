/**
 * plan-recur.js - 循环任务纯逻辑（3.5.0）
 *
 * 循环任务：每天/每周重复的固定动作（如「每天听 30 分钟」「每周 3 次模考」）。
 *  - 数据字段：recur_type: '' | 'daily' | 'weekly'；recur_count: 每周目标次数（weekly 默认 1）
 *  - 循环任务不做「完成」状态：靠打卡记当天/本周；打卡不置完成、不刷规划字段
 *  - 窗口规则：有效起止 = 自身与各级父计划中最晚开始、最早结束（含自身字段）。
 *    阶段子计划给每日项天然圈定起止，避免把整棵主计划的截止误当循环结束
 * 本文件为纯函数，不读写存储；今日行动条 / 提醒调度 / 自动收尾 / 详情页共用
 */

import { toPlanTs } from './datetime.js'

const DAY_MS = 24 * 60 * 60 * 1000
const MAX_CHAIN = 12

/** 循环类型：'' 不循环 / daily 每天 / weekly 每周 N 次 */
export function recurTypeOf(plan) {
  if (!plan) return ''
  const t = plan.recur_type === 'daily' || plan.recur_type === 'weekly' ? plan.recur_type : ''
  return t
}

/** weekly 的目标次数（默认 1），daily 恒为 1 */
export function recurCountOf(plan) {
  if (!plan || recurTypeOf(plan) !== 'weekly') return 1
  const n = parseInt(plan.recur_count, 10)
  return Number.isFinite(n) && n > 0 ? n : 1
}

/**
 * 规范化循环字段（编辑入口统一用它，避免各处洗数据不一致）
 * recur_type 只接受 '' | 'daily' | 'weekly'；weekly 次数收敛到 1-30，其余类型恒为 1
 */
export function normalizeRecur(recurType, recurCount) {
  const type = recurType === 'daily' || recurType === 'weekly' ? recurType : ''
  const n = parseInt(recurCount, 10)
  const count = type === 'weekly' ? Math.min(30, Math.max(1, Number.isFinite(n) ? n : 1)) : 1
  return { recur_type: type, recur_count: count }
}

/** 是否为「在跑」的循环任务（未删除/未完成/未冷藏/未放任意时间） */
export function isRecurring(plan) {
  if (!plan || !recurTypeOf(plan)) return false
  return !(plan.is_deleted === 1 || plan.status === 2 || plan.frozen_at || plan.someday_at)
}

/** 时间戳 → YYYY-MM-DD（本地时区） */
export function dateYmdOfTs(ts) {
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  const pad = n => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

/** 计划全部打卡日期（去重、升序） */
export function checkinDatesOf(plan) {
  const list = Array.isArray(plan && plan.checkins) ? plan.checkins : []
  return [...new Set(list.map(c => c && c.date).filter(Boolean))].sort()
}

/** 今天是否已打卡 */
export function isCheckedToday(plan, nowTs = Date.now()) {
  const today = dateYmdOfTs(nowTs)
  return checkinDatesOf(plan).indexOf(today) >= 0
}

function tsOfYmd(dateStr) {
  if (!dateStr) return null
  const m = String(dateStr).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (!m) return null
  return new Date(+m[1], +m[2] - 1, +m[3]).getTime()
}

/** 本周（周一起）[weekStartTs, weekEndTs) */
export function weekRangeTsOf(nowTs = Date.now()) {
  const now = new Date(nowTs)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const dayIndex = (now.getDay() + 6) % 7
  const weekStart = todayStart - dayIndex * DAY_MS
  return { weekStart, weekEnd: weekStart + 7 * DAY_MS }
}

/** 本周已打卡天数（每周循环按天计数，同日多次不重复计） */
export function weeklyDoneOf(plan, nowTs = Date.now()) {
  const { weekStart, weekEnd } = weekRangeTsOf(nowTs)
  return checkinDatesOf(plan).filter(dateStr => {
    const t = tsOfYmd(dateStr)
    return t != null && t >= weekStart && t < weekEnd
  }).length
}

const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']

/**
 * 本周七天格子（周一起），供周历视图渲染
 * 返回 [{ date, day, label, done, isToday, isFuture }]，day=日期数字
 */
export function weekDayCells(plan, nowTs = Date.now()) {
  const { weekStart } = weekRangeTsOf(nowTs)
  const doneSet = new Set(checkinDatesOf(plan))
  const todayStr = dateYmdOfTs(nowTs)
  return WEEK_LABELS.map((label, i) => {
    const ts = weekStart + i * DAY_MS
    const date = dateYmdOfTs(ts)
    return {
      date,
      day: Number(date.slice(8, 10)),
      label,
      done: doneSet.has(date),
      isToday: date === todayStr,
      isFuture: date > todayStr
    }
  })
}

/** weekly 配额是否已达标（达标后本周不再上今日条） */
export function quotaSatisfied(plan, nowTs = Date.now()) {
  if (!plan || recurTypeOf(plan) !== 'weekly') return false
  return weeklyDoneOf(plan, nowTs) >= recurCountOf(plan)
}

/** 今天是否已算满足：daily=今日已打卡；weekly=本周达标或今日已打 */
export function satisfiedToday(plan, nowTs = Date.now()) {
  if (!plan || !recurTypeOf(plan)) return false
  if (isCheckedToday(plan, nowTs)) return true
  return quotaSatisfied(plan, nowTs)
}

/**
 * 连续打卡天数（任意日期集合）：今天打过从今天数，今天没打但从昨天连着也从昨天数
 * 3.5.3 抽成公共纯函数，单计划（calcCheckinStreak）与全局连续天（进入总结）共用
 */
export function calcStreakFromDates(dates, nowTs = Date.now()) {
  const set = new Set((Array.isArray(dates) ? dates : []).filter(Boolean))
  if (set.size === 0) return 0
  const today = dateYmdOfTs(nowTs)
  const todayStart = tsOfYmd(today)
  if (todayStart == null) return 0
  let cursor = set.has(today)
    ? todayStart
    : (set.has(dateYmdOfTs(todayStart - DAY_MS)) ? todayStart - DAY_MS : null)
  let streak = 0
  while (cursor != null && set.has(dateYmdOfTs(cursor))) {
    streak += 1
    cursor -= DAY_MS
  }
  return streak
}

/** 连续打卡天数（单个计划） */
export function calcCheckinStreak(plan, nowTs = Date.now()) {
  return calcStreakFromDates(checkinDatesOf(plan), nowTs)
}

/** 某周（周一起 7 天）内的打卡天数 */
function countInWeek(startTs, dateTsList) {
  const endTs = startTs + 7 * DAY_MS
  let n = 0
  dateTsList.forEach(ts => { if (ts >= startTs && ts < endTs) n += 1 })
  return n
}

/**
 * 连续达标周数（weekly 专用，3.5.6）
 * 达标 = 该周打卡天数 >= recur_count；本周已达标就从本周数，否则从上周数
 * 上限 MAX_WEEKS 周，防止脏数据把循环拖死
 */
export function weeklyStreakOf(plan, nowTs = Date.now()) {
  if (!plan || recurTypeOf(plan) !== 'weekly') return 0
  const target = recurCountOf(plan)
  const dateTsList = checkinDatesOf(plan).map(tsOfYmd).filter(ts => ts != null)
  if (dateTsList.length === 0) return 0
  const { weekStart } = weekRangeTsOf(nowTs)
  let cursor = countInWeek(weekStart, dateTsList) >= target ? weekStart : weekStart - 7 * DAY_MS
  let streak = 0
  while (streak < MAX_WEEKS && countInWeek(cursor, dateTsList) >= target) {
    streak += 1
    cursor -= 7 * DAY_MS
  }
  return streak
}

/**
 * 计划在树中的路径标签（3.5.6）：「主计划 / 阶段 / 子计划」
 * 用于同名子计划的区分（长按补记候选清单）
 */
export function planPathLabel(plan, byId) {
  if (!plan) return ''
  const parts = []
  let cur = plan
  let depth = 0
  while (cur && depth <= MAX_CHAIN) {
    parts.unshift(cur.title || '未命名计划')
    cur = byId && cur.parent_id ? byId.get(cur.parent_id) : null
    depth += 1
  }
  return parts.join(' / ')
}

/** 计划层级深度（主计划 0） */
export function planDepthOf(plan, byId) {
  let depth = 0
  let cur = plan
  while (cur && cur.parent_id && depth < MAX_CHAIN) {
    cur = byId && byId.get(cur.parent_id) ? byId.get(cur.parent_id) : null
    depth += 1
  }
  return depth
}

/** 里程碑上限周数（脏数据保护） */
const MAX_WEEKS = 260

/** plans[] → client_id Map（供窗口计算用） */
export function buildPlanIndex(plans) {
  const map = new Map()
  if (Array.isArray(plans)) {
    plans.forEach(p => { if (p && p.client_id) map.set(p.client_id, p) })
  }
  return map
}

/**
 * 有效循环窗口：自身与祖先中「最晚开始 / 最早结束」
 * startTs 当天 00:00；endTs 当天 23:59:59.999；无边界返回 null
 */
export function startEndTsOf(plan, byId) {
  if (!plan) return { startTs: null, endTs: null }
  let startTs = null
  let endTs = null
  let cur = plan
  let depth = 0
  while (cur && depth < MAX_CHAIN) {
    const s = toPlanTs(cur.start_time || cur.estimated_time || '')
    if (s != null && (startTs == null || s > startTs)) startTs = s
    const e = toPlanTs(cur.deadline || cur.due_date || '', true)
    if (e != null && (endTs == null || e < endTs)) endTs = e
    cur = byId && cur.parent_id ? byId.get(cur.parent_id) : null
    depth += 1
  }
  return { startTs, endTs }
}

/** 今天是否落在循环窗口内 */
export function windowCoversToday(plan, byId, nowTs = Date.now()) {
  const { startTs, endTs } = startEndTsOf(plan, byId)
  const now = new Date(nowTs)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const todayEnd = todayStart + DAY_MS - 1
  if (startTs != null && startTs > todayEnd) return false
  if (endTs != null && endTs < todayStart) return false
  return true
}

/** 循环窗口已整体过去 → 应自动收尾（由存储层在读取时落库） */
export function shouldAutoCompleteRecurring(plan, byId, nowTs = Date.now()) {
  if (!isRecurring(plan)) return false
  const { endTs } = startEndTsOf(plan, byId)
  return endTs != null && nowTs > endTs
}

/**
 * 温和补记目标日（3.5.4）：漏了昨天才给补，返回 'YYYY-MM-DD'，不给补返回 ''
 * 条件：在跑的循环任务 + 昨天落在有效窗口内 + 昨天没打卡
 */
export function backfillTargetOf(plan, byId, nowTs = Date.now()) {
  const now = new Date(nowTs)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yKey = dateYmdOfTs(todayStart - DAY_MS)
  return isBackfillable(plan, byId, yKey, nowTs) ? yKey : ''
}

/** 补记回溯上限（天）：再往前的历史日不给补，避免把热力图当成任意补数据的入口 */
export const MAX_BACKFILL_DAYS = 30

/**
 * 某一天是否可补记（3.5.5 泛化，供热力图长按任意历史日使用）
 * 条件：在跑的循环任务 + 该天在最近 MAX_BACKFILL_DAYS 天内 + 该天落在有效窗口内 + 该天没打卡
 */
export function isBackfillable(plan, byId, dateStr, nowTs = Date.now()) {
  if (!isRecurring(plan)) return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ''))) return false
  const now = new Date(nowTs)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const todayKey = dateYmdOfTs(todayStart)
  if (dateStr >= todayKey) return false // 今天与未来走正常打卡
  const dayStart = tsOfYmd(dateStr)
  if (dayStart == null) return false
  if (dayStart < todayStart - MAX_BACKFILL_DAYS * DAY_MS) return false
  const { startTs, endTs } = startEndTsOf(plan, byId)
  if (startTs != null && startTs > dayStart + DAY_MS - 1) return false
  if (endTs != null && endTs < dayStart) return false
  return checkinDatesOf(plan).indexOf(dateStr) < 0
}

/**
 * 某一天可补记的计划清单（3.5.5 / 3.5.6）：热力图长按某天时给出候选
 * 返回 [{ client_id, title, label, depth, recur_type }]，label 带祖先路径（同名子计划可区分）
 * 排序：层级浅的在前，同层按标题，保证候选顺序稳定
 */
export function backfillCandidates(plans, dateStr, nowTs = Date.now()) {
  const source = Array.isArray(plans) ? plans.filter(p => p && p.is_deleted !== 1) : []
  const byId = buildPlanIndex(source)
  return source
    .filter(p => isBackfillable(p, byId, dateStr, nowTs))
    .map(p => ({
      client_id: p.client_id,
      title: p.title || '未命名计划',
      label: planPathLabel(p, byId),
      depth: planDepthOf(p, byId),
      recur_type: recurTypeOf(p)
    }))
    .sort((a, b) => (a.depth - b.depth) || a.label.localeCompare(b.label, 'zh-Hans-CN'))
}

/** 连续达标里程碑（轻量肯定用）：只有跨过才算数 */
const DAY_MILESTONES = [3, 7, 14, 30, 60, 100]
const WEEK_MILESTONES = [2, 4, 8, 12, 26, 52]

/**
 * 本次打卡是否跨过连续里程碑（3.5.5 / 3.5.6）
 * kind: day 看连续天数，week 看连续达标周数（weekly 任务）
 * @returns {number} 跨过的里程碑数值，未跨过返回 0
 */
export function streakMilestoneOf(afterStreak, beforeStreak, kind = 'day') {
  const after = Number(afterStreak) || 0
  const before = Number(beforeStreak) || 0
  if (after <= before) return 0
  const list = kind === 'week' ? WEEK_MILESTONES : DAY_MILESTONES
  let hit = 0
  list.forEach(m => { if (before < m && after >= m && m > hit) hit = m })
  return hit
}

/**
 * 级联收尾候选：直接子计划全部结束的未完成父级
 *  - 「结束」= status === 2（含本轮已收尾的循环项）；子计划有冷藏/任意时间标记时视为未结束
 *  - 固定点迭代：先收最深层，再向上收阶段、主计划（最多 MAX_CHAIN 轮）
 *  - 只返回候选 client_id（层级升序），落库由存储层统一执行
 */
export function collectCascadeCompletions(plans, maxRounds = MAX_CHAIN) {
  const list = Array.isArray(plans)
    ? plans.filter(p => p && p.client_id && p.is_deleted !== 1)
    : []
  if (list.length === 0) return []
  const childrenOf = new Map()
  list.forEach(p => {
    const pid = p.parent_id || ''
    if (!pid) return
    if (!childrenOf.has(pid)) childrenOf.set(pid, [])
    childrenOf.get(pid).push(p)
  })
  const closed = new Set()
  const out = []
  for (let round = 0; round < maxRounds; round++) {
    let progressed = false
    list.forEach(p => {
      if (p.status === 2 || closed.has(p.client_id)) return
      if (p.frozen_at || p.someday_at) return
      const kids = childrenOf.get(p.client_id) || []
      if (kids.length === 0) return
      const allClosed = kids.every(k =>
        (k.status === 2 || closed.has(k.client_id)) && !k.frozen_at && !k.someday_at)
      if (!allClosed) return
      closed.add(p.client_id)
      out.push(p.client_id)
      progressed = true
    })
    if (!progressed) break
  }
  return out
}
