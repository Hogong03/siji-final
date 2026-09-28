/**
 * 3.4 M2 微光本测试
 * 覆盖：存储同日覆盖、删除、查询计数；executor create/query/delete 接线
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useDataStore } from '../store/data.js'
import { resetStorage } from './setup.js'
import {
  getGlimmers, saveGlimmer, removeGlimmer, countGlimmers,
  getGlimmerByDate, todayStr
} from '../utils/storage.js'

beforeEach(() => {
  resetStorage()
  setActivePinia(createPinia())
})

describe('glimmer 存储', () => {
  it('保存后可读，同日覆盖为一条', () => {
    saveGlimmer('出门晒了会儿太阳', { date: '2026-09-01' })
    saveGlimmer('晚饭按时吃了', { date: '2026-09-01' })
    const all = getGlimmers()
    expect(all).toHaveLength(1)
    expect(all[0].content).toBe('晚饭按时吃了')
    expect(all[0].date).toBe('2026-09-01')
  })

  it('默认保存到今天，todayStr 格式正确', () => {
    const d = todayStr()
    expect(/^\d{4}-\d{2}-\d{2}$/.test(d)).toBe(true)
    const rec = saveGlimmer('散步十分钟')
    expect(rec.date).toBe(d)
    expect(getGlimmerByDate(d).content).toBe('散步十分钟')
  })

  it('空内容不保存；删除后为空', () => {
    expect(saveGlimmer('   ')).toBeNull()
    saveGlimmer('早睡', { date: '2026-09-02' })
    removeGlimmer('2026-09-02')
    expect(getGlimmers()).toHaveLength(0)
  })

  it('countGlimmers 支持近 N 天过滤', () => {
    saveGlimmer('a', { date: todayStr(0) })
    saveGlimmer('b', { date: todayStr(-2) })
    saveGlimmer('c', { date: todayStr(-40) })
    expect(countGlimmers()).toBe(3)
    expect(countGlimmers(7)).toBe(2)
  })
})

describe('glimmer executor（ACTION_MAP 接线）', () => {
  it('create_glimmer / query_glimmers / delete_glimmer 全链路', () => {
    const store = useDataStore()
    const c1 = store.executeAction({ type: 'create_glimmer', payload: { content: '今天按时吃了午饭' } })
    expect(c1.success).toBe(true)
    expect(c1.detail.type).toBe('glimmer')

    const q = store.executeAction({ type: 'query_glimmers', payload: { days: 30 } })
    expect(q.success).toBe(true)
    expect(q.detail.count).toBe(1)
    expect(q.detail.items[0].content).toContain('午饭')

    const del = store.executeAction({ type: 'delete_glimmer', payload: { date: q.detail.items[0].date } })
    expect(del.success).toBe(true)
    expect(getGlimmers()).toHaveLength(0)
  })

  it('未知操作类型返回失败不崩溃', () => {
    const store = useDataStore()
    const r = store.executeAction({ type: 'create_glimmer', payload: {} })
    expect(r.success).toBe(false)
  })
})
