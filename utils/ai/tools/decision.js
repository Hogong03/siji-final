/**
 * tools/decision.js - DECISION tool schemas (split from tools.js)
 */
export const DECISION_TOOLS = [
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
]
