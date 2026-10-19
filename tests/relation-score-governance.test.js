/**
 * test: 亲密度（relationship_score）语义治理（4.38.0）
 *
 * 背景：审查发现分数有 6 条写入通道，其中 AI 可自填（create_relation schema）与可覆盖
 * （update_relation 白名单），且写进去的数还会被注入回提示词当事实读、并决定情景模拟人设。
 *
 * 本轮规则（不动存储结构）：
 *  - AI 建卡传 relationship_score → 忽略，落默认值
 *  - AI 普通更新传 relationship_score → 剥离该字段，其余合法字段照常更新
 *  - 用户手动评分（UI 滑块）→ 唯一合法写入路径（utils 层 trustScore 显式授权）
 *  - 单次互动/情绪 → 永不自动改分
 *  - 现存分数来源未必可追溯，AI 不得声称是用户评价
 *
 * 关键：约束落在**执行层**（utils 默认拒绝），不是只靠提示词。因此「绕过提示词直接调执行器」
 * 也写不进去 —— 见「执行层兜底」一组。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import './setup.js'
import { resetStorage } from './setup.js'
import { setActivePinia, createPinia } from 'pinia'
import { useDataStore } from '../store/data.js'
import {
  createRelation,
  updateRelation,
  getRelationById,
  logInteraction,
  buildRelationsContext,
  getAllRelations
} from '../utils/relations.js'
import { buildSystemPrompt, invalidatePromptCache } from '../utils/ai/prompt-builder.js'
import { BEHAVIOR_RULES } from '../utils/ai/prompt-actions.js'

let store

beforeEach(() => {
  resetStorage()
  setActivePinia(createPinia())
  store = useDataStore()
})

/** 走 UI 手动路径建卡（trustScore 授权） */
function addManual(name, score) {
  return createRelation({ name, role: '朋友', relationship_score: score }, { trustScore: true })
}

describe('AI 建卡：不采信模型自填的分数', () => {
  it('create_relation 传了 relationship_score → 落默认值，并回报未采信', () => {
    const r = store.executeAction({
      type: 'create_relation',
      payload: { name: '阿伟', role: '朋友', relationship_score: 9 }
    })
    expect(r.success).toBe(true)
    expect(r.detail.relationship_score).toBe(5) // 默认值，不是 9
    expect(r.detail.score_blocked).toBe(true)
    expect(r.message).toContain('未采信')
    expect(getRelationById(r.detail.id).relationship_score).toBe(5)
  })

  it('create_relation 不传分数 → 默认值 5，行为不变', () => {
    const r = store.executeAction({ type: 'create_relation', payload: { name: '小明', role: '同事' } })
    expect(r.success).toBe(true)
    expect(r.detail.relationship_score).toBe(5)
    expect(r.detail.score_blocked).toBe(false)
  })
})

describe('AI 更新：分数被剥离，其余字段照常', () => {
  it('只请求改亲密度 → 拒绝且不改库', () => {
    const a = addManual('阿伟', 6)
    const r = store.executeAction({ type: 'update_relation', payload: { id: a.id, relationship_score: 9 } })
    expect(r.success).toBe(false)
    expect(r.detail.score_blocked).toBe(true)
    expect(getRelationById(a.id).relationship_score).toBe(6)
  })

  it('同时传 notes 与 relationship_score → 备注更新成功、分数不变（额外验收 1）', () => {
    const a = addManual('阿伟', 6)
    const r = store.executeAction({
      type: 'update_relation',
      payload: { id: a.id, notes: '最近在换工作', relationship_score: 9 }
    })
    expect(r.success).toBe(true)
    expect(r.detail.score_blocked).toBe(true)
    expect(r.detail.updated_fields).toEqual(['notes']) // 分数不在已应用字段里
    const after = getRelationById(a.id)
    expect(after.notes).toBe('最近在换工作')
    expect(after.relationship_score).toBe(6) // 关键：分数没被改
  })

  it('不传分数的普通更新 → 完全不受影响', () => {
    const a = addManual('阿伟', 6)
    const r = store.executeAction({ type: 'update_relation', payload: { id: a.id, context: '产品部' } })
    expect(r.success).toBe(true)
    expect(r.detail.score_blocked).toBe(false)
    expect(getRelationById(a.id).context).toBe('产品部')
    expect(getRelationById(a.id).relationship_score).toBe(6)
  })
})

