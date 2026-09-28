import { describe, it, expect, beforeEach } from 'vitest'
import './setup.js'
import {
  extractStructuredMemory, getStructuredMemory, upsertEntity, upsertRelation,
  addStructuredEvent, buildStructuredMemoryContext, getStructuredMemoryStats,
  clearStructuredMemory
} from '@/utils/memory-structured.js'

describe('memory-structured.js（E1 结构化记忆）', () => {
  beforeEach(() => { global.uni.clearStorageSync?.() })

  it('提取人物实体：我叫/我是', () => {
    extractStructuredMemory('我叫小明，今天很开心', '')
    const data = getStructuredMemory()
    const found = data.entities.find(e => e.name === '小明' && e.type === 'person')
    expect(found).toBeTruthy()
  })

  it('提取关系三元组：张三是我的同事', () => {
    extractStructuredMemory('张三是我的同事，我们一起做项目', '')
    const data = getStructuredMemory()
    expect(data.relations.some(r => r.subject === '张三' && r.relation === '同事' && r.object === '我')).toBe(true)
    expect(data.entities.some(e => e.name === '张三' && e.type === 'person')).toBe(true)
  })

  it('代词误匹配防护："这是我男朋友" 不提取"这是"', () => {
    extractStructuredMemory('这是我男朋友', '')
    const data = getStructuredMemory()
    expect(data.relations.some(r => r.subject === '这是')).toBe(false)
  })

  it('提取重要事件：下个月5号搬家', () => {
    extractStructuredMemory('我下个月5号要搬家', '')
    const data = getStructuredMemory()
    expect(data.events.length).toBeGreaterThan(0)
    const evt = data.events.find(e => e.title.includes('搬家'))
    expect(evt).toBeTruthy()
    expect(evt.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('去重合并：同名同类型实体只保留一条，attrs 合并', () => {
    upsertEntity('咖啡', 'thing', { preference: '喜欢' })
    upsertEntity('咖啡', 'thing', { frequency: '每天' })
    const data = getStructuredMemory()
    const list = data.entities.filter(e => e.name === '咖啡' && e.type === 'thing')
    expect(list.length).toBe(1)
    expect(list[0].attrs.preference).toBe('喜欢')
    expect(list[0].attrs.frequency).toBe('每天')
  })

  it('upsertRelation 三元组去重', () => {
    upsertRelation('张三', '同事', '我')
    upsertRelation('张三', '同事', '我')
    upsertRelation('张三', '朋友', '我')
    const data = getStructuredMemory()
    expect(data.relations.filter(r => r.subject === '张三').length).toBe(2)
  })

  it('addStructuredEvent 标题去重', () => {
    addStructuredEvent('下周五面试', '2026-09-01', [])
    addStructuredEvent('下周五面试', '', [])
    expect(getStructuredMemory().events.length).toBe(1)
  })

  it('buildStructuredMemoryContext 输出结构化文本（空时返回空串）', () => {
    expect(buildStructuredMemoryContext()).toBe('')
    extractStructuredMemory('张三是我的同事', '')
    const ctx = buildStructuredMemoryContext()
    expect(ctx).toContain('【关系】')
    expect(ctx).toContain('张三')
  })

  it('getStructuredMemoryStats / clearStructuredMemory', () => {
    upsertEntity('测试实体', 'person', {})
    expect(getStructuredMemoryStats().entities).toBe(1)
    clearStructuredMemory()
    expect(getStructuredMemoryStats().entities).toBe(0)
  })
})