/**
 * 记录 AI 功能 — 摘要、改写润色、提取待办、情绪分析
 * I1: AI 改写润色
 * I2: AI 提取待办（一键创建计划）
 * I3: AI 情绪分析
 */
import { ref } from 'vue'
import { logger } from '@/utils/logger.js'
import { generateEntityId } from '@/utils/uuid.js'
import { savePlan } from '@/utils/storage.js'
import { getDefaultConfig, buildProviderRequest } from '@/utils/ai/providers.js'

export function useDiaryAI(formRef) {
  const generating = ref(false)
  const Rewriting = ref(false)
  const extractingTodos = ref(false)
  const analyzingEmotion = ref(false)
  // 4.15：错误态（非空即失败，进统一错误卡，不再只弹 toast）
  const summaryError = ref('')
  const emotionError = ref('')

  /** 统一错误文案 */
  function errText(e, fallback) {
    const msg = (e && e.message) || ''
    if (/API Key|未配置|apikey/i.test(msg)) return '未配置 API Key，请到 设置 → AI 配置 填写后重试'
    if (/rate|频繁|429/i.test(msg)) return '调用太频繁，稍等片刻再试'
    if (/network|timeout|超时|abort/i.test(msg)) return '网络超时，请重试'
    if (/key|无效|invalid|401/i.test(msg)) return 'API Key 无效或已过期，请到 设置 → AI 配置 检查'
    return fallback
  }

  // 通用 AI 请求
  async function callAI(systemPrompt, userContent, temperature = 0.7) {
    const cfg = getDefaultConfig()
    if (!cfg?.apiKey) { const err = new Error('未配置 API Key'); throw err }
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ]
    const reqOpts = buildProviderRequest(cfg.provider, cfg.model, messages, cfg.apiKey, temperature)
    const res = await new Promise((resolve, reject) => {
      uni.request({ ...reqOpts, timeout: 15000, success: resolve, fail: reject })
    })
    if (res.statusCode === 200 && res.data?.choices) {
      const raw = res.data.choices[0]?.message?.content || ''
      return raw.replace(/```json\n?/g, '').replace(/```/g, '').trim()
    }
    return null
  }

  // 摘要 + 标签建议 (B2)
  async function generateAISummary(isNew, diaryId, month, getDiaryById, saveDiary) {
    if (!formRef.value.content.trim()) { uni.showToast({ title: '写点什么再生成摘要', icon: 'none' }); return }
    generating.value = true
    summaryError.value = ''
    try {
      const raw = await callAI(
        '你是思迹的记录助手。请为用户的记录生成简洁的摘要和建议，并推荐 1-3 个标签。返回纯 JSON：{"summary":"一句话摘要","advice":"一条建议","tags":["标签1","标签2"]}',
        formRef.value.content.trim()
      )
      if (!raw) { summaryError.value = '生成失败，请重试'; return }
      const result = JSON.parse(raw)
      formRef.value.ai_summary = result.summary || ''
      formRef.value.ai_advice = result.advice || ''
      // I3: 情绪
      if (result.emotion) formRef.value.emotion = result.emotion
      if (Array.isArray(result.tags)) result.tags.forEach(t => {
        if (t && !formRef.value.tags.includes(t)) formRef.value.tags.push(t)
      })
      if (!isNew) {
        const item = getDiaryById(diaryId, month)
        if (item) saveDiary({ ...item, ai_summary: formRef.value.ai_summary, ai_advice: formRef.value.ai_advice, updated_at: Date.now() })
      }
      uni.showToast({ title: '摘要已生成', icon: 'success' })
    } catch (e) {
      logger.warn('[AI摘要] 生成失败:', e.message)
      summaryError.value = errText(e, '生成失败，请重试')
    } finally { generating.value = false }
  }

  // I1: AI 改写润色
  async function rewriteContent() {
    if (!formRef.value.content.trim()) { uni.showToast({ title: '写点什么再润色', icon: 'none' }); return }
    Rewriting.value = true
    try {
      const raw = await callAI(
        '你是写作助手。请润色用户的记录，保持原意不变，让表达更流畅自然。返回纯 JSON：{"rewritten":"润色后的文本","changed":true/false}',
        formRef.value.content.trim(),
        0.5
      )
      if (!raw) { uni.showToast({ title: '润色失败', icon: 'none' }); return }
      const result = JSON.parse(raw)
      if (result.rewritten) {
        uni.showModal({
          title: '润色结果',
          content: result.rewritten,
          confirmText: '替换',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm) {
              formRef.value.content = result.rewritten
              uni.showToast({ title: '已替换', icon: 'success' })
            }
          }
        })
      }
      } catch (e) { logger.warn('[AI润色] 失败:', e.message); uni.showToast({ title: errText(e, '润色失败'), icon: 'none' }) }
    finally { Rewriting.value = false }
  }

  // I2 核心：从任意文本提取待办（4.15 抽出，供记录详情/对话消息/搜索结果复用）
  // 返回 todos 数组；无待办返回 []；失败抛错
  async function extractTodosFromText(text) {
    const raw = await callAI(
      '请从用户的记录中提取可执行的待办事项。返回纯 JSON：{"todos":[{"title":"待办标题","priority":0-2,"description":"简述"}]}。如果没有待办返回 {"todos":[]}',
      String(text || '').trim(),
      0.3
    )
    if (!raw) throw new Error('提取失败')
    const result = JSON.parse(raw)
    return Array.isArray(result.todos) ? result.todos : []
  }

  /** 4.15：全局入口用——对任意文本做「提取待办 → 确认 → 创建计划」，带确认弹窗 */
  async function extractTodosFromAnyText(text) {
    if (!String(text || '').trim()) { uni.showToast({ title: '没有可提取的内容', icon: 'none' }); return }
    extractingTodos.value = true
    try {
      const todos = await extractTodosFromText(text)
      if (todos.length === 0) { uni.showToast({ title: '未发现待办事项', icon: 'none' }); return }
      const count = todos.length
      uni.showModal({
        title: `发现 ${count} 个待办`,
        content: todos.map((t, i) => `${i + 1}. ${t.title}`).join('\n'),
        confirmText: '创建计划',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            todos.forEach(todo => {
              savePlan({
                client_id: generateEntityId('plan'),
                title: todo.title,
                description: todo.description || '',
                priority: todo.priority || 0,
                status: 0,
                tags: [],
                subtasks: [],
                created_at: Date.now(),
                updated_at: Date.now(),
                is_deleted: 0
              })
            })
            uni.showToast({ title: `已创建 ${count} 个计划`, icon: 'success' })
          }
        }
      })
    } catch (e) {
      logger.warn('[AI提取待办] 失败:', e.message)
      uni.showToast({ title: errText(e, '提取失败'), icon: 'none' })
    } finally { extractingTodos.value = false }
  }

  // I2: AI 提取待办（记录详情入口，走同一核心）
  async function extractTodos() {
    if (!formRef.value.content.trim()) { uni.showToast({ title: '写点什么再提取', icon: 'none' }); return }
    await extractTodosFromAnyText(formRef.value.content.trim())
  }

  // I3: AI 情绪分析
  async function analyzeEmotion(isNew, diaryId, month, getDiaryById, saveDiary) {
    if (!formRef.value.content.trim()) { uni.showToast({ title: '写点什么再分析', icon: 'none' }); return }
    analyzingEmotion.value = true
    emotionError.value = ''
    try {
      const raw = await callAI(
        '请分析用户记录中的情绪。返回纯 JSON：{"emotion":"开心|平静|焦虑|低落|愤怒","intensity":1-5,"reason":"简述判断依据"}',
        formRef.value.content.trim(),
        0.3
      )
      if (!raw) { emotionError.value = '分析失败，请重试'; return }
      const result = JSON.parse(raw)
      formRef.value.emotion = result.emotion || ''
      if (!isNew) {
        const item = getDiaryById(diaryId, month)
        if (item) saveDiary({ ...item, emotion: formRef.value.emotion, updated_at: Date.now() })
      }
      uni.showToast({ title: `情绪: ${result.emotion}`, icon: 'none' })
    } catch (e) {
      logger.warn('[AI情绪] 失败:', e.message)
      emotionError.value = errText(e, '分析失败，请重试')
    } finally { analyzingEmotion.value = false }
  }

  return {
    generating, Rewriting, extractingTodos, analyzingEmotion,
    summaryError, emotionError,
    generateAISummary, rewriteContent, extractTodos, extractTodosFromAnyText, analyzeEmotion
  }
}
