/**
 * tools/bill.js - BILL tool schemas (split from tools.js)
 */
export const BILL_TOOLS = [
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
]
