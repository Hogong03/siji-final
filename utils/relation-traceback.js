/**
 * relation-traceback.js — 关系事件回溯（4.40.0）
 *
 * 用途：用户问「为什么我最近觉得和小王疏远了」时，AI 必须先摆**事实与自己的感受**，
 * 原因只能作为**推测**提出。三层严格分离：
 *   【事实】 用户自己记录过的互动：时间、场景、做了什么、结果
 *   【你的感受】 用户自己写下的情绪（不是 AI 判断的情绪）
 *   【表达规则】 解释只能是推测并明确标注，禁止断言对方的态度/想法
 *
 * 数据来源：复用现有 siji_interactions（scene / content / result / emotion / date），
 * **不新增存储字段**；时间线按 date 倒序、可设时间窗与条数上限。
 */
import { getInteractions, detectMentionedRelations } from './relations.js'

const DAY_MS = 86400000

/** 情绪极性词表（只做提示性归类，不做诊断、不打分） */
const POSITIVE_WORDS = ['开心', '愉快', '高兴', '轻松', '温暖', '感动', '顺利', '亲切', '舒服', '满意', '期待', '亲近', '放心', '踏实', '好玩', '有趣']
const NEGATIVE_WORDS = ['低落', '难过', '沮丧', '麻木', '崩溃', '焦虑', '烦躁', '生气', '愤怒', '无奈', '失望', '委屈', '紧张', '尴尬', '疏远', '冷淡', '心累', '烦', '不安', '受伤', '憋屈', '内疚', '后悔']
/** 否定式正面（「不太开心」不能算正面） */
const NEGATED_POSITIVE = /不(?:太|怎么|很)?(?:开心|高兴|舒服|安|顺|好|爽)/

/**
 * 情绪极性归类
 * @param {string} text
 * @returns {'positive'|'negative'|'neutral'|'unknown'}
 */
export function classifyEmotion(text) {
  const s = String(text == null ? '' : text).trim()
  if (!s) return 'unknown'
  if (NEGATIVE_WORDS.some(w => s.includes(w))) return 'negative'
  if (NEGATED_POSITIVE.test(s)) return 'negative'
  if (POSITIVE_WORDS.some(w => s.includes(w))) return 'positive'
  return 'neutral'
}

/** 互动的时间戳（date 优先，回落 created_at） */
function tsOf(item) {
  return Number(item && item.date) || Number(item && item.created_at) || 0
}

/**
 * 按人取互动时间线（新 → 旧）
 * @param {string} relationId
 * @param {{ sinceDays?: number, limit?: number, now?: number }} [opts]
 * @returns {Array<{id,date,days_ago,scene,content,result,emotion,polarity}>}
 */
export function getRelationTimeline(relationId, opts = {}) {
  if (!relationId) return []
  const sinceDays = Number.isFinite(opts.sinceDays) ? opts.sinceDays : 90
  const limit = Number.isFinite(opts.limit) ? opts.limit : 20
  const now = Number.isFinite(opts.now) ? opts.now : Date.now()
  const from = now - sinceDays * DAY_MS

  return getInteractions(relationId)
    .filter(i => tsOf(i) >= from)
    .sort((a, b) => tsOf(b) - tsOf(a))
    .slice(0, limit)
    .map(i => {
      const t = tsOf(i)
      const emotion = i.emotion || ''
      return {
        id: i.id,
        date: t,
        days_ago: Math.max(0, Math.floor((now - t) / DAY_MS)),
        scene: i.scene || '日常',
        content: i.content || '',
        result: i.result || '',
        emotion,
        polarity: classifyEmotion(emotion)
      }
    })
}

/**
 * 情绪走向摘要：把时间线（新→旧）对半切，比较两段的负面占比。
 * 样本太少（带情绪记录 < 4 条）时返回 'unknown'，不硬给走向。
 * @param {Array} items getRelationTimeline 的返回值
 * @returns {{ total:number, positive:number, negative:number, neutral:number, unknown:number,
 *             sample:number, trend:'up'|'down'|'flat'|'unknown' }}
 */
