/**
 * useEnterSummary — 「进入总结」卡片状态（3.4.5 冷启动 / 3.5.12 前台恢复增量）
 *
 * 两条触发路径，共用同一张卡片与同一个确认基线 siji_enter_summary_at：
 *   - 冷启动：App.vue appReady → initEnterSummary()。首次升级静默武装基线（不弹存量老数据），
 *     之后算「确认基线 → 现在」的窗口
 *   - 回前台：App.vue onShow → refreshEnterSummary()。窗口起点取 siji_enter_summary_leave_at
 *     （onHide 写入），只报「你不在时」的新进展；进程被杀没写到时回落确认基线
 * 有内容才挂起 pending（附 source/awayMs 供卡片区分文案）；点「知道了/查看详情」推进确认基线。
 * 3.5.13：窗口起点取「确认基线与离开基线里更晚的那个」，卡片一旦展示就把离开基线推到 now ——
 * 不点「知道了」直接退出应用，下次冷启动也不会把同一批进展再报一遍（此前只在确认后不重复）。
 * 后台不轮询、不设定时器，只在切回前台时结算一次（60s 节流）。
 */
import { ref } from 'vue'
import { getPlanList } from '@/utils/storage.js'
import { getDiaryList } from '@/utils/storage/diary.js'
import {
  buildEnterSummary, resolveSummaryWindow, scanMoodDip, CONFIRM_KEY, LEAVE_KEY
} from '@/utils/enter-summary.js'
import { buildWeeklyBillAnnouncement, markWeeklyBillAnnounced } from '@/utils/bill-weekly.js'
import { collectPlanAlerts } from '@/utils/plan-alerts.js'
import { satisfiedToday } from '@/utils/plan-recur.js'
import { pickNextStep, shouldOfferNextStep } from '@/utils/next-step.js'
import { getPlanReminder } from '@/utils/reminder/settings.js'
import { isFeatureOn } from '@/utils/ai/features.js'

const pending = ref(null)
/** 上次结算时间（内存态，不落盘）：refreshEnterSummary 节流用 */
let lastCalcAt = 0

function readTs(key) {
  try {
    return Number(uni.getStorageSync(key)) || 0
  } catch (e) {
    return 0
  }
}

function writeTs(key, ts) {
  try {
    uni.setStorageSync(key, ts)
  } catch (e) {
    /* 存储失败不影响本次会话 */
  }
}

/* ==================== 4.5.0：计划状态包（alerts / 上班卡 / 下一步） ==================== */

/** 上班卡识别口径：打「工作」标签 + 名称含「打卡」的子计划（上班模板创建） */
function isWorkCheckinPlan(p) {
  return !!(p && !p.is_deleted && p.status !== 2 && !p.frozen_at && !p.someday_at &&
    Array.isArray(p.tags) && p.tags.includes('工作') &&
    p.parent_id && /打卡/.test(String(p.title || '')))
}

/** 该打卡计划的提醒时刻已过才算「该打没打」（没配置回落 上班 08:30 / 下班 18:00） */
function pastWorkTime(plan, kind, now) {
  let hhmm = ''
  try {
    const cfg = getPlanReminder(plan.client_id)
    if (cfg && cfg.customTime) hhmm = String(cfg.customTime)
  } catch (e) { /* 读不到就按默认时刻 */ }
  const m = hhmm.match(/(\d{1,2}):(\d{2})/)
  const cur = new Date(now)
  const curMin = cur.getHours() * 60 + cur.getMinutes()
  if (!m) return curMin >= (kind === 'out' ? 18 * 60 : 8 * 60 + 30)
  return curMin >= Number(m[1]) * 60 + Number(m[2])
}

/** 今天还没打的上下班卡：上班优先，打了上班报下班（null = 没有该催的卡） */
function collectWorkStatus(plans, now) {
  const work = (Array.isArray(plans) ? plans : []).filter(isWorkCheckinPlan)
  if (work.length === 0) return null
  const clockIn = work.find(p => /上班/.test(String(p.title || '')))
  const clockOut = work.find(p => /下班/.test(String(p.title || '')))
  if (clockIn && !satisfiedToday(clockIn, now) && pastWorkTime(clockIn, 'in', now)) {
    return { kind: 'in', clientId: clockIn.client_id, name: String(clockIn.title || '上班打卡') }
  }
  if (clockOut && !satisfiedToday(clockOut, now) && pastWorkTime(clockOut, 'out', now)) {
    return { kind: 'out', clientId: clockOut.client_id, name: String(clockOut.title || '下班打卡') }
  }
  return null
}

/**
 * 计划状态包：过时/快到期 + 上班卡 + 下一步候选
 * nextStep 只挑不标记 —— 消息真正落对话时才占用当天名额（useChatSession.appendEnterSummary）
 */
