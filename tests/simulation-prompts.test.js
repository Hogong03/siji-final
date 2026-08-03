import { describe, it, expect } from 'vitest'
import './setup.js'
import { generateSimulationPrompt, generatePlanningPrompt, generateRelationshipPrompt, generateSimPromptByMode } from '@/utils/simulation-prompts.js'

describe('simulation-prompts.js', () => {
  const mockRelation = {
    name: '张三',
    role: '同事',
    traits: ['强势', '直来直去'],
    preferences: ['数据驱动', '不喜欢绕弯子'],
    relationship_score: 5,
    context: '技术部同事',
    notes: '对代码质量要求高'
  }

  it('generateSimulationPrompt 应包含角色信息', () => {
    const prompt = generateSimulationPrompt(mockRelation, '年终绩效面谈', '争取加薪')
    expect(prompt).toContain('张三')
    expect(prompt).toContain('同事')
    expect(prompt).toContain('强势')
    expect(prompt).toContain('数据驱动')
    expect(prompt).toContain('年终绩效面谈')
    expect(prompt).toContain('争取加薪')
  })

  it('generateSimulationPrompt 应根据关系分数设定态度', () => {
    const highScore = { ...mockRelation, relationship_score: 9 }
    const prompt = generateSimulationPrompt(highScore, '日常对话', '')
    expect(prompt).toContain('友善')

    const lowScore = { ...mockRelation, relationship_score: 2 }
    const promptLow = generateSimulationPrompt(lowScore, '日常对话', '')
    expect(promptLow).toContain('冷淡')
  })

  it('generateSimulationPrompt 应包含复盘报告格式', () => {
    const prompt = generateSimulationPrompt(mockRelation, '', '')
    expect(prompt).toContain('复盘')
    expect(prompt).toContain('自信度')
    expect(prompt).toContain('共情力')
  })

  it('generatePlanningPrompt 应包含规划师角色', () => {
    const prompt = generatePlanningPrompt('3个月减重10斤', '制定可执行计划')
    expect(prompt).toContain('规划师')
    expect(prompt).toContain('SMART')
    expect(prompt).toContain('3个月减重10斤')
    expect(prompt).toContain('风险')
  })

  it('generateRelationshipPrompt 应包含冲突场景', () => {
    const prompt = generateRelationshipPrompt(mockRelation, '同事甩锅', '不伤和气地拒绝')
    expect(prompt).toContain('张三')
    expect(prompt).toContain('同事甩锅')
    expect(prompt).toContain('不伤和气地拒绝')
    expect(prompt).toContain('利益诉求')
  })

  it('generateSimPromptByMode 应按模式分发', () => {
    const socialPrompt = generateSimPromptByMode('social', { relation: mockRelation, scene: 'test', goal: 'goal' })
    expect(socialPrompt).toContain('社交模拟')

    const planningPrompt = generateSimPromptByMode('planning', { scene: 'test', goal: 'goal' })
    expect(planningPrompt).toContain('规划推演')

    const relPrompt = generateSimPromptByMode('relationship', { relation: mockRelation, scene: 'test', goal: 'goal' })
    expect(relPrompt).toContain('关系处理')
  })

  it('generateSimPromptByMode 默认应走 social 模式', () => {
    const prompt = generateSimPromptByMode('unknown', { relation: mockRelation, scene: 'test', goal: 'goal' })
    expect(prompt).toContain('社交模拟')
  })
})
