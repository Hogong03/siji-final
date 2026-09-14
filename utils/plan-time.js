/**
 * plan-time.js — 计划时间分布预览（3.2 M4）
 *
 * 纯函数：把主计划区间与各子计划起止映射到一条线性刻度上。
 * 范围取「主计划 + 子计划」全部有效日期的全局最小/最大；少于 2 个有效日期返回 null。
 * 不做滑动/缩放/拖拽（与已删时间轴教训一致），组件只读渲染。
 */

const DAY_MS = 24 * 60 * 60 * 1000

/** 解析日期字符串前 10 位（YYYY-MM-DD / YYYY/MM/DD）→ UTC 天序号；无效返回 null */
function dayNumber(value) {
  if (value == null) return null
  const m = String(value).trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (y < 1970 || mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return Math.floor(Date.UTC(y, mo - 1, d) / DAY_MS)
}

/** 天序号 → YYYY-MM-DD */
function dayToDateStr(day) {
  const d = new Date(day * DAY_MS)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

/** 首个非空字段值 */
function firstValue(...values) {
  for (const v of values) {
    if (v != null && String(v).trim()) return String(v).trim()
  }
  return ''
}

/** 短标签：9月6日；跨年份补年份 */
function shortLabel(dateStr) {
  const m = String(dateStr || '').match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (!m) return ''
  const y = Number(m[1])
  const label = `${Number(m[2])}月${Number(m[3])}日`
  return y === new Date().getFullYear() ? label : `${y}年${label}`
}

/**
 * 构建时间刻度数据
 * @param {Object} plan 主计划：start_time/estimated_time → 开始；end_time/due_date/deadline → 结束
 * @param {Array} childPlans 子计划：estimated_time/start_time → 开始；due_date/deadline/end_time → 结束
 * @param {string} [todayStr] YYYY-MM-DD；缺省取当天
 * @returns {null | { start, end, totalDays, startLabel, endLabel, nodes }}
 */
export function buildTimeStrip(plan = {}, childPlans = [], todayStr = '') {
  const children = Array.isArray(childPlans) ? childPlans : []
  const rawNodes = []
  const planStart = firstValue(plan.start_time, plan.estimated_time)
  const planEnd = firstValue(plan.end_time, plan.due_date, plan.deadline)
  if (planStart) rawNodes.push({ key: 'plan_start', kind: 'start', date: planStart })
  if (planEnd) rawNodes.push({ key: 'plan_end', kind: 'end', date: planEnd })
  for (const ch of children) {
    const id = ch.client_id || ch.id || 'child'
    const cs = firstValue(ch.start_time, ch.estimated_time)
    const ce = firstValue(ch.end_time, ch.due_date, ch.deadline)
    if (cs) rawNodes.push({ key: `${id}_start`, kind: 'child', date: cs })
    if (ce) rawNodes.push({ key: `${id}_end`, kind: 'child', date: ce })
  }

  const valid = rawNodes
    .map(n => ({ ...n, day: dayNumber(n.date) }))
    .filter(n => n.day != null)
  const distinct = [...new Set(valid.map(n => n.day))]
  if (distinct.length < 2) return null

  const min = Math.min(...distinct)
  const max = Math.max(...distinct)
  const totalDays = max - min

  const todayDay = dayNumber(todayStr || dayToDateStr(Math.floor(Date.now() / DAY_MS)))
  const todayInside = todayDay != null && todayDay >= min && todayDay <= max

  const nodes = valid
    .map(n => ({
      key: n.key,
      kind: n.kind,
      date: dayToDateStr(n.day),
      label: shortLabel(dayToDateStr(n.day)),
      offsetPct: totalDays === 0 ? 0 : Math.round(((n.day - min) / totalDays) * 1000) / 10
    }))
    .sort((a, b) => a.offsetPct - b.offsetPct || a.key.localeCompare(b.key))

  if (todayInside) {
    nodes.push({
      key: 'today',
      kind: 'today',
      date: dayToDateStr(todayDay),
      label: shortLabel(dayToDateStr(todayDay)),
      offsetPct: totalDays === 0 ? 0 : Math.round(((todayDay - min) / totalDays) * 1000) / 10
    })
    nodes.sort((a, b) => a.offsetPct - b.offsetPct || a.key.localeCompare(b.key))
  }

  return {
    start: dayToDateStr(min),
    end: dayToDateStr(max),
    totalDays,
    startLabel: shortLabel(dayToDateStr(min)),
    endLabel: shortLabel(dayToDateStr(max)),
    nodes
  }
}
