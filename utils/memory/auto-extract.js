/**
 * memory/auto-extract.js — 对话后的记忆提取（3.5.14 从 utils/memory.js 拆出）
 *
 * 本地规则提取（不调用 AI）+ 可选的 AI 对话摘要。
 */

import { chatRequest } from '@/utils/api.js'
import { logger } from '../logger.js'
import { extractStructuredMemory } from '../memory-structured.js'
import { addMemory, getAllMemories } from './store.js'
import { appendToMonthlyCard, currentMonth } from './monthly.js'

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

  // 预加载已有记忆，用于后续去重判断
  const existing = getAllMemories()
  const existingContents = new Set(existing.map(m => m.content))

  // === 改动1：偏好/事实提取已移交 profile smart_update，此处只保留事件/摘要 ===
  // 原 10 条正则（prefPatterns）删除：
  //   - "我喜欢X"/"我讨厌X"/"我通常X" → profile.dietary/hobbies/occupation
  //   - "我叫X"/"我在X工作"/"我住在X" → profile.nickname/occupation/location
  //   - "不吃X"/"预算X" → profile.dietary/budget
  // 这些信息由 AI 通过 smart_update_profile action 结构化更新，不再用正则提取

  // === 执行结果记忆已删除 ===
  // 原：从 execResult 中提取记账/计划事件存入记忆
  // 原因：chatHistoryBuilder 已在历史中追加 [执行结果: 已记账 ¥50 餐饮]，
  // memory 再存一份是冗余。且 AI 能从历史中看到执行结果。

  // === 规则 3：重要关键词触发（改动6：增加情绪宣泄排除） ===
  const EMOTION_NOISE = /太|好烦|气死|受不了|崩溃|烦透|郁卒|恶心|想哭|绝望/
  const importantKeywords = ['生日', '纪念日', '结婚', '搬家', '换工作', '入职', '离职', '考试', '面试', '旅行', '出差']
  importantKeywords.forEach(kw => {
    if (userMessage.includes(kw)) {
      const sentences = userMessage.split(/[。！？\n]/)
      sentences.forEach(s => {
        if (s.includes(kw) && s.length >= 3 && s.length <= 50) {
          // 改动6：排除情绪宣泄句式 — "好烦要去面试"不提取
          if (EMOTION_NOISE.test(s)) return
          memories.push({ content: s.trim(), category: 'event' })
        }
      })
    }
  })

  // === 改动1：规则4 人物/性格提取删除 ===
  // 原规则4从 AI 回复中提取「人际关系：张三（同事）」「性格特点是INFP」
  // 这些信息应由 AI 通过 create_relation / smart_update_profile action 结构化更新
  // 正则提取准确率低且与关系图谱/画像功能重叠，已删除

  // 去重并保存
  memories.forEach(m => {
    if (!existingContents.has(m.content)) {
      addMemory(m.content, m.category)
    }
  })

  // E1 结构化记忆：实体/关系/事件三元组提取（本地规则）
  try {
    extractStructuredMemory(userMessage, aiReply)
  } catch (e) {
    logger.warn('[思迹] 结构化记忆提取失败:', e)
  }
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
      appendToMonthlyCard(currentMonth(), lines)
      return lines.join('\n')
    }
  } catch (e) {
    logger.warn('[思迹] AI 记忆提取失败:', e)
  }
  return null
}
