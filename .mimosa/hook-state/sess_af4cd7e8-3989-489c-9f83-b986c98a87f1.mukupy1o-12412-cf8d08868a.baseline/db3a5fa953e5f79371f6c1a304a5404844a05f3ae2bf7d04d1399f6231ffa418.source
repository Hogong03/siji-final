/**
 * 执行卡片负载压缩（3.6.2）
 *
 * 反馈 2026-09-15：一条联网搜索把 5 篇正文整段写进 actionCard / execResult / execResults，
 * 会话落盘放大三份，导出的开发者反馈里也整段是网页正文（一次导出 5.8KB）。
 */
import { describe, it, expect } from 'vitest'
import './setup.js'
import { compactExecDetail, execCardText, isHeavyTool, EXEC_TITLE_LIMIT } from '../utils/ai/exec-payload.js'
import { autoExecuteAndDisplay } from '../utils/ai/autoExecutor.js'
import { canOpenType } from '../composables/useChatNavigation.js'

const ARTICLES = Array.from({ length: 5 }, (_, i) => ({
  title: '新闻标题 ' + i,
  link: 'https://news.example.com/' + i,
  content: '正文'.repeat(400),
  publish_date: '2026-09-10'
}))

describe('compactExecDetail：搜索 / 读网页只留摘要', () => {
  it('搜索结果压成条数 + 前几条标题，正文不再落盘', () => {
    const d = compactExecDetail('web_search', ARTICLES)
    expect(d.type).toBe('web_search')
    expect(d.count).toBe(5)
    expect(d.results).toHaveLength(EXEC_TITLE_LIMIT)
    expect(d.results[0].title).toBe('新闻标题 0')
    expect(JSON.stringify(d)).not.toContain('正文正文')
    expect(JSON.stringify(d).length).toBeLessThan(JSON.stringify(ARTICLES).length / 10)
  })

  it('读网页留下域名与字数', () => {
    const d = compactExecDetail('read_url', { url: 'https://a.com/x', host: 'a.com', title: '一篇文章', length: 3200, truncated: true })
    expect(d).toEqual({ type: 'read_url', url: 'https://a.com/x', host: 'a.com', title: '一篇文章', length: 3200, truncated: true })
  })

  it('其它工具的负载原样返回（账单 / 记录卡片不受影响）', () => {
    const detail = { type: 'bill', amount: 35, category: '餐饮' }
    expect(compactExecDetail('create_bill', detail)).toBe(detail)
    expect(isHeavyTool('create_bill')).toBe(false)
    expect(isHeavyTool('web_search')).toBe(true)
    expect(isHeavyTool('read_url')).toBe(true)
  })
})

describe('execCardText：卡片上那一行', () => {
  it('搜索给条数，读网页给域名与字数', () => {
    expect(execCardText({ type: 'web_search', count: 5 })).toBe('已联网搜索 · 5 条结果')
    expect(execCardText({ type: 'web_search', count: 0 })).toContain('没有结果')
    expect(execCardText({ type: 'read_url', host: 'a.com', length: 3200 })).toBe('已读取网页 · a.com（3200 字）')
    expect(execCardText({ type: 'read_url', host: 'a.com', length: 3200, truncated: true })).toContain('已截断')
  })

  it('其它类型不给文案（卡片走原来的分支）', () => {
    expect(execCardText({ type: 'bill', amount: 1 })).toBe('')
    expect(execCardText(null)).toBe('')
  })
})

describe('agent 路径：卡片与落盘用摘要，不给整包结果', () => {
  it('web_search 写进消息的是压缩后的负载', () => {
    let captured = null
    const store = { updateLastMessage(partial) { captured = partial } }
    const result = { _agentMode: true, execResults: [{ name: 'web_search', ok: true, message: '搜索结果：…', detail: ARTICLES }] }
    autoExecuteAndDisplay(store, result, '搜到了', '搜一下', { source: 'agent' })
    expect(captured.actionCard.type).toBe('web_search')
    expect(captured.actionCard.payload.count).toBe(5)
    expect(captured.execResult.detail.count).toBe(5)
    expect(captured.execResults[0].detail.count).toBe(5)
    expect(JSON.stringify(captured)).not.toContain('正文正文')
  })

  it('写操作卡片不受影响（账单明细原样落盘）', () => {
    let captured = null
    const store = { updateLastMessage(partial) { captured = partial } }
    const detail = { type: 'bill', id: 'bill_1', amount: 35, category: '餐饮' }
    const result = { _agentMode: true, execResults: [{ name: 'create_bill', ok: true, message: '已记账 ¥35 餐饮', detail: detail }] }
    autoExecuteAndDisplay(store, result, '记好了', '记一笔 35', { source: 'agent' })
    expect(captured.execResult.detail).toEqual(detail)
    expect(captured.execResults[0].detail.amount).toBe(35)
  })
})

describe('canOpenType：没有页面的类型不给死按钮', () => {
  it('有页面的类型返回 true，搜索 / 读网页返回 false', () => {
    expect(canOpenType('create_diary')).toBe(true)
    expect(canOpenType('create_plan')).toBe(true)
    expect(canOpenType('create_web_search')).toBe(false)
    expect(canOpenType('read_url')).toBe(false)
    expect(canOpenType('')).toBe(false)
  })
})