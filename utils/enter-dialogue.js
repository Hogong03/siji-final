/**
 * enter-dialogue.js — 把「进入总结」写成一条对话消息（3.5.19）
 *
 * 3.4.5 起，进入应用时的新进展用顶部卡片呈现，和聊天是两套东西。3.5.19 改成伪对话：
 * 摘要作为 AI 的一条消息直接落在新对话里（说话的口吻、能接着聊），消息下方挂
 * 「查看详情 / 返回旧对话」两个操作，这样「看总结」和「继续说话 / 回旧对话」在同一处完成。
 *
 * 消息同时带上预置按钮（3.5.21）：点「记一笔 / 写个记录 / 定个计划」把话术填进输入框，
 * 点「查看详情 / 看计划 / 看新记录 / 看账单」直接跳对应页面。
 *
 * 纯函数、不依赖 uni，可直接单测（tests/enter-dialogue.test.js）。
 * 数据来源见 utils/enter-summary.js（本文件只负责把数据写成话）。
 */
import { formatSummaryTime, formatAwaySpan } from './enter-summary.js'

/** 摘要消息标记：chat-session 判空会话、页面渲染操作行都认这个字段 */
export const ENTER_SUMMARY_FLAG = '_isEnterSummary'

/** 开场白标记：与进入总结一样算「壳」（判空会话、冷启动清理都认它） */
export const WELCOME_FLAG = '_isWelcome'

/** 开场消息标记（3.10.0）：欢迎语与进入总结都算「开场」，页面按它渲染操作行 */
export const OPENER_FLAG = '_isOpener'

/** 摘要消息最多念几条计划事件（其余归入「还有 N 项」） */
export const ENTER_LINE_LIMIT = 3

/** 计划的详情页：有进展去打卡记录，只有记录去记录列表 */
export function enterSummaryRoute(summary) {
  return (summary && summary.eventsTotal > 0) ? '/pages/plan/records' : '/pages/diary/list'
}

/** 按时段的问候词（4.5.0 抽出：无进展时开场也要有一句问候） */
export function buildGreeting(now = Date.now()) {
  const hour = new Date(now).getHours()
  return hour < 5 ? '夜深了' : hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好'
}

/** 开场白：按时段问候 + 按来源区分「刚打开」与「离开回来」 */
export function buildEnterOpener(summary, now = Date.now()) {
  const greet = buildGreeting(now)
  if (!summary) return `${greet}。`
  const span = summary.awayMs > 0 ? formatAwaySpan(summary.awayMs) : ''
  const showSpan = !!span && span !== '刚刚'
  if (summary.source === 'away') {
    return showSpan ? `${greet}，你离开的这 ${span}：` : `${greet}，你不在的这会儿：`
  }
  return showSpan ? `${greet}。距上次小结 ${span}：` : `${greet}。这是上次小结以来的进展：`
}

/**
 * 摘要正文行（计划事件 + 记录数 + 连续打卡 + 账单播报 + 低落提示）
 * @param {Object} summary buildEnterSummary 的返回值（可含 moodDip / weekBill）
 * @returns {string[]} 没有内容返回空数组
 */
export function buildEnterLines(summary) {
  if (!summary) return []
  const out = []
  const events = Array.isArray(summary.events) ? summary.events : []
  events.slice(0, ENTER_LINE_LIMIT).forEach(e => {
    if (!e) return
    const kind = e.kind === 'done' ? '完成' : '打卡'
    const when = e.at ? formatSummaryTime(e.at) : ''
    const note = e.note ? '：' + e.note : ''
    out.push(`${kind} 计划「${e.title}」${when ? ' ' + when : ''}${note}`)
  })

  const extra = Math.max(0, (summary.eventsTotal || 0) - Math.min(ENTER_LINE_LIMIT, events.length))
  if (extra > 0) out.push(`还有 ${extra} 项进展`)
  if (summary.diaryCount > 0) out.push(`新增记录 ${summary.diaryCount} 条`)
  if ((summary.streak || 0) >= 2) out.push(`已连续打卡 ${summary.streak} 天`)
  if (summary.weekBill && summary.weekBill.text) out.push(summary.weekBill.text)
  if (summary.moodDip) out.push('这两天记录里写着低落，今天慢一点也算数')
  return out
}

/* ==================== 4.5.0：计划状态 / 下一步 / 上班卡 ==================== */

/** 过时+快到期最多点破几个（多余的归并进「还有 N 个」） */
export const ALERT_LINE_LIMIT = 2

