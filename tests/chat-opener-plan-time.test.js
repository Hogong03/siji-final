/**
 * 3.10.0 三块修复的回归测试
 *
 *  1. 开场消息（欢迎语 / 进入总结）都带按钮，且按钮来自同一套生成逻辑 —— 「所有按钮都点得动」
 *     （配套修复：欢迎语快捷按钮原来用 $root.$emit 发，页面用 uni.$on 听，点了没反应）
 *  2. 计划时间改得动：保存时编辑值优先（原来旧 start_time/end_time 优先，改了不生效）
 *  3. 计划到点默认提醒：没手动设过提醒的计划，有截止/开始时间就自动提醒；
 *     用户明确关掉的仍然不提醒
 */
import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { resetStorage } from './setup.js'
import { resetColdStart } from '../utils/chat-session.js'
import './setup.js'
import { buildWelcomeMessage, buildWelcomeButtons, hasOpenerActions, OPENER_FLAG, WELCOME_FLAG } from '../utils/enter-dialogue.js'
import { usePlanForm } from '../pages/plan/composables/usePlanForm.js'
import { computeDefaultFire, checkAllReminders, initReminder } from '../utils/reminder/scheduler.js'
import { setPlanReminder, saveReminderSettings, getReminderSettings } from '../utils/reminder/settings.js'
import { useChatSession } from '../composables/useChatSession.js'
import { setActivePinia, createPinia } from 'pinia'
import { effectScope } from 'vue'
import { useChatStore } from '../store/chat.js'

/* ==================== 1. 开场消息与按钮 ==================== */

describe('开场消息：欢迎语与进入总结共用一套按钮', () => {
  it('欢迎语消息带按钮、带开场标记，且算「壳」（_isWelcome）', () => {
    const msg = buildWelcomeMessage('你好，我是思迹。')
    expect(msg).toBeTruthy()
    expect(msg.role).toBe('assistant')
    expect(msg.content).toBe('你好，我是思迹。')
    expect(msg[OPENER_FLAG]).toBe(true)
    expect(msg[WELCOME_FLAG]).toBe(true)
    expect(Array.isArray(msg._enterButtons)).toBe(true)
    expect(msg._enterButtons.length).toBeGreaterThanOrEqual(3)
  })

  it('空内容返回 null（调用方回落到别的开场方式）', () => {
    expect(buildWelcomeMessage('')).toBe(null)
    expect(buildWelcomeMessage('   ')).toBe(null)
    expect(buildWelcomeMessage(null)).toBe(null)
  })

  it('按钮都是可执行的两类之一：navigate（跳页）或 prefill（填输入框）', () => {
    buildWelcomeButtons().forEach(btn => {
      expect(typeof btn.key).toBe('string')
      expect(typeof btn.label).toBe('string')
      expect(['navigate', 'prefill']).toContain(btn.action)
      expect(typeof btn.value).toBe('string')
      expect(btn.value.length).toBeGreaterThan(0)
    })
  })

  it('hasOpenerActions：只有带按钮的「进入总结 / 开场白」才渲染操作行', () => {
    expect(hasOpenerActions(buildWelcomeMessage('hi'))).toBe(true)
    expect(hasOpenerActions({ _isEnterSummary: true, _enterButtons: [{ key: 'a' }] })).toBe(true)
    // 普通消息、没有按钮、空值都不渲染
    expect(hasOpenerActions({ role: 'assistant', content: '随便聊聊' })).toBe(false)
    expect(hasOpenerActions({ _isEnterSummary: true, _enterButtons: [] })).toBe(false)
    expect(hasOpenerActions(null)).toBe(false)
  })

  it('冷启动建的新对话里，开场白是带按钮的开场消息', () => {
    resetStorage()
    setActivePinia(createPinia())
    resetColdStart()
    const store = useChatStore()
    const scope = effectScope()
    const s = scope.run(() => useChatSession(store, () => '你好，我是思迹。'))
    s.maybeStartFreshSession()
    expect(store.messages.length).toBe(1)
    const opener = store.messages[0]
    expect(opener[OPENER_FLAG]).toBe(true)
    expect(opener._enterButtons.length).toBeGreaterThan(0)
    scope.stop()
  })
})

describe('静态回归：不再有 $root.$emit（死按钮的根因）', () => {
  it('components / pages 里没有 $root.$emit 调用', () => {
    const ROOT = process.cwd()
    const hits = []
    const walk = (dir) => {
      fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(full)
        else if (entry.name.endsWith('.vue') || entry.name.endsWith('.js')) {
          const text = fs.readFileSync(full, 'utf8')
          if (text.indexOf('$root.$emit(') >= 0) hits.push(path.relative(ROOT, full))
        }
      })
    }
    walk(path.join(ROOT, 'components'))
    walk(path.join(ROOT, 'pages'))
    expect(hits).toEqual([])
  })
})

/* ==================== 2. 计划时间改得动 ==================== */

