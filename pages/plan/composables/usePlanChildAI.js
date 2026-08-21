/**
 * 子计划 AI 拆解 composable
 * 大目标 → 拆解为多个子计划（每个子计划独立可管理，含时间窗口与下一级子计划）
 */
import { ref } from 'vue'
import { chatRequest } from '@/utils/api.js'
import { generateEntityId } from '@/utils/uuid.js'
import { convertPhasesToChildPlans } from '@/utils/storage.js'

export function usePlanChildAI(form, store) {
  const aiChildrenLoading = ref(false)

  function toChildForm(spec, priority) {
    return {
      client_id: generateEntityId('plan'),
      title: spec.title,
      description: spec.description || '',
      priority,
      status: spec.status,
      estimated_time: spec.estimated_time || '',
      due_date: spec.due_date || '',
      deadline: spec.deadline || '',
      parent_id: '',
      childPlans: (spec.children || []).map(g => toChildForm(g, priority)),
      _subCount: (spec.children || []).length
    }
  }

  async function aiBreakdownChildren() {
    if (!form.value.title.trim()) {
      uni.showToast({ title: '请先填写计划标题', icon: 'none' })
      return
    }
    if (form.value.childPlans.length > 0) {
      const confirmed = await new Promise(resolve => {
        uni.showModal({
          title: '重新拆解',
          content: '将替换当前 ' + form.value.childPlans.length + ' 个子计划，确认？',
          confirmText: '替换',
          cancelText: '取消',
          success: (res) => resolve(!!res.confirm),
          fail: () => resolve(false)
        })
      })
      if (!confirmed) return
    }
    aiChildrenLoading.value = true
    try {
      const deadline = form.value.due_date || '未指定'
      const today = new Date()
      const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0')
      const prompt = '你是专业项目规划师。请将以下目标拆解为多个子计划，每个子计划是一个独立可执行的计划。\n\n'
        + '目标：' + form.value.title + '\n'
        + '描述：' + (form.value.description || '无') + '\n'
        + '截止日期：' + deadline + '\n'
        + '当前日期：' + todayStr + '\n\n'
        + '要求：\n'
        + '1. 拆成 2-6 个子计划，按时间顺序递进\n'
        + '2. 每个子计划包含：标题、简短描述、开始日期(YYYY-MM-DD)、结束日期(YYYY-MM-DD)\n'
        + '3. 每个子计划可包含 1-3 个更细的子任务（可选，将生成下一级子计划）\n'
        + '4. 所有日期不能晚于截止日期\n'
        + '5. 只返回 JSON 数组，不要其他内容，格式：\n'
        + '[\n'
        + '  {\n'
        + '    "title": "子计划标题",\n'
        + '    "description": "目标描述",\n'
        + '    "start_date": "YYYY-MM-DD",\n'
        + '    "end_date": "YYYY-MM-DD",\n'
        + '    "subtasks": [{ "title": "具体动作", "done": false }]\n'
        + '  }\n'
        + ']'

      const result = await chatRequest(prompt, null, '', store.aiConfig)
      const raw = typeof result.reply === 'string' ? result.reply : ''
      let phases = []
      try {
        const m = raw.match(/\[[\s\S]*\]/)
        if (m) phases = JSON.parse(m[0])
      } catch (e) {
        phases = []
      }

      if (phases.length === 0) {
        uni.showToast({ title: 'AI 拆解失败，请重试', icon: 'none' })
        return
      }
      const specs = convertPhasesToChildPlans(phases)
      form.value.childPlans = specs.map(spec => toChildForm(spec, form.value.priority))
      uni.showToast({ title: '已拆解 ' + form.value.childPlans.length + ' 个子计划', icon: 'success' })
    } catch (e) {
      console.warn('AI children breakdown failed:', e)
      uni.showToast({ title: 'AI 拆解失败', icon: 'none' })
    } finally {
      aiChildrenLoading.value = false
    }
  }

  return { aiChildrenLoading, aiBreakdownChildren }
}
