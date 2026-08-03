/**
 * 计划详情 — 子任务管理 composable
 *
 * 包含：子任务增删改、AI 拆解
 */
import { ref, computed } from 'vue'
import { chatRequest } from '@/utils/api.js'

export function usePlanSubtasks(form, store) {
  const aiLoading = ref(false)

  const subtaskProgress = computed(() => {
    const subs = form.value.subtasks
    if (!subs || subs.length === 0) return { total: 0, done: 0, pct: 0 }
    const done = subs.filter(s => s.done).length
    return { total: subs.length, done, pct: Math.round(done / subs.length * 100) }
  })

  function toggleSubtask(idx) {
    if (form.value.subtasks[idx]) {
      form.value.subtasks[idx].done = !form.value.subtasks[idx].done
    }
  }

  function addSubtask() {
    form.value.subtasks.push({ title: '', done: false })
  }

  function removeSubtask(idx) {
    form.value.subtasks.splice(idx, 1)
  }

  async function aiBreakdown() {
    if (!form.value.title.trim()) {
      uni.showToast({ title: '请先填写计划标题', icon: 'none' })
      return
    }
    aiLoading.value = true
    try {
      const prompt = `你是计划拆解助手。请将以下计划拆解为3-8个具体的可执行子任务。
只返回 JSON 数组，每个元素包含 title（字符串）和 done（布尔值，默认false）。
计划标题：${form.value.title}
计划描述：${form.value.description || '无'}`
      const result = await chatRequest(prompt, null, '', store.aiConfig)
      const raw = result.reply || ''
      let subtasks = []
      // 尝试提取 JSON 数组
      const m = raw.match(/\[[\s\S]*\]/)
      if (m) {
        subtasks = JSON.parse(m[0])
      } else {
        // 逐行解析
        const lines = raw.split('\n').filter(l => /^\d+[.、\-)]/.test(l.trim()))
        subtasks = lines.map(l => ({
          title: l.replace(/^\d+[.、\-)]\s*/, '').trim(),
          done: false
        }))
      }
      if (subtasks.length > 0) {
        form.value.subtasks = subtasks
        uni.showToast({ title: `已拆解 ${subtasks.length} 个子任务`, icon: 'success' })
      } else {
        uni.showToast({ title: 'AI 拆解失败，请手动添加', icon: 'none' })
      }
    } catch (e) {
      console.warn('AI breakdown failed:', e)
      uni.showToast({ title: 'AI 拆解失败', icon: 'none' })
    } finally {
      aiLoading.value = false
    }
  }

  return { aiLoading, subtaskProgress, toggleSubtask, addSubtask, removeSubtask, aiBreakdown }
}
