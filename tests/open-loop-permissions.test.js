/**
 * open-loop-permissions.test.js — M2.3 权限边界
 *
 * 验证「Agent 只能查、不能写」：
 *   - query_open_loops：TOOL_DEFINITIONS + QUERY_TOOLS（只读自动执行）
 *   - update_open_loop：只在 CORE_ACTIONS（JSON action），不进工具表
 *   - 新建：两条路都不给 AI，只能走对话确认卡
 */
import { describe, it, expect } from 'vitest'
import { TOOL_DEFINITIONS, QUERY_TOOLS } from '../utils/ai/tools/index.js'
import { CORE_ACTIONS } from '../utils/ai/prompt-actions.js'

const toolNames = TOOL_DEFINITIONS.map((t) => t.name)

describe('开放事项的 AI 权限', () => {
  it('query_open_loops 是只读工具', () => {
    expect(toolNames).toContain('query_open_loops')
    expect(QUERY_TOOLS.has('query_open_loops')).toBe(true)
  })

  it('update_open_loop 不给 Agent 自动执行', () => {
    expect(toolNames).not.toContain('update_open_loop')
    expect(QUERY_TOOLS.has('update_open_loop')).toBe(false)
  })

  it('没有任何 create_open_loop 工具或 action', () => {
    expect(toolNames).not.toContain('create_open_loop')
    expect(CORE_ACTIONS).not.toContain('create_open_loop')
  })

  it('update_open_loop 挂在 CORE_ACTIONS 上（兜底路径可见）', () => {
    expect(CORE_ACTIONS).toContain('update_open_loop')
    expect(CORE_ACTIONS).toContain('query_open_loops')
  })

  it('工具 schema 结构完整', () => {
    const tool = TOOL_DEFINITIONS.find((t) => t.name === 'query_open_loops')
    expect(tool.description.length).toBeGreaterThan(10)
    expect(tool.parameters.type).toBe('object')
    expect(Array.isArray(tool.parameters.properties ? Object.keys(tool.parameters.properties) : [])).toBe(true)
  })
})