/**
 * 计划状态行（collectPlanAlerts 的结果写成话）
 * 口径：过时是「点破 + 给出口」（收尾/顺延/今天做掉），快到期只报事实；不诊断、不催
 * @param {{ overdue: Array, dueSoon: Array, total: number }} [alerts]
 * @returns {string[]}
 */
export function buildPlanAlertLines(alerts) {
  const out = []
  if (!alerts) return out
  const overdue = Array.isArray(alerts.overdue) ? alerts.overdue : []
  const dueSoon = Array.isArray(alerts.dueSoon) ? alerts.dueSoon : []
  if (overdue.length > 0) {
    const shownList = overdue.slice(0, ALERT_LINE_LIMIT)
    const shown = shownList
      .map(p => `「${p.name}」已拖 ${p.lateDays} 天`)
      .join('、')
    const extra = overdue.length - shownList.length
    out.push(`有 ${overdue.length} 个计划过了截止：${shown}${extra > 0 ? `，还有 ${extra} 个` : ''} —— 要收尾、顺延还是今天做掉？`)
  }
  dueSoon.slice(0, ALERT_LINE_LIMIT).forEach(p => {
    out.push(p.leftDays <= 0 ? `「${p.name}」今天到期` : `「${p.name}」还有 ${p.leftDays} 天到期`)
  })
  return out
}

/** 下一步行（pickNextStep 的结果写成话；没有返回空串） */
export function buildNextStepLine(nextStep) {
  if (!nextStep || !nextStep.title) return ''
  const min = Number(nextStep.minutes) || 0
  return min > 0
    ? `下一步可以从「${nextStep.title}」开始，约 ${min} 分钟。`
    : `下一步可以从「${nextStep.title}」开始。`
}

/* ==================== 4.12.0：简报卡（结构化开场，渲染层卡片化） ==================== */

/** 简报卡版本：消息渲染与落盘白名单都认它；不带此字段的存量消息回落文本渲染 */
export const BRIEFING_VERSION = 2

/** 是否结构化简报卡消息（v2）—— 页面据此隐藏旧版页级按钮行 */
export function isBriefingV2(message) {
  return !!message && message._briefingVersion === BRIEFING_VERSION && !!message._briefing
}

/** 问候变化池：按时段给几条候选，按「年积日」轮换 —— 同一天同一句，隔天换一句（本地零成本） */
const GREETING_POOL = {
  deepNight: ['夜深了', '还没睡', '夜里的时光'],
  morning: ['早上好', '早', '新的一天', '早安'],
  noon: ['中午好', '午安', '半天过去了'],
  afternoon: ['下午好', '下午茶时间', '一天过半'],
  evening: ['晚上好', '今晚', '一天收尾了']
}

/** 简报卡问候语：时段池 + 年积日轮换（同一天稳定，跨天变化） */
export function buildBriefingGreeting(now = Date.now()) {
  const d = new Date(now)
  const hour = d.getHours()
  const slot = hour < 5 ? 'deepNight' : hour < 11 ? 'morning' : hour < 14 ? 'noon' : hour < 18 ? 'afternoon' : 'evening'
  const pool = GREETING_POOL[slot]
  const dayOfYear = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000)
  return pool[dayOfYear % pool.length]
}

/** 指标格（无数据的格子不渲染；最多 3 格） */
export function buildBriefingMetrics(summary) {
  if (!summary) return []
  const out = []
  const expense = Number(summary.yesterdayExpense) || 0
  if (expense > 0) out.push({ key: 'expense', value: `¥${expense}`, label: '昨日支出' })
  // 4.20.0：周一洞察 —— 上周支出格（只有周播报在场时给，与文本行同源）
  const weekTotal = summary.weekBill && Number(summary.weekBill.total) || 0
  if (weekTotal > 0) out.push({ key: 'weekSpend', value: `¥${weekTotal % 1 === 0 ? weekTotal : weekTotal.toFixed(2)}`, label: '上周支出' })
  if ((summary.streak || 0) >= 2) out.push({ key: 'streak', value: `${summary.streak} 天`, label: '连续打卡' })
  if ((summary.diaryCount || 0) > 0) out.push({ key: 'diary', value: String(summary.diaryCount), label: '新记录' })
  if ((summary.eventsTotal || 0) > 0) out.push({ key: 'events', value: String(summary.eventsTotal), label: '新进展' })
  return out.slice(0, 3)
}

