/**
 * tools/diary.js - DIARY tool schemas (split from tools.js)
 */
export const DIARY_TOOLS = [
  // ===== 记录 =====
  {
    name: 'create_diary',
    description: '创建一条自由文本记录，首行自动作为标题。用户说"记一下/帮我记/写篇记录"时调用。正文必须放 content，禁止传 title 字段；record_type 必须根据用户原话判断：日记/心情→diary，想法/灵感→idea，待办/要做→todo，闪念→flash，其他→note，禁止省略。',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: '记录正文（首行作标题）' },
        record_type: { type: 'string', enum: ['note', 'diary', 'idea', 'todo', 'flash'], description: '记录类型，默认 note' },
        tags: { type: 'array', items: { type: 'string' }, description: '标签，尽量从历史标签中选' }
      },
      required: ['content']
    }
  },
  {
    name: 'update_diary',
    description: '修改一条已有记录。用户说"改内容/改标题/改类型"时调用，只传需要修改的字段。',
    parameters: {
      type: 'object',
      properties: {
        client_id: { type: 'string', description: '记录ID' },
        title: { type: 'string', description: '修改标题' },
        content: { type: 'string', description: '修改正文' },
        record_type: { type: 'string', enum: ['note', 'diary', 'idea', 'todo', 'flash'], description: '修改记录类型' },
        tags: { type: 'array', items: { type: 'string' } }
      },
      required: ['client_id']
    }
  },
  {
    name: 'query_diary',
    description: '查询记录。可按关键词或月份筛选，支持同义词匹配（如"焦虑"能查到"压力/失眠/睡不好"相关记录）。用户问"记录了啥/查一下/上个月写了什么"时调用。',
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
]
