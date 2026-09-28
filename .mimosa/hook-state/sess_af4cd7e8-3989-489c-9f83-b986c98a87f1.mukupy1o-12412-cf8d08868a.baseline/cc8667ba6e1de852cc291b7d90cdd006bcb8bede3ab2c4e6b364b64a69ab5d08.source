/**
 * 计划执行上下文（3.3 A/B 共用）
 *
 * A 数据源：计划记录 executions[]（utils/storage/plan.js savePlan 在 status 非完成态切到 2 时自动入账 done）；
 *          plan_count 由 store/executors/plan.js 在 AI 结构性更新时累计（纯状态切换不计）。
 * B 逃避候选（D4=A）：主计划未完成 + 整棵树无执行 + AI 规划次数 >= 3 + 距最后一次更新 > 3 天；
 *          仅当用户消息命中该计划时才注入点破模板（D3=A：对话内点破，不主动推送）。
 */
import { logger } from './logger.js'

const PLAN_KEY = 'plan_all'
const DAY_MS = 24 * 60 * 60 * 1000

/** 计划关键词 — 命中才注入执行上下文（节省 token） */
const PLAN_KEYWORDS = /(?:计划|执行|开始做|做到哪|进度|完成得|下一步|目标|拖延|没做|放弃|取消)/

/** 读取全部计划（排除已删除） */
function getPlans() {
  try {
    const raw = uni.getStorageSync(PLAN_KEY)
    return raw ? JSON.parse(raw).filter(p => p.is_deleted !== 1) : []
  } catch (e) {
    logger.warn('plan-context read fail', e)
    return []
  }
}

/** 聚合某计划树（含自身与全部子孙）的执行日志，按时间倒序 */
export function collectPlanExecutions(planId) {
  const plans = getPlans()
  const out = []
  function appendLogs(p) {
    if (p && Array.isArray(p.executions)) {
      p.executions.forEach(e => out.push({ ...e, planId: p.client_id, title: p.title || '' }))
    }
  }
  function walk(pid) {
    plans.forEach(p => {
      if (p.parent_id === pid) {
        appendLogs(p)
        walk(p.client_id)
      }
    })
  }
  appendLogs(plans.find(p => p.client_id === planId))
  walk(planId)
  return out.sort((a, b) => (b.at || 0) - (a.at || 0))
}

/** 时间格式化 MM-DD HH:mm */
function fmtTs(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ''
  const pad = n => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * 逃避候选检测（D4=A）
 * @returns {Array<{plan: object, planCount: number, lastPlanAt: number}>} 按最后规划时间升序（越久越靠前）
 */
export function findProcrastinationCandidates({ minPlans = 3, gapDays = 3 } = {}) {
  const plans = getPlans()
  const now = Date.now()
  const out = []
  for (const p of plans) {
    if (!p || p.parent_id || p.status === 2) continue
    if (p.frozen_at) continue // 3.4 M3：冷藏计划不参与逃避检测（先放一放=合法状态）
    if (collectPlanExecutions(p.client_id).length > 0) continue
    const count = p.plan_count || 0
    if (count < minPlans) continue
    const lastAt = p.updated_at || p.created_at || 0
    if (!lastAt || now - lastAt < gapDays * DAY_MS) continue
    out.push({ plan: p, planCount: count, lastPlanAt: lastAt })
  }
  return out.sort((a, b) => a.lastPlanAt - b.lastPlanAt)
}

/** 用户消息是否点名了某计划（标题双向包含，或主计划标题前 4 字出现在消息中） */
function isMentioned(plan, message) {
  const title = (plan.title || '').trim()
  if (!title || !message) return false
  if (message.includes(title)) return true
  if (title.length >= 4 && title.slice(0, 4) && message.includes(title.slice(0, 4))) return true
  const compact = title.replace(/\s+/g, '')
  return compact.length >= 4 && message.includes(compact.slice(0, 4))
}

/**
 * 构建计划执行上下文（3.3 A/B + 3.4 M1/M3）
 * 仅当用户消息涉及计划且点名具体计划时返回注入文本；命中逃避候选时附点破模板。
 * 冷藏计划（frozen_at）不注入执行摘要/点破（M3）；noNudge=true 时抑制点破模板（M1 低能量）。
 */
export function buildPlanContext(userMessage, opts = {}) {
  if (!userMessage || !PLAN_KEYWORDS.test(userMessage)) return ''
  const plans = getPlans().filter(p => !p.parent_id && !p.frozen_at)
  const mentioned = plans.filter(p => isMentioned(p, userMessage)).slice(0, 2)
  if (mentioned.length === 0) return ''

  const parts = []
  for (const p of mentioned) {
    const logs = collectPlanExecutions(p.client_id)
    const doneLogs = logs.filter(l => l.action === 'done')
    let line = `【计划执行】「${p.title}」`
    if (doneLogs.length > 0) {
      const last = doneLogs[0]
      line += `：最近执行 ${doneLogs.length} 次，最近一次 ${fmtTs(last.at)}${last.title ? `完成「${last.title}」` : ''}`
    } else {
      line += '：还没有执行记录'
    }
    // 逃避候选 → 非评判点破模板（D3=A：仅对话内、仅用户点名该计划时）
    const isCandidate = !opts.noNudge && findProcrastinationCandidates().some(c => c.plan.client_id === p.client_id)
    if (isCandidate) {
      line += '；该计划已多次只规划未执行。若用户继续聊它，可以温和点破：只陈述观察事实，并给可选项——缩小范围 / 换更小的一步 / 暂停计划 / 今天不做也行。禁止催促、评判或打鸡血式文案'
    }
    parts.push(line)
  }
  return '\n\n' + parts.join('\n')
}
