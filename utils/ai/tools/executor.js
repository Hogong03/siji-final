/**
 * tools/executor.js - tool executor (split from tools.js)
 * executeTool dispatch + query result formatting
 */
import { logger } from '../../logger.js'
import { addCustomTag, getTagsByCategory, removeCustomTag, updateTagCategory } from '../../storage/tags.js'
import { needsConfirmation } from './index.js'

/**
 * 执行一个工具调用
 * @param {Object} store - useDataStore（pinia）
 * @param {string} name - 工具名
 * @param {Object} args - 工具参数
 * @returns {{ ok:boolean, text:string, detail:any, confirm?:boolean }} 格式化的自然语言结果
 */
export function executeTool(store, name, args = {}) {
  try {
    // 标签管理工具 — 直接调用 tags.js，不走 store.executeAction
    if (name === 'query_tags') {
      const type = args.type || 'diary'
      const grouped = getTagsByCategory(type)
      const lines = []
      for (const [catId, group] of Object.entries(grouped)) {
        if (group.tags.length === 0) continue
        lines.push(`${group.name}（${group.tags.length}）: ${group.tags.map(t => t.name).join('、')}`)
      }
      return {
        ok: true,
        text: lines.length ? `标签列表（${type}）：\n${lines.join('\n')}` : `暂无${type}标签`,
        detail: { type: 'query_tags', grouped }
      }
    }
    if (name === 'add_tag') {
      const type = args.type || 'diary'
      const result = addCustomTag(type, args.name, null, null, args.categoryId || 'other')
      return {
        ok: true,
        text: `标签「${args.name}」已添加`,
        detail: { type: 'add_tag', name: args.name, categoryId: args.categoryId }
      }
    }
    if (name === 'update_tag_category') {
      const type = args.type || 'diary'
      const ok = updateTagCategory(type, args.name, args.categoryId)
      return {
        ok: ok,
        text: ok ? `标签「${args.name}」已修改种类` : `标签「${args.name}」不存在`,
        detail: { type: 'update_tag_category', name: args.name, categoryId: args.categoryId }
      }
    }
    if (name === 'remove_tag') {
      const type = args.type || 'diary'
      removeCustomTag(type, args.name)
      return {
        ok: true,
        text: `标签「${args.name}」已从注册表删除`,
        detail: { type: 'remove_tag', name: args.name }
      }
    }

    // 确认检查：金额>=500 或破坏性操作需用户确认
    if (needsConfirmation(name, args)) {
      const reason = name === 'create_bill' || name === 'update_bill'
        ? `金额 ¥${args.amount} 较大，需要你确认后再执行`
        : `操作 ${name} 需要用户确认`
      return {
        ok: false,
        confirm: true,
        text: reason + '。请向用户说明并等待确认，不要直接执行。',
        detail: { type: name, payload: args, confirmReason: reason }
      }
    }

    const action = { type: name, payload: args || {} }
    const result = store.executeAction(action)

    if (result && result.success) {
      return {
        ok: true,
        text: formatToolResult(name, result.detail),
        detail: result.detail,
        message: result.message
      }
    }
    return {
      ok: false,
      text: formatToolFailure(name, result?.message),
      detail: null,
      message: result?.message
    }
  } catch (e) {
    logger.error('[Tool] execute failed:', name, e.message)
    return { ok: false, text: `工具 ${name} 执行出错：${e.message}`, detail: null }
  }
}

// ==================== 结果格式化 ====================

/**
 * 把查询类工具的 detail 结构化为自然语言文本（供 AI 引用真实数据）
 */
function formatToolResult(name, detail) {
  if (!detail) return '（无返回数据）'
  switch (name) {
    case 'query_bill':
      return formatBills(detail)
    case 'query_stat':
      return formatBillStats(detail)
    case 'query_diary':
      return formatDiaries(detail)
    case 'query_combined':
      return formatCombined(detail)
    case 'query_plan':
      return formatPlans(detail)
    case 'summarize_diaries':
      return formatDiaries(detail)
    case 'get_profile':
      return JSON.stringify(detail)
    case 'query_relation':
      return JSON.stringify(detail)
    case 'query_decision':
      return JSON.stringify(detail)
    case 'query_feedback':
    case 'query_feedback_stats':
    case 'query_tags':
      return JSON.stringify(detail)
    default:
      return JSON.stringify(detail)
  }
}

function formatBills(d) {
  const items = Array.isArray(d.items) ? d.items : []
  if (items.length === 0) return `在 ${d.month || ''} 没有找到相关账单。`
  const lines = items.map(b =>
    `${b.type === 'expense' ? '支出' : '收入'}¥${b.amount} ${b.category || '未分类'}${b.note ? '（' + b.note + '）' : ''} ${b.bill_date || ''}`
  )
  const total = items.reduce((s, b) => s + (b.amount || 0), 0)
  return `${d.month || ''}共 ${d.count ?? items.length} 笔账单，合计¥${total}：\n` + lines.join('\n')
}

function formatBillStats(d) {
  if (!d) return JSON.stringify(d)
  const parts = []
  if (d.totalExpense != null) parts.push(`总支出¥${d.totalExpense}`)
  if (d.totalIncome != null) parts.push(`总收入¥${d.totalIncome}`)
  if (d.billCount != null) parts.push(`共${d.billCount}笔`)
  if (d.topCategory && d.topCategory !== '无') {
    parts.push(`主要分类：${d.topCategory}¥${d.topCategoryAmount ?? 0}`)
  }
  return `${d.month || ''}${parts.length ? '：' + parts.join('，') : ''}`
}

function formatDiaries(d) {
  const items = Array.isArray(d.items) ? d.items : []
  if (items.length === 0) return `在 ${d.month || ''} 没有找到相关记录。`
  const lines = items.map(x => {
    const content = (x.content || '').replace(/\s+/g, ' ').substring(0, 60)
    const tags = Array.isArray(x.tags) && x.tags.length ? ` #${x.tags.join('#')}` : ''
    return `- ${x.title || '无标题'}${tags}：${content}`
  })
  return `${d.month || ''}共 ${d.count ?? items.length} 篇记录：\n` + lines.join('\n')
}

function formatCombined(d) {
  const items = Array.isArray(d.items) ? d.items : []
  if (items.length === 0) return '没有找到相关结果。'
  const lines = items.map(x => {
    if (x.type === 'bill') return `账单：${x.amount ? '¥' + x.amount : ''} ${x.category || ''} ${x.note || ''} ${x.date || ''}`
    return `记录：${x.title || ''} ${x.content || ''} ${x.date || ''}`
  })
  return `找到 ${d.count ?? items.length} 条结果：\n` + lines.join('\n')
}

function formatPlans(d) {
  const items = Array.isArray(d.items) ? d.items : []
  if (items.length === 0) return '当前没有匹配的计划。'
  const lines = items.map(p => {
    const status = { 0: '待开始', 1: '进行中', 2: '已完成' }[p.status] || ''
    const phaseCount = Array.isArray(p.phases) && p.phases.length ? `（${p.phases.length}个阶段）` : ''
    const subCount = Array.isArray(p.subtasks) ? `，${p.subtasks.length}个子任务` : ''
    return `- ${p.title || ''}${phaseCount} [${status}]${subCount}${p.deadline ? ' 截止' + p.deadline : ''}`
  })
  return `共 ${d.count ?? items.length} 个计划：\n` + lines.join('\n')
}

function formatToolFailure(name, msg) {
  return `工具 ${name} 执行失败：${msg || '未知错误'}`
}
