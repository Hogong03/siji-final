/**
 * prompt-builder 核心测试 — 系统提示词构建 / 缓存失效 / 画像 / 扩展检测 / 闲聊判定
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  buildSystemPrompt,
  bumpDataVersion,
  invalidatePromptCache,
  checkExtensionData,
  getUserProfile,
  getTopCategory,
  isLiteChatMode
} from '../utils/ai/prompt-builder.js'
import { resetStorage } from './setup.js'

beforeEach(() => {
  resetStorage()
  invalidatePromptCache()
})

describe('buildSystemPrompt', () => {
  it('包含身份行、日期与输出规范', () => {
    const p = buildSystemPrompt(true)
    expect(p).toContain('你是「思迹」')
    expect(p).toContain('当前时间:')
    expect(p).toContain('## 输出格式')
    expect(p).toContain('## 核心铁律')
    expect(p).toContain('## 行为准则')
  })

  it('无扩展数据时只注入基础 action 说明', () => {
    const p = buildSystemPrompt(true)
    expect(p).toContain('create_relation')
    expect(p).not.toContain('update_relation: {id')
    expect(p).not.toContain('log_interaction: {relation_id') // 无关系数据时不注入 log_interaction 工具 schema
  })

  it('有关系数据时注入完整关系图谱 action', () => {
    uni.setStorageSync('siji_relations', JSON.stringify([{ id: 'r1', name: '张三', is_deleted: 0 }]))
    const p = buildSystemPrompt(true)
    expect(p).toContain('update_relation: {id')
    expect(p).toContain('log_interaction')
  })

  it('lite 模式使用精简 schema', () => {
    const full = buildSystemPrompt(true)
    const lite = buildSystemPrompt(true, { lite: true })
    expect(lite).toContain('create_bill')
    expect(lite.length).toBeLessThan(full.length)
  })

  it('agentMode 跳过身份行（保留 Agent 人设接管）', () => {
    const p = buildSystemPrompt(true, { agentMode: true })
    expect(p).not.toContain('你是「思迹」')
    expect(p).toContain('## 输出格式')
  })

  it('invalidatePromptCache 后重建并反映新数据', () => {
    const p1 = buildSystemPrompt()
    expect(p1).not.toContain('update_relation: {id')
    // 写入关系数据 → 失效缓存 → 重建后应包含扩展 action
    uni.setStorageSync('siji_relations', JSON.stringify([{ id: 'r1', name: '张三', is_deleted: 0 }]))
    invalidatePromptCache()
    const p3 = buildSystemPrompt()
    expect(p3).toContain('update_relation: {id')
  })
})

describe('画像与数据版本', () => {
  it('bumpDataVersion 后画像重建并反映新数据', () => {
    const u1 = getUserProfile(true)
    expect(u1).not.toBeNull()
    expect(u1).toContain('记录0篇')
    const now = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    uni.setStorageSync(`diary_${month}`, JSON.stringify([
      { title: '新记录', content: 'x', is_deleted: 0 }
    ]))
    bumpDataVersion()
    const u2 = getUserProfile()
    expect(u2).toContain('记录1篇')
    expect(u2).toContain('新记录')
  })

  it('画像包含月度概览与正确统计', () => {
    const now = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    uni.setStorageSync(`bill_${month}`, JSON.stringify([
      { type: 'expense', amount: 100, category: '餐饮', is_deleted: 0 },
      { type: 'expense', amount: 50, category: '餐饮', is_deleted: 0 },
      { type: 'income', amount: 1000, category: '工资', is_deleted: 0 },
      { type: 'expense', amount: 9999, category: '已删', is_deleted: 1 }
    ]))
    uni.setStorageSync(`diary_${month}`, JSON.stringify([
      { title: '测试记录', content: '内容', is_deleted: 0 }
    ]))
    const p = getUserProfile(true)
    expect(p).toContain('【月度概览】')
    expect(p).toContain('本月支出 ¥150')
    expect(p).toContain('收入 ¥1000')
    expect(p).toContain('餐饮')
    expect(p).toContain('记录1篇')
    expect(p).toContain('测试记录')
  })
})

describe('扩展检测与工具函数', () => {
  it('checkExtensionData 检测关系/决策/模拟数据', () => {
    expect(checkExtensionData()).toEqual({ hasRelations: false, hasDecisions: false, hasSimulations: false })
    uni.setStorageSync('siji_relations', JSON.stringify([{ id: 'r1', is_deleted: 0 }]))
    uni.setStorageSync('siji_decisions', JSON.stringify([{ id: 'd1', is_deleted: 0 }]))
    uni.setStorageSync('siji_simulations', JSON.stringify([{ id: 's1', is_deleted: 0 }]))
    expect(checkExtensionData()).toEqual({ hasRelations: true, hasDecisions: true, hasSimulations: true })
  })

  it('getTopCategory 返回金额最高分类', () => {
    expect(getTopCategory([])).toBe('无')
    const bills = [
      { category: '餐饮', amount: 30 },
      { category: '交通', amount: 80 },
      { category: '餐饮', amount: 70 }
    ]
    expect(getTopCategory(bills)).toBe('餐饮')
  })

  it('isLiteChatMode 判定闲聊与指令', () => {
    expect(isLiteChatMode('今天天气不错')).toBe(true)
    expect(isLiteChatMode('帮我记一下今天花了25块')).toBe(false)
    expect(isLiteChatMode('')).toBe(true)
  })
})
