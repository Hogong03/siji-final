/**
 * holidays.js — 中国节假日表（3.10.1）
 *
 * 为什么需要：用户说「中秋国庆出去旅游，玩三天」时，模型不知道该换算成哪几天，
 * 于是 create_plan 的时间字段全留空 —— 计划建出来了却没有时间，提醒也就无从谈起
 * （2026-09-17 反馈里的「本地深度游三日（中秋国庆）」就是这条）。
 * 把「接下来的节假日 + 具体日期」喂进 prompt，模型才有依据做日期换算。
 *
 * 两类节日：
 *   公历固定  元旦 1/1、劳动节 5/1、国庆 10/1-10/7 —— 按年推算，任何年份都对
 *   农历节日  春节 / 端午 / 中秋 —— 公历日期每年变，只能查表；表里没有的年份就不注入
 *             （宁可不给，也不编错日期；新增年份补一行即可）
 *
 * 纯函数、不 import uni。
 */

/** 农历节日的公历日期表（按需维护；表里没有的年份不会注入，避免编错） */
export const LUNAR_HOLIDAY_TABLE = {
  2026: [
    { name: '春节', start: '2026-02-17', end: '2026-02-23', note: '除夕 2/16' },
    { name: '端午节', start: '2026-06-19', end: '2026-06-21' },
    { name: '中秋节', start: '2026-09-25', end: '2026-09-27' }
  ],
  2027: [
    { name: '春节', start: '2027-02-06', end: '2027-02-12' },
    { name: '端午节', start: '2027-06-09', end: '2027-06-11' },
    { name: '中秋节', start: '2027-09-15', end: '2027-09-17' }
  ]
}

/** 公历固定节日（按年生成） */
function solarHolidays(year) {
  return [
    { name: '元旦', start: year + '-01-01', end: year + '-01-03' },
    { name: '劳动节', start: year + '-05-01', end: year + '-05-05' },
    { name: '国庆节', start: year + '-10-01', end: year + '-10-07' }
  ]
}

const DAY_MS = 24 * 60 * 60 * 1000

/** YYYY-MM-DD 的本地零点时间戳 */
function dayStart(dateStr) {
  const m = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  return new Date(+m[1], +m[2] - 1, +m[3]).getTime()
}

/**
 * 未来一段时间内的节假日（含正在进行的）
 * @param {number} [now] 时间戳
 * @param {number} [withinDays] 只保留开始日在这么多天内的（默认 120 天）
 * @returns {Array<{name, start, end, daysUntil, note?}>}
 */
export function upcomingHolidays(now, withinDays) {
  const at = Number(now) || Date.now()
  const limit = Number.isFinite(Number(withinDays)) ? Number(withinDays) : 120
  const base = new Date(at)
  const years = [base.getFullYear(), base.getFullYear() + 1, base.getFullYear() + 2]
  const all = []
  years.forEach(y => {
    solarHolidays(y).forEach(h => all.push(h))
    const lunar = LUNAR_HOLIDAY_TABLE[y]
    if (Array.isArray(lunar)) lunar.forEach(h => all.push(h))
  })

  const todayStart = new Date(base.getFullYear(), base.getMonth(), base.getDate()).getTime()
  return all
    .map(h => {
      const s = dayStart(h.start)
      const e = dayStart(h.end)
      return s == null ? null : Object.assign({}, h, {
        daysUntil: Math.round((s - todayStart) / DAY_MS),
        days: e == null ? 1 : Math.round((e - s) / DAY_MS) + 1
      })
    })
    .filter(h => h && h.daysUntil >= 0 && h.daysUntil <= limit)
    .sort((a, b) => a.daysUntil - b.daysUntil)
}

/**
 * 从文本里识别节假日（计划标题/描述里出现「中秋」「国庆」这类词时用）
 * @param {string} text
 * @param {number} [now]
 * @returns {{ name: string, start: string, end: string } | null}
 */
export function inferHolidayFromText(text, now) {
  const raw = String(text || '')
  if (!raw) return null
  const list = upcomingHolidays(now, 400)
  // 关键词 → 节日名（表里按中文名匹配，另补常见简称）
  const aliases = {
    中秋节: ['中秋'],
    国庆节: ['国庆', '十一'],
    春节: ['春节', '过年'],
    劳动节: ['劳动节', '五一'],
    元旦: ['元旦']
  }
  // 每个节日只取最近的一次（窗口跨年时会同时命中今年与明年，去重后再拼区间）
  const byName = new Map()
  list.forEach(h => {
    const words = aliases[h.name] || []
    const matched = raw.indexOf(h.name) >= 0 || words.some(w => raw.indexOf(w) >= 0)
    if (!matched) return
    if (!byName.has(h.name)) byName.set(h.name, h)
  })
  const hits = Array.from(byName.values()).sort((a, b) => a.daysUntil - b.daysUntil)
  if (hits.length === 0) return null
  if (hits.length === 1) return { name: hits[0].name, start: hits[0].start, end: hits[0].end }
  // 「中秋国庆」这种连着说的：取最早开始 ~ 最晚结束（中秋 9/25 开始、国庆 10/7 结束）
  const first = hits[0]
  const lastStart = hits[hits.length - 1]
  return { name: first.name + '~' + lastStart.name, start: first.start, end: lastStart.end }
}

/**
 * 喂给模型的「节假日」提示段
 * @param {number} [now]
 * @param {number} [limit] 最多列几个（默认 4）
 * @returns {string} 没有可列的就返回空串
 */
export function holidayPromptLine(now, limit) {
  const list = upcomingHolidays(now)
  const max = Number.isFinite(Number(limit)) ? Number(limit) : 4
  if (list.length === 0) return ''
  const parts = list.slice(0, max).map(h => {
    const when = h.daysUntil === 0 ? '今天开始' : h.daysUntil + ' 天后'
    const span = h.days > 1 ? `${h.start} 至 ${h.end}（${h.days} 天）` : h.start
    return `${h.name} ${span}，${when}`
  })
  return '接下来的节假日（据此把「中秋/国庆/春节」这类说法换算成具体日期）：' + parts.join('；')
}