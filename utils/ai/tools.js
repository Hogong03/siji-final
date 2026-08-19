/**
 * tools.js — Agent 工具注册表
 *
 * 把现有 executor 的 action 封装为 OpenAI 兼容的 function-calling 工具。
 * 每个工具含：name（同 action.type）、description、parameters schema。
 * executeTool() 把 tool 调用分发到 store.executeAction，并把执行结果
 * 格式化为自然语言文本回传给 AI（供 agent 基于真实数据继续推理）。
 */

import { logger } from '../logger.js'
import { getUsedTags, addCustomTag, updateTagCategory, removeCustomTag, getTagsByCategory } from '../storage/tags.js'

// ==================== 工具定义（OpenAI function schema）====================

/**
 * 工具清单 — 覆盖现有 CORE_ACTIONS 全部能力
 * 说明：delete_* / clear_* 等破坏性操作默认不给 agent 自动执行（needConfirm）
 *       agent 只自动执行查询类与安全写入类工具。
 */
export const TOOL_DEFINITIONS = [
  // ===== 记录 =====
  {
    name: 'create_diary',
    description: '创建一条自由文本记录，首行自动作为标题。用户说"记一下/帮我记/写篇记录"时调用。',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: '记录正文（首行作标题）' },
        tags: { type: 'array', items: { type: 'string' }, description: '标签，尽量从历史标签中选' }
      },
      required: ['content']
    }
  },
  {
    name: 'update_diary',
    description: '修改一条已有记录。',
    parameters: {
      type: 'object',
      properties: {
        client_id: { type: 'string', description: '记录ID' },
        content: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } }
      },
      required: ['client_id']
    }
  },
  {
    name: 'query_diary',
    description: '查询记录。可按关键词或月份筛选。用户问"记录了啥/查一下/上个月写了什么"时调用。',
    parameters: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '关键词' },
        month: { type: 'string', description: '月份，格式 YYYY-MM，默认当月' }
      }
    }
  },
  {
    name: 'summarize_diaries',
    description: '生成记录周报/月报总结。用户要总结/周报/月报时调用。',
    parameters: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['week', 'month'], description: 'week=近7天，month=本月' }
      },
      required: ['period']
    }
  },
  {
    name: 'query_combined',
    description: '跨类型查询记录和账单。用户问的问题同时涉及记录和账单时调用。',
    parameters: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '关键词' },
        types: { type: 'array', items: { type: 'string', enum: ['diary', 'bill'] } }
      }
    }
  },

  // ===== 记账 =====
  {
    name: 'create_bill',
    description: '创建账单。用户提到花了/收入/买了多少金额时调用。',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['expense', 'income'], description: 'expense=支出 income=收入' },
        amount: { type: 'number', description: '金额' },
        category: { type: 'string', description: '分类，如餐饮/交通/购物' },
        note: { type: 'string', description: '备注' },
        bill_date: { type: 'string', description: '账单日期 YYYY-MM-DD，默认今天' }
      },
      required: ['type', 'amount', 'category']
    }
  },
  {
    name: 'update_bill',
    description: '修改一条账单。',
    parameters: {
      type: 'object',
      properties: {
        client_id: { type: 'string', description: '账单ID' },
        amount: { type: 'number' },
        category: { type: 'string' },
        note: { type: 'string' },
        type: { type: 'string', enum: ['expense', 'income'] }
      },
      required: ['client_id']
    }
  },
  {
    name: 'query_bill',
    description: '查询账单。可按月份、分类、关键词筛选。用户问"花了多少/查账/消费记录"时调用。',
    parameters: {
      type: 'object',
      properties: {
        month: { type: 'string', description: '月份 YYYY-MM，默认当月' },
        category: { type: 'string', description: '分类' },
        keyword: { type: 'string', description: '备注关键词' }
      }
    }
  },
  {
    name: 'query_stat',
    description: '查询账单统计（当月支出/收入/分类汇总）。用户问"这个月花了多少"时优先调用。',
    parameters: {
      type: 'object',
      properties: {
        month: { type: 'string', description: '月份 YYYY-MM，默认当月' }
      }
    }
  },

  // ===== 计划 =====
  {
    name: 'create_plan',
    description: '创建计划。用户说"帮我建个计划/新建计划"时调用。',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '计划标题' },
        description: { type: 'string', description: '计划描述' },
        priority: { type: 'integer', enum: [0, 1, 2], description: '0=普通 1=重要 2=紧急' },
        subtasks: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' } } } },
        tags: { type: 'array', items: { type: 'string' } },
        deadline: { type: 'string', description: '截止日期 YYYY-MM-DD' }
      },
      required: ['title']
    }
  },
  {
    name: 'create_plan_phases',
    description: '创建多阶段计划。大目标需拆为多个阶段（含子任务+里程碑+时间窗口）时调用。',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        deadline: { type: 'string' },
        phase_count: { type: 'integer', minimum: 2, maximum: 6, description: '阶段数 2-6' }
      },
      required: ['title']
    }
  },
  {
    name: 'update_plan',
    description: '修改计划。',
    parameters: {
      type: 'object',
      properties: {
        client_id: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        priority: { type: 'integer', enum: [0, 1, 2] },
        status: { type: 'integer', enum: [0, 1, 2] },
        deadline: { type: 'string' },
        subtasks: { type: 'array', items: { type: 'object' } }
      },
      required: ['client_id']
    }
  },
  {
    name: 'query_plan',
    description: '查询计划列表。用户问"有哪些计划/计划进度"时调用。',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['active', 'completed', 'all'], description: 'active=进行中 completed=已完成 all=全部' }
      }
    }
  },

  // ===== 个人信息 =====
  {
    name: 'get_profile',
    description: '读取用户画像（昵称/生日/职业/偏好等）。用户问"你知道我什么"或需要画像信息时调用。',
    parameters: { type: 'object', properties: {} }
  },
  {
    name: 'smart_update_profile',
    description: '智能更新用户画像。用户在对话中透露新偏好/事实时调用。',
    parameters: {
      type: 'object',
      properties: {
        updates: {
          type: 'array',
          items: { type: 'object', properties: { card: { type: 'string' }, field: { type: 'string' }, value: {} } }
        }
      },
      required: ['updates']
    }
  },

  // ===== 关系图谱 =====
  {
    name: 'create_relation',
    description: '创建人物关系。用户介绍新人物（谁是我女朋友/同事等）时调用。',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '人名' },
        role: { type: 'string', description: '关系，如女朋友/同事' },
        context: { type: 'string' },
        traits: { type: 'array', items: { type: 'string' }, description: '性格特点' },
        preferences: { type: 'array', items: { type: 'string' }, description: '偏好' },
        relationship_score: { type: 'integer', minimum: 1, maximum: 10 }
      },
      required: ['name', 'role']
    }
  },
  {
    name: 'query_relation',
    description: '查询人物关系。用户提到某人物时调用获取其信息。',
    parameters: {
      type: 'object',
      properties: { keyword: { type: 'string' } }
    }
  },
  {
    name: 'log_interaction',
    description: '记录一次与某人的互动。',
    parameters: {
      type: 'object',
      properties: {
        relation_id: { type: 'string' },
        scene: { type: 'string' },
        content: { type: 'string' },
        result: { type: 'string' }
      },
      required: ['relation_id', 'scene', 'content']
    }
  },

  // ===== 决策 =====
  {
    name: 'create_decision',
    description: '创建决策日志。用户在纠结选择时调用。',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        category: { type: 'string' },
        options: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, pros: { type: 'array', items: { type: 'string' } }, cons: { type: 'array', items: { type: 'string' } } } } }
      },
      required: ['title']
    }
  },
  {
    name: 'query_decision',
    description: '查询决策日志。',
    parameters: {
      type: 'object',
      properties: { status: { type: 'string' }, category: { type: 'string' } }
    }
  },
  {
    name: 'update_decision',
    description: '更新决策（改状态/补充思考）。',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        status: { type: 'string', enum: ['thinking', 'decided', 'executing', 'done'] },
        decision: { type: 'string' },
        reasoning: { type: 'string' }
      },
      required: ['id']
    }
  },

  // ===== 通用 =====
  {
    name: 'undo_last',
    description: '撤销上一步操作。用户说"撤销/撤回"时调用。',
    parameters: { type: 'object', properties: {} }
  },

  // ===== 体验反馈 =====
  {
    name: 'create_feedback',
    description: '创建体验反馈。用户说"我要反馈/提个建议/反馈个bug"时调用。',
    parameters: {
      type: 'object',
      properties: {
        rating: { type: 'integer', minimum: 1, maximum: 5, description: '评分 1-5' },
        category: { type: 'string', enum: ['功能建议', 'Bug反馈', '体验感受', '功能需求'], description: '反馈分类' },
        content: { type: 'string', description: '反馈内容' },
        contact: { type: 'string', description: '联系方式（可选）' }
      },
      required: ['content']
    }
  },
  {
    name: 'update_feedback',
    description: '修改一条已有反馈。用户说“改一下反馈/修改反馈”时调用。',
    parameters: {
      type: 'object',
      properties: {
        client_id: { type: 'string', description: '反馈ID' },
        rating: { type: 'integer', minimum: 1, maximum: 5 },
        category: { type: 'string' },
        content: { type: 'string' },
        contact: { type: 'string' }
      },
      required: ['client_id']
    }
  },
  {
    name: 'delete_feedback',
    description: '删除一条反馈。用户说“删掉那个反馈”时调用。',
    parameters: {
      type: 'object',
      properties: {
        client_id: { type: 'string', description: '反馈ID' }
      },
      required: ['client_id']
    }
  },
  {
    name: 'query_feedback',
    description: '查询体验反馈列表。用户问“有哪些反馈/反馈了什么”时调用。',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: '按分类筛选' }
      }
    }
  },
  {
    name: 'query_feedback_stats',
    description: '查询反馈统计（总数/平均评分/分类分布）。',
    parameters: { type: 'object', properties: {} }
  },

  // ===== 标签管理 =====
  {
    name: 'query_tags',
    description: '查询标签列表（按种类分组）。用户问“有哪些标签/标签分类”时调用。',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['diary', 'plan'], description: '标签类型，默认 diary' }
      }
    }
  },
  {
    name: 'add_tag',
    description: '添加自定义标签。可指定种类。',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '标签名' },
        type: { type: 'string', enum: ['diary', 'plan'], description: '标签类型，默认 diary' },
        categoryId: { type: 'string', enum: ['life', 'work', 'mood', 'study', 'social', 'other'], description: '标签种类' }
      },
      required: ['name']
    }
  },
  {
    name: 'update_tag_category',
    description: '修改标签所属种类。用户说“把XX标签归到工作类”时调用。',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '标签名' },
        type: { type: 'string', enum: ['diary', 'plan'] },
        categoryId: { type: 'string', enum: ['life', 'work', 'mood', 'study', 'social', 'other'] }
      },
      required: ['name', 'categoryId']
    }
  },
  {
    name: 'remove_tag',
    description: '从注册表删除标签。用户说“删掉XX标签”时调用。',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        type: { type: 'string', enum: ['diary', 'plan'] }
      },
      required: ['name']
    }
  }
]

/** 工具名 → 对应的 action type（多数同名，个别映射） */
const TOOL_ACTION_MAP = {}

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
function needsConfirmation(name, args) {
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

// ==================== 执行器分发 ====================

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
  if (!d || !d.summary) return JSON.stringify(d)
  const s = d.summary
  const parts = []
  if (s.totalExpense != null) parts.push(`总支出¥${s.totalExpense}`)
  if (s.totalIncome != null) parts.push(`总收入¥${s.totalIncome}`)
  if (s.count) parts.push(`共${s.count}笔`)
  if (s.topCategories && s.topCategories.length) {
    parts.push('主要分类：' + s.topCategories.map(c => `${c.category}¥${c.amount}`).join('、'))
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

// ==================== 工具说明（prompt 注入用）====================

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
