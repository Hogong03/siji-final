/**
 * 计划时间轴 — 纯函数工具（可测试）
 * 时间解析、范围计算、节点构建、刻度步长
 */

const DAY_MS = 86400000

/** 解析 "YYYY-MM-DD[ HH:mm[:ss]]"（容忍非补零）为时间戳 */
export function toPlanTs(str, endOfDay = false) {
  if (!str) return null
  const s = String(str).trim()
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (!m) return null
  const timeMatch = s.match(/(\d{1,2}):(\d{2})/)
  if (timeMatch) {
    return new Date(+m[1], +m[2] - 1, +m[3], +timeMatch[1], +timeMatch[2]).getTime()
  }
  const d = new Date(+m[1], +m[2] - 1, +m[3])
  return endOfDay ? d.getTime() + DAY_MS - 1 : d.getTime()
}

/** 某天的 0 点时间戳 */
export function dayStart(ts) {
  const d = new Date(ts)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** 构建时间轴节点：只有带时间的计划才进入时间轴 */
export function buildTimelineNodes(plans) {
  const nodes = []
  ;(plans || []).forEach(p => {
    const startTs = toPlanTs(p.estimated_time || p.start_time) || toPlanTs(p.due_date || p.deadline)
    const endTs = toPlanTs(p.due_date || p.deadline) || toPlanTs(p.end_time) || startTs
    if (!startTs && !endTs) return
    nodes.push({
      id: p.client_id,
      title: p.title || '',
      status: p.status,
      priority: p.priority,
      parent_id: p.parent_id || '',
      startTs: startTs || endTs,
      endTs: endTs || startTs
    })
  })
  return nodes
}

/** 总时间跨度（天，最小 1）；无节点返回 null */
export function timelineRange(nodes) {
  if (!nodes || nodes.length === 0) return null
  let min = Infinity
  let max = -Infinity
  nodes.forEach(n => {
    if (n.startTs < min) min = n.startTs
    if (n.endTs > max) max = n.endTs
  })
  return { minTs: min, maxTs: max, spanDays: Math.max(1, (max - min) / DAY_MS) }
}

/** 根据 px/天 选择刻度步长（天），保证刻度间隔可读 */
export function pickTickStep(pxPerDay) {
  if (pxPerDay >= 160) return 1
  if (pxPerDay >= 60) return 3
  if (pxPerDay >= 20) return 7
  if (pxPerDay >= 8) return 14
  if (pxPerDay >= 3) return 30
  if (pxPerDay >= 1.2) return 90
  if (pxPerDay >= 0.5) return 180
  return 365
}

/** 生成刻度 { ts, label } */
export function buildTicks(minTs, spanDays, pxPerDay) {
  const step = pickTickStep(pxPerDay)
  const start = dayStart(minTs)
  const count = Math.ceil(spanDays / step) + 1
  const ticks = []
  for (let i = 0; i < count; i++) {
    const ts = start + i * step * DAY_MS
    const d = new Date(ts)
    const label = step >= 30
      ? (d.getMonth() + 1) + '月' + d.getDate() + '日'
      : (d.getMonth() + 1) + '/' + d.getDate()
    ticks.push({ ts, label })
  }
  return ticks
}
