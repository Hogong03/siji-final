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
        subtasks: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string', description: '这步具体做什么/怎么做/完成标准（一两句话）' }, est_minutes: { type: 'integer', description: '建议耗时分钟（普通一步 5-15 分钟可执行；循环任务 recur_type=daily/weekly 可为 20-120 分钟无需再拆）' }, start_time: { type: 'string', description: '该子计划开始 YYYY-MM-DD（用户给了计划整体起止时按序排入，禁止编造）' }, end_time: { type: 'string', description: '该子计划结束 YYYY-MM-DD（规则同上）' }, recur_type: { type: 'string', enum: ['', 'daily', 'weekly'], description: "循环任务：用户说每天/每周固定动作时填（daily=每天做；weekly=每周做 recur_count 次，任意天）；禁止逐日拆成多个子计划" }, recur_count: { type: 'integer', description: 'weekly 的每周目标次数（默认 1；如每周 3 次模考填 3）' } }, required: ['title', 'description', 'est_minutes'] }, description: '子计划列表（至少 1 条），将自动创建为子计划；每条收敛到 5-15 分钟可执行的一步；循环任务不逐日展开' },
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
    description: '创建多阶段计划（跨周/跨月/大目标，自动拆为多个子计划）。每阶段必须写清 description（阶段目标+怎么做/完成标准），禁止只给 phase_count 生成空壳阶段。',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        deadline: { type: 'string' },
        phase_count: { type: 'integer', minimum: 2, maximum: 6, description: '阶段数 2-6' },
        phases: { type: 'array', items: { type: 'object', properties: { title: { type: 'string', description: '阶段标题' }, description: { type: 'string', description: '阶段目标 + 具体做法/完成标准（一两句话）' }, start_date: { type: 'string', description: '阶段开始日期 YYYY-MM-DD（用户给了阶段起止时必填）' }, end_date: { type: 'string', description: '阶段结束日期 YYYY-MM-DD（规则同上，阶段内循环任务到此自动结束）' }, children: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' }, est_minutes: { type: 'integer', description: '耗时分钟；循环任务可为 20-120 分钟无需再拆' }, recur_type: { type: 'string', enum: ['', 'daily', 'weekly'] }, recur_count: { type: 'integer' } }, required: ['title', 'description', 'est_minutes'] }, description: '阶段内每日/每周动作（循环任务，禁止逐日拆碎）' } }, required: ['title', 'description'] }, description: '阶段列表（2-6 条），每条带明确细节，禁止空壳' }
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
        subtasks: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string', description: '这步具体做什么/怎么做/完成标准（一两句话）' }, est_minutes: { type: 'integer', description: '建议耗时分钟（普通一步 5-15 分钟可执行；循环任务可为 20-120 分钟无需再拆）' }, start_time: { type: 'string', description: '该子计划开始 YYYY-MM-DD（用户给了计划整体起止时按序排入，禁止编造）' }, end_time: { type: 'string', description: '该子计划结束 YYYY-MM-DD（规则同上）' }, recur_type: { type: 'string', enum: ['', 'daily', 'weekly'] }, recur_count: { type: 'integer' } }, required: ['title', 'description', 'est_minutes'] }, description: '子计划列表，将自动创建为子计划；单步超过 15 分钟必须继续拆出下一级子计划；循环任务不逐日展开' },
        recur_type: { type: 'string', enum: ['', 'daily', 'weekly'], description: '把该计划本身设为循环任务' },
        recur_count: { type: 'integer', description: 'weekly 的每周目标次数' },
        frozen: { type: 'boolean', description: '冷藏（先放一放）：true 冷藏 / false 恢复；不影响状态、执行记录与进度' },
      },
      required: ['client_id']
    }
  },
  {
    name: 'log_plan_checkin',
    description: '记录「今天做了」（计划打卡）。用户说"今天做了/今日打卡/今天完成了一次"且目标为重复性/习惯型计划时调用；同一天同一计划只记一次，不改状态与进度；note 写这次做了什么（可空，同一天可补写）；冷藏或已完成计划禁用。',
    parameters: {
      type: 'object',
      properties: {
        client_id: { type: 'string', description: '计划ID（不知道时先 query_plan 按标题找）' },
        note: { type: 'string', description: '这次做了什么（如：散步 20 分钟/读了 10 页），可空' }
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
