/**
 * 阶段化计划 composable
 * - AI 深度拆解：大目标 → 多阶段 → 每阶段子任务 + 里程碑
 * - 阶段 CRUD
 * - 进度按阶段聚合
 */
import { ref, computed } from 'vue'
import { chatRequest } from '@/utils/api.js'

export function usePlanPhases(form, store) {
  const phaseAILoading = ref(false)

  const phaseProgress = computed(() => {
    const phases = form.value.phases || []
    if (phases.length === 0) return { total: 0, done: 0, pct: 0, phases: [] }
    let totalSubs = 0, doneSubs = 0
    const phaseStats = phases.map(ph => {
      const subs = ph.subtasks || []
      const done = subs.filter(s => s.done).length
      totalSubs += subs.length
      doneSubs += done
      return {
        id: ph.id,
        title: ph.title,
        total: subs.length,
        done,
        pct: subs.length > 0 ? Math.round(done / subs.length * 100) : 0,
        milestoneCount: (ph.milestones || []).length
      }
    })
    return {
      total: totalSubs,
      done: doneSubs,
      pct: totalSubs > 0 ? Math.round(doneSubs / totalSubs * 100) : 0,
      phases: phaseStats
    }
  })

  function addPhase() {
    const phases = form.value.phases || (form.value.phases = [])
    phases.push({
      id: phases.length + 1,
      title: '',
      description: '',
      start_date: '',
      end_date: '',
      milestones: [],
      subtasks: [{ title: '', done: false }],
      _collapsed: false
    })
  }

  function removePhase(idx) {
    form.value.phases.splice(idx, 1)
    form.value.phases.forEach((p, i) => { p.id = i + 1 })
  }

  function addPhaseSubtask(phaseIdx) {
    const phase = form.value.phases[phaseIdx]
    if (!phase) return
    phase.subtasks.push({ title: '', done: false })
  }

  function removePhaseSubtask(phaseIdx, subIdx) {
    const phase = form.value.phases[phaseIdx]
    if (!phase) return
    phase.subtasks.splice(subIdx, 1)
  }

  function addMilestone(phaseIdx) {
    const phase = form.value.phases[phaseIdx]
    if (!phase) return
    if (!phase.milestones) phase.milestones = []
    phase.milestones.push('')
  }

  function removeMilestone(phaseIdx, msIdx) {
    const phase = form.value.phases[phaseIdx]
    if (!phase) return
    phase.milestones.splice(msIdx, 1)
  }

  function togglePhaseCollapse(phaseIdx) {
    const phase = form.value.phases[phaseIdx]
    if (!phase) return
    phase._collapsed = !phase._collapsed
  }

  /**
   * AI 深度拆解 — 将大目标拆为多阶段计划
   */
  async function aiPhaseBreakdown(targetDate) {
    if (!form.value.title.trim()) {
      uni.showToast({ title: '请先填写计划标题', icon: 'none' })
      return
    }
    phaseAILoading.value = true
    try {
      const deadline = targetDate || form.value.due_date || '未指定'
      const today = new Date()
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      const prompt = `你是专业项目规划师。请将以下目标拆解为多个阶段的执行计划。

目标：${form.value.title}
描述：${form.value.description || '无'}
截止日期：${deadline}
当前日期：${todayStr}

要求：
1. 拆成 2-6 个阶段，每阶段 1-4 周
2. 每阶段包含：标题、简短描述、开始日期(YYYY-MM-DD)、结束日期(YYYY-MM-DD)
3. 每阶段 2-5 个具体子任务
4. 每阶段 1-2 个里程碑（标志性成果）
5. 阶段之间有递进关系
6. 所有日期不能晚于截止日期

只返回 JSON 数组，不要其他内容：
[
  {
    "title": "第一阶段标题",
    "description": "阶段目标描述",
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD",
    "milestones": ["里程碑1", "里程碑2"],
    "subtasks": [
      { "title": "子任务1", "done": false },
      { "title": "子任务2", "done": false }
    ]
  }
]`

      const result = await chatRequest(prompt, null, '', store.aiConfig)
      const raw = result.reply || result || ''
      let phases = []

      // 尝试提取 JSON 数组
      try {
        const m = raw.match(/\[[\s\S]*\]/)
        if (m) {
          phases = JSON.parse(m[0])
        } else {
          const objMatch = raw.match(/\{[\s\S]*\}/)
          if (objMatch) {
            phases = [JSON.parse(objMatch[0])]
          }
        }
      } catch (e) {
        // 逐行兜底解析
        const lines = raw.split('\n').filter(l => l.trim())
        let currentPhase = null
        phases = []
        for (const line of lines) {
          if (/阶段|第.*阶段/.test(line) && !line.includes('子任务')) {
            if (currentPhase) phases.push(currentPhase)
            currentPhase = {
              title: line.replace(/[阶段：:第\d一二三四五六七八九十]/g, '').trim() || line.trim(),
              description: '', start_date: '', end_date: '',
              milestones: [], subtasks: []
            }
          } else if (currentPhase && /^\d+[.、\-)]/.test(line.trim())) {
            currentPhase.subtasks.push({
              title: line.replace(/^\d+[.、\-)]\s*/, '').trim(),
              done: false
            })
          }
        }
        if (currentPhase) phases.push(currentPhase)
      }

      if (phases.length > 0) {
        // 标准化 + 编号
        form.value.phases = phases.map((ph, i) => ({
          id: i + 1,
          title: ph.title || `第${i + 1}阶段`,
          description: ph.description || '',
          start_date: ph.start_date || '',
          end_date: ph.end_date || '',
          milestones: Array.isArray(ph.milestones) ? ph.milestones.filter(m => m && typeof m === 'string') : [],
          subtasks: Array.isArray(ph.subtasks) ? ph.subtasks.map((s, j) => ({
            id: j + 1,
            title: typeof s === 'string' ? s : (s.title || ''),
            done: false
          })) : [],
          _collapsed: false
        }))
        uni.showToast({ title: `已拆解 ${phases.length} 个阶段`, icon: 'success' })
      } else {
        uni.showToast({ title: 'AI 拆解失败，请重试', icon: 'none' })
      }
    } catch (e) {
      console.warn('AI phase breakdown failed:', e)
      uni.showToast({ title: 'AI 拆解失败', icon: 'none' })
    } finally {
      phaseAILoading.value = false
    }
  }

  return {
    phaseAILoading, phaseProgress,
    addPhase, removePhase,
    addPhaseSubtask, removePhaseSubtask,
    addMilestone, removeMilestone,
    togglePhaseCollapse, aiPhaseBreakdown
  }
}
