/**
 * guide.js — 引导式表达（4.48.0）
 *
 * 思迹的说话方式：温柔是语气，强大是每次都把对方往前送半步。
 * 本文件是「引导三式」的单一事实源，三层共用：
 *   - 提示层：buildGuideSection() 注入 system prompt（JSON 路径 / Agent 路径都经 buildSystemPrompt）
 *   - 兜底层：pickGuideChips() 给回复下方的可点短句（纯规则，不依赖模型返回 suggestions）
 *   - 判定层：hasGuideTail() 给测试与评测断言「这句回复有没有把话头递回去」
 *
 * 与产品铁律的关系（PRODUCT_VISION 第 6 节）：
 *   引导 = 把选择权递回用户，不是催办、不是盘点缺口、不是「你应该更努力」。
 *   所以引导必须具体、最多一句、可以不给；对方低落时只留最轻的一句。
 *
 * 改这个文件会改 AI 行为 —— 必跑 AI 三件套（action-schema-consistency /
 * module-exports / ai-eval），并跑 tests/ai-guide.test.js。
 */

/** 引导三式 —— 提示词、文档、测试共用的名字 */
export const GUIDE_KINDS = [
  { id: 'step', name: '收一步', desc: '把话收成 5 分钟内能做的一步' },
  { id: 'feel', name: '深一句', desc: '追问一个具体的感受或细节' },
  { id: 'choice', name: '给两选', desc: '卡住时给两个具体选项让他挑' }
]

/** 绝不出现在引导里的词（测试逐条断言） */
export const PRESSURE_WORDS = ['你应该', '建议你', '必须', '为什么不', '加油']

/** 引导式表达的提示段（开关打开时由 prompt-builder 注入；关掉整段消失） */
export const GUIDE_SECTION = `

## 引导式表达
你的风格：温柔是语气，强大是每次都把对方往前送半步。每次回复末尾留一句引导，最多一句，从三式里挑：
- 收一步：把话收成 5 分钟内能做的一步，用「要不要我先帮你…」给出具体动作
- 深一句：对方在讲自己时，问一个具体的感受或细节（「哪一刻最明显？」），不问评价
- 给两选：对方卡住时给两个具体选项让他挑，别让他自己想
规则：引导要落到下一个动作或下一句话，禁止「你觉得呢／要不要聊聊／看你怎么想」这类空追问；不连续两轮用同一式；纯查询、刚执行完写操作、对方说「别问了／先这样」时不给；对方状态低落或说累时只留最轻的一句（歇会儿／先放一放），不深挖不布置任务；宁缺毋滥，不给也正常。禁止「你应该／建议你／必须／为什么不／加油」。`

/** 构建引导段（保留函数形态：以后要按能量档调轻时只改这里） */
export function buildGuideSection() {
  return GUIDE_SECTION
}

/** 失败/停止类回复不引导 */
const FAILURE_RE = /(?:走神|超时|请求失败|未返回有效|（已停止）|▌已停止)/

/** 主题兜底：命中第一条即返回（最多 2 条） */
const TOPIC_RULES = [
  { re: /(?:账单|记账|花了|消费|买了|午餐|晚餐|夜宵|交通费|¥|\d+\s*元)/, chips: ['再记一笔', '查一下本月账单'] },
  { re: /(?:记好了|已保存|已记录|存好了|收录了|记录已)/, chips: ['再记一条'] },
  { re: /(?:计划|规划|安排|目标|打卡|待办|日程|想做的事)/, chips: ['排进我的计划', '看看我的计划'] },
  { re: /(?:记录|日记|心情|感想|想法|灵感|写个记录)/, chips: ['把这条记成记录'] },
  { re: /(?:记住|喜欢|偏好|习惯|性格|MBTI|星座|生日|兴趣)/, chips: ['存进我的信息'] }
]

/** 给了具体一小步的回复：chips 直接落在「做 / 再小一点」上 */
const STEP_RE = /(?:\d+\s*(?:分钟|min)|第一步|最小的一步|先做一件|先花)/
const STEP_VERB_RE = /(?:先|从|做|试|开始|花|收|写|读)/

/** 陪伴类回复：不加任何推进型 chips（不催） */
const COMFORT_RE = /(?:辛苦了|难为你了|换谁都会|先歇|不用勉强|躺着也行|今天就到这儿)/

/**
 * 根据回复文本生成引导型短句（用户点一下就能发出去的那种）
 * @param {string} replyText - AI 最终回复
 * @param {{didWrite?: boolean}} opts - didWrite：本轮已执行写操作，不再补（避免执行后弹无关建议）
 * @returns {string[]} 0-2 条短句
 */
export function pickGuideChips(replyText, opts = {}) {
  if (!replyText || opts.didWrite) return []
  const reply = String(replyText).trim()
  if (!reply || FAILURE_RE.test(reply)) return []

  // 模型已经在问「要不要我帮你…」→ 给一键可答的短句
  const offerMatch = reply.match(/(?:要不要|需要我|想让我|要我帮你).{0,14}(?:记|存|写|建|排|收|列|拆|做)/)
  if (offerMatch) {
    const planLike = /(?:计划|安排|排|规划|拆|步骤)/.test(reply)
    return planLike ? ['好，帮我排一下', '先不用'] : ['好，记下来', '先不用']
  }

  // 已经给出一小步 → 直接把「现在做」和「再小一点」递到手上
  if (STEP_RE.test(reply) && STEP_VERB_RE.test(reply)) {
    return ['好，现在开始', '换个更小的']
  }

  // 陪伴/安抚结束 → 留白，不推进
  if (COMFORT_RE.test(reply)) return []

  for (const rule of TOPIC_RULES) {
    if (rule.re.test(reply)) return rule.chips.slice(0, 2)
  }

  // 长段第一人称分享 → 给一个「记下来」出口；短回复不加，避免噪音
  if (reply.length > 60 && /我|我们/.test(reply)) return ['把这条记成记录']
  return []
}

/** 回复末尾是否已经把话头递回去（引导三式的粗判定，供测试/评测使用） */
export function hasGuideTail(text) {
  const reply = String(text || '').trim()
  if (!reply) return false
  const tail = reply.slice(-60)
  if (/[？?]\s*$/.test(tail)) return true
  return /(?:要不要|需要我|想让我|我可以|要不|或许可以|要不要我)/.test(tail)
}

/** 粗分引导属于哪一式（只用于测试与文档，不参与生产决策） */
export function guideKindOf(text) {
  const reply = String(text || '')
  if (!hasGuideTail(reply)) return ''
  if (/(?:\d+\s*分钟|第一步|最小的一步|先做|先花)/.test(reply)) return 'step'
  if (/(?:还是|哪一|两个|二选一|选一个)/.test(reply)) return 'choice'
  return 'feel'
}
