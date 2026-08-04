/**
 * 模板 AI 生成 composable
 */
import { ref } from 'vue'
import { chatRequest } from '@/utils/api.js'
import { generateEntityId } from '@/utils/uuid.js'
import { savePlanTemplate } from '@/utils/storage/plan.js'

export function useTemplateAI(store) {
  const aiInput = ref('')
  const aiLoading = ref(false)
  const aiPreview = ref(null)

  async function generateAI() {
    if (!aiInput.value.trim()) {
      uni.showToast({ title: '请描述你想要的计划模板', icon: 'none' })
      return
    }
    if (!store.hasApiKey) {
      uni.showToast({ title: '请先在设置页配置 API Key', icon: 'none' })
      return
    }
    aiLoading.value = true
    aiPreview.value = null
    try {
      const prompt = `你是计划模板生成器。用户想创建一个计划模板，请根据描述智能拆解为3-8个可执行的子任务。

用户描述：${aiInput.value}

请返回 JSON：
{
  "name": "模板名称（≤12字）",
  "icon": "合适的emoji图标",
  "color": "十六进制颜色（如 #18181B）",
  "description": "模板描述（≤40字）",
  "priority": 1-3（1高2中3低）,
  "subtasks": [{ "title": "子任务1" }, { "title": "子任务2" }]
}

注意：子任务要具体、可执行、有逻辑顺序。只返回 JSON，不要其他内容。`

      const result = await chatRequest(prompt, null, '', store.aiConfig.apiKey)
      const raw = result.reply || ''
      let parsed
      try { parsed = JSON.parse(raw) } catch {
        const m = raw.match(/\{[\s\S]*\}/)
        if (m) parsed = JSON.parse(m[0])
        else throw new Error('AI 返回格式错误')
      }
      aiPreview.value = {
        name: parsed.name || '自定义模板',
        icon: parsed.icon || '📋',
        color: parsed.color || '#18181B',
        description: parsed.description || '',
        priority: typeof parsed.priority === 'number' ? parsed.priority : 2,
        subtasks: Array.isArray(parsed.subtasks) ? parsed.subtasks.map(s => ({
          title: typeof s === 'string' ? s : (s.title || '')
        })) : []
      }
    } catch (e) {
      uni.showToast({ title: e.message || 'AI 生成失败', icon: 'none' })
    } finally {
      aiLoading.value = false
    }
  }

  function saveAIPreview() {
    if (!aiPreview.value) return
    const tpl = {
      client_id: generateEntityId('tpl'),
      name: aiPreview.value.name,
      icon: aiPreview.value.icon,
      color: aiPreview.value.color,
      description: aiPreview.value.description,
      category: 'custom',
      plan_data: {
        priority: aiPreview.value.priority,
        subtasks: aiPreview.value.subtasks
      },
      created_at: Date.now(),
      updated_at: Date.now(),
      is_deleted: 0
    }
    savePlanTemplate(tpl)
    aiPreview.value = null
    aiInput.value = ''
    uni.showToast({ title: '模板已保存', icon: 'success' })
    return tpl
  }

  return { aiInput, aiLoading, aiPreview, generateAI, saveAIPreview }
}