function buildPlanExtras(plans, now) {
  let alerts = null
  let workStatus = null
  let nextStep = null
  try { alerts = collectPlanAlerts(plans, now) } catch (e) { alerts = null }
  try { workStatus = collectWorkStatus(plans, now) } catch (e) { workStatus = null }
  // 4.10.0：「下一步建议」能力开关
  try {
    if (isFeatureOn('next_step') && shouldOfferNextStep(now)) nextStep = pickNextStep(plans)
  } catch (e) { nextStep = null }
  return { alerts: alerts, workStatus: workStatus, nextStep: nextStep }
}

/**
 * 当下状态快照（无窗口语义，4.5.0）：中对话新建 / 兜底开场的消息来源
 * 问候 + 计划状态 + 上班卡 + 下一步；没有进展行（events 全空）
 */
export function snapshotEnterContext(now = Date.now()) {
  let plans = []
  try { plans = getPlanList() } catch (e) { plans = [] }
  return Object.assign({
    events: [],
    eventsTotal: 0,
    diaryCount: 0,
    streak: 0,
    source: 'cold',
    awayMs: 0,
    moodDip: false,
    weekBill: null
  }, buildPlanExtras(plans, now))
}

/** 结算窗口增量；有内容返回带来源标记的总结，无内容返回 null */
function computeSummary(since, now, source) {
  const plans = getPlanList()
  const summary = buildEnterSummary({
    plans: plans,
    since,
    now,
    diaryReader: getDiaryList
  })
  // 3.5.13：连续两天低落时给一句休息提示（不诊断、不评分、不催）
  const moodDip = scanMoodDip({ since, now, diaryReader: getDiaryList })
  // 3.5.14：每周账单播报（三个数字，一周只出一次；生成即标记，不重复打扰）
  // 4.10.0：「周账单播报」能力开关
  let weekBill = null
  try {
    if (isFeatureOn('week_bill')) {
      weekBill = buildWeeklyBillAnnouncement({ now })
      if (weekBill) markWeeklyBillAnnounced(now)
    }
  } catch (e) {
    weekBill = null
  }
  // 4.5.0：计划状态包（过时/快到期 + 上班卡 + 下一步）跟着非空总结一起进消息
  const extras = buildPlanExtras(plans, now)
  if (summary.eventsTotal === 0 && summary.diaryCount === 0 && !moodDip && !weekBill) return null
  return Object.assign({}, summary, {
    source: source,
    awayMs: Math.max(0, now - since),
    moodDip: moodDip,
    weekBill: weekBill
  }, extras)
}

/** 应用冷启动时调用一次（App.vue appReady） */
export function initEnterSummary() {
  const now = Date.now()
  lastCalcAt = now
  try {
    const confirm = readTs(CONFIRM_KEY)
    if (!confirm) {
      // 首次升级：静默武装基线，避免把存量老数据一次性全部弹出来
      writeTs(CONFIRM_KEY, now)
      writeTs(LEAVE_KEY, now)
      pending.value = null
      return
    }
    // 本次冷启动的 onShow 结算（App onShow 早于 appReady）已出卡：保留它，别用宽窗口覆盖
    if (pending.value) return
    const summary = computeSummary(Math.max(confirm, readTs(LEAVE_KEY)), now, 'cold')
    pending.value = summary
    if (summary) {
      // 已展示：离开基线推进到 now，不点「知道了」直接退出也不重复报
      writeTs(LEAVE_KEY, now)
    } else {
      // 空窗口：推进基线，避免下次重复扫描同一段
      writeTs(CONFIRM_KEY, now)
      writeTs(LEAVE_KEY, now)
    }
  } catch (e) {
    pending.value = null
  }
}

/** 应用进入后台时调用（App.vue onHide）：记下离开时刻 */
export function markLeaveBaseline() {
  writeTs(LEAVE_KEY, Date.now())
}

/**
 * 回到前台时调用（App.vue onShow）：算「上次离开 → 现在」的增量
 * 跳过（已有未读卡片 / 距上次结算不足 60s / 基线未武装）时不推进窗口，
 * 被跳过那段时间的进展不会被吞掉，下次再算
 */
export function refreshEnterSummary() {
  const now = Date.now()
  const win = resolveSummaryWindow({
    confirmBaseline: readTs(CONFIRM_KEY),
    leaveBaseline: readTs(LEAVE_KEY),
    now,
    lastCalcAt,
    hasPending: !!pending.value
  })
  if (win.skip) return win
  lastCalcAt = now
  let summary = null
  try {
    summary = computeSummary(win.since, now, 'away')
  } catch (e) {
    summary = null
  }
  pending.value = summary
  if (!summary) writeTs(CONFIRM_KEY, now)
  // 无论有无内容都把离开基线推到 now：窗口只算一次，不滚雪球
  writeTs(LEAVE_KEY, now)
  return win
}

/** 用户点击「查看详情 / 知道了」后调用：清卡并推进基线 */
export function dismissEnterSummary() {
  pending.value = null
  const now = Date.now()
  writeTs(CONFIRM_KEY, now)
  writeTs(LEAVE_KEY, now)
}

/** 页面接入：返回模块级单例状态 */
export function useEnterSummary() {
  return { pending, dismiss: dismissEnterSummary }
}
