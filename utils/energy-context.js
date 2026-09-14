/**
 * 能量上下文（3.4 M1：慢恢复）
 *
 * 纯本地启发式：从最近对话推断用户能量档位，低/极低时给 AI 注入降载指令。
 * 不依赖模型、不持久化、无 UI 入口（拍板 D2=A：零用户输入）。
 * 只在中/高/未命中时返回空字符串，零 token 成本。
 *
 * 口径（PRODUCT_VISION 3.4 铁律 7/8/9）：
 *  - 低：不抛新话题/任务，建议只给 1 分钟最小选项，允许「不做也行」
 *  - 极低：1-2 句最轻语气，不追问不建议不引导
 */
const VERY_LOW_WORDS = [
  '撑不住', '扛不住', '受不了', '崩溃', '想哭', '哭出来',
  '动不了', '起不来', '完全没力气', '什么都没做', '一整天没动',
  '躺了一天', '摆烂', '废了', '没救', '撑不下去', '扛不下去了',
  '真的不行了', '熬不下去了'
]
const LOW_WORDS = [
  '好累', '太累', '很累', '有点累', '累死', '没力气', '没劲',
  '提不起劲', '不想动', '不想做', '好烦', '烦死', '很烦', '烦透了',
  '烦躁', '焦虑', '难受', '低落', '不开心', '难过', '没精神',
  '睡不着', '睡不好', '失眠', '头疼', '头晕', '疲惫', '疲倦',
  '乏力', '困死', '只想躺', '没意思', '算了', '好难', '压力好大',
  '压力大', '坚持不住', '熬不住', '心累', '很低落', '状态差', '没状态'
]
const POSITIVE_WORDS = [
  '不错', '挺好', '很好', '开心', '舒服', '顺利', '完成', '搞定',
  '精神', '有劲', '恢复', '好多了', '活力', '状态好', '出门',
  '散步', '走了走', '晒太阳', '早睡', '睡得好', '高兴', '轻松',
  '满足', '有进步', '做到了', '开始了', '成功了', '还不错', '还行'
]

const LOW_GUIDE = `
## 能量状态（本地推断）
用户当前能量偏低。请遵循：
1. 回复更短更软（1-3 句），多听少说，不要长篇大论
2. 不主动抛新话题、新任务、新计划或方案清单
3. 用户若问建议：只给一个「1 分钟就能做」的最小选项，并允许「不做也行」
4. 用户聊到计划时：不催、不盘点进度，可以自然提一句「先放一放也行，不会丢」`

const VERY_LOW_GUIDE = `
## 能量状态（本地推断）
用户当前能量极低。请遵循：
1. 回复 1-2 句，语气最轻
2. 不追问、不建议、不引导，不制造任何「应该做点什么」的氛围
3. 用户说什么就接什么；不主动提任务、计划、记录事项
4. 若用户主动请帮忙记东西（记录/微光/计划），用最小动作完成即可，不要展开解释`

/** 判断命中词是否被否定（往前最多看 4 个字符，如「不累/没太累/不开心」） */
function isNegated(text, idx) {
  const from = Math.max(0, idx - 4)
  const seg = text.slice(from, idx)
  if (!seg) return false
  if (/[不没别]/.test(seg)) return true
  if (/不太|没太|没那么|不是/.test(seg)) return true
  return false
}

/** 扫描单条文本的命中词（含否定处理），返回 { veryLow, low, positive } */
function scanText(text) {
  const out = { veryLow: [], low: [], positive: [] }
  if (!text) return out
  function scan(list, bucket) {
    for (const w of list) {
      let from = 0
      while (true) {
        const idx = text.indexOf(w, from)
        if (idx < 0) break
        if (!isNegated(text, idx)) {
          if (!bucket.includes(w)) bucket.push(w)
          break
        }
        from = idx + w.length
      }
    }
  }
  scan(VERY_LOW_WORDS, out.veryLow)
  scan(LOW_WORDS, out.low)
  scan(POSITIVE_WORDS, out.positive)
  return out
}

/**
 * 从用户消息列表推断能量档位
 * @param {string[]} texts 按时间正序的最近用户消息（最后一条 = 最新）
 * @returns {{ level: 'high'|'medium'|'low'|'very_low', reason: string }}
 */
export function inferEnergyLevel(texts) {
  const list = (Array.isArray(texts) ? texts : [])
    .map(t => (typeof t === 'string' ? t : ''))
    .filter(Boolean)
    .slice(-6)
  if (list.length === 0) return { level: 'medium', reason: '' }
  // 只取最近两条消息定档（更早的负面信号视为已恢复，不叠加压力）；越近权重越高
  const window = list.slice(-2)
  const n = window.length
  let very = 0
  let low = 0
  let pos = 0
  const hitNames = { veryLow: [], low: [], positive: [] }
  window.forEach((t, i) => {
    const w = i === n - 1 ? 1 : 0.8
    const hits = scanText(t)
    very += hits.veryLow.length * w
    low += hits.low.length * w
    pos += hits.positive.length * w
    hits.veryLow.forEach(x => { if (!hitNames.veryLow.includes(x)) hitNames.veryLow.push(x) })
    hits.low.forEach(x => { if (!hitNames.low.includes(x)) hitNames.low.push(x) })
    hits.positive.forEach(x => { if (!hitNames.positive.includes(x)) hitNames.positive.push(x) })
  })
  const reasonBits = []
  if (very > 0) reasonBits.push('极低:' + hitNames.veryLow.slice(0, 3).join('/'))
  if (low > 0) reasonBits.push('低:' + hitNames.low.slice(0, 3).join('/'))
  if (pos > 0) reasonBits.push('正:' + hitNames.positive.slice(0, 3).join('/'))
  const reason = reasonBits.join(';')

  if (very > 0 && pos < 2 * very) return { level: 'very_low', reason }
  if (low > 0 && pos < low) return { level: 'low', reason }
  if (low === 0 && pos >= 2) return { level: 'high', reason }
  return { level: 'medium', reason }
}

/**
 * 对话能量扫描（供 buildChatMessages 使用）
 * @returns {{ level: string, text: string }} text 仅低/极低时非空
 */
export function energyScan(userMessage, history) {
  const texts = []
  if (Array.isArray(history)) {
    for (const m of history) {
      if (m && m.role === 'user') {
        const c = typeof m.content === 'string' ? m.content : ''
        if (c && c.trim()) texts.push(c.trim())
      }
    }
  }
  if (userMessage && typeof userMessage === 'string' && userMessage.trim()) {
    texts.push(userMessage.trim())
  }
  const { level, reason } = inferEnergyLevel(texts)
  if (level === 'very_low') return { level, text: VERY_LOW_GUIDE, reason }
  if (level === 'low') return { level, text: LOW_GUIDE, reason }
  return { level, text: '', reason }
}
