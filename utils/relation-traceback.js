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
 * 含蓄关系变化的线索词（4.44.0；单一口径，意图门与分句合格性共用）
 *
 * **这些词单独出现不构成触发条件** —— 必须与「双方指向」（和/跟/与/同 + 某人）组合，
 * 否则「阿伟最近怪怪的」（只是状态描述）、「这家店越来越客气了」（无关用法）都会被误触发。
 */
const IMPLICIT_CHANGE = '不如以前|不如从前|没以前|没从前|不像以前|没话说|没得聊|无话可说|话越来越少|联系越来越少|越来越没话|越来越少话|越来越客气|越来越淡|生疏'

/**
 * 是否是「关系变化」类提问（决定要不要注入回溯上下文）
 *
 * 显式说法（疏远/冷淡/变差/不理我…）直接命中；
 * 含蓄说法要求 **双方指向 + 关系状态变化线索** 同时出现（4.44.0），
 * 例如「和阿伟不如以前了」「我和阿伟没以前那么亲近了」「跟阿伟越来越没话说」。
 * 只有状态词、没有「用户与某人」这层指向的句子（「阿伟最近有点怪怪的」）**不触发**。
 */
const TRACEBACK_INTENT = new RegExp(
  '(疏远|冷淡|变冷|变差|变淡|不联系|不理我|不回我|关系.{0,6}(变化|变差|不好)' +
  '|为什么.{0,10}(关系|对我|不理|冷淡)|是不是.{0,10}(讨厌|烦|不想理)' +
  '|(?:和|跟|与|同)\\s*[^，,。！？!?；;\\s]{1,6}[^，,。！？!?；;]{0,10}?(?:' + IMPLICIT_CHANGE + '))'
)

export function detectTracebackIntent(userMessage) {
  return TRACEBACK_INTENT.test(String(userMessage == null ? '' : userMessage))
}

/** 天前 / 今天 */
function agoText(days) {
  if (days <= 0) return '今天'
  if (days === 1) return '昨天'
  return `${days} 天前`
}

/**
 * 关系对象里出现这些称谓 → 话题是「他跟别人」，不是「我和他」
 * （娶亲/亲属/角色称谓，不含人名——人名由「他/她 + 跟/和/与」结构兜住）
 */
const OTHER_PARTY_ROLE = /(?:女朋友|男朋友|女友|男友|老婆|老公|妻子|丈夫|媳妇|对象|伴侣|未婚妻|未婚夫|家里人|家人|父母|爸妈|娘家人|妈妈|爸爸|儿子|女儿|孩子|弟弟|妹妹|哥哥|姐姐|亲戚|同事|同学|室友|朋友|领导|老板|老师|客户|前女友|前男友)/
/** 转述动词：出现它说明后面是「他」说的话（引语），不是用户自己的关系状态
 *  引语只在**同一句内**截取（切到 ，。！？； 为止）—— 否则「阿伟说他跟女朋友闹矛盾了，小王最近对我很冷淡」
 *  会把后一句的「对我」误当成阿伟那段关系的对象 */
const REPORT_VERB_TAIL = /^(?:[，,、]?\s*)?(?:(?:跟|给|向|对)\s*)?(?:我\s*)?(?:说|告诉|讲|表示|抱怨|提到|吐槽|聊到)\s*[，,:：]?\s*([^，,。！？!?；;\n]*)/
/** 配对结构：跟/和/与 + 对象 */
const PAIR_WITH = /(?:跟|和|与)\s*(?:他|她|自己)?\s*([^，,。！？!?\s]{1,6})/

/**
 * 找出「转述引语」动词的结束位置（在 pos 之前、且与本句同一句内）。
 * 用于判断某个名字是不是落在别人说的话里。
 * @returns {number} 结束下标；没有则 -1
 */
function lastReportVerbEnd(msg, pos) {
  const head = msg.slice(0, pos)
  // 边界含逗号：只在**本句/本分句**内回溯转述动词，避免把上一分句的「他说…」算到这个名字头上
  const cut = Math.max(
    head.lastIndexOf('。'), head.lastIndexOf('！'), head.lastIndexOf('？'),
    head.lastIndexOf('!'), head.lastIndexOf('?'), head.lastIndexOf('；'),
    head.lastIndexOf(';'), head.lastIndexOf('\n'),
    head.lastIndexOf('，'), head.lastIndexOf(',')
  )
  const seg = head.slice(cut + 1)
  const re = /(?:说|告诉|讲|表示|抱怨|提到|吐槽|聊到)(?:过)?\s*[，,:：]?\s*/g
  let last = null
  let m
  while ((m = re.exec(seg)) !== null) last = m
  if (!last) return -1
  return cut + 1 + last.index + last[0].length
}

