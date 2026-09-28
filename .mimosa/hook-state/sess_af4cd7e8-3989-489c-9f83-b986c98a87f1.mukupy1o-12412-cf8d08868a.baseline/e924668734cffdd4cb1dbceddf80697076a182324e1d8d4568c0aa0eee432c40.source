/**
 * 开发者反馈 — 聊天记录导出工具（纯函数，可测试）
 *
 * 用途：用户在使用中遇到 Bug 或想优化功能时，
 * 把对话记录提取为 Markdown / JSON 反馈文本，交给开发者（Codex）定位问题。
 *
 * 隐私处理：
 *  - 图片 base64 一律剔除，仅保留「含图片」标注（体积大且不必要）
 *  - 单条消息超长截断（MAX_MSG_CHARS）
 *  - 不包含 API Key 等配置（对话存储中本就不含）
 */

const MAX_MESSAGES_PER_CONV = 200
const MAX_MSG_CHARS = 20000

/** 消息清洗：剔除 base64、截断超长字段、丢弃流式中间帧 */
export function sanitizeMessage(m) {
  if (!m) return null
  // 丢弃未完成的流式中间帧
  if (m.role === 'assistant' && m.loading && !m.aiReply) return null
  const out = {
    role: m.role || 'unknown',
    content: typeof m.content === 'string' ? m.content : (m.content ? JSON.stringify(m.content) : '')
  }
  if (m.aiReply) {
    const replyText = typeof m.aiReply === 'string' ? m.aiReply : JSON.stringify(m.aiReply)
    const contentText = out.content || ''
    // content ?? = ???? + ????????????????????
    if (replyText && replyText !== contentText && !contentText.startsWith(replyText)) {
      out.aiReply = replyText
    }
  }
  if (m.execResult) out.execResult = m.execResult
  if (m.execResults) out.execResults = m.execResults
  if (m.actionCard) out.actionCard = m.actionCard
  if (m.image) {
    if (m.image.base64) {
      out.image = { note: '（含图片，已省略）' }
    } else if (m.image.localPath || m.image.src) {
      out.image = { note: '（含图片）' }
    }
  }
  for (const key of ['content', 'aiReply']) {
    if (typeof out[key] === 'string' && out[key].length > MAX_MSG_CHARS) {
      out[key] = out[key].slice(0, MAX_MSG_CHARS) + '\n…（内容过长已截断）'
    }
  }
  return out
}

/** 收集会话消息（按条数上限截取最近消息） */
export function collectMessages(conv, maxMessages = MAX_MESSAGES_PER_CONV) {
  const list = Array.isArray(conv && conv.messages) ? conv.messages : []
  return list
    .map(sanitizeMessage)
    .filter(Boolean)
    .slice(-maxMessages)
}

/** 会话摘要（供列表展示） */
export function summarizeConversation(conv) {
  return {
    id: conv.id || '',
    title: conv.title || '未命名对话',
    messageCount: Array.isArray(conv.messages) ? conv.messages.length : 0,
    createdAt: conv.createdAt || 0,
    updatedAt: conv.updatedAt || 0
  }
}

/** 头部信息（版本/平台/设备/时间） */
export function buildHeader(meta = {}) {
  const lines = [
    '# 思迹开发者反馈（聊天记录）',
    '',
    '- 导出时间: ' + (meta.exportedAt || ''),
    '- 应用版本: ' + (meta.appVersion || ''),
    '- 平台: ' + (meta.platform || ''),
    '- 设备: ' + (meta.deviceModel || ''),
    '- AI 模型: ' + (meta.model || ''),
    '- 会话数: ' + (meta.conversationCount || 0) + '，消息数: ' + (meta.messageCount || 0),
    '',
    '> 说明：以下为应用内对话记录，请据此定位 Bug 或评估优化点。',
    ''
  ]
  return lines.join('\n')
}

function safeJson(v) {
  try {
    return JSON.stringify(v, null, 2)
  } catch {
    return String(v)
  }
}

function fmtTime(ts) {
  if (!ts) return '-'
  const d = new Date(ts)
  const pad = n => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
}

function renderMessage(m, includeActions) {
  const parts = []
  const who = m.role === 'user' ? '### 用户' : '### AI'
  parts.push(who, '')
  parts.push((m.content || '').trim() || '（空消息）')
  if (m.aiReply) {
    parts.push('', '**AI 回复**:', '', m.aiReply)
  }
  if (includeActions) {
    if (m.actionCard) {
      parts.push('', '**执行动作**:', '', '```json', safeJson(m.actionCard), '```')
    }
    if (m.execResult) {
      parts.push('', '**执行结果**:', '', '```json', safeJson(m.execResult), '```')
    }
    if (m.execResults && m.execResults.length > 0) {
      parts.push('', '**执行结果（多步）**:', '', '```json', safeJson(m.execResults), '```')
    }
  }
  if (m.image && m.image.note) {
    parts.push('', m.image.note)
  }
  return parts.join('\n')
}

