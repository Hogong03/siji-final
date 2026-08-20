/**
 * Executor 核心测试 — 通过 useDataStore 走完整 action 分发链路
 * 覆盖：记录/账单/计划/反馈 CRUD + 撤销 + 复合执行
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useDataStore } from '../store/data.js'
import { resetStorage } from './setup.js'

let store
beforeEach(() => {
  resetStorage()
  setActivePinia(createPinia())
  store = useDataStore()
})

describe('记录 executor', () => {
  it('创建：首行作标题，其余作内容', () => {
    const r = store.executeAction({ type: 'create_diary', payload: { content: '今天跑步5公里\n状态不错', tags: ['运动'] } })
    expect(r.success).toBe(true)
    expect(r.detail.title).toBe('今天跑步5公里')
    expect(r.detail.content).toBe('状态不错')
    expect(r.detail.tags).toEqual(['运动'])
  })

  it('查询：关键词命中', () => {
    store.executeAction({ type: 'create_diary', payload: { content: '跑步打卡' } })
    store.executeAction({ type: 'create_diary', payload: { content: '吃了火锅' } })
    const q = store.executeAction({ type: 'query_diary', payload: { keyword: '跑步' } })
    expect(q.success).toBe(true)
    expect(q.detail.count).toBe(1)
    expect(q.detail.items[0].title).toContain('跑步')
  })

  it('更新：内容与标签就地修改', () => {
    const c = store.executeAction({ type: 'create_diary', payload: { content: '旧内容', tags: ['a'] } })
    const u = store.executeAction({ type: 'update_diary', payload: { client_id: c.detail.id, content: '新内容', tags: ['b'] } })
    expect(u.success).toBe(true)
    expect(u.detail.updatedFields).toContain('content')
    const q = store.executeAction({ type: 'query_diary', payload: { keyword: '新内容' } })
    expect(q.detail.count).toBe(1)
  })

  it('更新：缺少 ID 返回失败', () => {
    const r = store.executeAction({ type: 'update_diary', payload: {} })
    expect(r.success).toBe(false)
    expect(r.message).toBe('缺少记录ID')
  })

  it('软删除：删除后查询不可见', () => {
    const c = store.executeAction({ type: 'create_diary', payload: { content: '待删除' } })
    const d = store.executeAction({ type: 'delete_diary', payload: { client_id: c.detail.id } })
    expect(d.success).toBe(true)
    const q = store.executeAction({ type: 'query_diary', payload: {} })
    expect(q.detail.count).toBe(0)
  })

  it('撤销创建 → 记录被软删除', () => {
    store.executeAction({ type: 'create_diary', payload: { content: '待撤销' } })
    const undo = store.executeAction({ type: 'undo_last' })
    expect(undo.success).toBe(true)
    expect(undo.detail.originalType).toBe('diary')
    const q = store.executeAction({ type: 'query_diary', payload: {} })
    expect(q.detail.count).toBe(0)
  })
})

describe('账单 executor', () => {
  it('创建 → 统计 → 修改金额 → 统计更新', () => {
    const c = store.executeAction({ type: 'create_bill', payload: { type: 'expense', amount: 25, category: '餐饮', note: '午餐' } })
    expect(c.success).toBe(true)
    const s1 = store.executeAction({ type: 'query_stat', payload: {} })
    expect(s1.success).toBe(true)
    expect(s1.detail.totalExpense).toBe(25)

    const u = store.executeAction({ type: 'update_bill', payload: { client_id: c.detail.id, amount: 30 } })
    expect(u.success).toBe(true)
    const s2 = store.executeAction({ type: 'query_stat', payload: {} })
    expect(s2.detail.totalExpense).toBe(30)
  })

  it('创建：异常日期回退到今天', () => {
    const c = store.executeAction({ type: 'create_bill', payload: { type: 'expense', amount: 10, category: '其他', bill_date: '2099-01-01' } })
    expect(c.success).toBe(true)
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    expect(c.detail.bill_date).toBe(todayStr)
  })
})

describe('计划 executor', () => {
  it('创建 → 查询 → 阶段化创建', () => {
    const c = store.executeAction({ type: 'create_plan', payload: { title: '学日语', priority: 1 } })
    expect(c.success).toBe(true)
    const q = store.executeAction({ type: 'query_plan', payload: {} })
    expect(q.success).toBe(true)
    expect(q.detail.items.length).toBe(1)
    expect(q.detail.items[0].title).toBe('学日语')

    const p = store.executeAction({ type: 'create_plan_phases', payload: { title: '大目标' } })
    expect(p.success).toBe(true)
    const q2 = store.executeAction({ type: 'query_plan', payload: {} })
    expect(q2.detail.items.length).toBe(2)
  })

  it('阶段化创建：phase_count 生成对应数量阶段', () => {
    const p = store.executeAction({ type: 'create_plan_phases', payload: { title: '大目标', phase_count: 3 } })
    expect(p.success).toBe(true)
    expect(p.detail.phaseCount).toBe(3)
    expect(p.detail.phases).toHaveLength(3)
    expect(p.detail.phases[0].id).toBe(1)
    expect(p.detail.phases[0].title).toBe('第1阶段')
    expect(p.detail.phases[2].title).toBe('第3阶段')
  })

  it('阶段数超界钳制到 2-6，缺失时不生成', () => {
    const over = store.executeAction({ type: 'create_plan_phases', payload: { title: '超界', phase_count: 99 } })
    expect(over.detail.phaseCount).toBe(6)
    const under = store.executeAction({ type: 'create_plan_phases', payload: { title: '不足', phase_count: 1 } })
    expect(under.detail.phaseCount).toBe(2)
    const none = store.executeAction({ type: 'create_plan_phases', payload: { title: '无数量' } })
    expect(none.detail.phaseCount).toBe(0)
  })

  it('子任务更新', () => {
    const c = store.executeAction({ type: 'create_plan', payload: { title: '带子任务', subtasks: [{ title: '第一步' }] } })
    expect(c.detail.subtasks).toHaveLength(1)
  })
})

describe('反馈 executor', () => {
  it('创建 → 统计', () => {
    const c = store.executeAction({ type: 'create_feedback', payload: { rating: 5, category: '功能建议', content: '希望支持语音输入' } })
    expect(c.success).toBe(true)
    const s = store.executeAction({ type: 'query_feedback_stats', payload: {} })
    expect(s.success).toBe(true)
    expect(s.detail.total).toBe(1)
  })
})

describe('分发器', () => {
  it('未知 action 返回失败', () => {
    const r = store.executeAction({ type: 'not_exist', payload: {} })
    expect(r.success).toBe(false)
    expect(r.message).toBe('未知操作类型')
  })

  it('空/无操作 action 无需执行', () => {
    expect(store.executeAction(null).message).toBe('无需执行')
    expect(store.executeAction({ type: 'none' }).message).toBe('无需执行')
  })

  it('复合执行 executeActions', () => {
    const r = store.executeActions([
      { type: 'create_diary', payload: { content: '第一条' } },
      { type: 'create_bill', payload: { type: 'expense', amount: 10, category: '其他' } }
    ])
    expect(r.allSuccess).toBe(true)
    expect(r.results).toHaveLength(2)
  })
})
