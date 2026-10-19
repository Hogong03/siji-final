/**
 * tools/relation.js - RELATION tool schemas (split from tools.js)
 */
export const RELATION_TOOLS = [
  // ===== 关系图谱 =====
  {
    name: 'create_relation',
    description: '创建人物关系。用户介绍新人物（谁是我女朋友/同事等）时调用。亲密度由用户自己在关系页评价，不要传分数。',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '人名' },
        role: { type: 'string', description: '关系，如女朋友/同事' },
        context: { type: 'string' },
        traits: { type: 'array', items: { type: 'string' }, description: '性格特点' },
        preferences: { type: 'array', items: { type: 'string' }, description: '偏好' }
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
    description: '记录一次与某人的互动。relation_id 优先（关系上下文里 ID: 后的值）。若返回「匹配到 N 个人」，禁止猜测，把候选（含 id）交给用户确认，用户选定后用该 relation_id 重新调用；姓名只在不知道 ID 时传。',
    parameters: {
      type: 'object',
      properties: {
        relation_id: { type: 'string', description: '关系ID（关系上下文中 ID: 后面的值，优先使用）' },
        relation_name: { type: 'string', description: '关系人名（不知道 ID 时才传；同名或模糊命中多人时会返回候选而不写入）' },
        scene: { type: 'string' },
        content: { type: 'string' },
        result: { type: 'string' }
      },
      required: ['scene', 'content']
    }
  },
]
