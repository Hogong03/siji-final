/**
 * plan-heatmap.js - 打卡热力月视图纯逻辑（3.5.3）
 *
 * 输入计划列表与年月，输出周一起 7 列的月网格、每天打卡次数与强度等级。
 * 不读写存储；记录页 components/plan/PlanHeatmap.vue 只负责渲染。
 */

/** 强度等级：0 无 / 1 一次 / 2 两次 / 3 三次及以上 */
export function levelOf(count) {
  const n = Number(count) || 0
  if (n >= 3) return 3
  if (n === 2) return 2
  if (n === 1) return 1
  return 0
}

/** 毫秒时间 → YYYY-MM-DD（本地时区） */
export function dateKeyOf(ts) {
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  const pad = n => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

function keyOf(year, month, day) {
  const pad = n => String(n).padStart(2, '0')
  return year + '-' + pad(month + 1) + '-' + pad(day)
}

/**
 * 单计划热度表：date → 次数（打卡 + 完成日志）
 * 3.5.6 起这是「一个计划有多热」的唯一口径：记录页热力图、详情页日历都从这里取数，
 * 不允许各页面自己拼（拼出来的颜色深浅会互相打架）
 * 已删除计划返回空表
 */
export function countsOf(plan) {
  const map = {}
  if (!plan || plan.is_deleted === 1) return map
  if (Array.isArray(plan.checkins)) {
    plan.checkins.forEach(c => {
      if (!c || !c.date) return
      map[c.date] = (map[c.date] || 0) + 1
    })
  }
  if (Array.isArray(plan.executions)) {
    plan.executions.forEach(e => {
      if (!e || e.action !== 'done' || !e.at) return
      const key = dateKeyOf(e.at)
      if (!key) return
      map[key] = (map[key] || 0) + 1
    })
  }
  return map
}

/**
 * 全部计划合并热度表：date → 次数，逐计划 countsOf 相加
 * 口径与 countsOf 完全一致（同一函数累加），保证两处颜色深浅可对照
 */
export function collectDayCounts(plans) {
  const map = {}
  const source = Array.isArray(plans) ? plans.filter(p => p && p.is_deleted !== 1) : []
  source.forEach(p => {
    const one = countsOf(p)
    Object.keys(one).forEach(date => { map[date] = (map[date] || 0) + one[date] })
  })
  return map
}

/**
 * 月网格：7 列（周一起），首尾用 null 补空
 * 每格：{ date, day, count, level, isToday, isFuture }
 * isFuture：晚于今天，补记与统计都不该碰（界面据此置灰）
 */
export function monthGrid(year, month, counts = {}, nowTs = Date.now()) {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const lead = (new Date(year, month, 1).getDay() + 6) % 7
  const todayKey = dateKeyOf(nowTs)
  const weeks = []
  let week = new Array(lead).fill(null)
  for (let day = 1; day <= daysInMonth; day++) {
    const date = keyOf(year, month, day)
    const count = Number(counts[date]) || 0
    week.push({ date, day, count, level: levelOf(count), isToday: date === todayKey, isFuture: date > todayKey })
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }
  return weeks
}

/** 当月合计：days 有记录的天数，times 总次数 */
export function monthTotals(year, month, counts = {}) {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  let days = 0
  let times = 0
  for (let day = 1; day <= daysInMonth; day++) {
    const n = Number(counts[keyOf(year, month, day)]) || 0
    if (n > 0) {
      days += 1
      times += n
    }
  }
  return { days, times }
}

/** 月份偏移（delta 可正可负） */
export function shiftMonth(year, month, delta) {
  const d = new Date(year, month + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}

/** 是否可翻到下个月（不允许超过当月） */
export function canGoNext(year, month, nowTs = Date.now()) {
  const now = new Date(nowTs)
  return year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth())
}

/**
 * 本周（周一起）打卡概览（3.5.4：计划总览「本周打卡 N 次」）
 * 只统计 checkins（不含完成日志），主计划与子计划一起算；已删除计划排除
 * 返回 { times 次数, days 有记录天数 }
 */
export function weekCheckinSummary(plans, nowTs = Date.now()) {
  const now = new Date(nowTs)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const mondayTs = todayStart - ((now.getDay() + 6) % 7) * 86400000
  const from = dateKeyOf(mondayTs)
  const to = dateKeyOf(mondayTs + 6 * 86400000)
  let times = 0
  const daySet = new Set()
  const source = Array.isArray(plans) ? plans.filter(p => p && p.is_deleted !== 1) : []
  source.forEach(p => {
    if (!Array.isArray(p.checkins)) return
    p.checkins.forEach(c => {
      const date = c && c.date
      if (!date || date < from || date > to) return
      times += 1
      daySet.add(date)
    })
  })
  return { times, days: daySet.size }
}
