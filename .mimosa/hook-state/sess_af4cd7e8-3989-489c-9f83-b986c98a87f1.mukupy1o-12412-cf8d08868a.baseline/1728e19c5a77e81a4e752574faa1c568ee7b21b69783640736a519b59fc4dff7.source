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
import { CONVERSATION_TOOLS } from './chat.js'
import { GLIMMER_TOOLS } from './glimmer.js'
import { WEB_SEARCH_TOOL } from './web-search.js'
import { READ_URL_TOOL } from './read-url.js'
import { AGENT_TOOLS } from './agent.js'

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
  ...CONVERSATION_TOOLS,
  ...GLIMMER_TOOLS,
  ...AGENT_TOOLS,
  WEB_SEARCH_TOOL, // D2 联网搜索（agent-loop 按搜索后端门控执行）
  READ_URL_TOOL,   // 3.6.0 读网址（agent-loop 独立网络分支执行）
]


/** 需确认工具 — agent 不自动执行，改为提示用户确认
 * 3.5.11：delete_feedback 是注册给 Agent 的唯一删除类工具，必须永远确认（不受「AI 自动执行写操作」开关影响）。
 * 若后续再加入 delete_* 工具，必须登记到此集合。
 * 其余写入类工具的确认在 executeTool 内按 payload 动态判断（如金额>=500），不在此静态集合。 */
export const CONFIRM_TOOLS = new Set(['delete_feedback'])

/** 查询类工具（只读，安全自动执行） */
export const QUERY_TOOLS = new Set([
  'query_diary', 'query_bill', 'query_stat', 'query_plan', 'query_relation',
  'query_decision', 'query_combined', 'get_profile', 'summarize_diaries',
  'query_feedback', 'query_feedback_stats', 'query_tags',
  'query_conversations',  // 3.2 M3 旧话检索（只读）
  'query_glimmers',        // 3.4 M2 微光本（只读）
  'web_search', // D2 联网搜索（只读，agent-loop 独立执行）
  'read_url'    // 3.6.0 读网址（只读，agent-loop 独立执行）
])

/** 工具中文标签（确认卡/进度提示共用，避免暴露英文工具名） */
export const TOOL_LABELS = {
  create_diary: '写记录',
  update_diary: '修改记录',
  create_bill: '记账',
  update_bill: '修改账单',
  create_plan: '创建计划',
  update_plan: '修改计划',
  create_plan_phases: '创建分阶段计划',
  update_plan_phase: '更新计划阶段',
  update_plan_subtask: '更新计划子项',
  log_plan_checkin:     '计划打卡',
  create_plan_template: '保存计划模板',
  smart_update_profile: '更新个人信息',
  update_profile: '更新个人信息',
  create_relation: '创建人物档案',
  update_relation: '修改人物档案',
  log_interaction: '记录互动',
  create_decision: '创建决策',
  update_decision: '更新决策',
  review_decision: '复盘决策',
  create_feedback: '提交反馈',
  update_feedback: '修改反馈',
  add_tag: '添加标签',
  update_tag_category: '修改标签分类',
  remove_tag: '删除标签',
  read_url: '读网页',
  query_conversations: '检索会话',
  extract_todos: '提取待办',
  create_agent: '创建 Agent',
  create_glimmer: '收微光',
  query_glimmers: '查看微光本',
  undo_last: '撤销上一步'
}

/** 是否开启了「AI 自动执行写操作」（设置页开关 siji_auto_write；默认关 = 写前需确认） */
function isAutoWriteEnabled() {
  try {
    if (typeof uni === 'undefined') return true  // 非 uni 环境（单测）保持旧行为
    return uni.getStorageSync('siji_auto_write') === '1'
  } catch (e) {
    return true
  }
}

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
  // 3.0 M3：AI 写操作默认需用户确认（草稿确认卡），开关开启后跳过一次确认
  if (isAutoWriteEnabled()) return false
  if (QUERY_TOOLS.has(name) || name === 'web_search') return false
  if (name === 'undo_last') return false  // 撤销是纠错动作，不二次确认
  return true  // 其余均视为 AI 写操作 → 默认需确认
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