describe('执行层兜底：绕过提示词也写不进（额外验收 2）', () => {
  it('直接调 utils.createRelation 不带 trustScore → 分数被忽略', () => {
    const r = createRelation({ name: '绕过者', role: '朋友', relationship_score: 10 })
    expect(r.relationship_score).toBe(5)
  })

  it('直接调 utils.updateRelation 不带 trustScore → 分数被忽略，其他字段仍写', () => {
    const a = addManual('阿伟', 6)
    const ok = updateRelation(a.id, { relationship_score: 10, notes: '备注照写' })
    expect(ok).toBe(true)
    const after = getRelationById(a.id)
    expect(after.relationship_score).toBe(6)
    expect(after.notes).toBe('备注照写')
  })

  it('执行器 update_relation 即使带 relation_id 别名也写不进分数', () => {
    const a = addManual('阿伟', 6)
    store.executeAction({ type: 'update_relation', payload: { relation_id: a.id, relationship_score: 1 } })
    expect(getRelationById(a.id).relationship_score).toBe(6)
  })

  it('AI 也改不到 last_interaction（系统记账字段，执行器白名单外）', () => {
    const a = addManual('阿伟', 6)
    store.executeAction({ type: 'update_relation', payload: { id: a.id, last_interaction: 1234567890 } })
    expect(getRelationById(a.id).last_interaction).toBe('')
  })
})

describe('用户手动路径：唯一合法写入', () => {
  it('UI 建卡（trustScore）→ 用户给的分数生效', () => {
    const a = addManual('阿伟', 8)
    expect(a.relationship_score).toBe(8)
  })

  it('UI 编辑（trustScore）→ 用户改分生效', () => {
    const a = addManual('阿伟', 8)
    updateRelation(a.id, { relationship_score: 3 }, { trustScore: true })
    expect(getRelationById(a.id).relationship_score).toBe(3)
  })
})

describe('单次互动不改分（钉死无自动推导）', () => {
  it('记录一次带情绪的互动后，分数保持不变', () => {
    const a = addManual('阿伟', 6)
    logInteraction({ relation_id: a.id, relation_name: '阿伟', scene: '午餐', content: '聊得很开心', emotion: '开心' })
    logInteraction({ relation_id: a.id, relation_name: '阿伟', scene: '争执', content: '吵了一架', emotion: '生气' })
    const after = getRelationById(a.id)
    expect(after.relationship_score).toBe(6)
    // 互动本身要正常落库（不改分不等于不改 last_interaction）
    expect(after.last_interaction).toBeTruthy()
  })
})

describe('提示词层：AI 看不到评分能力，且被告知分数来源不可追溯', () => {
  it('系统提示词（有数据分支）不再出现 relationship_score', () => {
    addManual('阿伟', 6)
    invalidatePromptCache()
    const p = buildSystemPrompt(false)
    expect(p).toContain('关系图谱:')
    expect(p).toContain('create_relation')
    expect(p).not.toContain('relationship_score')
  })

  it('关系上下文标注分数来源未必可追溯', () => {
    addManual('阿伟', 6)
    const ctx = buildRelationsContext('今天和阿伟吃了午饭')
    expect(ctx).toContain('阿伟')
    expect(ctx).toContain('来源未必可追溯')
  })

  it('行为准则含「不得改分 + 引导用户自己调整」规则', () => {
    const rule = BEHAVIOR_RULES.find(r => r.includes('亲密度'))
    expect(rule).toBeTruthy()
    expect(rule).toContain('禁止')
    expect(rule).toContain('滑块')
  })

  it('行为准则含「不得把现存分数说成用户评价」规则', () => {
    const rule = BEHAVIOR_RULES.find(r => r.includes('来源未必可追溯'))
    expect(rule).toBeTruthy()
    expect(rule).toContain('禁止据此断言')
  })
})

describe('回归：其他关系功能不受影响', () => {
  it('增删改查与软删除照常', () => {
    const a = addManual('阿伟', 7)
    expect(getAllRelations().length).toBe(1)
    store.executeAction({ type: 'update_relation', payload: { id: a.id, role: '同事' } })
    expect(getRelationById(a.id).role).toBe('同事')
    store.executeAction({ type: 'delete_relation', payload: { id: a.id } })
    expect(getAllRelations().length).toBe(0)
  })
})
