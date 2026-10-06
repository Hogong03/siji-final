/**
 * 计划 AI 增强 composable
 * - AI 智能排期：根据子计划+优先级+截止日期推荐每日执行计划
 * - AI 进度复盘：已完成计划生成复盘报告（3.4 M4 去评价化 / 3.4.3 接入打卡与执行数据）
 * - AI 下一步建议：进行中计划推荐下一步行动（3.4.3 基于执行记录温和衔接）
 */
import { ref } from 'vue'
import { chatRequest } from '@/utils/api.js'
import { getPlanList, getChildPlans, getPlanCheckInStats } from '@/utils/storage.js'

export function usePlanAI(form, store, opts = {}) {
  const aiScheduling = ref(false)
  const aiReview = ref(false)
  const aiNextStep = ref(false)
  const aiScheduleResult = ref('')
  const aiReviewResult = ref('')
  const aiNextStepResult = ref('')
  // 4.15：错误态（非空即失败，进统一错误卡）+ 生成时间戳 + 结果落库
  const aiScheduleError = ref('')
  const aiReviewError = ref('')
  const aiNextStepError = ref('')
  const aiScheduleAt = ref(0)
  const aiReviewAt = ref(0)
  const aiNextStepAt = ref(0)

  /** 统一错误文案（供 AiResultCard 失败态展示） */
  function errText(e, fallback) {
    const msg = (e && e.message) || ''
    if (/API Key|未配置|apikey/i.test(msg)) return '未配置 API Key，请到 设置 → AI 配置 填写后重试'
    if (/rate|频繁|429/i.test(msg)) return '调用太频繁，稍等片刻再试'
    if (/network|timeout|超时|abort/i.test(msg)) return '网络超时，请重试'
    if (/key|无效|invalid|401/i.test(msg)) return 'API Key 无效或已过期，请到 设置 → AI 配置 检查'
    return fallback
  }

  /** 结果写回表单并立即落库（重跑覆盖；不带 persist 时由保存计划兜底） */
  function commitResult(field, atField, value) {
    form.value[field] = value
    form.value[atField] = Date.now()
    if (typeof opts.persist === 'function') opts.persist()
  }

  /** 初始化：把已存结果回填到页面状态（进详情时调用一次） */
  function hydrateFromForm() {
    aiScheduleResult.value = form.value.ai_schedule || ''
    aiReviewResult.value = form.value.ai_review || ''
    aiNextStepResult.value = form.value.ai_next_step || ''
    aiScheduleAt.value = form.value.ai_schedule_at || 0
    aiReviewAt.value = form.value.ai_review_at || 0
    aiNextStepAt.value = form.value.ai_next_step_at || 0
  }

  /** 子计划清单文本（新模型：子任务/阶段统一为子计划） */
  function childrenLines() {
    const kids = (opts.getChildren && opts.getChildren()) || []
    if (kids.length === 0) return ''
    return kids.map((c, i) => {
      if (!c || !c.title) return null
      const state = c.status === 2 ? '已完成' : (c.someday_at ? '任意时间（今天不做，不催）' : '未完成')
      const mins = c.est_minutes > 0 ? '，约 ' + c.est_minutes + ' 分钟' : ''
      const desc = c.description ? '；' + c.description : ''
      return (i + 1) + '. ' + c.title + mins + ' — ' + state + desc
    }).filter(Boolean).join('\n')
  }

  /** 执行摘要：本计划与直接子计划的打卡/完成/任意时间/冷藏（只陈述事实） */
  function execSummary() {
    const pid = (opts.getPlanId && opts.getPlanId()) || ''
    if (!pid) return ''
    const rec = getPlanList().find(p => p.client_id === pid)
    if (!rec) return ''
    const kids = getChildPlans(pid)
    const nodes = [rec].concat(kids)
    let count = 0
    let days = 0
    let lastDate = ''
    nodes.forEach(p => {
      if (!p) return
      const stats = getPlanCheckInStats(p)
      days += stats.days
      count += Array.isArray(p.checkins) ? p.checkins.length : 0
      if (stats.lastDate > lastDate) lastDate = stats.lastDate
    })
    const doneKids = kids.filter(k => k.status === 2).length
    const somKids = kids.filter(k => k.someday_at).length
    const frozenKids = kids.filter(k => k.frozen_at).length
    const bits = ['计划内共打卡 ' + count + ' 次（' + days + ' 天）']
    if (lastDate) bits.push('最近一次 ' + lastDate)
    if (kids.length > 0) bits.push('子计划完成 ' + doneKids + '/' + kids.length)
    if (somKids > 0) bits.push(somKids + ' 个放在任意时间（不催）')
    if (frozenKids > 0) bits.push(frozenKids + ' 个先放一放（不催）')
    return bits.join('；')
  }

  async function generateSchedule() {
    if (!store.hasApiKey) {
      aiScheduleError.value = '未配置 API Key，请到 设置 → AI 配置 填写后重试'
      return
    }
    if (!form.value.due_date) {
      uni.showToast({ title: '请先设置截止日期', icon: 'none' })
      return
    }
    aiScheduling.value = true
    aiScheduleError.value = ''
    try {
      const prompt = '你是计划排期助手。请根据以下计划信息，生成一个合理的执行排期建议。\n\n' +
        '计划标题：' + form.value.title + '\n' +
        '优先级：' + (['普通', '重要', '紧急'][form.value.priority] || '普通') + '\n' +
        '截止时间：' + form.value.due_date + '\n' +
        '执行记录：' + (execSummary() || '暂无') + '\n' +
        '子计划：\n' + (childrenLines() || '无') + '\n\n' +
        '请给出：\n' +
        '1. 把未完成的子计划按「约时最短优先」排进剩余天数（未写时长视为 15 分钟）\n' +
        '2. 每天最多 1-2 件，空一天也没关系，不排满\n' +
        '3. 简短用列表输出，不催促不评价'
      const result = await chatRequest(prompt, null, '', store.aiConfig.apiKey)
      const reply = result.reply || ''
      aiScheduleResult.value = reply
      commitResult('ai_schedule', 'ai_schedule_at', reply)
    } catch (e) {
      console.error('[AI排期] 失败:', e)
      aiScheduleError.value = errText(e, '排期生成失败，请重试')
    } finally {
      aiScheduling.value = false
    }
  }

  async function generateReview() {
    if (!store.hasApiKey) {
      aiReviewError.value = '未配置 API Key，请到 设置 → AI 配置 填写后重试'
      return
    }
    aiReview.value = true
    aiReviewError.value = ''
    try {
      const prompt = '你是计划复盘助手。请对以下已完成的计划进行复盘分析。\n\n' +
        '计划标题：' + form.value.title + '\n' +
        '描述：' + (form.value.description || '无') + '\n' +
        '优先级：' + (['普通', '重要', '紧急'][form.value.priority] || '普通') + '\n' +
        '执行记录：' + (execSummary() || '暂无') + '\n' +
        '子计划完成情况：\n' + (childrenLines() || '无') + '\n\n' +
        '请给出：\n' +
        '1. 先数一数实际完成了多少件小事（参考子计划完成情况，没有完成就不数，不编造）\n' +
        '2. 不带评价地描述过程：做了什么、在哪里自然停了下来（可参考打卡记录里的描述，只陈述事实，不下好/差结论）\n' +
        '3. 一句轻轻的收尾，用「已经很好了」结束\n\n' +
        '语气温和，不点评、不催促、不写改进建议。'
      const result = await chatRequest(prompt, null, '', store.aiConfig.apiKey)
      const reply = result.reply || ''
      aiReviewResult.value = reply
      commitResult('ai_review', 'ai_review_at', reply)
    } catch (e) {
      console.error('[AI复盘] 失败:', e)
      aiReviewError.value = errText(e, '复盘生成失败，请重试')
    } finally {
      aiReview.value = false
    }
  }

  async function generateNextStep() {
    if (!store.hasApiKey) {
      aiNextStepError.value = '未配置 API Key，请到 设置 → AI 配置 填写后重试'
      return
    }
    aiNextStep.value = true
    aiNextStepError.value = ''
    try {
      const prompt = '你是计划执行顾问。用户有一个进行中的计划，请推荐下一步该做什么。\n\n' +
        '计划标题：' + form.value.title + '\n' +
        '描述：' + (form.value.description || '无') + '\n' +
        '执行记录：' + (execSummary() || '暂无') + '\n' +
        '子计划状态：\n' + (childrenLines() || '无') + '\n\n' +
        '请给出：\n' +
        '1. 下一步最应该做的 1-2 件事（优先未完成且不在任意时间里的最短一件；放在任意时间里的不要催）\n' +
        '2. 为什么推荐这个顺序\n' +
        '3. 如果最近一次打卡有描述，可以自然衔接「上次做了X」；若用户流露疲惫，允许「今天不做也行」\n\n' +
        '简短直接，3-5 句话，不催促不评判。'
      const result = await chatRequest(prompt, null, '', store.aiConfig.apiKey)
      const reply = result.reply || ''
      aiNextStepResult.value = reply
      commitResult('ai_next_step', 'ai_next_step_at', reply)
    } catch (e) {
      console.error('[AI建议] 失败:', e)
      aiNextStepError.value = errText(e, '建议生成失败，请重试')
    } finally {
      aiNextStep.value = false
    }
  }

  return {
    aiScheduling, aiReview, aiNextStep,
    aiScheduleResult, aiReviewResult, aiNextStepResult,
    aiScheduleError, aiReviewError, aiNextStepError,
    aiScheduleAt, aiReviewAt, aiNextStepAt,
    hydrateFromForm,
    generateSchedule, generateReview, generateNextStep
  }
}
