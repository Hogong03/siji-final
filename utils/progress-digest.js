/**
 * progress-digest.js — 「你不在时」的动静摘要（3.5.13）
 *
 * 供给 AI 上下文：把上次结算以来的增量压成 1-3 行，让 AI 能自然续上
 * （「你昨天把晨跑打了卡」），而不是每次都说「我看看记录」。
 * 口径与进入总结卡片完全一致（同一对基线 CONFIRM_KEY / LEAVE_KEY），
 * 只含已发生的成果，绝不含未完成事项 —— 铁律 8：缺口只有用户主动问才出现。
 * 无内容返回空串，不占 token。
 */
import { getPlanList } from './storage.js'
import { getDiaryList } from './storage/diary.js'
import {
  CONFIRM_KEY, LEAVE_KEY, countEventsByKind, calcGlobalStreak, monthKeyOf, formatAwaySpan
} from './enter-summary.js'

function readTs(key) {
  try {
    return Number(uni.getStorageSync(key)) || 0
  } catch (e) {
    return 0
  }
}

/** 今天 00:00 的时间戳 */
function dayStartOf(now) {
  const d = new Date(now)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** 今天新增的记录条数（只读当前月分片） */
function countTodayDiaries(now, todayStart) {
  const list = getDiaryList(monthKeyOf(now))
  if (!Array.isArray(list)) return 0
  return list.filter(d => d && d.is_deleted !== 1 && d.created_at >= todayStart && d.created_at <= now).length
}

/**
 * 生成给模型看的动静摘要（含前导分隔线；无内容返回空串）
 * @param {Object} [opts]
 * @param {Array} [opts.plans] - 计划列表，默认 getPlanList()（便于测试注入）
 * @param {number} [opts.now] - 当前时间（ms），默认 Date.now()
 * @returns {string}
 */
export function buildProgressDigest({ plans = null, now = Date.now() } = {}) {
  const source = Array.isArray(plans) ? plans : getPlanList()
  const since = Math.max(readTs(CONFIRM_KEY), readTs(LEAVE_KEY))
  const todayStart = dayStartOf(now)

  const away = since > 0 ? countEventsByKind(source, since, now) : { done: 0, checkin: 0 }
  const today = countEventsByKind(source, todayStart, now)
  const diaries = countTodayDiaries(now, todayStart)
  const streak = calcGlobalStreak(source, now)

  const lines = []
  if (away.done > 0 || away.checkin > 0) {
    const parts = []
    if (away.done > 0) parts.push('完成 ' + away.done + ' 项')
    if (away.checkin > 0) parts.push('打卡 ' + away.checkin + ' 次')
    const span = formatAwaySpan(now - since)
    const label = span && span !== '刚刚' ? '（' + span + '）' : ''
    lines.push('· 上次离开' + label + '：' + parts.join('、'))
  }

  const todayParts = []
  if (today.done > 0) todayParts.push('完成 ' + today.done + ' 项')
  if (today.checkin > 0) todayParts.push('打卡 ' + today.checkin + ' 次')
  if (diaries > 0) todayParts.push('新增记录 ' + diaries + ' 条')
  if (todayParts.length > 0) lines.push('· 今天：' + todayParts.join('、'))

  if (streak >= 2) lines.push('· 连续打卡 ' + streak + ' 天')

  if (lines.length === 0) return ''
  return '\n\n---\n用户近期动静（只在你自然需要时引用，不要逐条复述，不要提未完成的事）：\n' + lines.join('\n')
}
