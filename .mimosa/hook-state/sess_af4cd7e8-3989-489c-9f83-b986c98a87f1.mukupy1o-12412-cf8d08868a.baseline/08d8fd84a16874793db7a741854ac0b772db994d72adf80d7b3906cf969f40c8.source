import { createRelation, updateRelation, deleteRelation, getAllRelations, findRelationsByName, logInteraction, getInteractions } from '@/utils/relations.js'
import { invalidatePromptCache } from '@/utils/ai/prompt-builder.js'

/**
 * Relation 相关 executor 工厂函数
 * @param {{ undoStack, cidCache, generateEntityId }} ctx 上下文
 */
export function createRelationExecutors(ctx) {
  // ==================== 关系图谱操作 ====================

  function execCreateRelation(p) {
    const relation = createRelation(p)
    invalidatePromptCache()
    return {
      success: true,
      message: `已收录「${relation.name}」到关系图谱`,
      detail: {
        type: 'relation', id: relation.id,
        name: relation.name, role: relation.role,
        context: relation.context, traits: relation.traits,
        preferences: relation.preferences, notes: relation.notes,
        relationship_score: relation.relationship_score, tags: relation.tags
      }
    }
  }

  function execUpdateRelation(p) {
    if (!p.id && !p.relation_id) return { success: false, message: '缺少关系ID', detail: null }
    const id = p.id || p.relation_id
    const updates = {}
    const allowed = ['name', 'role', 'context', 'traits', 'preferences', 'notes', 'relationship_score', 'tags']
    for (const key of allowed) {
      if (p[key] != null) updates[key] = p[key]
    }
    if (Object.keys(updates).length === 0) return { success: false, message: '无更新字段', detail: null }
    const ok = updateRelation(id, updates)
    if (!ok) return { success: false, message: '关系卡片不存在', detail: null }
    const updated = getAllRelations().find(r => r.id === id)
    invalidatePromptCache()
    return {
      success: true,
      message: `已更新「${updated.name}」的信息`,
      detail: { type: 'relation', id, updated_fields: Object.keys(updates), ...updated }
    }
  }

  function execDeleteRelation(p) {
    if (!p.id && !p.relation_id) return { success: false, message: '缺少关系ID', detail: null }
    const id = p.id || p.relation_id
    const all = getAllRelations()
    const target = all.find(r => r.id === id)
    if (!target) return { success: false, message: '关系卡片不存在', detail: null }
    deleteRelation(id)
    invalidatePromptCache()
    return {
      success: true,
      message: `已从关系图谱中移除「${target.name}」`,
      detail: { type: 'relation', id, deleted: true }
    }
  }

  function execQueryRelation(p) {
    let list
    if (p.keyword) {
      list = findRelationsByName(p.keyword)
    } else {
      list = getAllRelations()
    }
    if (list.length === 0) {
      return { success: true, message: '关系图谱为空', detail: { type: 'query_relation', count: 0, items: [] } }
    }
    const summary = list.slice(0, 10).map(r => `${r.name}(${r.role}) 亲密度${r.relationship_score}/10`).join('；')
    return {
      success: true,
      message: `关系图谱共 ${list.length} 人：${summary}`,
      detail: { type: 'query_relation', count: list.length, items: list.slice(0, 10) }
    }
  }

  function execLogInteraction(p) {
    let relation = null
    if (p.relation_id) {
      relation = getAllRelations().find(r => r.id === p.relation_id)
    } else if (p.relation_name) {
      // 模型未拿到 ID 时按人名自动匹配
      const matched = findRelationsByName(p.relation_name)
      relation = matched.length > 0 ? matched[0] : null
    }
    if (!relation) return { success: false, message: '关系卡片不存在，请先创建该人脉', detail: null }
    const interaction = logInteraction({
      relation_id: relation.id,
      relation_name: relation.name,
      scene: p.scene || '日常',
      content: p.content || '',
      result: p.result || '',
      emotion: p.emotion || ''
    })
    invalidatePromptCache()
    return {
      success: true,
      message: `已记录与「${relation.name}」的互动`,
      detail: { type: 'interaction', id: interaction.id, relation_id: relation.id, relation_name: relation.name, scene: interaction.scene }
    }
  }

  function execQueryInteraction(p) {
    if (!p.relation_id) return { success: false, message: '缺少关系ID', detail: null }
    const list = getInteractions(p.relation_id)
    if (list.length === 0) {
      return { success: true, message: '暂无互动记录', detail: { type: 'query_interaction', count: 0, items: [] } }
    }
    const summary = list.slice(0, 5).map(i => `${i.scene}: ${i.content.substring(0, 30)}`).join('；')
    return {
      success: true,
      message: `共 ${list.length} 条互动记录：${summary}`,
      detail: { type: 'query_interaction', count: list.length, items: list.slice(0, 5) }
    }
  }

  return { execCreateRelation, execUpdateRelation, execDeleteRelation, execQueryRelation, execLogInteraction, execQueryInteraction }
}
