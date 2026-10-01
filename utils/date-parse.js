/**
 * date-parse.js — 相对日期短语的确定性解析（4.9.0）
 *
 * 为什么要有：计划时间的「下周三 / 月底 / 下周」此前全靠提示词让模型自己算，
 * 模型算错没有兜底；节日有 holidays.js 查表兜底，相对日期没有。本文件补上这一层：
 * 纯函数、不依赖 uni，与 inferHolidayFromText 同构（{start,end,name}），
 * 供 execCreatePlan 在模型没给时间、文本也没命中节日时二级兜底。
 *
 * 周口径与 plan-recur 一致：周一为一周起点。
 * 直接可单测（tests/date-parse.test.js）。
 */

const DAY_MS = 24 * 60 * 60 * 1000

function pad(n) {
  return String(n).padStart(2, '0')
}

function ymd(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 当天零点 */
function midnight(ts) {
  const d = new Date(ts)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** 本周周一零点（周一起算） */
function weekStartOf(ts) {
  const d = new Date(midnight(ts))
  const wd = d.getDay() === 0 ? 7 : d.getDay() // 周日 = 7
  return d.getTime() - (wd - 1) * DAY_MS
}

/** 中文数字 → 周几序号（周一=1 … 周日=7），解析失败 0 */
const WEEKDAY_WORDS = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7 }

/**
 * 从文本解析第一个命中的相对日期短语
 * @param {string} text 标题/描述原文
 * @param {number} [now]
 * @returns {{ start: string, end: string, name: string } | null} 与 inferHolidayFromText 同构；无命中 null
 */
export function rangeFromText(text, now = Date.now()) {
  const raw = String(text || '')
  if (!raw) return null
  const base = midnight(now)
  const weekStart = weekStartOf(now)
  const monthEnd = new Date(new Date(now).getFullYear(), new Date(now).getMonth() + 1, 0).getTime()

  // 单日短语（顺序即优先级：大后天 先于 后天 匹配）
  const single = [
    { re: /大后天/, offset: 3, name: '大后天' },
    { re: /后天/, offset: 2, name: '后天' },
    { re: /明天/, offset: 1, name: '明天' },
    { re: /今晚|今天/, offset: 0, name: '今天' }
  ]
  for (const it of single) {
    if (it.re.test(raw)) {
      const ts = base + it.offset * DAY_MS
      return { start: ymd(ts), end: ymd(ts), name: it.name }
    }
  }

  // 下周[几]：下周三 → 下周那一天（单日）
  const nextWeekDay = raw.match(/下周(?:一|二|三|四|五|六|日|天)/)
  if (nextWeekDay) {
    const wd = WEEKDAY_WORDS[nextWeekDay[0].slice(2)]
    const ts = weekStart + (7 + wd - 1) * DAY_MS
    return { start: ymd(ts), end: ymd(ts), name: nextWeekDay[0] }
  }

  // 本周[几]（本周三；已在周四还说本周三 → 取下周的同一天，别给过去的日子）
  const thisWeekDay = raw.match(/(?:本|这)周(?:一|二|三|四|五|六|日|天)/)
  if (thisWeekDay) {
    const wd = WEEKDAY_WORDS[thisWeekDay[0].slice(2)]
    let ts = weekStart + (wd - 1) * DAY_MS
    if (ts < base) ts += 7 * DAY_MS
    return { start: ymd(ts), end: ymd(ts), name: thisWeekDay[0] }
  }

  // 周[几]（裸写周三）：未来最近的那个周三
  const bareWeekDay = raw.match(/(?:周|星期)(?:一|二|三|四|五|六|日|天)/)
  if (bareWeekDay) {
    const wd = WEEKDAY_WORDS[bareWeekDay[0].slice(-1)]
    let ts = weekStart + (wd - 1) * DAY_MS
    if (ts < base) ts += 7 * DAY_MS
    return { start: ymd(ts), end: ymd(ts), name: bareWeekDay[0] }
  }

  // 区间短语
  if (/下周末/.test(raw)) {
    const sat = weekStart + (7 + 5) * DAY_MS
    return { start: ymd(sat), end: ymd(sat + DAY_MS), name: '下周末' }
  }
  if (/(?:本|这)周末|周末/.test(raw)) {
    const sat = weekStart + 5 * DAY_MS
    const start = sat >= base ? sat : sat + 7 * DAY_MS
    return { start: ymd(start), end: ymd(start + DAY_MS), name: '周末' }
  }
  if (/下周|下星期/.test(raw)) {
    return { start: ymd(weekStart + 7 * DAY_MS), end: ymd(weekStart + 13 * DAY_MS), name: '下周' }
  }
  if (/(?:本|这)周/.test(raw)) {
    return { start: ymd(weekStart), end: ymd(Math.max(weekStart + 6 * DAY_MS, base)), name: '本周' }
  }
  if (/下个?月/.test(raw)) {
    const nmFirst = new Date(new Date(now).getFullYear(), new Date(now).getMonth() + 1, 1).getTime()
    const nmEnd = new Date(new Date(now).getFullYear(), new Date(now).getMonth() + 2, 0).getTime()
    return { start: ymd(nmFirst), end: ymd(nmEnd), name: '下个月' }
  }
  if (/月底/.test(raw)) {
    // 「月底」= 从今天做到本月最后一天
    return { start: ymd(base), end: ymd(monthEnd), name: '月底' }
  }
  return null
}