describe('计划时间：编辑值优先于旧值', () => {
  beforeEach(() => resetStorage())

  it('已有 start_time 的计划，改开始日期后保存会写进新值', () => {
    const api = usePlanForm()
    api.applyStoredItem({
      client_id: 'plan_1', title: '六级备考', status: 0,
      start_time: '2026-09-01 08:00:00', end_time: '2026-12-01 23:59:00',
      due_date: '2026-12-01 23:59:00', created_at: Date.now()
    })
    // 用户把开始时间改成 9 月 20 日 07:30、截止改成 12 月 12 日
    api.form.value.estimated_time = '2026-09-20'
    api.form.value.estimated_time_value = '07:30'
    api.form.value.due_date = '2026-12-12'
    api.form.value.due_time = '09:00'
    const rec = api.persistForm()

    expect(rec.start_time).toContain('2026-09-20')
    expect(rec.start_time).toContain('07:30')
    expect(rec.end_time).toContain('2026-12-12')
    expect(rec.due_date).toContain('2026-12-12')
    expect(rec.deadline).toContain('2026-12-12')
  })

  it('没填编辑值时保留存量旧值（不因为改别的字段把时间清空）', () => {
    const api = usePlanForm()
    api.applyStoredItem({
      client_id: 'plan_2', title: '读书', status: 0,
      start_time: '2026-09-05 09:00:00', end_time: '2026-09-30 23:59:00',
      created_at: Date.now()
    })
    const rec = api.persistForm()
    expect(rec.start_time.startsWith('2026-09-05 09:00')).toBe(true)
    expect(rec.end_time.startsWith('2026-09-30 23:59')).toBe(true)
  })
})

/* ==================== 3. 计划到点默认提醒 ==================== */

describe('计划提醒：没设过提醒也会到点提醒', () => {
  beforeEach(() => {
    resetStorage()
    saveReminderSettings({ enabled: true, defaultAdvanceMin: 30, quietHoursStart: '22:00', quietHoursEnd: '08:00', plans: {} })
    initReminder(() => [])
  })

  it('只有日期的截止 → 当天 09:00 提醒一次', () => {
    const plan = { client_id: 'p1', title: '交报告', status: 0, deadline: '2026-10-01' }
    const fire = computeDefaultFire(plan, { defaultAdvanceMin: 30 })
    const d = new Date(fire.ts)
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(9)
    expect(d.getDate()).toBe(1)
    expect(d.getHours()).toBe(9)
    expect(fire.dateKey).toBe('2026-10-01')
  })

  it('带具体时刻的截止 → 时刻前 defaultAdvanceMin 分钟', () => {
    const plan = { client_id: 'p2', title: '开会', status: 0, deadline: '2026-10-01 14:00:00' }
    const fire = computeDefaultFire(plan, { defaultAdvanceMin: 30 })
    const d = new Date(fire.ts)
    expect(d.getHours()).toBe(13)
    expect(d.getMinutes()).toBe(30)
  })

  it('没有任何时间的计划不产生提醒', () => {
    expect(computeDefaultFire({ client_id: 'p3', title: '想想' }, { defaultAdvanceMin: 30 })).toBe(null)
  })

  it('checkAllReminders：没配提醒但有截止的计划会被触发（原来永远不提醒）', () => {
    const past = new Date(Date.now() - 60 * 60 * 1000)
    const plan = { client_id: 'p4', title: '早就该交的报告', status: 0, deadline: '2026-01-01' }
    initReminder(() => [plan])
    let triggered = 0
    const origModal = uni.showModal
    uni.showModal = () => { triggered++ }
    checkAllReminders()
    uni.showModal = origModal
    expect(triggered).toBeGreaterThan(0)
    expect(past.getTime()).toBeLessThan(Date.now())
  })

  it('用户明确关掉提醒的计划不会被默认规则顶上', () => {
    const plan = { client_id: 'p5', title: '不想被打扰', status: 0, deadline: '2026-01-01' }
    setPlanReminder('p5', { enabled: false, advanceMin: 30 })
    initReminder(() => [plan])
    let triggered = 0
    const origModal = uni.showModal
    uni.showModal = () => { triggered++ }
    checkAllReminders()
    uni.showModal = origModal
    expect(triggered).toBe(0)
    expect(getReminderSettings().plans.p5.enabled).toBe(false)
  })

  it('已完成 / 已删除 / 冷藏的计划不提醒', () => {
    const plans = [
      { client_id: 'd1', title: '完成的', status: 2, deadline: '2026-01-01' },
      { client_id: 'd2', title: '删掉的', status: 0, is_deleted: 1, deadline: '2026-01-01' },
      { client_id: 'd3', title: '冷藏的', status: 0, frozen_at: Date.now(), deadline: '2026-01-01' }
    ]
    initReminder(() => plans)
    let triggered = 0
    const origModal = uni.showModal
    uni.showModal = () => { triggered++ }
    checkAllReminders()
    uni.showModal = origModal
    expect(triggered).toBe(0)
  })
})