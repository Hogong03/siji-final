/**
 * 计划时间的显示与回填（3.10.2）
 *
 * 来源：2026-09-17 反馈 —— 计划「去联通营业厅办理业务」只有
 * start_time="2026-09-17 15:00"，其余时间字段全空；提醒能弹（调度器认 start_time），
 * 但计划详情里两个时间框都是空的、收起行也只显示到「日」，用户以为「没有时间」。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { resetStorage } from './setup.js'
import './setup.js'
import { usePlanForm } from '../pages/plan/composables/usePlanForm.js'
import { useDataStore } from '../store/data.js'

const START_ONLY = {
  client_id: 'plan_ymt_1',
  title: '去联通营业厅办理业务',
  description: '下午三点前往联通营业厅办理业务',
  status: 0,
  deadline: '',
  due_date: '',
  estimated_time: '',
  start_time: '2026-09-17 15:00',
  end_time: '',
  created_at: new Date(2026, 8, 17, 14, 42).getTime()
}

describe('回填：只有 start_time 的计划也要显示出来', () => {
  beforeEach(() => resetStorage())

  it('编辑器「开始」框拿到 start_time 的日期与时刻（原来读 estimated_time，空着）', () => {
    const api = usePlanForm()
    api.applyStoredItem(START_ONLY)
    expect(api.form.value.estimated_time).toBe('2026-09-17')
    expect(api.form.value.estimated_time_value).toBe('15:00')
  })

  it('只有 end_time 的计划，「截止」框也能显示', () => {
    const api = usePlanForm()
    api.applyStoredItem({ client_id: 'p2', title: 'x', status: 0, end_time: '2026-09-18 18:30' })
    expect(api.form.value.due_date).toBe('2026-09-18')
    expect(api.form.value.due_time).toBe('18:30')
  })

  it('estimated_time / due_date 优先于 start_time / end_time（老数据不被覆盖）', () => {
    const api = usePlanForm()
    api.applyStoredItem({
      client_id: 'p3', title: 'x', status: 0,
      estimated_time: '2026-09-20 08:00', start_time: '2026-09-01 07:00',
      due_date: '2026-09-25 20:00', end_time: '2026-09-30 20:00'
    })
    expect(api.form.value.estimated_time).toBe('2026-09-20')
    expect(api.form.value.due_date).toBe('2026-09-25')
  })

  it('收起行摘要带时刻（原来只到日，看不出 15:00）', () => {
    const api = usePlanForm()
    api.applyStoredItem(START_ONLY)
    expect(api.timeSummary.value).toBe('09-17 15:00')
  })

  it('起止都有时显示区间；完全没有时间显示「未设置时间」', () => {
    const api = usePlanForm()
    api.applyStoredItem({ client_id: 'p4', title: 'x', status: 0, start_time: '2026-09-17 15:00', end_time: '2026-09-17 16:00' })
    expect(api.timeSummary.value).toBe('09-17 15:00 ~ 09-17 16:00')
    const api2 = usePlanForm()
    api2.applyStoredItem({ client_id: 'p5', title: 'y', status: 0 })
    expect(api2.timeSummary.value).toBe('未设置时间')
  })

  it('只有日期没有时刻时仍是纯日期（不凭空加 00:00）', () => {
    const api = usePlanForm()
    api.applyStoredItem({ client_id: 'p6', title: 'x', status: 0, start_time: '2026-09-25', end_time: '2026-10-07' })
    expect(api.timeSummary.value).toBe('09-25 ~ 10-07')
  })

  it('回填后不改动直接保存：时间字段保持原样（不会因为回填被清掉）', () => {
    const api = usePlanForm()
    api.applyStoredItem(START_ONLY)
    const rec = api.persistForm()
    expect(rec.start_time.startsWith('2026-09-17 15:00')).toBe(true)
    expect(rec.end_time).toBe('')
  })
})

describe('update 找不到计划时给可执行的下一步', () => {
  beforeEach(() => {
    resetStorage()
    setActivePinia(createPinia())
  })

  it('提示改用 create_plan，而不是只说「计划不存在」', () => {
    const store = useDataStore()
    const r = store.executeAction({ type: 'update_plan', payload: { client_id: 'plan_not_exist', title: '去办业务' } })
    expect(r.success).toBe(false)
    expect(r.message).toContain('没找到要修改的计划')
    expect(r.message).toContain('create_plan')
  })
})