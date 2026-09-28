import { describe, it, expect, beforeEach } from 'vitest'
import './setup.js'

// 冒烟测试：确保 agent 引擎模块可加载（import 期无副作用报错）
import { runAgentLoop, MAX_ROUNDS } from '@/utils/ai/agent-loop.js'
import { WEB_SEARCH_TOOL, executeWebSearch } from '@/utils/ai/tools/web-search.js'
import { QUERY_TOOLS, TOOL_DEFINITIONS } from '@/utils/ai/tools.js'
import { isWebSearchAvailable, resolveSearchConfig, setOwnSearchKey } from '@/utils/ai/search-config.js'

describe('Agent 引擎（D2 联网搜索）', () => {
  beforeEach(() => { global.uni.clearStorageSync?.() })

  it('web_search 已注册进 TOOL_DEFINITIONS 与 QUERY_TOOLS', () => {
    expect(TOOL_DEFINITIONS.some(t => t.name === 'web_search')).toBe(true)
    expect(QUERY_TOOLS.has('web_search')).toBe(true)
    expect(WEB_SEARCH_TOOL.parameters.required).toContain('query')
  })

  it('门控与聊天厂商无关：没配 Key 就不可用', () => {
    expect(isWebSearchAvailable()).toBe(false)
    expect(resolveSearchConfig().reason).toBe('no_key')
  })

  it('配好搜索 Key 即可用（不看当前聊天厂商）', () => {
    setOwnSearchKey('sk-search-test')
    const cfg = resolveSearchConfig()
    expect(cfg.available).toBe(true)
    expect(cfg.source).toBe('own')
  })

  it('executeWebSearch 无 Key 时返回友好错误（不抛异常）', async () => {
    const result = await executeWebSearch('今天天气', '')
    expect(result.ok).toBe(false)
    expect(result.text).toContain('联网搜索')
  })

  it('runAgentLoop 可导出且轮次上限存在', () => {
    expect(typeof runAgentLoop).toBe('function')
    expect(MAX_ROUNDS).toBeGreaterThan(0)
  })
})