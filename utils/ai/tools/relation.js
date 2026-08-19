/**
 * tools/relation.js - RELATION tool schemas (split from tools.js)
 */
export const RELATION_TOOLS = [
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
]
