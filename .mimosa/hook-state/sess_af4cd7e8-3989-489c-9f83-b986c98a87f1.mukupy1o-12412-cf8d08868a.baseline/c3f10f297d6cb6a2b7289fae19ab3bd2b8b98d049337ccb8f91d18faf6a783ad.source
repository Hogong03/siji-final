/**
 * M3 旧话检索测试（3.2 升级方案 4.4）
 * 覆盖：标题/用户消息/AI 回复加权命中、标签过滤、snippet 截取、
 *       无结果/空关键词、limit 截断、executeTool 直调格式化
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import './setup.js'
import { searchConversations } from '../utils/chat-search.js'
import { executeTool } from '../utils/ai/tools.js'

const DAY = 24 * 60 * 60 * 1000
const BASE = Date.UTC(2026, 8, 1) // 2026-09-01

function seed(convs) {
  global.uni.setStorageSync('siji_conversations', JSON.stringify(convs))
}

function conv(id, title, updatedAt, messages, tags = []) {
  return { id, title, createdAt: updatedAt, updatedAt, messages, tags }
}

beforeEach(() => {
  global.uni.clearStorageSync()
})

describe('searchConversations 检索', () => {
  it('关键词命中用户消息：返回会话与摘录', () => {
    seed([
      conv('c1', '健康闲聊', BASE, [
        { role: 'user', content: '我是不是应该戒糖，最近胖了不少' },
        { role: 'assistant', aiReply: '可以试试从少喝奶茶开始' }
      ]),
      conv('c2', '闲聊', BASE + DAY, [
        { role: 'user', content: '今天天气不错' }
      ])
    ])
    const hits = searchConversations('戒糖')
    expect(hits).toHaveLength(1)
    expect(hits[0].convId).toBe('c1')
    expect(hits[0].convTitle).toBe('健康闲聊')
    expect(hits[0].role).toBe('user')
    expect(hits[0].snippet).toContain('戒糖')
    expect(hits[0].dateText).toBe('9月1日')
  })

  it('AI 回复内容可命中（aiReply 字段）', () => {
    seed([
      conv('c1', '闲聊', BASE, [
        { role: 'user', content: '最近有点焦虑' },
        { role: 'assistant', aiReply: '建议你试试每天出门散步半小时' }
      ])
    ])
    const hits = searchConversations('散步')
    expect(hits).toHaveLength(1)
    expect(hits[0].role).toBe('assistant')
    expect(hits[0].snippet).toContain('散步')
  })

  it('标题命中返回 title 角色；新会话排在前面', () => {
    seed([
      conv('c1', '奶茶食谱研究', BASE, [], []),
      conv('c2', '新对话2', BASE + 2 * DAY, [
        { role: 'user', content: '记一下奶茶的做法' }
      ])
    ])
    const hits = searchConversations('食谱')
    expect(hits).toHaveLength(1)
    expect(hits[0].convId).toBe('c1')
    expect(hits[0].role).toBe('title')
  })

  it('标签过滤生效；多命中按 updatedAt 倒序且 limit 生效', () => {
    seed([
      conv('c1', '健康讨论', BASE, [{ role: 'user', content: '想聊聊戒糖' }], ['健康']),
      conv('c2', '职场话题', BASE + DAY, [{ role: 'user', content: '想聊聊戒糖吗' }], ['工作']),
      conv('c3', '咖啡闲聊', BASE + 3 * DAY, [{ role: 'user', content: '戒糖不如戒咖啡' }], ['生活'])
    ])
    const tagged = searchConversations('戒糖', { tag: '健康' })
    expect(tagged.map(h => h.convId)).toEqual(['c1'])
    const noTag = searchConversations('戒糖', { tag: '不存在的标签' })
    expect(noTag).toEqual([])
    const limited = searchConversations('戒糖', { limit: 2 })
    expect(limited).toHaveLength(2)
    expect(limited.map(h => h.convId)).toEqual(['c3', 'c2'])
  })

  it('无结果返回空数组；空关键词返回空数组', () => {
    seed([conv('c1', '闲聊', BASE, [{ role: 'user', content: '你好' }])])
    expect(searchConversations('完全不存在的内容')).toEqual([])
    expect(searchConversations('')).toEqual([])
    expect(searchConversations('   ')).toEqual([])
  })

  it('存量会话（无 tags/无 updatedAt）不报错且可检', () => {
    seed([
      { id: 'legacy', title: '老对话', messages: [{ role: 'user', content: '记得要早睡' }] }
    ])
    const hits = searchConversations('早睡')
    expect(hits).toHaveLength(1)
    expect(hits[0].convId).toBe('legacy')
  })
})

describe('query_conversations 工具执行（executor 直调）', () => {
  it('命中时返回格式化文本与 detail.hits；未命中返回友好文案', () => {
    seed([
      conv('c1', '戒糖计划', BASE, [
        { role: 'user', content: '我上次说要戒糖来着' }
      ])
    ])
    const store = { executeAction: vi.fn() }
    const hit = executeTool(store, 'query_conversations', { keyword: '戒糖' })
    expect(hit.ok).toBe(true)
    expect(hit.text).toContain('找到 1 条相关会话')
    expect(hit.text).toContain('「戒糖计划」')
    expect(hit.text).toContain('戒糖')
    expect(hit.detail.hits).toHaveLength(1)
    expect(store.executeAction).not.toHaveBeenCalled()

    const miss = executeTool(store, 'query_conversations', { keyword: '从没说过的话' })
    expect(miss.ok).toBe(true)
    expect(miss.text).toContain('没有在历史对话中找到')
    expect(miss.detail.hits).toEqual([])
  })
})
