/**
 * tools/feedback.js - FEEDBACK tool schemas (split from tools.js)
 */
export const FEEDBACK_TOOLS = [
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
]
