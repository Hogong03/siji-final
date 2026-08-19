/**
 * tools/index.js - tool registry assembly (split from tools.js)
 * TOOL_DEFINITIONS order = original tools.js order
 */
import { DIARY_TOOLS } from './diary.js'
import { BILL_TOOLS } from './bill.js'
import { PLAN_TOOLS } from './plan.js'
import { PROFILE_TOOLS } from './profile.js'
import { RELATION_TOOLS } from './relation.js'
import { DECISION_TOOLS } from './decision.js'
import { GENERAL_TOOLS } from './general.js'
import { FEEDBACK_TOOLS } from './feedback.js'
import { TAGS_TOOLS } from './tags.js'

export const TOOL_DEFINITIONS = [
  ...DIARY_TOOLS,
  ...BILL_TOOLS,
  ...PLAN_TOOLS,
  ...PROFILE_TOOLS,
  ...RELATION_TOOLS,
  ...DECISION_TOOLS,
  ...GENERAL_TOOLS,
  ...FEEDBACK_TOOLS,
  ...TAGS_TOOLS,
]


/** 需确认工具 — agent 不自动执行，改为提示用户确认
 * 当前 TOOL_DEFINITIONS 未定义 delete_* 等破坏性工具（Agent 不做删除），故此集合为空。
 * 若未来在 TOOL_DEFINITIONS 中加入 delete_* 工具，需在此添加对应名称。
 * 注意：写入类工具的确认在 executeTool 内按 payload 动态判断（如金额>=500），不在此静态集合。 */
export const CONFIRM_TOOLS = new Set()

/** 查询类工具（只读，安全自动执行） */
export const QUERY_TOOLS = new Set([
  'query_diary', 'query_bill', 'query_stat', 'query_plan', 'query_relation',
  'query_decision', 'query_combined', 'get_profile', 'summarize_diaries',
  'query_feedback', 'query_feedback_stats', 'query_tags'
])

/** 写入类工具的确认阈值（payload 内字段值超过此阈值需确认） */
const CONFIRM_THRESHOLDS = {
  create_bill: { field: 'amount', min: 500 },
  update_bill: { field: 'amount', min: 500 }
}

/** 检查工具调用是否需要用户确认（按 payload 动态判断） */
export function needsConfirmation(name, args) {
  // 静态确认集
  if (CONFIRM_TOOLS.has(name)) return true
  // 动态阈值检查（如 create_bill 金额>=500）
  const rule = CONFIRM_THRESHOLDS[name]
  if (rule && args) {
    const val = args[rule.field]
    if (typeof val === 'number' && val >= rule.min) return true
  }
  return false
}

/** 生成 tools 的简洁文本说明，注入 system prompt 供不支持原生 function-calling 的降级场景使用 */
export function buildToolsInstruction() {
  return TOOL_DEFINITIONS.map(t => {
    const params = Object.entries(t.parameters.properties || {})
      .map(([k, v]) => {
        const required = (t.parameters.required || []).includes(k) ? '*' : '?'
        return `${k}${required}`
      })
      .join(', ')
    return `- ${t.name}(${params}) — ${t.description}`
  }).join('\n')
}
