/**
 * 长期记忆管理
 *
 * 设计：
 *   memories: [{ id, content, category, createdAt, updatedAt }]
 *   category: fact(事实) | preference(偏好) | event(事件) | summary(摘要) | other
 *
 * 存储：siji_long_term_memory
 *
 * 使用方式：
 *   - AI 回复后自动调用 extractMemory 提取关键信息
 *   - buildSystemPrompt 时注入记忆摘要
 *   - 设置页可查看/编辑/删除
 */

import { chatRequest } from '@/utils/api.js'
import { logger } from './logger.js'

const STORAGE_KEY = 'siji_long_term_memory'
const MAX_MEMORIES = 100 // 最多保存 100 条

/** 获取所有记忆 */
export function getAllMemories() {
  try {
    const raw = uni.getStorageSync(STORAGE_KEY)
    if (!raw) return []
    const list = JSON.parse(raw)
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

/** 按分类获取记忆 */
export function getMemoriesByCategory(category) {
  return getAllMemories().filter(m => m.category === category)
}

/** 添加一条记忆 */
export function addMemory(content, category = 'other') {
  const memories = getAllMemories()
  // 去重：如果内容相似度高则更新而非新增
  const existing = memories.find(m => m.content === content)
  if (existing) {
    existing.updatedAt = Date.now()
    persist(memories)
    return existing
  }

  const item = {
    id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    content,
    category,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  memories.unshift(item)

  // 超出上限，移除最旧的
  if (memories.length > MAX_MEMORIES) {
    memories.length = MAX_MEMORIES
  }

  persist(memories)
  return item
}

/** 更新记忆 */
export function updateMemory(id, content) {
  const memories = getAllMemories()
  const item = memories.find(m => m.id === id)
  if (item) {
    item.content = content
    item.updatedAt = Date.now()
    persist(memories)
    return true
  }
  return false
}

/** 删除记忆 */
export function deleteMemory(id) {
  const memories = getAllMemories().filter(m => m.id !== id)
  persist(memories)
  return true
}

/** 清空所有记忆 */
export function clearAllMemories() {
  try {
    uni.removeStorageSync(STORAGE_KEY)
  } catch { /* ignore */ }
}

/** 记忆统计 */
export function getMemoryStats() {
  const all = getAllMemories()
  const categories = {}
  all.forEach(m => {
    categories[m.category] = (categories[m.category] || 0) + 1
  })
  return {
    total: all.length,
    categories,
    latestUpdate: all.length > 0 ? all[0].updatedAt : 0
  }
}

/**
 * 构建记忆摘要文本（注入系统提示词）
 * 按分类分组，最多取最近 30 条
 */
export function buildMemoryContext() {
  const enabled = uni.getStorageSync('siji_memory_enabled')
  if (enabled === 'false') return '' // 用户关闭了长期记忆

  const all = getAllMemories()
  if (all.length === 0) return ''

  const recent = all.slice(0, 30)
  const grouped = {}
  recent.forEach(m => {
    const cat = m.category || 'other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(m.content)
  })

  const labels = {
    fact: '已知事实',
    preference: '用户偏好',
    event: '重要事件',
    summary: '对话摘要',
    other: '其他记忆'
  }

  const parts = []
  for (const cat of ['fact', 'preference', 'event', 'summary', 'other']) {
    if (grouped[cat] && grouped[cat].length > 0) {
      const items = grouped[cat].map(c => `  - ${c}`).join('\n')
      parts.push(`【${labels[cat]}】\n${items}`)
    }
  }

  return parts.length > 0 ? `\n\n---\n长期记忆：\n${parts.join('\n\n')}` : ''
}

/**
 * 从 AI 对话中自动提取记忆
 * 轻量级本地提取（不调用 AI API），基于规则匹配
 *
 * @param {string} userMessage - 用户消息
 * @param {string} aiReply - AI 回复
 * @param {object} execResult - 执行结果（可选）
 */
export function autoExtractMemory(userMessage, aiReply, execResult) {
  const enabled = uni.getStorageSync('siji_memory_enabled')
  if (enabled === 'false') return

  const memories = []

  // === 规则 1：用户自述偏好 ===
  const prefPatterns = [
    { re: /我(喜欢|爱吃|爱喝|偏好|习惯)(.{2,20})/g, cat: 'preference' },
    { re: /我(讨厌|不喜欢|不爱|反感)(.{2,20})/g, cat: 'preference' },
    { re: /我(通常|一般|总是|经常)(.{2,20})/g, cat: 'preference' },
    { re: /我的(名字|姓名|昵称)叫?(.{2,10})/g, cat: 'fact' },
    { re: /我在(.{2,15})(工作|上班|上学|读书)/g, cat: 'fact' },
    { re: /我(是|在做)(.{2,15})工作/g, cat: 'fact' },
    { re: /我(住|搬)在?(.{2,15})/g, cat: 'fact' },
    // 新增：饮食/健康偏好
    { re: /(不吃|不能吃|对.{1,6}过敏)(.{2,15})/g, cat: 'preference' },
    // 新增：作息习惯
    { re: /(早上|晚上|每天)(.{1,5})(起床|睡觉|跑步|锻炼|冥想)/g, cat: 'preference' },
    // 新增：数字偏好
    { re: /预算(是|大概|大约)?(\d{2,6})/g, cat: 'fact' },
  ]
  prefPatterns.forEach(({ re, cat }) => {
    let match
    while ((match = re.exec(userMessage)) !== null) {
      const text = match[0].trim()
      if (text.length >= 4 && text.length <= 40) {
        memories.push({ content: text, category: cat })
      }
    }
  })

  // === 规则 2：执行结果记忆 ===
  if (execResult && execResult.success && execResult.detail) {
    const d = execResult.detail
    if (d.type === 'bill' && d.amount) {
      memories.push({
        content: `记账：¥${d.amount} ${d.category || ''} ${d.note || ''}`.trim(),
        category: 'event'
      })
    } else if (d.type === 'plan' && d.title) {
      memories.push({
        content: `计划：${d.title}`,
        category: 'event'
      })
    }
  }

  // === 规则 3：重要关键词触发 ===
  const importantKeywords = ['生日', '纪念日', '结婚', '搬家', '换工作', '入职', '离职', '考试', '面试', '旅行', '出差']
  importantKeywords.forEach(kw => {
    if (userMessage.includes(kw)) {
      // 提取包含关键词的句子
      const sentences = userMessage.split(/[。！？\n]/)
      sentences.forEach(s => {
        if (s.includes(kw) && s.length >= 3 && s.length <= 50) {
          memories.push({ content: s.trim(), category: 'event' })
        }
      })
    }
  })

  // 去重并保存
  const existing = getAllMemories()
  const existingContents = new Set(existing.map(m => m.content))

  memories.forEach(m => {
    if (!existingContents.has(m.content)) {
      addMemory(m.content, m.category)
    }
  })
}

/**
 * 手动通过 AI 提取记忆摘要（当对话达到一定长度时调用）
 * 这是一个可选的增强功能，用 AI 自身能力总结对话
 *
 * @param {Array} messages - 对话消息列表
 * @param {object} cfg - AI 配置
 * @returns {Promise<string|null>} 提取的记忆摘要
 */
export async function aiSummarizeConversation(messages, cfg) {
  if (!messages || messages.length < 10) return null

  try {
    // 取最近 20 条对话
    const recent = messages.slice(-20)
    const dialogue = recent
      .map(m => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content || m.aiReply || ''}`)
      .join('\n')

    const prompt = `请从以下对话中提取值得长期记忆的关键信息（用户偏好、重要事实、重要事件），每条一行，不要编号。如果没有值得记忆的内容，回复"无"。\n\n${dialogue}`

    const result = await chatRequest(prompt, null, null, {
      ...cfg,
      temperature: 0.3
    }, [])

    if (result && result.reply && result.reply.trim() && result.reply.trim() !== '无') {
      const lines = result.reply.trim().split('\n').map(l => l.replace(/^[-•*\d.\s]+/, '').trim()).filter(l => l.length >= 3 && l.length <= 60)
      lines.forEach(line => addMemory(line, 'summary'))
      return lines.join('\n')
    }
  } catch (e) {
    logger.warn('[思迹] AI 记忆提取失败:', e)
  }
  return null
}

/** 是否启用长期记忆 */
export function isMemoryEnabled() {
  const v = uni.getStorageSync('siji_memory_enabled')
  return v !== 'false' // 默认启用
}

/** 切换记忆开关 */
export function setMemoryEnabled(enabled) {
  uni.setStorageSync('siji_memory_enabled', enabled ? 'true' : 'false')
}

/** 持久化 + 过期清理 */
function persist(memories) {
  // 过期清理：event 类记忆超 90 天自动移除，summary 类超 180 天移除
  const now = Date.now()
  const EVENT_TTL = 90 * 24 * 60 * 60 * 1000   // 90 天
  const SUMMARY_TTL = 180 * 24 * 60 * 60 * 1000  // 180 天
  const cleaned = memories.filter(m => {
    if (m.category === 'event' && now - (m.createdAt || 0) > EVENT_TTL) return false
    if (m.category === 'summary' && now - (m.createdAt || 0) > SUMMARY_TTL) return false
    return true
  })
  try {
    uni.setStorageSync(STORAGE_KEY, JSON.stringify(cleaned))
  } catch { /* ignore */ }
}
