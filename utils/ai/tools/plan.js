/**
 * tools/plan.js - PLAN tool schemas (split from tools.js)
 */
export const PLAN_TOOLS = [
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
]
