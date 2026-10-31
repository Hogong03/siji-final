/**
 * open-loops-rules.js — 开放事项的本地规则层（M2.1，纯函数）
 *
 * 只做三件事：从一句话里认出「悬着的事」、给它一个 kind、给出标题与进度线索。
 * 不读写存储、不调模型 —— 抽取结果必须经用户确认才落库（写入在 open-loops.js）。
 *
 * 规则口径（与产品文档一一对应）：
 *   R1 想法表达   最近又想学 Python
 *   R2 延后承诺   回头我处理一下
 *   R3 时间意向   这周找时间研究 RAG
 *   R4 未完成     上次那个功能还没弄完
 *   R5 持续关注   最近一直在关注 AI Agent
 *   R6 暂停       之前那个项目先放一放（只对已存在的 loop 生效，不新建）
 *   R7 重启       之前那个准备重新开始（同上）
 *   R8 反复提及   不单独弹卡：命中已有 loop 时由 open-loops 的合并逻辑累加 touches
 *
 * 第 5 类需要"最近"这类持续状语；第 8 类必须结合历史（见 detectCandidates 的 ctx.loops）。
 */

/** 标题上限（字） */
export const TITLE_MAX = 30

/** 进度线索上限（字） */
export const HINT_MAX = 20

/** 通用后缀：包含关系去重时，只允许这种"同义收尾"被合并（学 Python vs 学 Python 爬虫 不合并） */
export const GENERIC_SUFFIXES = ['项目', '计划', '这件事', '这个事情', '这事', '东西', '练习', '一下']

/** 太泛、不能用来匹配已有事项的词 */
const GENERIC_TOKENS = new Set(['项目', '计划', '事情', '东西', '一下', '这个', '那个', '最近', '之前'])

/** 句首的时间/语气词：生成标题时剥掉 */
const LEADING_NOISE = /^(?:嗯|那个|就是|然后|另外|其实|我|我们)?(?:最近一直|最近|这几天|这两天|这阵子|又|还|回头|下次|改天|晚点|明天|这周|下周|这个月|下个月|周末|找时间|抽时间|上次|之前|暂时|先|想|打算|准备|要|去)+/