/**
 * 判断一段「关系变化」描述到底属于谁（4.42.0）
 *
 * 只识别一件事：这段关系的**对象是不是用户自己**。
 *  - 'self'        ：用户与这个人的关系 —— 照常回溯
 *  - 'third_party' ：这个人跟**别人**的关系 —— 不许把用户自己的互动时间线套上去
 *
 * 保守原则：**只有确凿识别出第三人对象时才判 third_party**，识别不出按 self 处理
 * （宁可漏挡第三人，也不误挡用户自己的关系——误挡会让回溯在该触发时静默失效）。
 *
 * 覆盖的结构（不是关键词屏蔽）：
 *  1. 转述引语：「X 说/告诉我/抱怨 …」后面描述的是 X 自己的关系；引语里出现他者称谓、
 *     或「他/她 + 跟/和/与」即判第三人。但引语里若明确出现「跟我/和我/对我」→ 说的是「他与用户」。
 *  2. 配对结构：「X + 跟/和/与 + 他者称谓」——X 是这段关系的主体，对象不是用户。
 *  3. 指向用户：出现「对我/和我/跟我」时一律按 self（优先级最高）。
 *
 * @param {string} message
 * @param {string} personName 已收录人物名（关系回溯的候选对象）
 * @returns {'self'|'third_party'}
 */
export function analyzeTracebackOwnership(message, personName) {
  const msg = String(message == null ? '' : message)
  const name = String(personName == null ? '' : personName)
  if (!msg || !name) return 'self'
  const at = msg.indexOf(name)
  if (at < 0) return 'self'
  const before = msg.slice(0, at)
  const after = msg.slice(at + name.length)

  // 规则 1：转述引语
  const reported = after.match(REPORT_VERB_TAIL)
  if (reported) {
    const quoted = reported[1] || ''
    // 引语的主语是用户（「阿伟说我最近和他疏远了」）→ 说的就是「我和他」
    if (/^\s*(?:我|咱)/.test(quoted)) return 'self'
    // 引语里明确带「跟我/和我/对我」→ 说的也是「他和用户」
    if (/(?:跟|和|与|对)\s*(?:我|咱)/.test(quoted)) return 'self'
    if (OTHER_PARTY_ROLE.test(quoted)) return 'third_party'
    if (/(?:他|她|自己)\s*(?:跟|和|与)/.test(quoted)) return 'third_party'
  }

  // 规则 4：这个人名本身落在**别人的转述引语**里 —— 「阿伟说他跟小王关系变差了」里的小王。
  // 要求名字前面隔着「他/她/自己 + 跟/和/与」这类结构（即名字是那段关系的对象），
  // 否则（如「我妈说阿伟最近很冷淡」）不判第三人，避免误挡。
  const verbEnd = lastReportVerbEnd(msg, at)
  if (verbEnd >= 0) {
    const seg = msg.slice(verbEnd, at)
    const isObjectOfQuote = /(?:他|她|自己)\s*(?:跟|和|与)|(?:跟|和|与)\s*$/.test(seg)
    const pointsToSelf = /(?:跟|和|与|对)\s*(?:我|咱)/.test(seg)
    if (isObjectOfQuote && !pointsToSelf) return 'third_party'
  }

  // 规则 2：X 与「非我」的对象配对
  const nearAfter = after.slice(0, 14)
  const pair = nearAfter.match(PAIR_WITH)
  if (pair) {
    const object = pair[1] || ''
    const pointsToSelf = object.startsWith('我') || object.startsWith('咱')
    if (!pointsToSelf && OTHER_PARTY_ROLE.test(object)) return 'third_party'
  }

  // 规则 3：明确指向用户
  if (/(?:对我|和我|跟我)/.test(after)) return 'self'
  if (/(?:我|咱|我们)[^。！？!?]{0,6}(?:跟|和|与)\s*$/.test(before)) return 'self'

  return 'self'
}

const TREND_TEXT = {
  down: '与更早的记录相比，近期情绪更偏负面',
  up: '与更早的记录相比，近期情绪更偏正面',
  flat: '前后两段的情绪差不多',
  unknown: '带情绪的记录太少，看不出走向'
}

/**
 * 一次回溯最多展开几个人（4.43.0）
 * 说明：这是**注入上限**，不是「只看前两个」—— 超出的人是被**确定性**丢弃的：
 * 先按消息中出现的先后排序再取前 N 个，不依赖 last_interaction 或存储顺序。
 */
export const MAX_TRACEBACK_PERSONS = 2

