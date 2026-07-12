import { createDecision, updateDecision, getDecisionById, getAllDecisions, getDecisionsByStatus, getDecisionsByCategory, reviewDecision, analyzeDecisionPatterns } from '@/utils/decisions.js'
import { invalidatePromptCache } from '@/utils/ai/prompt-builder.js'

/**
 * Decision 相关 executor 工厂函数
 * @param {{ undoStack, cidCache, generateEntityId }} ctx 上下文
 */
export function createDecisionExecutors(ctx) {
  // ==================== 决策日志操作 ====================

  function execCreateDecision(p) {
    const decision = createDecision(p)
    invalidatePromptCache()
    return {
      success: true,
      message: `已创建决策记录「${decision.title}」`,
      detail: {
        type: 'decision', id: decision.id,
        title: decision.title, category: decision.category,
        status: decision.status, deadline: decision.deadline,
        optionCount: decision.options.length,
        options: decision.options,
        stakeholders: decision.stakeholders,
        factors: decision.factors
      }
    }
  }

  function execUpdateDecision(p) {
    if (!p.id && !p.decision_id) return { success: false, message: '缺少决策ID', detail: null }
    const id = p.id || p.decision_id
    const updates = {}
    const allowed = ['title', 'category', 'status', 'deadline', 'options', 'stakeholders', 'factors', 'decision', 'reasoning', 'emotion']
    for (const key of allowed) {
      if (p[key] != null) updates[key] = p[key]
    }
    if (Object.keys(updates).length === 0) return { success: false, message: '无更新字段', detail: null }
    const ok = updateDecision(id, updates)
    if (!ok) return { success: false, message: '决策记录不存在', detail: null }
    const updated = getDecisionById(id)
    invalidatePromptCache()
    return {
      success: true,
      message: `已更新决策「${updated.title}」`,
      detail: { type: 'decision', id, updated_fields: Object.keys(updates), status: updated.status }
    }
  }

  function execReviewDecision(p) {
    if (!p.id && !p.decision_id) return { success: false, message: '缺少决策ID', detail: null }
    const id = p.id || p.decision_id
    const ok = reviewDecision(id, p.review_notes || '', p.outcome)
    if (!ok) return { success: false, message: '决策记录不存在', detail: null }
    invalidatePromptCache()
    return {
      success: true,
      message: '复盘已保存',
      detail: { type: 'decision', id, reviewed: true, review_notes: p.review_notes }
    }
  }

  function execQueryDecision(p) {
    let list
    if (p.status) list = getDecisionsByStatus(p.status)
    else if (p.category) list = getDecisionsByCategory(p.category)
    else list = getAllDecisions()
    if (list.length === 0) {
      return { success: true, message: '暂无决策记录', detail: { type: 'query_decision', count: 0, items: [] } }
    }
    const summary = list.slice(0, 5).map(d => `${d.title}(${d.status})`).join('；')
    return {
      success: true,
      message: `共 ${list.length} 条决策记录：${summary}`,
      detail: { type: 'query_decision', count: list.length, items: list.slice(0, 5) }
    }
  }

  function execAnalyzeDecisions(p) {
    const result = analyzeDecisionPatterns()
    if (!result.sufficient) {
      return { success: true, message: result.message, detail: { type: 'analyze_decisions', sufficient: false } }
    }
    const insightText = result.insights.length > 0 ? '\n' + result.insights.join('\n') : ''
    return {
      success: true,
      message: `决策模式分析：共 ${result.total} 条决策，已复盘 ${result.reviewed} 条，平均决策时长 ${result.avgDecisionDays} 天，待复盘 ${result.pendingReview} 条。${insightText}`,
      detail: { type: 'analyze_decisions', ...result }
    }
  }

  return { execCreateDecision, execUpdateDecision, execReviewDecision, execQueryDecision, execAnalyzeDecisions }
}
