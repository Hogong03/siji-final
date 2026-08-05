/**
 * prompt-actions.js — Action schema + 闲聊模式判定
 * 从 prompt-builder.js 拆分，降低单文件体积
 */

/**
 * 核心 action schema（始终注入，已压缩字段注释）
 * 注意：此 schema 与 tools.js 的 TOOL_DEFINITIONS 描述同一能力，
 * 但格式不同（此处为紧凑文本供路径 A JSON action，tools.js 为 OpenAI function schema 供路径 B）。
 * 新增 action 时两处都要改。
 */
export const CORE_ACTIONS = `记录:
- create_diary: {content,tags?}  // 自由文本，首行自动作为标题。tags 尽量从用户历史标签中选
- update_diary: {client_id,content?,tags?}
- delete_diary: {client_id} needConfirm=true
- query_diary: {keyword?,month?}
- summarize_diaries: {period:"week"|"month"}  // 生成周报/月报总结
- extract_todos: {content}  // 从记录中提取待办事项

记账:
- create_bill: {type:"expense"|"income",amount,category,note?,bill_date?}
- update_bill: {client_id,amount?,category?,note?,bill_date?,type?}
- delete_bill: {client_id} needConfirm=true
- query_bill: {month?,category?}
- query_stat: {month?}

计划:
- create_plan: {title,description,priority:0-2,subtasks:[],tags:[],deadline?,estimated_time?,parent_id?}
- create_plan_phases: {title,description?,deadline,phase_count?:2-6}  // AI自动拆解多阶段计划，每阶段含子任务+里程碑+时间窗口
- update_plan: {client_id,title?,description?,priority?,status?,deadline?,estimated_time?,subtasks?,parent_id?}
- update_plan_phase: {client_id,phase_id,title?,subtasks?,milestones?,start_date?,end_date?}
- update_plan_subtask: {client_id,subtask_id,done}
- delete_plan: {client_id} needConfirm=true
- query_plan: {status:"active"|"completed"|"all"}

个人信息:
- smart_update_profile: {updates:[],remove:[],createCard:[]}
- update_profile: {nickname?,gender?,birthday?,occupation?,location?,bio?,budget?,sleepTime?,hobbies:[],dietary:[]}
- get_profile: {}
- clear_profile: {card?,field?} needConfirm=true
- toggle_profile: {enabled:bool}

联动:
- query_combined: {keyword?,date_range?,types:["diary","bill"]}  // 跨类型查询记录和账单

通用:- undo_last: {}`

/** 精简版 action schema（闲聊模式，只保留高频操作） */
export const LITE_ACTIONS = `记账:
- create_bill: {type:"expense"|"income",amount,category,note?,bill_date?}
- query_bill: {month?,category?}

记录:
- create_diary: {content,tags?}

计划:
- create_plan: {title,description,priority:0-2,subtasks:[],tags:[],deadline?,estimated_time?,parent_id?}
- create_plan_template: {name,icon?,color?,description?,priority?,subtasks:[]}

通用:- undo_last: {}`

/** 闲聊意图判定 — 检测用户消息是否纯闲聊（不含指令性动词） */
const _COMMAND_PATTERNS = /(?:帮我|帮我记|帮我查|帮我建|帮我写|记一下|查一下|建一个|写一篇|修改|更新|删除|撤销|取消|完成|标记|今天花了|今天消费|买|付|收|收入|支出|记得|别忘了|提醒)/

export function isLiteChatMode(userMessage) {
  if (!userMessage || userMessage.length < 4) return true
  // 包含指令性动词 → 完整模式
  if (_COMMAND_PATTERNS.test(userMessage)) return false
  // 包含金额模式 → 完整模式
  if (/\d+(?:\.\d+)?\s*[块元¥万亿]/.test(userMessage)) return false
  // 纯闲聊
  return true
}

/** 行为准则（已压缩，合并相似项 7→5 条） */
export const BEHAVIOR_RULES = [
  '闲聊/倾诉/问好/吐槽/分享日常 → action.type="none"，正常聊天',
  '只有用户说"帮我记/帮我查/帮我建/帮我写"等指令时才执行 action',
  '"改/删除/撤销" → 对应 update_*/delete_*/undo_last，不确定目标时先 query',
  '[¥记账] 等消息开头标记必须按标记执行',
  '用户提到新人物/重要决定但没说"帮我记录" → 正常聊天，不主动 create'
]
