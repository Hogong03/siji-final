/**
 * 子计划落库（3.5.7：从 pages/plan/detail.vue 抽出）
 *
 * buildChildPlanForm：AI 拆解 / 旧数据迁移的规格对象 → 子计划表单对象（带 _subCount 展示字段）
 * saveChildPlans：子计划表单对象 → 存储层（递归写入孙计划，parent_id 逐层回填）
 * 两个函数都不依赖组件状态，可直接在 node 环境跑测试
 */
import { savePlan, updateIndex } from './storage.js'
import { generateEntityId } from './uuid.js'

/** 规格对象 → 子计划表单对象（_subCount 仅用于展示，落库前会被剔除） */
export function buildChildPlanForm(spec, priority) {
  const src = spec || {}
  return {
    client_id: generateEntityId('plan'),
    title: src.title,
    description: src.description || '',
    priority,
    status: src.status,
    estimated_time: src.estimated_time || '',
    start_time: src.start_time || '',
    end_time: src.end_time || '',
    due_date: src.due_date || '',
    deadline: src.deadline || '',
    est_minutes: src.est_minutes || 0,
    recur_type: src.recur_type || '',
    recur_count: src.recur_count || 1,
    parent_id: '',
    childPlans: (src.children || []).map(g => buildChildPlanForm(g, priority)),
    _subCount: 0
  }
}

/** 子计划递归落库，返回写入条数（供测试断言） */
export function saveChildPlans(children, parentId) {
  let count = 0
  ;(children || []).forEach(ch => {
    if (!ch) return
    const { _subCount, ...child } = ch
    const record = {
      ...child,
      client_id: child.client_id || generateEntityId('plan'),
      parent_id: parentId,
      created_at: child.created_at || Date.now(),
      updated_at: Date.now(),
      subtasks: [],
      phases: [],
      is_deleted: 0
    }
    savePlan(record)
    updateIndex('plan', record)
    count += 1
    if (Array.isArray(child.childPlans) && child.childPlans.length > 0) {
      count += saveChildPlans(child.childPlans, record.client_id)
    }
  })
  return count
}
