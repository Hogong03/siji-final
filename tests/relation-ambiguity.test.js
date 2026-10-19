/**
 * test: 人脉互动目标解析（4.37.0）
 *
 * 背景：旧实现 `log_interaction` 按姓名匹配后直接取 `matched[0]` —— 同名或模糊命中多人时
 * 会把一次真实互动记到错的人名下，污染后续画像/关系分析与 AI 建议，且用户不易察觉。
 *
 * 本轮规则（审查确认）：
 *  - 有效 relation_id 且人物存在 → 直接用（ID 优先）
 *  - 姓名精确匹配唯一 → 用该人
 *  - 姓名精确匹配同名多人 → 返回候选，不写
 *  - 姓名模糊匹配唯一 → 用该人（保持旧行为）
 *  - 姓名模糊匹配多人 → 返回候选，不写
 *  - 无匹配 → 不写，提示先建人物
 *  **绝不因为候选排在第一位就默认选中它。**
 *
 * 另外锁死：模糊候选只看姓名（不看 context/tags），软删除人物不会被选中；
 * 解析成功时 executeTool 把 relation_id 写回参数（确认卡与写入用同一个 ID）。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import './setup.js'
import { resetStorage } from './setup.js'
import { setActivePinia, createPinia } from 'pinia'
import { useDataStore } from '../store/data.js'
import {
  createRelation,
  deleteRelation,
  getAllRelations,
  findRelationsByExactName,
  findRelationCandidates,
  resolveInteractionTarget
} from '../utils/relations.js'
import { executeTool } from '../utils/ai/tools/executor.js'
import { getInteractions } from '../utils/relations.js'

let store

beforeEach(() => {
  resetStorage()
  setActivePinia(createPinia())
  store = useDataStore()
})

/** 建人物卡并返回 **落库后** 的 relation（createRelation 的返回值就是落库对象） */
function addPerson(name, extra = {}) {
  return createRelation({ name, role: extra.role || '朋友', context: extra.context || '', tags: extra.tags || [] })
}

/** 当前所有互动条数（软删过滤在 getAllInteractions 内做，这里直接用底层查询） */
function interactionCount(relationId) {
  return getInteractions(relationId).length
}

describe('resolveInteractionTarget：解析规则', () => {
  it('有效 relation_id 优先，且不依赖姓名', () => {
    const a = addPerson('阿伟')
    addPerson('阿伟') // 同名干扰
    const r = resolveInteractionTarget({ relationId: a.id, relationName: '完全不对的名字' })
    expect(r.status).toBe('resolved')
    expect(r.relation.id).toBe(a.id)
  })

  it('relation_id 失效（人物已删）且无同名 → none，不误配给同名的另一个人', () => {
    const a = addPerson('阿伟')
    deleteRelation(a.id)
    const r = resolveInteractionTarget({ relationId: a.id, relationName: '阿伟' })
    expect(r.status).toBe('none')
  })

  it('姓名精确唯一 → resolved', () => {
    const a = addPerson('阿伟')
    const r = resolveInteractionTarget({ relationName: '阿伟' })
    expect(r.status).toBe('resolved')
    expect(r.relation.id).toBe(a.id)
  })

  it('同名两人 → ambiguous，候选两人都在，且不替用户选', () => {
    const a = addPerson('阿伟', { role: '同事', context: '产品部' })
    const b = addPerson('阿伟', { role: '同学', context: '大学室友' })
    const r = resolveInteractionTarget({ relationName: '阿伟' })
    expect(r.status).toBe('ambiguous')
    expect(r.candidates.map(c => c.id).sort()).toEqual([a.id, b.id].sort())
    expect(r.relation).toBeUndefined()
  })

  it('模糊匹配唯一（姓名包含关键词）→ resolved，保持旧行为', () => {
    const a = addPerson('阿伟大')
    const r = resolveInteractionTarget({ relationName: '阿伟' }) // 2 字关键词，模糊命中一人
    expect(r.status).toBe('resolved')
    expect(r.relation.id).toBe(a.id)
  })

  it('模糊匹配多个 → ambiguous', () => {
    addPerson('王小明')
    addPerson('李小明')
    const r = resolveInteractionTarget({ relationName: '小明' })
    expect(r.status).toBe('ambiguous')
    expect(r.candidates.length).toBe(2)
  })
})

describe('匹配函数分工：精确 vs 模糊 vs 场景标签', () => {
  it('findRelationsByExactName 只认严格相等（不做包含匹配）', () => {
    addPerson('阿伟')
    expect(findRelationsByExactName('阿伟').length).toBe(1)
    expect(findRelationsByExactName('伟').length).toBe(0)
    expect(findRelationsByExactName(' 阿伟 ').length).toBe(1) // 去首尾空格
  })

  it('模糊候选只看姓名：场景/标签文本不算命中（避免场景词被当人名）', () => {
    addPerson('李白', { context: '午餐', tags: ['午餐', '饭搭子'] })
    // 场景词「午餐」不能被当成人物匹配
    expect(findRelationCandidates('午餐').length).toBe(0)
    expect(resolveInteractionTarget({ relationName: '午餐' }).status).toBe('none')
  })

  it('单字关键词不给模糊候选（噪声太大）', () => {
    addPerson('阿伟')
    expect(findRelationCandidates('伟').length).toBe(0)
    expect(findRelationCandidates('阿伟').length).toBe(1)
  })
})

