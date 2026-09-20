/**
 * 回复被输出上限截断（4.3.1）
 *
 * 三件事的回归：
 *   1. 判据：只认 finish_reason === 'length'，不按字数猜
 *   2. 采集：四条请求路径都要读 finish_reason，并把标记带到结果上
 *   3. 落地：标记写进消息 → 气泡给「继续写完」→ 随会话落盘（重启后还在）
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import './setup.js'
import { markReplyTruncated } from '../utils/ai/response-parser.js'

const ROOT = process.cwd()
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')

describe('判据：只有 finish_reason === length 才算截断', () => {
  it('length 打标记，其余终止原因不动结果', () => {
    expect(markReplyTruncated({ reply: 'a' }, 'length').truncated).toBe(true)
    expect(markReplyTruncated({ reply: 'a' }, 'stop').truncated).toBeUndefined()
    expect(markReplyTruncated({ reply: 'a' }, '').truncated).toBeUndefined()
    expect(markReplyTruncated({ reply: 'a' }, undefined).truncated).toBeUndefined()
  })

  it('原对象返回（便于链式调用），传 null 不炸', () => {
    const r = { reply: 'x' }
    expect(markReplyTruncated(r, 'length')).toBe(r)
    expect(markReplyTruncated(null, 'length')).toBe(null)
  })

  it('没有按字数猜的启发式 —— 超长回复不因字数被打标记', () => {
    const long = { reply: '字'.repeat(5000) }
    expect(markReplyTruncated(long, 'stop').truncated).toBeUndefined()
  })
})

describe('采集：四条请求路径都读 finish_reason', () => {
  it('H5 SSE', () => {
    const s = read('utils/ai/chat-sse.js')
    expect(s).toContain('finish_reason')
    expect(s).toContain('markReplyTruncated(result, finishReason)')
  })

  it('App 分块流（含 Agent 原始 content 模式）', () => {
    const s = read('utils/ai/chat-chunked.js')
    expect(s).toContain('finish_reason')
    expect(s).toContain("truncated: finishReason === 'length'")
    expect(s).toContain('markReplyTruncated(result, finishReason)')
  })

  it('非流式：正常路径与 400 降级重试路径都标', () => {
    const s = read('utils/ai/chat-request.js')
    const hits = s.match(/markReplyTruncated\(/g) || []
    expect(hits.length).toBeGreaterThanOrEqual(2)
  })

  it('Agent 工具轮 + 最终流式 + App 分支', () => {
    const s = read('utils/ai/agent-transport.js')
    const hits = s.match(/markReplyTruncated\(/g) || []
    expect(hits.length).toBeGreaterThanOrEqual(4)
    expect(s).toContain('truncated: res.truncated === true')
  })

  it('agent-loop 把标记透传给上层（最终回复 + 轮次耗尽兜底两处）', () => {
    const s = read('utils/ai/agent-loop.js')
    const hits = s.match(/truncated: response\.truncated === true/g) || []
    expect(hits.length).toBe(2)
  })
})

describe('落地：消息 → 气泡 → 落盘', () => {
  it('useChatEngine 把标记写到消息上', () => {
    expect(read('composables/useChatEngine.js')).toContain('safeUpdate({ _truncated: result.truncated === true })')
  })

  it('落盘白名单含 _truncated（重启后还看得见）', () => {
    expect(read('store/chat/persist.js')).toContain('if (m._truncated) item._truncated = true')
  })

  it('气泡给提示 + 「继续写完」入口，样式在 scss 里', () => {
    const vue = read('components/chat/MessageBubble.vue')
    expect(vue).toContain("'continue-write'")
    expect(vue).toContain('已达输出上限，回复被截断')
    expect(vue).toContain('继续写完')
    expect(vue).toContain("props.message._truncated === true")
    expect(read('components/chat/MessageBubble.scss')).toContain('.bubble-truncated')
  })

  it('聊天页接住事件，续写指令要求不重复已写内容', () => {
    const s = read('pages/chat/index.vue')
    expect(s).toContain('@continue-write="handleContinueWrite"')
    expect(s).toContain('function handleContinueWrite(msg)')
    expect(s).toContain('不要重复已经写过的内容')
  })
})
