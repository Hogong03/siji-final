/**
 * 上班模板测试（4.5.0）
 *
 * 锁死的语义：
 *  - tpl_work 随 ensureDefaultTemplates 增量补发（幂等，老用户也能拿到）
 *  - 模板两个「打卡」子计划都是 daily 循环、打「工作」标签（进入消息按这个口径识别）
 *  - createPlanFromTemplate 支持模板带 reminder：创建后提醒配置落位（repeatType/customTime）
 *  - 提醒写失败不影响模板创建本身
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useDataStore } from '../store/data.js'
import { resetStorage } from './setup.js'
import './setup.js'
import {
  ensureDefaultTemplates,
  getPlanTemplates,
  getPlanList
} from '../utils/storage/plan.js'
import { getPlanReminder } from '../utils/reminder/settings.js'

let store
beforeEach(() => {
  resetStorage()
  setActivePinia(createPinia())
  store = useDataStore()
})

describe('tpl_work：内置上班模板', () => {
  it('ensureDefaultTemplates 补发 tpl_work，幂等不重复', () => {
    ensureDefaultTemplates()
    ensureDefaultTemplates()
    const tpl = getPlanTemplates().find(t => t.client_id === 'tpl_work')
    expect(tpl).toBeTruthy()
    expect(getPlanTemplates().filter(t => t.client_id === 'tpl_work')).toHaveLength(1)
    expect(tpl.plan_data.subtasks).toHaveLength(2)
  })

  it('两个打卡子计划：daily 循环 + 工作标签 + 自带提醒配置', () => {
    ensureDefaultTemplates()
    const tpl = getPlanTemplates().find(t => t.client_id === 'tpl_work')
    const subs = tpl.plan_data.subtasks
    expect(subs.map(s => s.title)).toEqual(['上班打卡', '下班打卡'])
    subs.forEach(s => {
      expect(s.recur_type).toBe('daily')
      expect(s.tags).toContain('工作')
      expect(s.reminder.repeatType).toBe('daily')
      expect(s.reminder.customTime).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/)
    })
    // 上下班默认时刻不同
    expect(subs[0].reminder.customTime).not.toBe(subs[1].reminder.customTime)
  })
})

describe('createPlanFromTemplate：模板提醒落位', () => {
  it('从上班模板创建：根计划 + 两个循环子计划，提醒各自写入提醒设置', () => {
    ensureDefaultTemplates()
    const tpl = getPlanTemplates().find(t => t.client_id === 'tpl_work')
    const root = store.createPlanFromTemplate(tpl)
    expect(root).toBeTruthy()

    const plans = getPlanList()
    const children = plans.filter(p => p.parent_id === root.client_id)
    expect(children).toHaveLength(2)
    children.forEach(c => {
      expect(c.recur_type).toBe('daily')
      expect(c.tags).toContain('工作')
      const cfg = getPlanReminder(c.client_id)
      expect(cfg).toBeTruthy()
      expect(cfg.enabled).toBe(true)
      expect(cfg.repeatType).toBe('daily')
    })
    // 上班 08:30 / 下班 18:00
    const clockIn = children.find(c => /上班/.test(c.title))
    const clockOut = children.find(c => /下班/.test(c.title))
    expect(getPlanReminder(clockIn.client_id).customTime).toContain('08:30')
    expect(getPlanReminder(clockOut.client_id).customTime).toContain('18:00')
  })

  it('普通模板（无 reminder 字段）不写提醒配置', () => {
    ensureDefaultTemplates()
    const tpl = getPlanTemplates().find(t => t.client_id === 'tpl_fitness')
    const root = store.createPlanFromTemplate(tpl)
    const children = getPlanList().filter(p => p.parent_id === root.client_id)
    children.forEach(c => {
      expect(getPlanReminder(c.client_id)).toBeNull()
    })
  })

  it('提醒配置坏数据（customTime 缺失）不炸创建', () => {
    const tpl = {
      client_id: 'tpl_manual_test', name: '坏提醒模板',
      plan_data: {
        subtasks: [
          { title: '子任务A', reminder: { enabled: true, repeatType: 'daily' } }
        ]
      },
      created_at: Date.now(), updated_at: Date.now(), is_deleted: 0
    }
    const root = store.createPlanFromTemplate(tpl)
    const children = getPlanList().filter(p => p.parent_id === root.client_id)
    expect(children).toHaveLength(1)
    const cfg = getPlanReminder(children[0].client_id)
    expect(cfg.repeatType).toBe('daily')
    expect(cfg.customTime).toBe('')
  })
})