export function summarizeEmotionShift(items) {
  const list = Array.isArray(items) ? items.filter(Boolean) : []
  const counts = { positive: 0, negative: 0, neutral: 0, unknown: 0 }
  const polarityOf = (i) => i.polarity || classifyEmotion(i.emotion)
  list.forEach(i => { counts[polarityOf(i)] = (counts[polarityOf(i)] || 0) + 1 })

  const withEmotion = list.filter(i => polarityOf(i) !== 'unknown')
  let trend = 'unknown'
  if (withEmotion.length >= 4) {
    const half = Math.floor(withEmotion.length / 2)
    const recent = withEmotion.slice(0, half)      // 新 → 旧
    const earlier = withEmotion.slice(half)
    const negRatio = (arr) => arr.filter(i => polarityOf(i) === 'negative').length / arr.length
    const diff = negRatio(recent) - negRatio(earlier)
    if (diff >= 0.3) trend = 'down'
    else if (diff <= -0.3) trend = 'up'
    else trend = 'flat'
  }
  return { total: list.length, ...counts, sample: withEmotion.length, trend }
}

/**
 * 是否是「关系变化」类提问（决定要不要注入回溯上下文）
 * 覆盖：疏远 / 变冷淡 / 关系变差 / 为什么对我这样 / 是不是讨厌我
 */
const TRACEBACK_INTENT = /(疏远|冷淡|变冷|变差|变淡|不联系|不理我|不回我|关系.{0,6}(变化|变差|不好)|为什么.{0,10}(关系|对我|不理|冷淡)|是不是.{0,10}(讨厌|烦|不想理))/

export function detectTracebackIntent(userMessage) {
  return TRACEBACK_INTENT.test(String(userMessage == null ? '' : userMessage))
}

/** 天前 / 今天 */
function agoText(days) {
  if (days <= 0) return '今天'
  if (days === 1) return '昨天'
  return `${days} 天前`
}

const TREND_TEXT = {
  down: '与更早的记录相比，近期情绪更偏负面',
  up: '与更早的记录相比，近期情绪更偏正面',
  flat: '前后两段的情绪差不多',
  unknown: '带情绪的记录太少，看不出走向'
}

/**
 * 构建关系事件回溯上下文（注入系统提示词）
 *
 * 找不到被提到的人物时返回 ''（不猜是谁）。多个人被提到时取最近有互动的那个。
 * @param {string} userMessage
 * @param {{ relation?: object, sinceDays?: number, limit?: number, now?: number }} [opts]
 * @returns {string}
 */
export function buildTracebackContext(userMessage, opts = {}) {
  const msg = String(userMessage == null ? '' : userMessage)
  let relation = opts.relation || null

  if (!relation) {
    const mentioned = detectMentionedRelations(msg)
    if (mentioned.length === 0) return ''
    relation = mentioned
      .slice()
      .sort((a, b) => (Number(b.last_interaction) || 0) - (Number(a.last_interaction) || 0))[0]
  }
  if (!relation) return ''

  const sinceDays = Number.isFinite(opts.sinceDays) ? opts.sinceDays : 90
  const items = getRelationTimeline(relation.id, { sinceDays, limit: opts.limit, now: opts.now })
  const shift = summarizeEmotionShift(items)
  const name = relation.name || '这个人'

  const lines = [`\n\n---\n关系回溯（${name}，只依据用户自己记录的内容，最近 ${sinceDays} 天）：`]

  // 【事实】
  if (items.length === 0) {
    lines.push(`【事实】最近 ${sinceDays} 天没有记录到与「${name}」的互动 —— 这**不能**证明关系变差（也可能只是没记），先如实说明这一点，再问用户最近发生了什么。`)
  } else {
    lines.push(`【事实】用户自己记录过 ${items.length} 次互动：`)
    items.slice(0, 8).forEach(i => {
      const parts = [`  - ${agoText(i.days_ago)} · ${i.scene}：${String(i.content).substring(0, 40)}`]
      if (i.result) parts.push(`（结果：${String(i.result).substring(0, 30)}）`)
      lines.push(parts.join(''))
    })
  }

  // 【你的感受】
  if (shift.sample === 0) {
    lines.push('【你的感受】这些互动里没有记录过情绪，因此没有可用的感受数据 —— 不要替用户编造感受。')
  } else {
    const pieces = []
    if (shift.negative) pieces.push(`负面 ${shift.negative} 次`)
    if (shift.positive) pieces.push(`正面 ${shift.positive} 次`)
    if (shift.neutral) pieces.push(`中性 ${shift.neutral} 次`)
    lines.push(`【你的感受】用户自己写下的情绪共 ${shift.sample} 条（${pieces.join('、')}）；${TREND_TEXT[shift.trend]}。`)
  }

  // 【表达规则】
  lines.push('【表达规则】上面是事实与用户自己的感受，都来自他自己的记录。原因只能作为**推测**提出：用「可能/也许」并明确说明这是你的猜测；禁止断言对方的态度或想法（不许说「他变冷淡了」这类结论）；样本不足就直接说不确定。')

  return lines.join('\n')
}