/** 今日打卡进度（4.13.0）：pack/summary 里带 checkinToday（total>0）才产出，done 收敛到 [0, total] */
function buildBriefingCheckin(summary, pack) {
  const src = (pack && pack.checkinToday) || (summary && summary.checkinToday) || null
  const total = Number(src && src.total) || 0
  if (total <= 0) return null
  const done = Math.min(Math.max(Number(src.done) || 0, 0), total)
  return { done: done, total: total }
}

/**
 * 简报卡主按钮：一屏只推一件事 —— 优先级 上班卡 > 过时/快到期计划 > 下一步
 * @returns {{ key, label, action, value }|null} 与 _enterButtons 同构，action ∈ checkin/navigate/prefill
 */
export function buildBriefingPrimary(summary, extras) {
  const work = extras && extras.workStatus
  if (work && work.clientId) {
    return { key: 'checkin', label: work.kind === 'out' ? '打下班卡' : '打上班卡', action: 'checkin', value: work.clientId }
  }
  const alerts = extras && extras.alerts
  if (alerts && alerts.total > 0) {
    return { key: 'plan', label: '看计划', action: 'navigate', value: '/pages/plan/index' }
  }
  const next = extras && extras.nextStep
  if (next && next.title) {
    return { key: 'next', label: '就做这个', action: 'prefill', value: `开始做「${next.title}」` }
  }
  return null
}

/** 次级 chips：从全量按钮里去掉已升为主按钮的那颗，再截前 3 个 */
export function buildBriefingChips(summary, extras, primary) {
  const all = buildEnterButtons(summary, extras)
  const dropped = primary ? primary.key : ''
  return all.filter(b => b.key !== dropped).slice(0, 3)
}

/**
 * 结构化简报 payload（4.12.0）：挂在进入消息上由 EnterBriefing 组件渲染；
 * 纯数据可单测。content 文本仍照旧生成 —— 老版本回落渲染与 AI 历史窗口都还吃它。
 * @param {Object|null} summary buildEnterSummary 的返回值
 * @param {{ alerts?, nextStep?, workStatus? }} [extras]
 * @param {number} [now]
 */
export function buildBriefing(summary, extras = null, now = Date.now()) {
  const pack = extras || summary || {}
  const primary = buildBriefingPrimary(summary, pack)
  const nextLine = buildNextStepLine(pack.nextStep)
  return {
    version: BRIEFING_VERSION,
    greeting: buildBriefingGreeting(now),
    opener: buildEnterOpener(summary, now),
    metrics: buildBriefingMetrics(summary),
    // 4.13.0：今日打卡进度（无可打卡计划为 null，渲染层不出进度行）
    checkin: buildBriefingCheckin(summary, pack),
    statusLines: buildPlanAlertLines(pack.alerts).concat(buildWorkLine(pack.workStatus)).filter(Boolean),
    nextLine: nextLine,
    primary: primary,
    chips: buildBriefingChips(summary, pack, primary),
    moodDip: !!(summary && summary.moodDip)
  }
}

/**
 * 上班卡行（4.5.0：上班模板的打卡子计划今天还没打且已过提醒时刻）
 * @param {{ kind: 'in'|'out', name: string, clientId: string }} [workStatus]
 * @returns {string}
 */
export function buildWorkLine(workStatus) {
  if (!workStatus || !workStatus.name) return ''
  return workStatus.kind === 'out'
    ? `今天还没打下班卡（${workStatus.name}），走之前记得打一个。`
    : `今天还没打上班卡（${workStatus.name}），到了就打一个。`
}

/**
 * 摘要消息里预置的按钮（3.5.21；4.5.0 扩展计划状态 / 上班卡 / 下一步）
 * 对话形式：点一下就能接着做，不用自己想说什么。六类 ——
 *   上下文（摘要里提到什么就给什么入口）/ 计划状态（过时快到期给「看计划」）/
 *   上班卡（直达打卡）/ 下一步（预置话术）/ 通用（记账、记录、计划）/ 情绪提示
 * 顺序即渲染顺序；「返回旧对话」不放这里，它要 resumeTarget，只有页面知道该指向哪。
 *
 * @param {Object} summary buildEnterSummary 的返回值
 * @param {{ alerts?: Object, nextStep?: Object, workStatus?: Object }} [extras] 4.5.0 状态包
 * @returns {Array<{key: string, label: string, action: 'navigate'|'prefill'|'checkin', value: string}>}
 *   navigate 的 value 是路由，prefill 是预置话术，checkin 的 value 是计划 client_id
 */
