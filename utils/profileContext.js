/**
 * profileContext - 个人信息 AI 上下文构建与智能更新
 *
 * 从 profile.js 抽取，负责：
 *   - buildProfileContextBrief：每轮注入用的画像摘要（4.36.0，最终字符预算 + 字段优先级）
 *   - smartUpdateProfile：AI 驱动的自动更新（创建/更新/删除字段）
 *   - 统计函数
 *
 * 4.36.0：删除 buildProfileContext —— 它全量拼接所有卡片、无预算、无优先级，且全仓零调用
 * （prompt-builder 只 import 未使用）。改为只注入 portrait 卡的关键字段摘要，
 * 其余卡片继续走 get_profile 按需读取。
 */

import { getProfile, saveProfile, getCard } from './profile.js'

const ARRAY_FIELDS = new Set(['hobbies', 'dietary'])

/** 每轮画像摘要的**最终**字符预算（含标题与尾注，不是字段预算） */
export const PROFILE_BRIEF_MAX_CHARS = 600
/** 单字段值截断长度（字符） */
export const PROFILE_FIELD_MAX_CHARS = 60

const BRIEF_HEADER = '【用户画像摘要】'
/**
 * 尾注语义（4.36.0 修正）：不能无条件声明「以摘要为准」——旧画像会覆盖更新的事实。
 * 稳定信息（性格/价值观/长期方向）可长期沿用；可变信息（职业/作息/目标/关系状态）以更近期的记录为准。
 */
const BRIEF_FOOTER = '（稳定性内容可长期沿用；职业/作息/目标/关系状态等可变信息，若与更近期的记录冲突，以更近期的记录为准。需要完整画像可调用 get_profile）'

/**
 * 画像摘要字段表：order 越小越先占预算；key 是卡片里的原始键；label 是展示名。
 * 中英键并存的原因：portrait 卡用中文键（种子与 UI 默认），旧 basic/lifestyle 迁入的仍是英文键。
 * 新增画像维度只需在这里登记一行，不用改构建逻辑；未登记的字段会自动兜底排在最后。
 */
export const PROFILE_BRIEF_FIELDS = [
  // 我是谁
  { key: '当前阶段', label: '当前阶段', order: 10 },
  { key: '职业方向', label: '职业方向', order: 20 },
  { key: '人生关键词', label: '人生关键词', order: 30 },
  { key: '金钱目标', label: '金钱目标', order: 40 },
  { key: '性格优势', label: '性格优势', order: 50 },
  { key: '主要短板', label: '主要短板', order: 60 },
  { key: '行动原则', label: '行动原则', order: 70 },
  { key: 'MBTI', label: 'MBTI', order: 80 },
  { key: '感情目标', label: '感情目标', order: 90 },
  { key: '家庭目标', label: '家庭目标', order: 100 },
  { key: '产品意识', label: '产品意识', order: 110 },
  { key: '创业潜力', label: '创业潜力', order: 120 },
  // 旧 basic/lifestyle 迁入的英文键
  { key: 'nickname', label: '昵称', order: 200 },
  { key: 'occupation', label: '职业', order: 210 },
  { key: 'location', label: '所在地', order: 220 },
  { key: 'hobbies', label: '爱好', order: 230 },
  { key: 'dietary', label: '饮食偏好', order: 240 },
  { key: 'budget', label: '月预算', order: 250 },
  { key: 'sleepTime', label: '作息', order: 260 },
  { key: 'gender', label: '性别', order: 270 },
  { key: 'birthday', label: '生日', order: 280 },
  { key: 'bio', label: '自我描述', order: 290 }
]

const FIELD_META = new Map(PROFILE_BRIEF_FIELDS.map(f => [f.key, f]))

function fieldOrder(key) {
  const meta = FIELD_META.get(key)
  return meta ? meta.order : 9999
}

function fieldLabel(key) {
  const meta = FIELD_META.get(key)
  return meta ? meta.label : key
}

/**
 * 每轮注入用的画像摘要（4.36.0）
 *
 * 规则：
 *  - 画像开关关闭 → null（不注入）
 *  - 只取 portrait 卡；其余卡片走 get_profile 按需读取
 *  - 白名单字段按 order 优先占预算，未登记字段兜底排在后面（新维度不会静默丢失）
 *  - **最终输出长度 ≤ maxChars**：标题 + 正文 + 尾注一起算，单字段超长先截断
 *
 * @param {{ maxChars?: number }} [opts]
 * @returns {{ text: string, chars: number, dropped: number, fields: number } | null}
 */
