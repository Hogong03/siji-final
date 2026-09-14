/**
 * 结构化记忆（E1 独立模块）
 *
 * 把记忆从"文本堆"升级为「实体 / 关系 / 事件」三元组结构：
 * - entities:  { id, name, type: person|place|org|thing, attrs: {k:v}, updatedAt }
 * - relations: { id, subject, relation, object, updatedAt }
 * - events:    { id, title, date, participants[], updatedAt }
 *
 * 存储：siji_structured_memory（与扁平记忆 siji_long_term_memory 并存）
 * 提取：本地规则轻量提取（不调 AI），与 autoExtractMemory 互补
 * 注入：buildStructuredMemoryContext() 输出进 buildMemoryContext
 */

import { asyncSetStorageJSON } from './store-helpers.js'

const STORAGE_KEY = 'siji_structured_memory'
const LIMITS = { entities: 50, relations: 60, events: 80 }

// ==================== 基础读写 ====================

/** 获取结构化记忆 */
export function getStructuredMemory() {
  try {
    const raw = uni.getStorageSync(STORAGE_KEY)
    if (!raw) return emptyStore()
    const data = JSON.parse(raw)
    return {
      entities: Array.isArray(data.entities) ? data.entities : [],
      relations: Array.isArray(data.relations) ? data.relations : [],
      events: Array.isArray(data.events) ? data.events : []
    }
  } catch {
    return emptyStore()
  }
}

function emptyStore() {
  return { entities: [], relations: [], events: [] }
}

function persist(data) {
  try {
    asyncSetStorageJSON(STORAGE_KEY, {
      entities: data.entities.slice(0, LIMITS.entities),
      relations: data.relations.slice(0, LIMITS.relations),
      events: data.events.slice(0, LIMITS.events)
    })
  } catch { /* ignore */ }
}

/** 清空结构化记忆（随扁平记忆一起清理） */
export function clearStructuredMemory() {
  try {
    uni.removeStorageSync(STORAGE_KEY)
  } catch { /* ignore */ }
}

/** 统计 */
export function getStructuredMemoryStats() {
  const data = getStructuredMemory()
  return {
    entities: data.entities.length,
    relations: data.relations.length,
    events: data.events.length
  }
}

// ==================== 写入（去重） ====================

function genId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/** 新增/更新实体（同名同类型合并，attrs 增量合并） */
export function upsertEntity(name, type, attrs) {
  const key = String(name || '').trim()
  if (!key) return null
  const data = getStructuredMemory()
  const typeKey = type || 'thing'
  let entity = data.entities.find(e => e.name === key && e.type === typeKey)
  if (entity) {
    entity.attrs = Object.assign({}, entity.attrs || {}, attrs || {})
    entity.updatedAt = Date.now()
  } else {
    entity = { id: genId('ent'), name: key, type: typeKey, attrs: attrs || {}, updatedAt: Date.now() }
    data.entities.unshift(entity)
  }
  persist(data)
  return entity
}

/** 新增/更新关系（subject + relation + object 三元组去重） */
export function upsertRelation(subject, relation, object) {
  const s = String(subject || '').trim()
  const r = String(relation || '').trim()
  const o = String(object || '').trim()
  if (!s || !r || !o) return null
  const data = getStructuredMemory()
  let rel = data.relations.find(x => x.subject === s && x.relation === r && x.object === o)
  if (rel) {
    rel.updatedAt = Date.now()
  } else {
    rel = { id: genId('rel'), subject: s, relation: r, object: o, updatedAt: Date.now() }
    data.relations.unshift(rel)
  }
  persist(data)
  return rel
}

/** 新增事件（标题去重，date 可选 YYYY-MM-DD） */
export function addStructuredEvent(title, date, participants) {
  const t = String(title || '').trim()
  if (!t || t.length < 3) return null
  const data = getStructuredMemory()
  const existing = data.events.find(e => e.title === t)
  if (existing) {
    existing.date = date || existing.date
    existing.updatedAt = Date.now()
    persist(data)
    return existing
  }
  const event = {
    id: genId('evt'),
    title: t.substring(0, 50),
    date: date || '',
    participants: Array.isArray(participants) ? participants.slice(0, 6) : [],
    updatedAt: Date.now()
  }
  data.events.unshift(event)
  persist(data)
  return event
}

// ==================== 规则提取 ====================

