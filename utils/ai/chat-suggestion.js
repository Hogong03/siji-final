/**
 * chat-suggestion.js — AI 回复后的轻追问 chips 本地兜底
 *
 * 背景：部分厂商（尤其流式纯文本回复）不会在 JSON 里返回 suggestions，
 * 导致 AI 气泡下方的快捷 chips 时有时无。这里做纯规则兜底：
 *   - AI 给了 suggestions → 原样透传（最多 3 条）
 *   - AI 没给 → 根据回复内容本地生成 1-2 条用户最可能直接发送的短句
 *
 * 铁律：只生成「用户会直接发出的话」，禁止评价式/催促式/问心情的伪建议
 * （"你觉得呢""要不要试试""感觉怎么样"一类都不允许出现）。
 */

/** 按主题命中生成 chips（命中第一条即返回，最多 2 条） */
const TOPIC_RULES = [
  // 记账/账单语境
  { re: /(?:账单|记账|花了|消费|买了|午餐|晚餐|夜宵|交通费|¥|\d+\s*元)/, chips: ['再记一笔', '查一下本月账单'] },
  // 已完成的记录动作 → 鼓励继续记录，而不是重复同一条
  { re: /(?:记好了|已保存|已记录|存好了|收录了|记录已)/, chips: ['再记一条'] },
  // 计划语境
  { re: /(?:计划|规划|安排|目标|打卡|待办|日程|想做的事)/, chips: ['排进我的计划', '看看我的计划'] },
  // 记录/日记/心情语境
  { re: /(?:记录|日记|心情|感想|想法|灵感|写个记录)/, chips: ['把这条记成记录'] },
  // 个人信息/喜好语境
  { re: /(?:记住|喜欢|偏好|习惯|性格|MBTI|星座|生日|兴趣)/, chips: ['存进我的信息'] }
]

/** 失败/停止类回复不给建议 */
const FAILURE_RE = /(?:走神|超时|请求失败|未返回有效|（已停止）|▌已停止)/

/**
 * 根据回复文本生成兜底建议
 * @param {string} replyText - AI 最终回复
 * @returns {string[]} 0-2 条短句
 */
export function buildFallbackSuggestions(replyText) {
  if (!replyText) return []
  const reply = String(replyText).trim()
  if (!reply || FAILURE_RE.test(reply)) return []

  // AI 主动提议帮忙（要不要帮你记/需要我排…）→ 给用户可一键答复的短句
  const offerMatch = reply.match(/(?:要不要|需要我|想让我|要我帮你).{0,14}(?:记|存|写|建|排|收|列)/)
  if (offerMatch) {
    return /(?:计划|安排|排|规划)/.test(reply) ? ['好，帮我排一下', '先不用'] : ['好，记下来', '先不用']
  }

  for (const rule of TOPIC_RULES) {
    if (rule.re.test(reply)) return rule.chips.slice(0, 2)
  }

  // 长段第一人称分享（讲了一段经历）→ 给一个"记下来"出口；短回复不加 chips 避免噪音
  if (reply.length > 60 && /我|我们/.test(reply)) return ['把这条记成记录']
  return []
}

/**
 * 合并建议：AI 给了就用 AI 的（最多 3 条），没给就本地兜底
 * @param {Array} aiList - AI suggestions（可能 undefined）
 * @param {string} replyText - 兜底用的回复文本
 * @returns {string[]}
 */
export function mergeSuggestions(aiList, replyText) {
  const out = []
  const push = (item) => {
    const s = item != null ? String(item).trim() : ''
    if (s && out.indexOf(s) === -1) out.push(s)
  }
  ;(Array.isArray(aiList) ? aiList.slice(0, 3) : []).forEach(push)
  if (out.length > 0) return out.slice(0, 3)
  buildFallbackSuggestions(replyText).forEach(push)
  return out.slice(0, 2)
}