export function buildEnterButtons(summary, extras = null) {
  const out = []
  const add = (key, label, action, value) => {
    if (out.some(b => b.key === key)) return
    out.push({ key: key, label: label, action: action, value: value })
  }

  // 摘要相关按钮：没有摘要（欢迎语开场）时跳过，但通用三个照给（3.10.0）
  if (summary) {
    if ((summary.eventsTotal || 0) > 0) {
      add('detail', '查看详情', 'navigate', enterSummaryRoute(summary))
      add('plan', '看计划', 'navigate', '/pages/plan/index')
    }
    if ((summary.diaryCount || 0) > 0) add('diary', '看新记录', 'navigate', '/pages/diary/list')
    if (summary.weekBill && summary.weekBill.text) add('bill', '看账单', 'navigate', '/pages/bill/index')
    // 4.20.0：周洞察的建议按钮 —— 预填追问「看看上周XX都花在哪了」，AI 有 query_bill 接得住
    if (summary.weekBill && summary.weekBill.suggestion && summary.weekBill.suggestion.prefill) {
      add('insight', '看看花在哪', 'prefill', summary.weekBill.suggestion.prefill)
    }
    if (summary.moodDip) add('mood', '聊聊现在的状态', 'prefill', '我想聊聊最近的状态')
  }

  // 4.5.0：计划状态 / 上班卡 / 下一步（没有摘要时也照给 —— 进入消息恒产出这些状态）
  const alerts = extras && extras.alerts
  if (alerts && alerts.total > 0) add('plan', '看计划', 'navigate', '/pages/plan/index')
  const work = extras && extras.workStatus
  if (work && work.clientId) add('checkin', work.kind === 'out' ? '打下班卡' : '打上班卡', 'checkin', work.clientId)
  const next = extras && extras.nextStep
  if (next && next.title) add('next', '就做这个', 'prefill', `开始做「${next.title}」`)

  add('note', '记一笔', 'prefill', '记一笔 ')
  add('diary-new', '写个记录', 'prefill', '写个记录：')
  add('plan-new', '定个计划', 'prefill', '帮我定个计划')
  return out
}

/**
 * 开场消息的预置按钮：没有进展可播报时用哪几个
 * 与进入总结共用 buildEnterButtons，保证「对话里所有按钮都点得动」的口径一致
 * @returns {Array<{key: string, label: string, action: string, value: string}>}
 */
export function buildWelcomeButtons() {
  return buildEnterButtons(null)
}

/**
 * 把开场白写成一条可入对话的 AI 消息（3.10.0）
 * 与进入总结消息的区别只有内容：没有进展可播报时用它，操作行按钮完全一样
 * @param {string} text 开场白正文
 * @returns {Object|null} { role, content, _isWelcome, _isOpener, _enterButtons }，空内容返回 null
 */
export function buildWelcomeMessage(text) {
  const content = String(text == null ? '' : text).trim()
  if (!content) return null
  const message = {
    role: 'assistant',
    content: content,
    _isOpener: true,
    _enterButtons: buildWelcomeButtons()
  }
  message[WELCOME_FLAG] = true
  return message
}

/**
 * 这条消息要不要渲染操作行（进入总结与开场白都渲染 —— 按钮都点得动是硬要求）
 * @param {Object} message
 * @returns {boolean}
 */
export function hasOpenerActions(message) {
  if (!message) return false
  const buttons = Array.isArray(message._enterButtons) ? message._enterButtons : []
  return (message[ENTER_SUMMARY_FLAG] === true || message[OPENER_FLAG] === true) && buttons.length > 0
}

/**
 * 把进入总结写成一条可入对话的 AI 消息（4.5.0 恒产出）
 *
 * 一条消息囊括：问候 + 进展总结 + 计划状态（过时/快到期）+ 上班卡 + 下一步 + 预置按钮。
 * 就算没有进展、没有状态、没有下一步，也出「问候 + 通用按钮」的一条 ——
 * 新对话的开场不再回落欢迎语（buildWelcomeMessage 只剩存量数据清理语义）。
 *
 * @param {Object|null} summary useEnterSummary 的 pending 值（可 null = 只有当下状态）
 * @param {{ alerts?: Object, nextStep?: Object, workStatus?: Object }} [extras] 计划状态包（挂在 summary 上也认）
 * @param {number} [now]
 * @returns {Object} { role, content, _isEnterSummary, _enterSummaryKind, _enterSummaryDigest, _enterButtons }
 */
