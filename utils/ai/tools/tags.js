/**
 * tools/tags.js - TAGS tool schemas (split from tools.js)
 */
export const TAGS_TOOLS = [
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
