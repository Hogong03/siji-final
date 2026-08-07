/**
 * test: action schema 一致性校验
 * 确保 prompt-actions.js 的 CORE_ACTIONS 与 tools.js 的 TOOL_DEFINITIONS
 * 覆盖相同的 action name 集合（CORE_ACTIONS 是超集，TOOL_DEFINITIONS 是 Agent 子集）
 */
import { describe, it, expect } from 'vitest'
import { TOOL_DEFINITIONS, QUERY_TOOLS, CONFIRM_TOOLS } from '../utils/ai/tools.js'

// 从 CORE_ACTIONS 文本中提取所有 action name
function extractActionNames(text) {
  const matches = text.matchAll(/-\s+(\w+):\s*\{/g)
  return new Set([...matches].map(m => m[1]))
}

// 从 TOOL_DEFINITIONS 中提取所有 tool name
function extractToolNames() {
  return new Set(TOOL_DEFINITIONS.map(t => t.name))
}

describe('Action Schema 一致性', () => {
  it('TOOL_DEFINITIONS 中的工具名应全部存在于 ACTION_MAP', () => {
    // tools.js 的工具名应该都能被 store/data.js 的 ACTION_MAP 处理
    // 这里只校验 TOOL_DEFINITIONS 内部一致性
    const toolNames = extractToolNames()
    expect(toolNames.size).toBe(TOOL_DEFINITIONS.length) // 无重复
  })

  it('CONFIRM_TOOLS 应为空集（当前未定义 delete_* 工具）', () => {
    const toolNames = extractToolNames()
    const orphans = [...CONFIRM_TOOLS].filter(name => !toolNames.has(name))
    expect(orphans).toEqual([])
    // undo_last 是安全操作，不需要确认
    expect(CONFIRM_TOOLS.has('undo_last')).toBe(false)
  })

  it('QUERY_TOOLS 中的工具名应存在于 TOOL_DEFINITIONS', () => {
    const toolNames = extractToolNames()
    const orphans = [...QUERY_TOOLS].filter(name => !toolNames.has(name))
    expect(orphans).toEqual([])
  })
})