/** 生成 Markdown 反馈文本（人类可读 + Codex 可直接理解） */
export function buildDevFeedbackMarkdown(conversations, options = {}) {
  const includeActions = options.includeActions !== false
  const list = Array.isArray(conversations) ? conversations : []
  const allMsgs = list.reduce((s, c) => s + collectMessages(c, options.maxMessages).length, 0)
  const meta = Object.assign({}, options.meta || {}, {
    conversationCount: list.length,
    messageCount: allMsgs
  })
  const parts = [buildHeader(meta)]
  list.forEach((conv, ci) => {
    const msgs = collectMessages(conv, options.maxMessages)
    parts.push('', '## 会话 ' + (ci + 1) + '：' + (conv.title || '未命名对话'))
    parts.push('- 创建: ' + fmtTime(conv.createdAt) + '，更新: ' + fmtTime(conv.updatedAt) + '，消息数: ' + msgs.length)
    parts.push('')
    msgs.forEach(m => {
      parts.push(renderMessage(m, includeActions), '')
    })
  })
  if (list.length === 0) {
    parts.push('（没有可导出的会话）')
  }
  return parts.join('\n')
}

/** 剔除执行动作字段（includeActions=false 时 JSON 导出使用） */
function stripActions(m) {
  const out = Object.assign({}, m)
  delete out.actionCard
  delete out.execResult
  delete out.execResults
  return out
}

/** 生成 JSON 反馈文本（结构化，供 Codex 直接解析） */
export function buildDevFeedbackJson(conversations, options = {}) {
  const includeActions = options.includeActions !== false
  const list = Array.isArray(conversations) ? conversations : []
  const allMsgs = list.reduce((s, c) => s + collectMessages(c, options.maxMessages).length, 0)
  const meta = Object.assign({}, options.meta || {}, {
    conversationCount: list.length,
    messageCount: allMsgs
  })
  const payload = {
    type: 'siji_dev_feedback',
    version: 1,
    meta,
    conversations: list.map(conv => {
      const msgs = collectMessages(conv, options.maxMessages)
      return {
        id: conv.id || '',
        title: conv.title || '未命名对话',
        createdAt: conv.createdAt || 0,
        updatedAt: conv.updatedAt || 0,
        messages: includeActions ? msgs : msgs.map(stripActions)
      }
    })
  }
  return JSON.stringify(payload, null, 2)
}
/** ==================== 自动选择（问题会话 + 关键消息） ==================== */

/** 异常消息特征正则（按优先级排列） */
const ISSUE_PATTERNS = [
  /请求失败|Access denied|API Key 无效|网络连接失败|请到设置页检查/,
  /AI 走神|响应超时|AI 未返回有效响应|AI 响应超时/,
  /没能自动记录|该操作未实际执行|未返回有效指令|请重新描述/,
  /没有附带图片|无法直接查看|识别图片/,
  /\[执行结果:[^\]]*$/  // 残缺的执行结果回声（未闭合括号）
]

/**
 * 检测单条消息是否异常
 * @returns {null | {level: number, reason: string}} level 2=硬失败 1=疑似异常
 */
export function getMessageIssue(m) {
  if (!m) return null
  if (m.failed) return { level: 2, reason: 'failed' }
  const text = [m.content, m.aiReply, m.execResult && m.execResult.message]
    .filter(v => typeof v === 'string' && v)
    .join('\n')
  if (!text) return null
  for (let i = 0; i < ISSUE_PATTERNS.length; i++) {
    if (ISSUE_PATTERNS[i].test(text)) return { level: 1, reason: 'pattern-' + i }
  }
  return null
}

/**
 * 自动选择问题会话：按异常消息数降序（同分按最近更新）
 * @returns {Array<{conv: Object, issueCount: number, issues: Array}>}
 */
export function selectIssueConversations(convs, options = {}) {
  const limit = options.limit || 3
  const list = Array.isArray(convs) ? convs : []
  const scored = list
    .map(conv => {
      const msgs = Array.isArray(conv.messages) ? conv.messages : []
      const issues = msgs
        .map((m, i) => ({ index: i, issue: getMessageIssue(m) }))
        .filter(x => x.issue)
      return { conv, issueCount: issues.length, issues }
    })
    .filter(x => x.issueCount > 0)
  scored.sort((a, b) =>
    b.issueCount - a.issueCount ||
    (b.conv.updatedAt || 0) - (a.conv.updatedAt || 0))
  return scored.slice(0, limit)
}

/**
 * 关键消息选择：异常消息 + 前后上下文，保留原始顺序
 * 无异常时返回最近 maxMessages 条
 */
export function selectKeyMessages(conv, options = {}) {
  const contextBefore = options.contextBefore || 2
  const contextAfter = options.contextAfter || 2
  const maxMessages = options.maxMessages || 80
  const msgs = Array.isArray(conv && conv.messages) ? conv.messages : []
  const issueIdx = msgs
    .map((m, i) => (getMessageIssue(m) ? i : -1))
    .filter(i => i >= 0)
  if (issueIdx.length === 0) return msgs.slice(-maxMessages)
  const picked = new Set()
  for (const idx of issueIdx) {
    for (let i = Math.max(0, idx - contextBefore); i <= Math.min(msgs.length - 1, idx + contextAfter); i++) {
      picked.add(i)
    }
  }
  const indexes = Array.from(picked).sort((a, b) => a - b)
  const out = indexes.map(i => msgs[i])
  return out.length > maxMessages ? out.slice(-maxMessages) : out
}