/** 从对话中提取结构化记忆（本地规则，低侵入） */
export function extractStructuredMemory(userMessage, aiReply) {
  const text = `${userMessage || ''}\n${aiReply || ''}`
  if (!text.trim()) return

  // 1) 人物实体：我叫/我是/我的名字是
  const personMatch = text.match(/(?:我叫|我是|我的名字是)\s*([\u4e00-\u9fa5]{2,4})(?:[，,。！？\s]|$)/)
  if (personMatch) {
    upsertEntity(personMatch[1], 'person', {})
  }

  // 2) 关系：X是/是我（的）亲属/同事等
  const relationRegex = /([\u4e00-\u9fa5]{2,4})(?:是|是我)(?:的)?(爸爸|妈妈|母亲|父亲|老公|老婆|妻子|丈夫|男朋友|女朋友|女友|男友|同事|朋友|好友|老板|上司|领导|女儿|儿子|哥哥|弟弟|姐姐|妹妹|兄弟|姐妹|闺蜜|客户|同学|老师|医生|合伙人)/g
  let rm
  while ((rm = relationRegex.exec(text)) !== null) {
    // 排除代词误匹配："这是我男朋友" 不应提取"这是"
    if (/^(这|那|我|他|她|你|我们|你们|他们|咱们)$/.test(rm[1])) continue
    upsertEntity(rm[1], 'person', {})
    upsertRelation(rm[1], rm[2], '我')
  }

  // 3) 组织实体：在/加入/就职于 XX公司/学校…
  const orgMatch = text.match(/(?:在|加入|就职于|供职于|毕业于|就读于)\s*([\u4e00-\u9fa5A-Za-z0-9]{2,20}(?:公司|集团|银行|医院|学校|大学|学院|单位|工厂|团队|部门|店|所))/)
  if (orgMatch) {
    upsertEntity(orgMatch[1], 'org', {})
  }

  // 4) 地点实体：住在/搬到/去了 XX市/区/路…
  const placeMatch = text.match(/(?:住在|搬到|搬去|去了|在|位于)\s*([\u4e00-\u9fa5]{2,8}(?:市|省|区|县|镇|路|街|小区|村))/)
  if (placeMatch) {
    upsertEntity(placeMatch[1], 'place', {})
  }

  // 5) 喜好实体：喜欢/爱吃/爱喝/爱看 X
  const prefMatch = text.match(/(?:喜欢|最爱|爱吃|爱喝|爱看|爱玩|喜欢玩|常去)\s*([\u4e00-\u9fa5]{2,10})(?:[，,。！？\s]|$)/)
  if (prefMatch) {
    upsertEntity(prefMatch[1], 'thing', { preference: '喜欢' })
  }

  // 6) 重要事件：关键词 + 日期
  const EVENT_KEYWORDS = ['生日', '纪念日', '结婚', '婚礼', '搬家', '换工作', '入职', '离职', '考试', '面试', '旅行', '出差', '体检', '手术', '住院']
  const dateRegex = /(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日|下个月|明天|这周末|周末|下周/
  for (const kw of EVENT_KEYWORDS) {
    if (!text.includes(kw)) continue
    const sentences = text.split(/[。！？\n]/)
    for (const s of sentences) {
      if (!s.includes(kw) || s.length < 4 || s.length > 50) continue
      const dm = s.match(dateRegex)
      let date = ''
      if (dm && dm[2]) {
        const year = dm[1] ? dm[1] : String(new Date().getFullYear())
        date = `${year}-${String(dm[2]).padStart(2, '0')}-${String(dm[3]).padStart(2, '0')}`
      } else {
        // 支持「下个月5号」「本月10号」等无年份写法
        const dn = s.match(/(?:下个月|下月|本月|这个月|这个月)?(\d{1,2})[号日]/)
        if (dn && dn[1]) {
          const now = new Date()
          let month = now.getMonth() + 1
          if (/下个月|下月/.test(s)) month = month + 1
          if (month > 12) month = 1
          date = `${now.getFullYear()}-${String(month).padStart(2, '0')}-${String(dn[1]).padStart(2, '0')}`
        }
      }
      const title = s.trim().replace(/^(我|我要|我想|打算|计划|准备|下个月|明天|这周末|周末|下周)/, '').trim()
      if (title.length >= 3) {
        addStructuredEvent(title, date, [])
      }
    }
  }
}

// ==================== 上下文注入 ====================

/**
 * 构建结构化记忆上下文文本（注入系统提示词）
 * 按相关度取最近数据，token 精简
 */
export function buildStructuredMemoryContext() {
  const data = getStructuredMemory()
  if (data.entities.length === 0 && data.relations.length === 0 && data.events.length === 0) return ''

  const parts = []

  // 人物 + 组织 + 地点（最多 12 个，含喜好属性）
  const keyEntities = data.entities.slice(0, 12)
  const entityLines = keyEntities.map(e => {
    const typeLabel = { person: '人物', place: '地点', org: '组织', thing: '事物' }[e.type] || '实体'
    const attrs = e.attrs && Object.keys(e.attrs).length
      ? `（${Object.entries(e.attrs).map(([k, v]) => `${k}:${v}`).join('，')}）`
      : ''
    return `  - ${e.name}[${typeLabel}]${attrs}`
  })
  if (entityLines.length) parts.push(`【人物/地点/组织】\n${entityLines.join('\n')}`)

  // 关系（最多 10 条）
  const relLines = data.relations.slice(0, 10).map(r => `  - ${r.subject} 的${r.relation}：${r.object}`)
  if (relLines.length) parts.push(`【关系】\n${relLines.join('\n')}`)

  // 重要事件（最近 8 条）
  const eventLines = data.events.slice(0, 8).map(e => `  - ${e.date ? e.date + ' ' : ''}${e.title}`)
  if (eventLines.length) parts.push(`【重要事件】\n${eventLines.join('\n')}`)

  return `\n${parts.join('\n\n')}`
}