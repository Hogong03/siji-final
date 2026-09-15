/**
 * test: AI 核心模块的跨模块依赖必须显式 import（3.5.11）
 *
 * 背景：agent-loop.js 曾用 chatRequestChunkedStream 但从未 import（H5 条件编译剥离，
 * 只在 App 真机炸）；拆分 chat-stream.js 时 chat-sse.js 又漏了 chatRequestNonStream。
 * 这类「搬运后漏 import」只在特定分支才炸，静态断言能提前拦住。
 *
 * 维护：新增跨模块 helper 后，把名字加进 WATCHED 即可。
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const ROOT = process.cwd()
const WATCHED = [
  'getProvider', 'getDefaultConfig', 'supportsStreamStructuredOutput', 'getReasoningConfig',
  'parseAiResponse', 'buildChatMessages', 'getRecentHistory', 'chatRequestNonStream', 'logger',
  'checkRateLimit', 'recordRequest', 'runAgentChat', 'chatRequestChunkedStream', 'simulatedStream',
  'chatRequestRealStream', 'callWithTools', 'buildToolList', 'isWebSearchAvailable', 'TOOL_DEFINITIONS',
  'TOOL_LABELS', 'executeTool', 'QUERY_TOOLS', 'needsConfirmation', 'executeWebSearch', 'parseToolArgs',
  'argErrorResult', 'getTruncateLimit', 'AGENT_TOOL_INSTRUCTION', 'selectMemories',
  'expandTerms', 'buildQueryTerms', 'resolveSearchConfig', 'getSearchBackend'
]
const FILES = [
  'utils/ai/agent-loop.js',
  'utils/ai/agent-transport.js',
  'utils/ai/chat-stream.js',
  'utils/ai/chat-sse.js',
  'utils/ai/chat-simulated.js',
  'utils/ai/chat-chunked.js',
  'utils/ai/tools/call-utils.js',
  'utils/ai/tools/executor.js',
  'utils/ai/search-config.js',
  'utils/ai/search-adapters.js',
  'utils/ai/tools/web-search.js',
  'utils/memory.js',
  'utils/memory-rank.js',
  'utils/memory-synonyms.js'
]

function freeCallMissingImport(file) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8')
  const importLines = src.split('\n').filter(l => /^\s*import /.test(l)).join('\n')
  const used = WATCHED.filter(id => new RegExp('(^|[^\\w$.])' + id + '\\s*\\(', 'm').test(src))
  return used.filter(id =>
    !new RegExp('(^|[^\\w$])' + id + '([^\\w$]|$)').test(importLines) &&
    !new RegExp('(export )?function ' + id + '\\b').test(src)
  )
}

describe('AI 模块静态依赖', () => {
  for (const file of FILES) {
    it(file + '：用到的跨模块函数都已 import', () => {
      expect(freeCallMissingImport(file)).toEqual([])
    })
  }

  it('agent-loop 不再自己实现传输（callWithTools 由 agent-transport 提供）', () => {
    const src = fs.readFileSync(path.join(ROOT, 'utils/ai/agent-loop.js'), 'utf8')
    expect(src).toContain("from './agent-transport.js'")
    expect(src).not.toContain('function callWithRetry')
  })

  it('chat-stream 只做入口与门控（两种流式都在独立模块）', () => {
    const src = fs.readFileSync(path.join(ROOT, 'utils/ai/chat-stream.js'), 'utf8')
    expect(src).toContain("from './chat-sse.js'")
    expect(src).toContain("from './chat-simulated.js'")
    expect(src).not.toContain('function chatRequestRealStream')
  })
})