describe('log_interaction：歧义不写入', () => {
  it('同名两人时按姓名记录 → 失败 + 候选，且双方都没有新增互动', () => {
    const a = addPerson('阿伟', { role: '同事' })
    const b = addPerson('阿伟', { role: '同学' })
    const r = store.executeAction({ type: 'log_interaction', payload: { relation_name: '阿伟', scene: '午餐', content: '吃了饭' } })

    expect(r.success).toBe(false)
    expect(r.needChoice).toBe(true)
    expect(r.detail.candidates.length).toBe(2)
    // 关键：一条都没写
    expect(interactionCount(a.id)).toBe(0)
    expect(interactionCount(b.id)).toBe(0)
  })

  it('模糊多候选同样不写入', () => {
    const a = addPerson('王小明')
    const b = addPerson('李小明')
    const r = store.executeAction({ type: 'log_interaction', payload: { relation_name: '小明', scene: '午餐', content: '吃了饭' } })
    expect(r.success).toBe(false)
    expect(r.needChoice).toBe(true)
    expect(interactionCount(a.id)).toBe(0)
    expect(interactionCount(b.id)).toBe(0)
  })

  it('无匹配 → 失败且提示关系卡片不存在，不产生孤立互动', () => {
    const r = store.executeAction({ type: 'log_interaction', payload: { relation_name: '不存在的人', scene: '日常', content: 'x' } })
    expect(r.success).toBe(false)
    expect(r.message).toContain('关系卡片不存在')
    expect(getAllRelations().length).toBe(0)
  })

  it('软删除的人物不会被候选或解析选中', () => {
    const dead = addPerson('阿伟')
    deleteRelation(dead.id)
    const r = resolveInteractionTarget({ relationName: '阿伟' })
    expect(r.status).toBe('none')
    expect(store.executeAction({ type: 'log_interaction', payload: { relation_name: '阿伟', scene: '日常', content: 'x' } }).success).toBe(false)
  })
})

describe('log_interaction：确认后按 relation_id 写入', () => {
  it('用户从候选里选定 → 用该 id 重调 → 互动落在正确的人名下', () => {
    const a = addPerson('阿伟', { role: '同事' })
    const b = addPerson('阿伟', { role: '同学' })

    // 第一次：歧义，拿到候选
    const first = store.executeAction({ type: 'log_interaction', payload: { relation_name: '阿伟', scene: '午餐', content: '和同事阿伟吃饭' } })
    const picked = first.detail.candidates.find(c => c.id === b.id)

    // 第二次：带 id 重调
    const second = store.executeAction({ type: 'log_interaction', payload: { relation_id: picked.id, scene: '午餐', content: '和同学阿伟吃饭' } })
    expect(second.success).toBe(true)
    expect(second.detail.relation_id).toBe(b.id)

    expect(interactionCount(b.id)).toBe(1)
    expect(interactionCount(a.id)).toBe(0) // 没有被顺手写到另一个同名的人
  })

  it('唯一同名（单人）仍然照旧成功写入（兼容旧行为）', () => {
    const a = addPerson('阿伟')
    const r = store.executeAction({ type: 'log_interaction', payload: { relation_name: '阿伟', scene: '午餐', content: '吃了饭' } })
    expect(r.success).toBe(true)
    expect(r.detail.relation_id).toBe(a.id)
    expect(interactionCount(a.id)).toBe(1)
  })
})

describe('executeTool：agent 路径的歧义与 ID 回写', () => {
  it('歧义 → ok:false、不给确认卡、文本里带候选 id', () => {
    const a = addPerson('阿伟', { role: '同事' })
    const b = addPerson('阿伟', { role: '同学' })
    const r = executeTool(store, 'log_interaction', { relation_name: '阿伟', scene: '午餐', content: '吃了饭' })

    expect(r.ok).toBe(false)
    expect(r.confirm).toBeFalsy()
    expect(r.text).toContain('匹配到 2 个人')
    expect(r.text).toContain(a.id)
    expect(r.text).toContain(b.id)
    expect(interactionCount(a.id)).toBe(0)
    expect(interactionCount(b.id)).toBe(0)
  })

  it('解析成功 → 把 relation_id 写回 args，确认卡 payload 已带 ID（写入不再靠姓名二次匹配）', () => {
    const a = addPerson('阿伟')
    const r = executeTool(store, 'log_interaction', { relation_name: '阿伟', scene: '午餐', content: '吃了饭' })
    // 写操作默认需确认 → 返回 confirm，但 payload 必须已注入 ID
    expect(r.confirm).toBe(true)
    expect(r.detail.payload.relation_id).toBe(a.id)
    expect(r.detail.payload.relation_name).toBe('阿伟')
  })

  it('未找到人物 → ok:false，提示先建卡，不写库', () => {
    const r = executeTool(store, 'log_interaction', { relation_name: '查无此人', scene: '日常', content: 'x' })
    expect(r.ok).toBe(false)
    expect(r.text).toContain('没有找到')
    expect(getAllRelations().length).toBe(0)
  })
})
