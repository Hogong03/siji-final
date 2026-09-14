/**
 * 打卡回执（3.5.6）
 *
 * 一句话反馈：跨过连续里程碑时给肯定，否则回原本的确认文案；不弹窗、无音效、不打断。
 * 连续口径按循环类型分流：weekly 看连续达标周数，其余看连续打卡天数。
 */
import { recurTypeOf, weeklyStreakOf, calcCheckinStreak, streakMilestoneOf } from './plan-recur.js'

/** 该计划当前「连续」数值（weekly=连续达标周数，其余=连续打卡天数） */
export function streakOfPlanRecord(plan, nowTs = Date.now()) {
  if (!plan) return 0
  return recurTypeOf(plan) === 'weekly' ? weeklyStreakOf(plan, nowTs) : calcCheckinStreak(plan, nowTs)
}

/** 连续单位：weekly 返回 week，其余返回 day */
export function streakKindOf(plan) {
  return recurTypeOf(plan) === 'weekly' ? 'week' : 'day'
}

/**
 * 打卡回执：跨过里程碑说一句，否则回原本文案
 * @returns {number} 跨过的里程碑数值（未跨过 0）
 */
export function checkinFeedback(afterStreak, beforeStreak, fallback, kind = 'day') {
  const hit = streakMilestoneOf(afterStreak, beforeStreak, kind)
  if (hit > 0) {
    uni.showToast({
      title: kind === 'week' ? '连续 ' + hit + ' 周达标，稳' : '连续 ' + hit + ' 天，稳',
      icon: 'none'
    })
    return hit
  }
  uni.showToast({ title: fallback, icon: 'none' })
  return 0
}
