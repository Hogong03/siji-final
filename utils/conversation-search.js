/**
 * 对话内容搜索工具
 * 搜索所有会话消息（用户+AI回复），用于功能页全局搜索
 */

const CONV_STORAGE_KEY = 'siji_conversations'

/**
 * 搜索会话消息
 * @param {string} keyword - 搜索关键词
 * @param {object} options - 可选配置
 * @param {number} options.limit - 最多返回条数，默认 10
 * @returns {Array} 匹配的对话片段 [{ convId, convTitle, messageIndex, content, preview, role, time }]
 */
export function searchConversations(keyword, options = {}) {
  const kw = keyword.trim().toLowerCase()
  if (!kw || kw.length < 1) return []

  const limit = options.limit || 10
  const results = []

  try {
    const raw = uni.getStorageSync(CONV_STORAGE_KEY)
    if (!raw) return []
    const conversations = JSON.parse(raw)
    if (!Array.isArray(conversations)) return []

    for (const conv of conversations) {
      if (!conv.messages || !Array.isArray(conv.messages)) continue

      for (let i = 0; i < conv.messages.length; i++) {
        const msg = conv.messages[i]
        const content = (msg.content || '').toLowerCase()
        const aiReply = (msg.aiReply || '').toLowerCase()

        if (content.includes(kw) || aiReply.includes(kw)) {
          // 找到匹配文本片段（前后取 40 字上下文）
          const sourceText = msg.content || msg.aiReply || ''
          const idx = sourceText.toLowerCase().indexOf(kw)
          const start = Math.max(0, idx - 20)
          const end = Math.min(sourceText.length, idx + kw.length + 40)
          let preview = sourceText.substring(start, end)
          if (start > 0) preview = '…' + preview
          if (end < sourceText.length) preview += '…'

          results.push({
            convId: conv.id,
            convTitle: conv.title || '未命名对话',
            messageIndex: i,
            role: msg.role || 'user',
            content: sourceText.substring(0, 100),
            preview,
            time: msg.time || msg.createdAt || conv.updatedAt || conv.createdAt
          })

          if (results.length >= limit) break
        }
      }
      if (results.length >= limit) break
    }
  } catch (e) {
    // 忽略解析错误
  }

  // 按时间倒序
  results.sort((a, b) => (b.time || 0) - (a.time || 0))
  return results.slice(0, limit)
}