export function buildProfileContextBrief(opts = {}) {
  const maxChars = Math.max(160, Number(opts.maxChars) || PROFILE_BRIEF_MAX_CHARS)
  const profile = getProfile()
  // 开关语义：enabled 必须显式为 true（缺省 false，与 isProfileEnabled 一致）
  if (!profile || profile.enabled !== true) return null

  const card = profile.cards.find(c => c.id === 'portrait') ||
               profile.cards.find(c => c.title === '我的画像')
  if (!card || !card.fields) return null

  // 预算拆分：overhead = 标题 + 尾注 + 两个换行，正文只能用剩下的
  const overhead = BRIEF_HEADER.length + BRIEF_FOOTER.length + 2
  const bodyBudget = maxChars - overhead
  if (bodyBudget < 40) return null // 预算小到放不下一个字段，宁可整段不注入

  const keys = Object.keys(card.fields)
    .filter(k => card.fields[k] != null && card.fields[k] !== '')
    .sort((a, b) => fieldOrder(a) - fieldOrder(b) || a.localeCompare(b))

  let body = ''
  let dropped = 0
  let usedFields = 0
  for (const k of keys) {
    const raw = Array.isArray(card.fields[k]) ? card.fields[k].join('、') : String(card.fields[k])
    let v = raw.trim()
    if (!v) continue
    if (v.length > PROFILE_FIELD_MAX_CHARS) v = v.slice(0, PROFILE_FIELD_MAX_CHARS) + '…'
    const line = `${fieldLabel(k)}：${v}`
    const candidate = body ? body + '；' + line : line
    // 超预算：整行跳过（不做半截截断），保证每个保留字段完整可读
    if (candidate.length > bodyBudget) { dropped++; continue }
    body = candidate
    usedFields++
  }
  if (!body) return null

  const text = `${BRIEF_HEADER}\n${body}\n${BRIEF_FOOTER}`
  // 由构造保证：header + 1 + body + 1 + footer ≤ maxChars；这里断言式兜底
  return { text, chars: text.length, dropped, fields: usedFields }
}

/** AI 智能更新 profile */
export function smartUpdateProfile(params) {
  const profile = getProfile()
  if (!profile.enabled) profile.enabled = true

  const results = []
  const overwritten = []

  // 1. 创建新卡片
  if (Array.isArray(params.createCard)) {
    for (const cc of params.createCard) {
      if (!cc.id || !cc.title) continue
      if (!profile.cards.find(c => c.id === cc.id)) {
        profile.cards.push({
          id: cc.id, title: cc.title, icon: cc.icon || 'sparkle',
          fields: {}, source: 'ai_extracted', createdAt: Date.now()
        })
        results.push(`创建分组「${cc.title}」`)
      }
    }
  }

  // 2. 更新字段
  if (Array.isArray(params.updates)) {
    for (const u of params.updates) {
      if (!u.card || !u.field) continue
      let card = profile.cards.find(c => c.id === u.card)
      if (!card) {
        card = {
          id: u.card, title: u.cardTitle || u.card, icon: 'sparkle',
          fields: {}, source: 'ai_extracted', createdAt: Date.now()
        }
        profile.cards.push(card)
        results.push(`创建分组「${card.title}」`)
      }

      const oldValue = card.fields[u.field]

      if (ARRAY_FIELDS.has(u.field) && Array.isArray(u.value)) {
        const existing = Array.isArray(oldValue) ? oldValue : []
        const newItems = u.value.filter(v => !existing.includes(v))
        if (newItems.length > 0) {
          card.fields[u.field] = [...existing, ...newItems]
          results.push(`${u.field}(+${newItems.length})`)
        }
      } else if (ARRAY_FIELDS.has(u.field) && typeof u.value === 'string') {
        const existing = Array.isArray(oldValue) ? oldValue : []
        if (!existing.includes(u.value)) {
          card.fields[u.field] = [...existing, u.value]
          results.push(`${u.field}(+${u.value})`)
        }
      } else {
        if (oldValue != null && oldValue !== '' && oldValue !== u.value) {
          overwritten.push(`${u.field}: ${oldValue} → ${u.value}`)
        }
        card.fields[u.field] = u.value
        results.push(u.field)
      }
    }
  }

  // 3. 删除字段/数组项
  if (Array.isArray(params.remove)) {
    for (const r of params.remove) {
      if (!r.card || !r.field) continue
      const card = profile.cards.find(c => c.id === r.card)
      if (!card) continue

      if (ARRAY_FIELDS.has(r.field) && r.value) {
        const arr = Array.isArray(card.fields[r.field]) ? card.fields[r.field] : []
        const idx = arr.indexOf(r.value)
        if (idx >= 0) {
          arr.splice(idx, 1)
          card.fields[r.field] = arr
          results.push(`移除${r.field}「${r.value}」`)
        }
      } else if (r.value) {
        const arr = Array.isArray(card.fields[r.field]) ? card.fields[r.field] : []
        const idx = arr.indexOf(r.value)
        if (idx >= 0) {
          arr.splice(idx, 1)
          card.fields[r.field] = arr
          results.push(`移除「${r.value}」`)
        }
      } else {
        if (card.fields[r.field] !== undefined) {
          delete card.fields[r.field]
          results.push(`删除${r.field}`)
        }
      }
    }
  }

  if (results.length === 0) {
    return { success: true, message: '没有新信息需要更新', detail: { type: 'profile', skipped: true } }
  }

  saveProfile(profile)

  const msg = overwritten.length > 0
    ? `已更新个人信息：${results.join('、')}（其中 ${overwritten.length} 项已覆盖旧值）`
    : `已更新个人信息：${results.join('、')}`

  return {
    success: true, message: msg,
    detail: { type: 'profile', updatedFields: results, overwritten, allFields: results }
  }
}

/** 计算已填写字段数 */
export function getFilledCount() {
  const profile = getProfile()
  let count = 0
  for (const card of profile.cards) {
    for (const [, val] of Object.entries(card.fields)) {
      if (val == null || val === '') continue
      if (Array.isArray(val) && val.length === 0) continue
      count++
    }
  }
  return count
}

/** 获取基本信息卡片字段数 */
export function getBasicFilledCount() {
  const card = getCard('basic')
  if (!card) return 0
  let count = 0
  for (const [, val] of Object.entries(card.fields)) {
    if (val) count++
  }
  return count
}
