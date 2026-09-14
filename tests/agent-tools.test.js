import { describe, it, expect, vi } from 'vitest'
import { TOOL_DEFINITIONS, executeTool, QUERY_TOOLS, buildToolsInstruction } from '../utils/ai/tools.js'
import { CORE_ACTIONS } from '../utils/ai/prompt-actions.js'
import { buildAgentPayload } from '../utils/ai/tools/agent.js'

describe('create_agent 工具 schema（3.1：无技能，含开场引导）', () => {
  const tool = TOOL_DEFINITIONS.find(t => t.name === 'create_agent')

  it('参数不含 skills，含 starts', () => {
    expect(tool).toBeDefined()
    const props = tool.parameters.properties
    expect(props.skills).toBeUndefined()
    expect(props.starts).toBeDefined()
    expect(props.starts.maxItems).toBe(3)
    expect(JSON.stringify(props.starts.items)).toContain('20')
  })

  it('buildAgentPayload 归一化 starts（截断、去空、上限 3 条）', () => {
    const r = buildAgentPayload({
      name: ' 情绪教练 ',
      systemPrompt: '你是情绪教练',
      starts: [' 今天状态不好，帮我看看 ', '', '第2条开场引导文字很长超过二十个字符会被截断处理哦', '第3条', '第4条']
    })
    expect(r.ok).toBe(true)
    expect(r.data.starts).toHaveLength(3)
    expect(r.data.starts[0]).toBe('今天状态不好，帮我看看')
  })

  it('存量带 skills 的 payload 静默忽略，不报错', () => {
    const r = buildAgentPayload({ name: '旧版Agent', systemPrompt: '人设', skills: ['memory', 'decision'] })
    expect(r.ok).toBe(true)
    expect(r.data.skills).toBeUndefined()
    expect(r.data.starts).toEqual([])
  })

  it('CORE_ACTIONS 的 create_agent 行不再声明 skills', () => {
    const line = CORE_ACTIONS.split('\n').find(l => l.includes('create_agent:'))
    expect(line).toBeTruthy()
    expect(line).not.toContain('skills')
    expect(line).toContain('starts')
  })
})

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

describe('AI 自定义属性（MBTI/星座/血型）上报说明', () => {
  it('smart_update_profile 工具 schema 说明自定义属性写入方式', () => {
    const tool = TOOL_DEFINITIONS.find(t => t.name === 'smart_update_profile')
    const updatesDesc = JSON.stringify(tool.parameters.properties.updates)
    expect(updatesDesc).toContain('MBTI')
    expect(updatesDesc).toContain('星座')
    const item = tool.parameters.properties.updates.items
    expect(item.required).toEqual(['card', 'field', 'value'])
  })

  it('CORE_ACTIONS 说明 update_profile.custom 与自定义属性规则', () => {
    expect(CORE_ACTIONS).toContain('custom?:[{label,value}]')
    expect(CORE_ACTIONS).toContain('MBTI')
    expect(CORE_ACTIONS).toContain('禁止重复上报')
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
    // 3.0：写操作默认需确认；此用例测「自动执行已开启」时的直写路径
    globalThis.uni = { getStorageSync: () => '1' }
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
    // 3.0：写操作默认需确认；此用例测「自动执行已开启」时的失败透传路径
    globalThis.uni = { getStorageSync: () => '1' }
    const store = {
      executeAction: vi.fn(() => ({ success: false, message: '缺少记录ID' }))
    }
    const r = executeTool(store, 'update_diary', {})
    expect(r.ok).toBe(false)
    expect(r.text).toContain('update_diary')
    expect(r.text).toContain('缺少记录ID')
  })

  it('undo_last 是安全操作，无需 confirm，可直接执行', () => {
    const store = { executeAction: vi.fn(() => ({ success: true, message: '已撤销', detail: { undone: true } })) }
    const r = executeTool(store, 'undo_last', {})
    expect(r.confirm).toBeUndefined()
    expect(r.ok).toBe(true)
    expect(store.executeAction).toHaveBeenCalled()
  })

  it('delete_feedback 永远需要确认（3.5.11：删类工具例外登记）', () => {
    globalThis.uni = { getStorageSync: () => '1' } // 即便开了自动写，删除也必须确认
    const store = { executeAction: vi.fn(() => ({ success: true, message: '已删除' })) }
    const r = executeTool(store, 'delete_feedback', { client_id: 'f1' })
    expect(r.confirm).toBe(true)
    expect(r.ok).toBe(false)
    expect(store.executeAction).not.toHaveBeenCalled()
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

describe('query_conversations 会话检索工具（3.2 M3）', () => {
  const tool = TOOL_DEFINITIONS.find(t => t.name === 'query_conversations')

  it('工具注册且 keyword 必填', () => {
    expect(tool).toBeDefined()
    expect(tool.parameters.required).toEqual(['keyword'])
    expect(tool.parameters.properties.tag).toBeDefined()
  })

  it('只读：QUERY_TOOLS 含 query_conversations', () => {
    expect(QUERY_TOOLS.has('query_conversations')).toBe(true)
  })

  it('CORE_ACTIONS 双注册含会话记忆段', () => {
    expect(CORE_ACTIONS).toContain('query_conversations: {keyword,tag?}')
    expect(CORE_ACTIONS).toContain('会话记忆')
  })
})
