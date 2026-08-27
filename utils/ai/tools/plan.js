/**
 * tools/plan.js - PLAN tool schemas (split from tools.js)
 */
export const PLAN_TOOLS = [
  // ===== 计划 =====
  {
    name: 'create_plan',
    description: '创建全新计划。用户说"帮我建个计划/新建计划"时调用；对已有计划的补充/修改（加子计划、改时间、改内容）必须用 update_plan，禁止新建同名计划。',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '计划标题' },
        description: { type: 'string', description: '计划描述' },
        priority: { type: 'integer', enum: [0, 1, 2], description: '0=普通 1=重要 2=紧急' },
        subtasks: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' } } }, description: '子计划列表（至少 1 条），将自动创建为子计划' },
        tags: { type: 'array', items: { type: 'string' } },
        start_time: { type: 'string', description: '计划开始日期 YYYY-MM-DD（用户提到时间时必填，从原话计算）' },
        end_time: { type: 'string', description: '计划结束日期 YYYY-MM-DD（用户提到时间时必填，从原话计算）' },
        deadline: { type: 'string', description: '截止日期 YYYY-MM-DD（用户提到"后天/下周/月底"等时间时必填，从原话计算具体日期）' }
      },
      required: ['title']
    }
  },
  {
    name: 'create_plan_phases',
    description: '创建多阶段计划。大目标需拆为多个阶段（将自动创建为多个子计划）时调用。',
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
    description: '修改已有计划。用户对计划提出变更（补充子计划/改时间/改内容/改名）时调用；不知道计划ID时先 query_plan 按标题找到原计划。',
    parameters: {
      type: 'object',
      properties: {
        client_id: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        priority: { type: 'integer', enum: [0, 1, 2] },
        status: { type: 'integer', enum: [0, 1, 2] },
        deadline: { type: 'string' },
        start_time: { type: 'string', description: '计划开始日期 YYYY-MM-DD' },
        end_time: { type: 'string', description: '计划结束日期 YYYY-MM-DD' },
        subtasks: { type: 'array', items: { type: 'object' }, description: '子计划列表，将自动创建为子计划' }
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
]
