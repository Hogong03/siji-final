/**
 * prompt-actions.js — Action schema + 闲聊模式判定
 * 从 prompt-builder.js 拆分，降低单文件体积
 */

/**
 * 核心 action schema（始终注入，已压缩字段注释）
 * 一致性维护：此 schema 与 tools.js 的 TOOL_DEFINITIONS 描述同一能力集，
 * 但格式不同。CORE_ACTIONS 是超集（含 delete/update），TOOL_DEFINITIONS 是 Agent 子集。
 * 新增 action 时：查询/创建类两处都加，更新/删除类只加 CORE_ACTIONS。
 * 跑 tests/action-schema-consistency.test.js 校验一致性。
 */
export const CORE_ACTIONS = `记录:
- create_diary: {content,tags?,record_type?}  // 自由文本，首行自动作为标题；正文必须放 content，禁止传 title；record_type: note|diary|idea|todo|flash（默认 note）
- update_diary: {client_id,title?,content?,record_type?,tags?}  // 改内容/标题/类型只传对应字段
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
- create_plan: {title,description,priority:0-2,subtasks:[],tags:[],deadline?,start_time?,end_time?,estimated_time?,parent_id?}  // subtasks>=1条自动转为子计划，必须>=1条否则不建；日期统一 YYYY-MM-DD；用户提到"后天/下周/月底"等时间时 deadline/start_time/end_time 必填（从原话计算），用户没说的天数/日期禁止编造
- create_plan_phases: {title,description?,deadline,phase_count?:2-6}  // AI自动拆解为多个子计划
- update_plan: {client_id,title?,description?,priority?,status?,deadline?,estimated_time?,subtasks?,parent_id?}  // 用户对已有计划提变更时调用；不知道ID先 query_plan，禁止新建同名计划
- update_plan_phase: {client_id,phase_id,title?,subtasks?,milestones?,start_date?,end_date?}  // phase_id=子计划client_id
- update_plan_subtask: {client_id,subtask_id,done}
- delete_plan: {client_id} needConfirm=true
- query_plan: {status:"active"|"completed"|"all"}

个人信息:
- smart_update_profile: {updates:[{card,field,value}],remove:[],createCard:[]}  // updates：card 为已有分组(basic/lifestyle/custom_ai)或新分组名(自动创建)，field 为已知字段或任意自定义属性(如 MBTI/星座/血型)，value 为属性值；用户主动告知的新属性必须记录；只更新用户本次提到的字段，画像中的旧字段未提及禁止重复上报
- update_profile: {nickname?,gender?,birthday?,occupation?,location?,bio?,budget?,sleepTime?,hobbies:[],dietary:[],custom?:[{label,value}]}  // custom 用于任意自定义属性：label=属性名(如 MBTI/星座)，value=属性值；只更新用户本次提到的字段
- get_profile: {}
- clear_profile: {card?,field?} needConfirm=true
- toggle_profile: {enabled:bool}

体验反馈:
- create_feedback: {rating:1-5,category:"功能建议"|"Bug反馈"|"体验感受"|"功能需求",content,contact?}
- update_feedback: {client_id,rating?,category?,content?,contact?}
- delete_feedback: {client_id} needConfirm=true
- query_feedback: {category?}
- query_feedback_stats: {}

标签管理:
- query_tags: {type:"diary"|"plan"}  // 按种类分组查询标签
- add_tag: {name,type?:"diary"|"plan",categoryId?:"life"|"work"|"mood"|"study"|"social"|"other"}
- update_tag_category: {name,type?,categoryId}
- remove_tag: {name,type?}  // 从注册表删除标签

联动:
- query_combined: {keyword?,date_range?,types:["diary","bill"]}  // 跨类型查询记录和账单

通用:- undo_last: {}`

/** 精简版 action schema（闲聊模式，只保留高频操作） */
export const LITE_ACTIONS = `记账:
- create_bill: {type:"expense"|"income",amount,category,note?,bill_date?}
- query_bill: {month?,category?}

记录:
- create_diary: {content,tags?,record_type?}

计划:
- create_plan: {title,description,priority:0-2,subtasks:[],tags:[],deadline?,start_time?,end_time?,estimated_time?,parent_id?}
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

/** 行为准则（已压缩，合并相似项 7→7 条） */
export const BEHAVIOR_RULES = [
  '闲聊/倾诉/问好/吐槽/分享日常 → action.type="none"，正常聊天',
  '只有用户说"帮我记/帮我查/帮我建/帮我写"等指令时才执行 action',
  '"改/删除/撤销" → 对应 update_*/delete_*/undo_last，不确定目标时先 query',
  '用户指出数据有误或 AI 识别到矛盾 → 先 query 确认，再 update_* 直接修正，不要只说"建议手动修改"',
  '用户告知自定义属性（MBTI/星座/血型/偏好等）→ smart_update_profile 或 update_profile.custom 记录，禁止只口头回复不落库，禁止重复上报未提及的旧字段',
  '[¥记账] 等消息开头标记必须按标记执行',
  '用户提到新人物/重要决定但没说"帮我记录" → 正常聊天，不主动 create',
  '标签分类/归类/整理 → add_tag/update_tag_category/query_tags 直接操作',
  '改内容/改标题/改类型/改状态 → 对应 update_* 修改原记录，禁止 create_* 新建记录',
  '执行结果必须如实复述：工具没改的字段（如标题未改）禁止声称"已同步更新"，只说执行结果确认过的内容',
  '用户补充/修改已有计划（加子计划、改时间、改内容）→ query_plan 找到原计划后 update_plan，禁止 create_plan 新建同名计划',
  '一句话含多个意图（如"花了25元吃饭+我的爱好是篮球"）→ 拆解为多个 action 一次执行，禁止只处理第一个意图',
  '用户说"我的…(是/为/式)…帮我记录/记一下" → 拆解事实+指令并落库（update_profile/smart_update_profile）；错别字不影响语义（如"式"按"是"理解），禁止只口头确认不执行'
]