/** 归一化：去空白与标点、全角转半角、ASCII 小写 */
export function normalizeTitle(text) {
  return String(text == null ? '' : text)
    .replace(/[\uff01-\uff5e]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[，。！？、；：""''（）【】《》…—\s~!?,.;:'"()\[\]<>]/g, '')
    .toLowerCase()
    .trim()
}

/** 从原话生成标题：剥句首噪声、去句末标点、截断 */
export function titleOf(text) {
  const raw = String(text == null ? '' : text).trim()
  if (!raw) return ''
  let s = raw.split(/[。！？!?\n]/)[0].trim()
  s = s.replace(LEADING_NOISE, '').trim()
  s = s.replace(/[，,。.!？?；;：:]+$/, '').trim()
  if (!s) s = raw.slice(0, TITLE_MAX)
  return s.slice(0, TITLE_MAX)
}

/**
 * kind 判定（顺序即优先级）
 * commitment：有明确的"回头/下次"承诺；plan：有时间窗口的动作；topic：未完成的旧事；idea：默认
 */
export function classifyKind(text) {
  const s = String(text || '')
  if (/(?:回头|下次|改天|晚点|明天)(?:我)?(?:再)?[^。！？\n]{0,6}(?:处理|弄|搞|做|看|整理|写|补|跑|搭|办|聊|问)/.test(s)) return 'commitment'
  if (/(?:这周|下周|这个月|下个月|周末|找时间|抽时间)(?:我)?(?:再)?(?:去)?(?:研究|学|做|整理|看|写|试|跑|搭)/.test(s)) return 'plan'
  if (/(?:还没|没有|没)(?:弄完|做完|搞完|完成|开始)|(?:上次|之前).{0,8}(?:没|还没)/.test(s)) return 'topic'
  return 'idea'
}

/**
 * 进度线索：只从用户明确说出的卡点/进度里取，取不到就是空
 * 绝不根据时间或上下文编造"下一步"
 */
export function detectHint(text) {
  const s = String(text || '')
  const m = s.match(/(?:卡在|停在|卡到|做到|进度是|主要卡在|还剩)\s*([^\n。！？!?，,；;]{2,20})/)
  if (!m) return ''
  return m[1].trim().slice(0, HINT_MAX)
}

/** 文本是否提到某个已有事项（用于暂停/重启/反复提及） */
export function matchLoopByText(text, loops) {
  const n = normalizeTitle(text)
  if (!n) return null
  let best = null
  for (const loop of Array.isArray(loops) ? loops : []) {
    if (!loop || !loop.title) continue
    const t = normalizeTitle(loop.title)
    if (t.length < 2) continue
    if (n.includes(t)) {
      if (!best || t.length > normalizeTitle(best.title).length) best = loop
      continue
    }
    // 标题里的实词片段出现也算提到（"项目"这类泛词不算）
    const tokens = String(loop.title).split(/[\s,，、]+/).filter((w) => w.length >= 2 && !GENERIC_TOKENS.has(w))
    if (tokens.some((w) => n.includes(normalizeTitle(w)))) {
      if (!best) best = loop
    }
  }
  // 兜底：只剩一条候选时，"那个项目/那件事"这种指代就认它（卡片还会让用户确认，不会误落库）
  if (!best && Array.isArray(loops) && loops.length === 1) return loops[0]
  return best
}

/**
 * 识别候选
 * @param {string} text 用户原话
 * @param {{ loops?: Array, now?: number }} [ctx] loops = 现有未删除事项（判断暂停/重启/提及）
 * @returns {Array<{mode:'create'|'pause'|'resume', title, kind, quote, hint, rule}>}
 */
export function detectCandidates(text, ctx = {}) {
  const raw = String(text == null ? '' : text).trim()
  if (!raw || raw.length < 4) return []
  // 提问/查询不生成候选（"我有哪些计划""RAG 是什么"）
  if (/[?？]$/.test(raw) || /^(?:什么|怎么|为什么|哪|多少|是不是|能不能|要不要问)/.test(raw)) return []

  const loops = Array.isArray(ctx.loops) ? ctx.loops : []
  const out = []

  // R6 暂停 / R7 重启：不新建，只对已存在的开放事项生效
  if (/(?:先|暂时)(?:放一放|放放|放一边|搁置|停一停|不弄了)|(?:暂停|搁置)/.test(raw)) {
    const hit = matchLoopByText(raw, loops.filter((l) => l.status === 'open'))
    if (hit) out.push({ mode: 'pause', title: hit.title, kind: 'topic', quote: raw.slice(0, 60), hint: '', rule: 'R6', loopId: hit.id })
    return out
  }
  if (/(?:重新开始|重新捡起来|捡起来|接着做|接着弄|重启|继续做)/.test(raw)) {
    const hit = matchLoopByText(raw, loops.filter((l) => l.status === 'paused' || l.status === 'dropped'))
    if (hit) out.push({ mode: 'resume', title: hit.title, kind: 'topic', quote: raw.slice(0, 60), hint: '', rule: 'R7', loopId: hit.id })
    return out
  }

  const rules = [
    { id: 'R4', re: /(?:还没|没有|没)(?:弄完|做完|搞完|完成|开始)|(?:上次|之前).{0,8}(?:没|还没)/ },
    { id: 'R2', re: /(?:回头|下次|改天|晚点|明天)(?:我)?(?:再)?[^。！？\n]{0,6}(?:处理|弄|搞|做|看|整理|写|补|跑|搭|办|聊|问)/ },
    { id: 'R3', re: /(?:这周|下周|这个月|下个月|周末|找时间|抽时间)(?:我)?(?:再)?(?:去)?(?:研究|学|做|整理|看|写|试|跑)/ },
    { id: 'R1', re: /(?:最近|这几天|这两天)?(?:又|还)?(?:想|打算)(?:要|去|学|做|试|搞|弄|看)/ },
    { id: 'R5', re: /(?:一直|最近).{0,4}(?:在)?(?:关注|研究|跟踪|盯着|在看)/ }
  ]

  for (const r of rules) {
    if (!r.re.test(raw)) continue
    const title = titleOf(raw)
    if (!title || normalizeTitle(title).length < 2) return []
    out.push({
      mode: 'create',
      title,
      kind: classifyKind(raw),
      quote: raw.slice(0, 60),
      hint: detectHint(raw),
      rule: r.id
    })
    return out // 一条消息最多一个候选
  }
  return out
}
