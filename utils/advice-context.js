/**
 * advice-context.js — 建议引擎的「上下文」层
 *
 * 三层环境：
 *   数据     —— 应用内容（计划 / 记录 / 账单 / 人脉 / 画像 / 微光）的指纹
 *   时段     —— 清晨 / 上午 / 中午 / 下午 / 晚上 / 深夜 + 工作日 / 周末
 *   运行环境 —— AI 是否可用、是否首启、是否离线、是否深色
 *
 * 三者合成一个「上下文签名」：签名不变就不值得重出建议；
 * 签名变了（数据变了 / 跨了时段 / 环境变了）才重出 —— 这就是「环境变化也提供建议」。
 *
 * 纯函数、不读存储、不碰 DOM，可直接单测（tests/advice.test.js）。
 */

/** 时段标签（建议面板头部用） */
export const BUCKET_LABELS = {
  dawn: '清晨',
  morning: '上午',
  noon: '中午',
  afternoon: '下午',
  evening: '晚上',
  night: '深夜'
}

/**
 * 当前时段（六档）
 * 边界取「人一天怎么过」而不是均分：8 点上班、11 点半吃饭、18 点下班、23 点该睡
 * @param {number} [now]
 * @returns {'dawn'|'morning'|'noon'|'afternoon'|'evening'|'night'}
 */
export function timeBucket(now = Date.now()) {
  const h = new Date(now).getHours()
  if (h >= 5 && h < 8) return 'dawn'
  if (h >= 8 && h < 11) return 'morning'
  if (h >= 11 && h < 14) return 'noon'
  if (h >= 14 && h < 18) return 'afternoon'
  if (h >= 18 && h < 23) return 'evening'
  return 'night'
}

/** 时段中文名（非法值回落「现在」） */
export function bucketLabel(bucket) {
  return BUCKET_LABELS[bucket] || '现在'
}

/** 周末（周六 / 周日） */
export function isWeekend(now = Date.now()) {
  const d = new Date(now).getDay()
  return d === 0 || d === 6
}

/** 本地日期 YYYY-MM-DD（与 next-step / plan-summary 同口径） */
export function ymdOf(now = Date.now()) {
  const d = new Date(now)
  const pad = (n) => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

/**
 * 数据指纹：把影响建议的计数字段压成一串短码。
 * 只放「会让建议内容变化」的量，不放时间戳 —— 时间由签名里的 ymd / bucket 负责。
 * @param {Object} [data]
 */
export function dataFingerprint(data = {}) {
  const d = data || {}
  const n = (v) => (Number.isFinite(+v) && +v > 0 ? Math.round(+v) : 0)
  return [
    'p' + n(d.planTotal),
    'o' + n(d.planOverdue),
    'T' + n(d.planDueToday),
    'c' + (d.planChecked ? 1 : 0),
    'd' + n(d.diaryWeek),
    'D' + (d.diaryToday ? 1 : 0),
    'b' + n(d.billMonth),
    'B' + n(d.billBudgetPct),
    'r' + n(d.relationStale),
    'f' + n(d.profilePct),
    'g' + n(d.glimmerWeek)
  ].join('')
}

/**
 * 运行环境短码：AI 可用 / 首启 / 离线 / 深色（大小写区分真假）
 * @param {Object} [env]
 */
export function envKey(env = {}) {
  const e = env || {}
  return [
    e.aiReady ? 'a' : 'A',
    e.firstRun ? 'f' : 'F',
    e.offline ? 'o' : 'O',
    e.dark ? 'k' : 'K'
  ].join('')
}

/**
 * 上下文签名：任一层变化 → 签名变化 → 允许重出建议
 * @param {{ ymd?: string, bucket?: string, env?: Object, data?: Object }} opts
 */
export function buildAdviceSignature(opts = {}) {
  const o = opts || {}
  return [o.ymd || '', o.bucket || '', envKey(o.env), dataFingerprint(o.data)].join('|')
}
