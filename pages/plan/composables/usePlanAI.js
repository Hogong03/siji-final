/**
 * 计划 AI 增强 composable
 * - AI 智能排期：根据子任务+优先级+截止日期推荐每日执行计划
 * - AI 进度复盘：已完成计划生成复盘报告
 * - AI 下一步建议：进行中计划推荐下一步行动
 */
import { ref } from 'vue'
import { chatRequest } from '@/utils/api.js'

export function usePlanAI(form, store) {
  const aiScheduling = ref(false)
  const aiReview = ref(false)
  const aiNextStep = ref(false)
  const aiScheduleResult = ref('')
  const aiReviewResult = ref('')
  const aiNextStepResult = ref('')

  async function generateSchedule() {
    if (!store.hasApiKey) {
      uni.showToast({ title: '请先配置 API Key', icon: 'none' })
      return
    }
    if (!form.value.due_date) {
      uni.showToast({ title: '请先设置截止日期', icon: 'none' })
      return
    }
    aiScheduling.value = true
    aiScheduleResult.value = ''
    try {
      const subtasks = form.value.subtasks.map((s, i) => `${i + 1}. ${s.title} (${s.done ? '已完成' : '未完成'})`).join('\n')
      const prompt = `你是计划排期助手。请根据以下计划信息，生成一个合理的执行排期建议。

计划标题：${form.value.title}
优先级：${['普通', '重要', '紧急'][form.value.priority] || '普通'}
截止时间：${form.value.due_date}
子任务：
${subtasks || '无'}

请给出具体的执行建议，包括：
1. 每个子任务的推荐执行时间
2. 关键路径和依赖关系
3. 风险提示

简洁明了，用列表格式。`

      const result = await chatRequest(prompt, null, '', store.aiConfig.apiKey)
      aiScheduleResult.value = result.reply || 'AI 生成失败'
    } catch (e) {
      uni.showToast({ title: 'AI 排期失败', icon: 'none' })
    } finally {
      aiScheduling.value = false
    }
  }

  async function generateReview() {
    if (!store.hasApiKey) {
      uni.showToast({ title: '请先配置 API Key', icon: 'none' })
      return
    }
    aiReview.value = true
    aiReviewResult.value = ''
    try {
      const subtasks = form.value.subtasks.map((s, i) => `${i + 1}. ${s.title} (${s.done ? '已完成' : '未完成'})`).join('\n')
      const prompt = `你是计划复盘助手。请对以下已完成的计划进行复盘分析。

计划标题：${form.value.title}
描述：${form.value.description || '无'}
优先级：${['普通', '重要', '紧急'][form.value.priority] || '普通'}
子任务完成情况：
${subtasks || '无'}

请给出：
1. 完成质量评估（优/良/中/差）
2. 时间管理分析
3. 改进建议
4. 下次类似计划的可复用经验

简洁有力，不要废话。`

      const result = await chatRequest(prompt, null, '', store.aiConfig.apiKey)
      aiReviewResult.value = result.reply || 'AI 复盘失败'
    } catch (e) {
      uni.showToast({ title: 'AI 复盘失败', icon: 'none' })
    } finally {
      aiReview.value = false
    }
  }

  async function generateNextStep() {
    if (!store.hasApiKey) {
      uni.showToast({ title: '请先配置 API Key', icon: 'none' })
      return
    }
    aiNextStep.value = true
    aiNextStepResult.value = ''
    try {
      const subtasks = form.value.subtasks.map((s, i) => `${i + 1}. ${s.title} (${s.done ? '已完成' : '未完成'})`).join('\n')
      const prompt = `你是计划执行顾问。用户有一个进行中的计划，请推荐下一步该做什么。

计划标题：${form.value.title}
描述：${form.value.description || '无'}
子任务状态：
${subtasks || '无'}

请给出：
1. 下一步最应该做的 1-2 件事
2. 为什么推荐这个顺序
3. 可能的风险和注意事项

简短直接，3-5 句话。`

      const result = await chatRequest(prompt, null, '', store.aiConfig.apiKey)
      aiNextStepResult.value = result.reply || 'AI 建议失败'
    } catch (e) {
      uni.showToast({ title: 'AI 建议失败', icon: 'none' })
    } finally {
      aiNextStep.value = false
    }
  }

  return {
    aiScheduling, aiReview, aiNextStep,
    aiScheduleResult, aiReviewResult, aiNextStepResult,
    generateSchedule, generateReview, generateNextStep
  }
}