/** 共用表达规则（原因只能是推测） */
const EXPRESS_RULE = '【表达规则】上面是事实与用户自己的感受，都来自他自己的记录。原因只能作为**推测**提出：用「可能/也许」并明确说明这是你的猜测；禁止断言对方的态度或想法（不许说「他变冷淡了」这类结论）；样本不足就直接说不确定。'

/** 句内「关系变化」信号：只用于判断某个人是否落在变化句里（不决定是否触发）
 *  与意图门共用 IMPLICIT_CHANGE 口径，否则会出现「意图命中但没人为他建段」的错配 */
const CHANGE_CLAUSE = new RegExp('(疏远|冷淡|变冷|变差|变淡|不联系|不理我|不回我|关系.{0,6}(变化|变差|不好)|讨厌|不想理|矛盾|吵架|闹|不对劲|怪怪的|' + IMPLICIT_CHANGE + ')')

/** 该人名是否落在含「关系变化」信号的句子里（按标点切句，句内判断；顺带提及不算） */
function isInChangeClause(msg, name) {
  const at = msg.indexOf(name)
  if (at < 0) return false
  let cursor = 0
  const clauses = msg.split(/[，,。！？!?；;\n]/)
  for (const clause of clauses) {
    const start = cursor
    const end = cursor + clause.length
    cursor = end + 1 // 分隔符都是单字符
    if (at >= start && at < end) return CHANGE_CLAUSE.test(clause)
  }
  return false
}

/**
 * 挑选本次回溯要展开的人物（4.43.0，纯函数，便于测试）
 *
 * 规则（顺序即优先级）：
 *  1. 必须是**用户自己**的关系：归属判定为第三人（缺口 3）的跳过
 *  2. 必须落在「关系变化」的句子里：只是顺带提及（在别的句子里提到名字）不算
 *  3. 同一人只算一次（同名多卡按先出现的名字位置）
 *  4. 按**消息中出现顺序**排序（确定性：与 last_interaction / 存储顺序无关）
 *  5. 最多 MAX_TRACEBACK_PERSONS 个
 *
 * @param {string} userMessage
 * @param {{ relation?: object }} [opts] 显式指定 relation 时只做归属过滤（调用方已决定回溯谁）
 * @returns {object[]}
 */
export function selectTracebackPersons(userMessage, opts = {}) {
  const msg = String(userMessage == null ? '' : userMessage)
  const explicit = opts.relation
  const candidates = explicit ? [explicit] : detectMentionedRelations(msg)
  if (!candidates.length) return []

  const qualified = candidates.filter(r => {
    if (!r || !r.name) return false
    if (analyzeTracebackOwnership(msg, r.name) !== 'self') return false
    if (explicit) return true
    return isInChangeClause(msg, r.name)
  })

  const seen = new Set()
  const unique = []
  qualified.forEach(r => {
    if (seen.has(r.name)) return
    seen.add(r.name)
    unique.push(r)
  })
  unique.sort((a, b) => msg.indexOf(a.name) - msg.indexOf(b.name))
  return unique.slice(0, MAX_TRACEBACK_PERSONS)
}

/** 单人一段回溯（事实 + 感受）；表达规则由外层统一给一条 */
function buildPersonSection(relation, { sinceDays, limit, now }) {
  const items = getRelationTimeline(relation.id, { sinceDays, limit, now })
  const shift = summarizeEmotionShift(items)
  const name = relation.name || '这个人'
  const lines = [`关系回溯（${name}，只依据用户自己记录的内容，最近 ${sinceDays} 天）：`]

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
  return lines.join('\n')
}

/**
 * 构建关系事件回溯上下文（注入系统提示词）
 *
 * 找不到合格人物时返回 ''（不猜是谁）。多人时**每人一段**，段首标明对应人物，
 * 结尾共用一条表达规则并声明「各段分别对应哪个人，不要混在一起说」。
 * @param {string} userMessage
 * @param {{ relation?: object, sinceDays?: number, limit?: number, now?: number }} [opts]
 * @returns {string}
 */
export function buildTracebackContext(userMessage, opts = {}) {
  const msg = String(userMessage == null ? '' : userMessage)
  const sinceDays = Number.isFinite(opts.sinceDays) ? opts.sinceDays : 90
  const picked = selectTracebackPersons(msg, opts)
  if (picked.length === 0) return ''

  const sections = picked.map(r => buildPersonSection(r, { sinceDays, limit: opts.limit, now: opts.now }))
  const rule = picked.length > 1
    ? `【表达规则】上面 ${picked.length} 段回溯各对应一个人（${picked.map(r => r.name).join('、')}），不要把他们的情况混在一起说。其余同下：` +
      EXPRESS_RULE.replace('【表达规则】', '')
    : EXPRESS_RULE

  return '\n\n---\n' + sections.join('\n') + '\n' + rule
}
