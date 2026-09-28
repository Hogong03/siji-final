import { describe, it, expect } from 'vitest'
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  ALL_CATEGORIES,
  getCategoriesByType,
  getCategoryInfo,
  DANGER_COLOR
} from '@/utils/categories.js'

describe('categories.js', () => {
  it('支出分类应有 16 项', () => {
    expect(EXPENSE_CATEGORIES).toHaveLength(16)
  })

  it('收入分类应有 6 项', () => {
    expect(INCOME_CATEGORIES).toHaveLength(6)
  })

  it('ALL_CATEGORIES 应等于支出+收入', () => {
    expect(ALL_CATEGORIES).toHaveLength(22)
    expect(ALL_CATEGORIES).toEqual([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES])
  })

  it('每个分类应有 key/icon/color', () => {
    ALL_CATEGORIES.forEach(c => {
      expect(c.key).toBeTruthy()
      expect(c.icon).toBeTruthy()
      expect(c.color).toMatch(/^#/)
    })
  })

  it('getCategoriesByType 应按类型返回分类', () => {
    expect(getCategoriesByType('expense')).toBe(EXPENSE_CATEGORIES)
    expect(getCategoriesByType('income')).toBe(INCOME_CATEGORIES)
    expect(getCategoriesByType()).toBe(EXPENSE_CATEGORIES) // 默认支出
  })

  it('getCategoryInfo 应返回正确分类信息', () => {
    const result = getCategoryInfo('餐饮')
    expect(result.key).toBe('餐饮')
    expect(result.icon).toBe('🍜')
    expect(result.color).toBe('#E8A838')
  })

  it('getCategoryInfo 未找到应返回默认值', () => {
    const result = getCategoryInfo('不存在的分类')
    expect(result.key).toBe('不存在的分类')
    expect(result.icon).toBe('📌')
  })

  it('getCategoryInfo 空值应返回默认', () => {
    const result = getCategoryInfo('')
    expect(result.key).toBe('其他')
  })

  it('DANGER_COLOR 应为红色', () => {
    expect(DANGER_COLOR).toMatch(/^#/)
  })
})
