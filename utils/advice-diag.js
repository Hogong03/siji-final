/**
 * advice-diag.js — 建议链路的按日聚合诊断（M3 埋点补丁）
 *
 * 只存计数，不存候选原文、不存用户内容：
 *   autoEntries   自动入口被尝试的次数（页面挂载且开关打开）
 *   autoShown     自动入口实际展示的方向数
 *   manualOpens   手动打开面板次数
 *   manualShown   手动入口实际展示的方向数
 *   silence*      按原因分组的沉默次数在 siji_advice_silence（本文件不重复记）
 *   considered / available / droppedNoRef / droppedDup / droppedCooldown   各层计数
 *   srcRule / srcLoop   候选来源分布
 *   autoDisabled  用户主动关掉自动弹出的次数（设置变化，不是拒绝）
 *
 * 保留：最近 30 天（按本地日），每天一个 key；写入时剪掉更早的。
 * 失败不影响主流程：所有存储操作都 try 包住。
 */

export const ADVICE_DIAG_KEY = 'siji_advice_diag'
/** 保留天数 */
export const DIAG_KEEP_DAYS = 30

const FIELDS = [
  'autoEntries', 'autoShown', 'manualOpens', 'manualShown',
  'considered', 'available', 'droppedNoRef', 'droppedDup', 'droppedCooldown',
  'srcRule', 'srcLoop', 'autoDisabled'
]

function ymd(now) {
  const d = new Date(now)
  const p = (n) => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
}

function emptyDay() {
  const o = {}
  for (const f of FIELDS) o[f] = 0
  return o
}

function read() {
  try {
    const raw = uni.getStorageSync(ADVICE_DIAG_KEY)
    const v = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null
    if (!v || typeof v !== 'object' || !v.days || typeof v.days !== 'object') return { days: {} }
    return v
  } catch (e) {
    return { days: {} }
  }
}

function prune(days, now) {
  const keys = Object.keys(days).sort()
  const cutoff = ymd(now - (DIAG_KEEP_DAYS - 1) * 86400000)
  const kept = keys.filter((k) => k >= cutoff)
  const out = {}
  for (const k of kept) out[k] = days[k]
  return out
}

function write(state, now) {
  try {
    state.days = prune(state.days, now)
    uni.setStorageSync(ADVICE_DIAG_KEY, JSON.stringify(state))
  } catch (e) { /* 统计失败不影响建议展示 */ }
}

/**
 * 累加诊断计数
 * @param {Object} patch 只认 FIELDS 里的数字字段，其余忽略
 * @param {number} [now]
 */
export function bumpDiag(patch, now = Date.now()) {
  const state = read()
  const day = ymd(now)
  const cur = Object.assign(emptyDay(), state.days[day] || {})
  let touched = false
  for (const f of FIELDS) {
    const v = patch && patch[f]
    if (typeof v === 'number' && Number.isFinite(v) && v !== 0) {
      cur[f] = (Number(cur[f]) || 0) + v
      touched = true
    }
  }
  if (!touched) return
  state.days[day] = cur
  write(state, now)
}

/** 原始按日数据（调试/交接用） */
export function getDiag() {
  return read()
}

/** 跨日汇总（评估用），另带统计范围 */
export function getDiagTotals() {
  const { days } = read()
  const total = emptyDay()
  const keys = Object.keys(days).sort()
  for (const k of keys) {
    const d = days[k] || {}
    for (const f of FIELDS) total[f] += Number(d[f]) || 0
  }
  return {
    ...total,
    days: keys.length,
    from: keys[0] || '',
    to: keys[keys.length - 1] || ''
  }
}

export function clearDiag() {
  try { uni.removeStorageSync(ADVICE_DIAG_KEY) } catch (e) { /* ignore */ }
}
