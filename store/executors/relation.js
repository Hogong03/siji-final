import { createRelation, updateRelation, deleteRelation, getAllRelations, findRelationsByName, resolveInteractionTarget, briefRelation, logInteraction, getInteractions } from '@/utils/relations.js'
import { invalidatePromptCache } from '@/utils/ai/prompt-builder.js'

/**
 * Relation 相关 executor 工厂函数
 * @param {{ undoStack, cidCache, generateEntityId }} ctx 上下文
 */
export function createRelationExecutors(ctx) {
  // ==================== 关系图谱操作 ====================

  /** 亲密度被剥离时给模型与用户的统一说明（AI 不得代改用户的主观评价，4.38.0） */
  const SCORE_BLOCKED_MSG = '亲密度是你自己的评价，思迹不会代你修改；需要调整请到「人脉 → 该人物详情页」拖动滑块'

  function execCreateRelation(p) {
    const scoreRequested = p && p.relationship_score != null
    // 不传 trustScore：AI 建卡一律落到默认亲密度，模型自填的分数不被采信
    const relation = createRelation(p)
    invalidatePromptCache()
    return {
      success: true,
      message: `已收录「${relation.name}」到关系图谱`
        + (scoreRequested ? `（未采信亲密度 ${p.relationship_score}：${SCORE_BLOCKED_MSG}）` : ''),
      detail: {
        type: 'relation', id: relation.id,
        name: relation.name, role: relation.role,
        context: relation.context, traits: relation.traits,
        preferences: relation.preferences, notes: relation.notes,
        relationship_score: relation.relationship_score,
        score_blocked: scoreRequested,
        tags: relation.tags
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

    const scoreRequested = updates.relationship_score != null

    // 只请求改亲密度 → 直接拒绝，不写库（其余字段一个都没有）
    if (scoreRequested && Object.keys(updates).every(k => k === 'relationship_score')) {
      return {
        success: false,
        message: `没有改动任何信息：${SCORE_BLOCKED_MSG}`,
        detail: { type: 'relation', id, score_blocked: true, score_requested: p.relationship_score }
      }
    }

    // 不传 trustScore：分数被剥离，其余合法字段照常更新
    const ok = updateRelation(id, updates)
    if (!ok) return { success: false, message: '关系卡片不存在', detail: null }
    const updated = getAllRelations().find(r => r.id === id)
    invalidatePromptCache()
    const applied = Object.keys(updates).filter(k => k !== 'relationship_score')
    return {
      success: true,
      message: `已更新「${updated.name}」的信息`
        + (scoreRequested ? `（亲密度未改：${SCORE_BLOCKED_MSG}）` : ''),
      detail: {
        type: 'relation', id,
        updated_fields: applied,
        score_blocked: scoreRequested,
        ...updated
      }
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
    // 4.37.0：目标人物解析与写入分离 —— 歧义/未找到都不得写库（旧实现取 matched[0]，
    // 同名或模糊命中多人时会把互动记到错的人名下，且用户不易察觉）
    const resolved = resolveInteractionTarget({ relationId: p.relation_id, relationName: p.relation_name })

    if (resolved.status === 'ambiguous') {
      const lines = resolved.candidates.map((r, i) =>
        `${i + 1}. ${r.name}（${r.role || '未分类'}${r.context ? '，' + r.context : ''}）id=${r.id}`
      )
      return {
        success: false,
        needChoice: true,
        message: `「${resolved.keyword}」匹配到 ${resolved.candidates.length} 个人（${resolved.reason}），先确认是哪一位再记录：\n${lines.join('\n')}`,
        detail: {
          type: 'interaction_target_ambiguous',
          keyword: resolved.keyword,
          reason: resolved.reason,
          candidates: resolved.candidates.map(briefRelation),
          pendingInteraction: { scene: p.scene || '日常', content: p.content || '', result: p.result || '' }
        }
      }
    }

    if (resolved.status === 'none') {
      return {
        success: false,
        message: '关系卡片不存在，请先创建该人脉',
        detail: { type: 'interaction_target_missing', keyword: resolved.keyword }
      }
    }

    const relation = resolved.relation
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
    // 4.40.0：事实与感受分开标注（内容/结果 = 发生了什么，情绪 = 用户自己的感受），
    // 供 AI 回溯时区分「事实」与「感受」，不要把它们混成一句判断
    const lines = list.slice(0, 5).map(i => {
      const t = Number(i.date) || Number(i.created_at) || 0
      const d = t ? new Date(t) : null
      const day = d ? `${d.getMonth() + 1}月${d.getDate()}日` : ''
      const parts = [`  - ${day} ${i.scene || '日常'}：${String(i.content || '').substring(0, 40)}`]
      if (i.result) parts.push(`（结果：${String(i.result).substring(0, 30)}）`)
      if (i.emotion) parts.push(`（用户当时的情绪：${i.emotion}）`)
      return parts.join('')
    })
    return {
      success: true,
      message: `共 ${list.length} 条互动记录（均来自用户自己的记录，结果与情绪分别标注）：\n${lines.join('\n')}`,
      detail: { type: 'query_interaction', count: list.length, items: list.slice(0, 5) }
    }
  }

  return { execCreateRelation, execUpdateRelation, execDeleteRelation, execQueryRelation, execLogInteraction, execQueryInteraction }
}
