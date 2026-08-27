/**
 * test: 开发者反馈导出工具（utils/dev-feedback.js）
 * 覆盖：消息清洗（base64 剔除 / 流式帧丢弃 / 截断）、收集上限、
 * Markdown / JSON 反馈文本结构、会话摘要
 */
import { describe, it, expect } from 'vitest'
import {
  sanitizeMessage,
  collectMessages,
  summarizeConversation,
  buildDevFeedbackMarkdown,
  buildDevFeedbackJson
} from '../utils/dev-feedback.js'

// ─── fixtures ───
function makeConv(overrides = {}) {
  return Object.assign({
    id: 'conv-1',
    title: '测试对话',
    createdAt: 1725000000000,
    updatedAt: 1725000600000,
    messages: [
      { role: 'user', content: '帮我记一笔账' },
      {
        role: 'assistant',
        content: '',
        aiReply: '好的，已记录 50 元餐饮支出',
        actionCard: { action: 'create_bill', args: { amount: 50 } },
        execResult: { ok: true, id: 'bill-1' }
      },
      { role: 'user', content: '图片消息', image: { base64: 'data:image/png;base64,AAAA' } }
    ]
  }, overrides)
}

describe('sanitizeMessage', () => {
  it('剔除图片 base64，仅保留标注', () => {
    const out = sanitizeMessage({ role: 'user', content: '看这张图', image: { base64: 'data:image/png;base64,xxx' } })
    expect(out.image).toEqual({ note: '（含图片，已省略）' })
    expect(JSON.stringify(out)).not.toContain('base64')
  })

  it('本地图片路径同样只保留标注', () => {
    const out = sanitizeMessage({ role: 'user', content: '图', image: { localPath: '/doc/a.png' } })
    expect(out.image).toEqual({ note: '（含图片）' })
  })

  it('丢弃未完成的流式中间帧', () => {
    expect(sanitizeMessage({ role: 'assistant', loading: true, content: '正在思考…' })).toBeNull()
    expect(sanitizeMessage({ role: 'assistant', loading: true, aiReply: '已完成', content: '' })).not.toBeNull()
  })

  it('超长内容截断', () => {
    const long = 'a'.repeat(30000)
    const out = sanitizeMessage({ role: 'user', content: long })
    expect(out.content.length).toBeLessThan(21000)
    expect(out.content).toContain('已截断')
  })

  it('空消息返回 null，非字符串内容序列化', () => {
    expect(sanitizeMessage(null)).toBeNull()
    const out = sanitizeMessage({ role: 'user', content: { text: '结构化' } })
    expect(out.content).toContain('结构化')
  })
  it('aiReply 与 content 相同时不重复导出', () => {
    const out = sanitizeMessage({ role: 'assistant', content: '好的，已记录', aiReply: '好的，已记录' })
    expect(out.aiReply).toBeUndefined()
  })

  it('content 以 aiReply 开头时不重复导出', () => {
    const out = sanitizeMessage({ role: 'assistant', content: '好的，已记录

计划已创建', aiReply: '好的，已记录' })
    expect(out.aiReply).toBeUndefined()
  })

  it('aiReply 与 content 不同时保留', () => {
    const out = sanitizeMessage({ role: 'assistant', content: '', aiReply: '好的，已记录 50 元餐饮支出' })
    expect(out.aiReply).toBe('好的，已记录 50 元餐饮支出')
  })
})

describe('collectMessages', () => {
  it('过滤无效消息并按上限截取最近消息', () => {
    const conv = makeConv()
    conv.messages.push({ role: 'assistant', loading: true })
    const list = collectMessages(conv, 2)
    expect(list).toHaveLength(2)
    expect(list[0].role).toBe('assistant')
    expect(list[1].content).toBe('图片消息')
  })

  it('上限为 1 时只保留最后一条有效消息', () => {
    const conv = makeConv()
    const list = collectMessages(conv, 1)
    expect(list).toHaveLength(1)
    expect(list[0].content).toBe('图片消息')
  })

  it('无 messages 字段返回空数组', () => {
    expect(collectMessages({})).toEqual([])
  })
})

describe('summarizeConversation', () => {
  it('输出标题与消息数', () => {
    const s = summarizeConversation(makeConv())
    expect(s.title).toBe('测试对话')
    expect(s.messageCount).toBe(3)
    expect(s.id).toBe('conv-1')
  })
})

describe('buildDevFeedbackMarkdown', () => {
  it('包含头部元信息与会话内容', () => {
    const text = buildDevFeedbackMarkdown([makeConv()], {
      meta: { appVersion: 'v2.2.0', platform: 'android', deviceModel: 'Xiaomi 14' }
    })
    expect(text).toContain('# 思迹开发者反馈（聊天记录）')
    expect(text).toContain('- 应用版本: v2.2.0')
    expect(text).toContain('- 平台: android')
    expect(text).toContain('## 会话 1：测试对话')
    expect(text).toContain('帮我记一笔账')
    expect(text).toContain('**执行动作**')
    expect(text).toContain('（含图片，已省略）')
  })

  it('includeActions=false 时不包含执行动作', () => {
    const text = buildDevFeedbackMarkdown([makeConv()], { includeActions: false })
    expect(text).not.toContain('**执行动作**')
    expect(text).not.toContain('**执行结果**')
  })

  it('空会话列表输出占位说明', () => {
    const text = buildDevFeedbackMarkdown([], {})
    expect(text).toContain('没有可导出的会话')
  })
})

describe('buildDevFeedbackJson', () => {
  it('输出合法 JSON 结构且统计正确', () => {
    const convs = [makeConv(), makeConv({ id: 'conv-2', title: '第二会话' })]
    const json = buildDevFeedbackJson(convs, { meta: { platform: 'ios' } })
    const payload = JSON.parse(json)
    expect(payload.type).toBe('siji_dev_feedback')
    expect(payload.meta.conversationCount).toBe(2)
    expect(payload.meta.messageCount).toBe(6)
    expect(payload.meta.platform).toBe('ios')
    expect(payload.conversations).toHaveLength(2)
    expect(payload.conversations[1].title).toBe('第二会话')
  })

  it('includeActions=false 时消息不含执行动作字段', () => {
    const json = buildDevFeedbackJson([makeConv()], { includeActions: false })
    const payload = JSON.parse(json)
    const msgs = payload.conversations[0].messages
    const assistantMsg = msgs.find(m => m.role === 'assistant')
    expect(assistantMsg.actionCard).toBeUndefined()
    expect(assistantMsg.execResult).toBeUndefined()
  })
})