export function buildEnterSummaryMessage(summary, extras = null, now = Date.now()) {
  // 兼容旧签名 buildEnterSummaryMessage(summary, now)：第二参传数字当时间
  if (typeof extras === 'number') {
    now = extras
    extras = null
  }
  const pack = extras || summary || {}
  const lines = buildEnterLines(summary)
  const statusLines = buildPlanAlertLines(pack.alerts)
  const workLine = buildWorkLine(pack.workStatus)
  if (workLine) statusLines.push(workLine)
  const nextLine = buildNextStepLine(pack.nextStep)
  if (nextLine) statusLines.push(nextLine)

  // 开场白：有进展念进展（带离开时长），没有就是一句干净的问候
  const head = lines.length > 0
    ? buildEnterOpener(summary, now)
    : (summary && summary.source === 'away'
        ? `${buildGreeting(now)}，回来了。`
        : `${buildGreeting(now)}。`)
  const allLines = lines.concat(statusLines)
  const tail = allLines.length > 0
    ? '要细看哪一项就说，或者直接说你现在想做什么。'
    : '今天想从什么开始？说一声就行。'

  // 用 markdown 列表语法（'- '）：MarkdownRenderer 会渲染成带圆点的列表项，
  // 用「·」这种裸字符只会在同一段里换行，长摘要糊成一坨
  const content = [head, '', ...allLines.map(line => '- ' + line), '', tail].join('\n')

  const alerts = pack.alerts
  const next = pack.nextStep
  const work = pack.workStatus
  const message = {
    role: 'assistant',
    content: content,
    _isOpener: true,
    _enterSummaryKind: (summary && summary.source === 'away') ? 'away' : 'cold',
    _enterButtons: buildEnterButtons(summary, pack),
    // 4.12.0：结构化简报卡（渲染层卡片化；文本 content 保留供老版本回落与 AI 历史窗口）
    _briefingVersion: BRIEFING_VERSION,
    _briefing: buildBriefing(summary, pack, now),
    _enterSummaryDigest: {
      eventsTotal: (summary && summary.eventsTotal) || 0,
      diaryCount: (summary && summary.diaryCount) || 0,
      streak: (summary && summary.streak) || 0,
      moodDip: !!(summary && summary.moodDip),
      weekBill: (summary && summary.weekBill && summary.weekBill.text) || '',
      route: enterSummaryRoute(summary),
      // 4.5.0：状态包摘要（页面按 nextStepTitle 在消息落对话后占用当天「下一步」名额）
      alertsTotal: (alerts && alerts.total) || 0,
      nextStepTitle: (next && next.title) || '',
      workPending: !!(work && work.clientId)
    }
  }
  message[ENTER_SUMMARY_FLAG] = true
  return message
}

/**
 * 摘要签名：来源 + 离开时长 + 各项计数 + 计划状态（4.5.0）
 * 页面用它去重 —— 回前台每算一次都会生成新对象，签名相同说明还是同一批内容
 * 注意：nextStep 不进签名（落对话时占用当天名额并标记，重复计算不该因此再写一条）
 * @param {Object} summary
 * @param {{ alerts?: Object, nextStep?: Object, workStatus?: Object }} [extras]
 * @returns {string} 没有进展也没有状态返回空串
 */
export function enterSummarySignature(summary, extras = null) {
  if (!summary) return ''
  const pack = extras || summary
  const lines = buildEnterLines(summary)
  const alerts = pack.alerts
  const work = pack.workStatus
  const hasStatus = (alerts && alerts.total > 0) || (work && work.clientId)
  if (lines.length === 0 && !hasStatus) return ''
  return [
    summary.source || 'cold',
    summary.awayMs || 0,
    summary.eventsTotal || 0,
    summary.diaryCount || 0,
    summary.streak || 0,
    (alerts && alerts.total) || 0,
    (work && work.clientId) || ''
  ].join('|')
}

/**
 * 这条总结要不要落成对话消息
 * @param {Object} summary
 * @param {string} [lastSignature] 已经写进对话的那条签名
 * @returns {boolean} 空内容或重复都返回 false
 */
export function shouldAppendEnterSummary(summary, lastSignature = '') {
  const sig = enterSummarySignature(summary)
  if (!sig) return false
  return sig !== lastSignature
}

/** 该消息是否是进入总结（页面渲染操作行用） */
export function isEnterSummaryMessage(message) {
  return !!(message && message[ENTER_SUMMARY_FLAG])
}