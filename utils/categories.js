/**
 * 账单分类统一配置
 *
 * 支出分类 16 项 + 收入分类 6 项
 * icon: emoji 图标（跨平台一致）
 * color: 分类标识色（用于列表筛选 chip、编辑页选中态）
 *
 * 使用方式：
 *   import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, ALL_CATEGORIES, getCategoryInfo } from '@/utils/categories.js'
 */

export const EXPENSE_CATEGORIES = [
  { key: '餐饮', icon: '🍜', color: '#E8A838' },
  { key: '咖啡奶茶', icon: '☕', color: '#8B5E3C' },
  { key: '零食水果', icon: '🍎', color: '#D35D5D' },
  { key: '交通出行', icon: '🚌', color: '#5B8BD4' },
  { key: '网购购物', icon: '🛒', color: '#9C27B0' },
  { key: '居住水电', icon: '🏠', color: '#607D8B' },
  { key: '通讯网络', icon: '📱', color: '#00BCD4' },
  { key: '娱乐休闲', icon: '🎮', color: '#FF9800' },
  { key: '运动健身', icon: '🏃', color: '#4CAF50' },
  { key: '医疗健康', icon: '💊', color: '#F44336' },
  { key: '教育学习', icon: '📚', color: '#3F51B5' },
  { key: '人情社交', icon: '🎁', color: '#E91E63' },
  { key: '宠物用品', icon: '🐱', color: '#8BC34A' },
  { key: '数码电器', icon: '💻', color: '#78909C' },
  { key: '服饰美容', icon: '👔', color: '#AB47BC' },
  { key: '其他支出', icon: '📌', color: '#9E9E9E' }
]

export const INCOME_CATEGORIES = [
  { key: '工资薪资', icon: '💼', color: '#10B981' },
  { key: '兼职外快', icon: '💵', color: '#66BB6A' },
  { key: '投资理财', icon: '📈', color: '#26A69A' },
  { key: '红包礼金', icon: '🧧', color: '#EF5350' },
  { key: '退款退货', icon: '↩️', color: '#42A5F5' },
  { key: '其他收入', icon: '📌', color: '#9E9E9E' }
]

/** 全部分类（支出 + 收入） */
export const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]

/** 按账单类型获取分类列表 */
export function getCategoriesByType(billType) {
  return billType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
}

/** 根据 key 获取分类信息（未找到时返回默认值） */
export function getCategoryInfo(key) {
  return ALL_CATEGORIES.find(c => c.key === key) || { key: key || '其他', icon: '📌', color: '#9E9E9E' }
}

/** 确认弹窗通用红色 */
export const DANGER_COLOR = '#D35D5D'
