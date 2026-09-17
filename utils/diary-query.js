/**
 * diary-query.js — 记录列表的两件小事（4.2.0，纯函数）
 *
 *   parseDiaryQuery  一句话筛选：「上周的工作记录」→ 时间范围 + 关键词
 *   firstSentence    列表副标题：取第一句（比截断正文更有信息量）
 *
 * 不做 AI 调用：规则能覆盖的，就不该让用户等一个网络往返。
 */

/** 相对时间说法 → 时间范围标识 */
export const QUERY_RANGES = ['today', 'week', 'month', 'lastMonth']

/**
 * 解析一句话筛选
 * @param {string} text 用户输入
 * @returns {{ keyword: string, range: string }} range 为空串表示不限
 */
export function parseDiaryQuery(text) {
  let s = String(text == null ? '' : text).trim()
  if (!s) return { keyword: '', range: '' }
  let range = ''

  const rules = [
    { range: 'today', re: /今天|今日/ },
    { range: 'week', re: /这周|本周|上周(?!末)|一周|近一周/ },
    { range: 'month', re: /这月|本月|这个月/ },
    { range: 'lastMonth', re: /上个月|上月/ }
  ]
  rules.forEach(r => {
    if (!range && r.re.test(s)) {
      range = r.range
      s = s.replace(new RegExp(r.re.source, 'g'), '')
    }
  })

  // 去噪声：分类词（的记录 / 内容）+ 疑问填充短语（做了什么 / 有什么）+ 句尾语气词
  // 注意：不逐个删「的 / 了」这类单字 —— 「了解」会被删成「解」；只删短语与句尾
  s = s.replace(/的?(记录|日记|内容|相关|所有|全部)/g, ' ')
  s = s.replace(/(做了?什么|干了?什么|干什么|有什么|有啥|有哪些|有没有|都是啥)/g, ' ')
  s = s.replace(/[\s吗呢啊呀吧]+$/g, ' ')
  s = s.replace(/^[\s的]+/g, ' ').replace(/[\s的]+$/g, ' ')
  s = s.replace(/\s+/g, ' ').trim()
  return { keyword: s, range }
}

/**
 * 时间范围 → 起止时间戳（以「今天」为基准）
 * @param {string} range
 * @param {number} [now]
 * @returns {{ from: number, to: number }|null} 不认识的 range 返回 null（= 不限）
 */
export function rangeToTimestamps(range, now) {
  const at = Number(now) || Date.now()
  const today = new Date(at)
  today.setHours(0, 0, 0, 0)
  const day = 24 * 60 * 60 * 1000
  if (range === 'today') return { from: today.getTime(), to: at }
  if (range === 'week') {
    // 自然周：周一为一周起点
    const wd = today.getDay() === 0 ? 7 : today.getDay()
    return { from: today.getTime() - (wd - 1) * day, to: at }
  }
  if (range === 'month') return { from: new Date(today.getFullYear(), today.getMonth(), 1).getTime(), to: at }
  if (range === 'lastMonth') {
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1).getTime()
    const to = new Date(today.getFullYear(), today.getMonth(), 1).getTime() - 1
    return { from, to }
  }
  return null
}

/**
 * 列表副标题：取第一句（句号/换行/问号/感叹号切），超长再截断
 * @param {string} content
 * @param {number} [max] 默认 60 字
 * @returns {string} 没有内容返回空串
 */
export function firstSentence(content, max) {
  const s = String(content == null ? '' : content).replace(/\s+/g, ' ').trim()
  if (!s) return ''
  const limit = Number.isFinite(Number(max)) ? Number(max) : 60
  const m = s.match(/^[^。！？!?；;]{1,200}[。！？!?；;]?/)
  const first = (m ? m[0] : s).trim()
  if (first.length <= limit) return first
  return first.slice(0, limit) + '…'
}