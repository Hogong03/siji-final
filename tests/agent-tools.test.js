import { describe, it, expect, vi } from 'vitest'
import { TOOL_DEFINITIONS, executeTool, QUERY_TOOLS, buildToolsInstruction } from '../utils/ai/tools.js'

describe('Agent 工具注册表', () => {
  it('工具定义覆盖核心能力', () => {
    const names = TOOL_DEFINITIONS.map(t => t.name)
    expect(names).toContain('query_bill')
    expect(names).toContain('create_diary')
    expect(names).toContain('query_plan')
    expect(names).toContain('create_plan_phases')
    expect(names).toContain('smart_update_profile')
    expect(names).toContain('get_profile')
  })

  it('每个工具定义含 name/description/parameters', () => {
    for (const t of TOOL_DEFINITIONS) {
      expect(typeof t.name).toBe('string')
      expect(t.name.length).toBeGreaterThan(0)
      expect(typeof t.description).toBe('string')
      expect(t.parameters).toBeDefined()
      expect(t.parameters.type).toBe('object')
    }
  })

  it('查询类工具标记只读', () => {
    expect(QUERY_TOOLS.has('query_bill')).toBe(true)
    expect(QUERY_TOOLS.has('query_diary')).toBe(true)
    expect(QUERY_TOOLS.has('query_plan')).toBe(true)
    expect(QUERY_TOOLS.has('get_profile')).toBe(true)
    // 写入类工具不在只读集合
    expect(QUERY_TOOLS.has('create_bill')).toBe(false)
    expect(QUERY_TOOLS.has('create_diary')).toBe(false)
  })

  it('buildToolsInstruction 生成可读文本', () => {
    const txt = buildToolsInstruction()
    expect(txt).toContain('query_bill')
    expect(txt).toContain('create_diary')
    expect(txt).toContain('记录')
  })
})

describe('executeTool', () => {
  it('查询成功 → 返回格式化文本与 detail', () => {
    const store = {
      executeAction: vi.fn(() => ({
        success: true,
        message: '找到 2 笔',
        detail: {
          type: 'query_bill', month: '2026-07', count: 2,
          items: [
            { type: 'expense', amount: 25, category: '餐饮', note: '午餐', bill_date: '2026-07-28' },
            { type: 'expense', amount: 58, category: '交通', note: '', bill_date: '2026-07-27' }
          ]
        }
      }))
    }
    const r = executeTool(store, 'query_bill', { month: '2026-07' })
    expect(r.ok).toBe(true)
    expect(store.executeAction).toHaveBeenCalledWith({ type: 'query_bill', payload: { month: '2026-07' } })
    expect(r.text).toContain('2026-07')
    expect(r.text).toContain('¥25')
    expect(r.text).toContain('餐饮')
    expect(r.detail.items).toHaveLength(2)
  })

  it('写入成功 → ok true 带 message', () => {
    const store = {
      executeAction: vi.fn(() => ({
        success: true,
        message: '记录已保存',
        detail: { type: 'diary', id: 'd1', title: '测试' }
      }))
    }
    const r = executeTool(store, 'create_diary', { content: '测试' })
    expect(r.ok).toBe(true)
    expect(r.message).toBe('记录已保存')
    expect(store.executeAction).toHaveBeenCalledWith({ type: 'create_diary', payload: { content: '测试' } })
  })

  it('执行失败 → ok false 返回失败文本', () => {
    const store = {
      executeAction: vi.fn(() => ({ success: false, message: '缺少记录ID' }))
    }
    const r = executeTool(store, 'update_diary', {})
    expect(r.ok).toBe(false)
    expect(r.text).toContain('update_diary')
    expect(r.text).toContain('缺少记录ID')
  })

  it('CONFIRM_TOOLS 为空集 — Agent 不做删除，undo_last 可直接执行', () => {
    // undo_last 是安全操作，不需要 confirm
    const store = { executeAction: vi.fn(() => ({ success: true, message: '已撤销', detail: { undone: true } })) }
    const r = executeTool(store, 'undo_last', {})
    expect(r.confirm).toBeUndefined()
    expect(r.ok).toBe(true)
    expect(store.executeAction).toHaveBeenCalled()
  })

  it('查询无数据 → 友好提示', () => {
    const store = {
      executeAction: vi.fn(() => ({
        success: true,
        message: '找到 0 笔',
        detail: { type: 'query_bill', month: '2026-07', count: 0, items: [] }
      }))
    }
    const r = executeTool(store, 'query_bill', { month: '2026-07' })
    expect(r.ok).toBe(true)
    expect(r.text).toContain('没有找到')
  })

  it('detail 缺失 → 返回无数据文本', () => {
    const store = {
      executeAction: vi.fn(() => ({ success: true, message: 'ok', detail: null }))
    }
    const r = executeTool(store, 'get_profile', {})
    expect(r.ok).toBe(true)
    expect(r.text).toBe('（无返回数据）')
  })
  it('query_stat 平坦 detail 格式化为统计文本', () => {
    const store = {
      executeAction: vi.fn(() => ({
        success: true,
        message: '2026-08 概览',
        detail: {
          type: 'query_stat', month: '2026-08', billCount: 3, diaryCount: 2,
          activePlanCount: 1, completedPlanCount: 0,
          totalExpense: 100, totalIncome: 50, netIncome: -50,
          topCategory: '餐饮', topCategoryAmount: 60,
          topMood: '平静', categoryBreakdown: { '餐饮': 60, '交通': 40 }
        }
      }))
    }
    const r = executeTool(store, 'query_stat', { month: '2026-08' })
    expect(r.ok).toBe(true)
    expect(r.text).toContain('总支出¥100')
    expect(r.text).toContain('总收入¥50')
    expect(r.text).toContain('共3笔')
    expect(r.text).toContain('主要分类：餐饮¥60')
    expect(r.text).not.toMatch(/^\s*\{/)
  })

})
