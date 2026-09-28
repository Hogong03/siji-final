/**
 * chat-search.js — 历史会话内容检索（3.2 M3）
 *
 * 纯内存遍历 siji_conversations（总量受裁剪上限约束，单键存储，无需索引）。
 * 命中权重：标题 > 用户消息 > AI 回复；同一会话只保留得分最高的一条摘录。
 */

const CONV_STORAGE_KEY = 'siji_conversations'

/** 读取全部会话（无数据返回空数组） */
export function loadConversations() {
  try {
    const raw = uni.getStorageSync(CONV_STORAGE_KEY)
    if (!raw) return []
    const list = JSON.parse(raw)
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

/** 会话单条消息的可检索文本（用户 content + AI aiReply/content 兼容） */
function messageText(m) {
  if (!m) return ''
  const parts = []
  if (typeof m.content === 'string' && m.content) parts.push(m.content)
  if (typeof m.aiReply === 'string' && m.aiReply) parts.push(m.aiReply)
  return parts.join('\n')
}

/** 截取命中处前后各 20 字 */
function makeSnippet(text, idx, kw) {
  const clean = text.replace(/\s+/g, ' ').trim()
  const start = Math.max(0, idx - 20)
  const end = Math.min(clean.length, idx + kw.length + 20)
  return clean.slice(start, end)
}

/** 会话更新时间 → 短日期文本 */
function formatDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const md = `${d.getMonth() + 1}月${d.getDate()}日`
  return d.getFullYear() === new Date().getFullYear() ? md : `${d.getFullYear()}年${md}`
}

/**
 * 检索历史会话
 * @param {string} keyword 关键词（原话片段）
 * @param {{ tag?: string, limit?: number }} opts tag 按会话标签过滤；limit 默认 5
 * @returns {Array<{ convId, convTitle, updatedAt, dateText, role, snippet }>} 命中按时间倒序
 */
export function searchConversations(keyword, { tag, limit = 5 } = {}) {
  const kw = String(keyword == null ? '' : keyword).trim().toLowerCase()
  if (!kw) return []
  const list = loadConversations()
  const hits = []
  for (const conv of list) {
    const tags = Array.isArray(conv.tags) ? conv.tags : []
    if (tag && !tags.includes(tag)) continue
    const titleText = String(conv.title || '')
    const updatedAt = conv.updatedAt || conv.createdAt || 0
    let best = null
    const consider = (role, text, baseWeight) => {
      const low = String(text || '').toLowerCase()
      const idx = low.indexOf(kw)
      if (idx < 0) return
      const score = baseWeight + updatedAt / 1e14
      if (!best || score > best.score) {
        best = { role, snippet: makeSnippet(String(text || ''), idx, kw), score }
      }
    }
    // 标题权重最高
    if (titleText) consider('title', titleText, 3)
    for (const m of conv.messages || []) {
      const text = messageText(m)
      if (!text) continue
      consider(m.role === 'user' ? 'user' : 'assistant', text, m.role === 'user' ? 2 : 1)
    }
    if (best) {
      hits.push({
        convId: conv.id,
        convTitle: titleText || '未命名对话',
        updatedAt,
        dateText: formatDate(updatedAt),
        role: best.role,
        snippet: best.snippet
      })
    }
  }
  hits.sort((a, b) => b.updatedAt - a.updatedAt)
  return hits.slice(0, limit)
}
