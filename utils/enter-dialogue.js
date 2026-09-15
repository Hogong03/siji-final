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

/** 摘要消息最多念几条计划事件（其余归入「还有 N 项」） */
export const ENTER_LINE_LIMIT = 3

/** 计划的详情页：有进展去打卡记录，只有记录去记录列表 */
export function enterSummaryRoute(summary) {
  return (summary && summary.eventsTotal > 0) ? '/pages/plan/records' : '/pages/diary/list'
}

/** 开场白：按时段问候 + 按来源区分「刚打开」与「离开回来」 */
export function buildEnterOpener(summary, now = Date.now()) {
  const hour = new Date(now).getHours()
  const greet = hour < 5 ? '夜深了' : hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好'
  const span = summary && summary.awayMs > 0 ? formatAwaySpan(summary.awayMs) : ''
  const showSpan = !!span && span !== '刚刚'
  if (summary && summary.source === 'away') {
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

/**
 * 摘要消息里预置的按钮（3.5.21）
 *
 * 对话形式：点一下就能接着做，不用自己想说什么。四类 ——
 *   上下文（摘要里提到什么就给什么入口）/ 通用（记账、记录、计划）/ 情绪提示 / 返回旧对话（页面追加，见下）
 * 顺序即渲染顺序；「返回旧对话」不放这里，它要 resumeTarget，只有页面知道该指向哪条。
 *
 * @param {Object} summary buildEnterSummary 的返回值
 * @returns {Array<{key: string, label: string, action: 'navigate'|'prefill', value: string}>} action 为 navigate 时 value 是路由，prefill 时是预置话术
 */
export function buildEnterButtons(summary) {
  const out = []
  if (!summary) return out
  const add = (key, label, action, value) => {
    if (out.some(b => b.key === key)) return
    out.push({ key: key, label: label, action: action, value: value })
  }

  if ((summary.eventsTotal || 0) > 0) {
    add('detail', '查看详情', 'navigate', enterSummaryRoute(summary))
    add('plan', '看计划', 'navigate', '/pages/plan/index')
  }
  if ((summary.diaryCount || 0) > 0) add('diary', '看新记录', 'navigate', '/pages/diary/list')
  if (summary.weekBill && summary.weekBill.text) add('bill', '看账单', 'navigate', '/pages/bill/index')
  if (summary.moodDip) add('mood', '聊聊现在的状态', 'prefill', '我想聊聊最近的状态')

  add('note', '记一笔', 'prefill', '记一笔 ')
  add('diary-new', '写个记录', 'prefill', '写个记录：')
  add('plan-new', '定个计划', 'prefill', '帮我定个计划')
  return out
}

/**
 * 把进入总结写成一条可入对话的 AI 消息
 * @param {Object} summary useEnterSummary 的 pending 值
 * @param {number} [now]
 * @returns {Object|null} { role, content, _isEnterSummary, _enterSummaryKind, _enterSummaryDigest }，无内容返回 null
 */
export function buildEnterSummaryMessage(summary, now = Date.now()) {
  if (!summary) return null
  const lines = buildEnterLines(summary)
  if (lines.length === 0) return null

  const head = buildEnterOpener(summary, now)
  const tail = '要细看哪一项就说，或者直接说你现在想做什么。'
  // 用 markdown 列表语法（'- '）：MarkdownRenderer 会渲染成带圆点的列表项，
  // 用「·」这种裸字符只会在同一段里换行，长摘要糊成一坨
  const content = [head, '', ...lines.map(line => '- ' + line), '', tail].join('\n')

  const message = {
    role: 'assistant',
    content: content,
    _enterSummaryKind: summary.source === 'away' ? 'away' : 'cold',
    _enterButtons: buildEnterButtons(summary),
    _enterSummaryDigest: {
      eventsTotal: summary.eventsTotal || 0,
      diaryCount: summary.diaryCount || 0,
      streak: summary.streak || 0,
      moodDip: !!summary.moodDip,
      weekBill: (summary.weekBill && summary.weekBill.text) || '',
      route: enterSummaryRoute(summary)
    }
  }
  message[ENTER_SUMMARY_FLAG] = true
  return message
}

/**
 * 摘要签名：来源 + 离开时长 + 各项计数
 * 页面用它去重 —— 回前台每算一次都会生成新对象，签名相同说明还是同一批进展
 * @param {Object} summary
 * @returns {string} 无内容返回空串
 */
export function enterSummarySignature(summary) {
  if (!summary) return ''
  const lines = buildEnterLines(summary)
  if (lines.length === 0) return ''
  return [
    summary.source || 'cold',
    summary.awayMs || 0,
    summary.eventsTotal || 0,
    summary.diaryCount || 0,
    summary.streak || 0
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