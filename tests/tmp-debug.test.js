import { describe, it, expect } from 'vitest'
import './setup.js'
import { getReminderSettings, saveReminderSettings, parseDateTimeToTs } from '../utils/reminder/settings.js'
import { computeDefaultFire, checkAllReminders, initReminder } from '../utils/reminder/scheduler.js'
import { isTriggered } from '../utils/reminder/triggered.js'

describe('debug', () => {
  it('print state', () => {
    saveReminderSettings({ enabled: true, defaultAdvanceMin: 30, quietHoursStart: '22:00', quietHoursEnd: '08:00', plans: {} })
    const plan = { client_id: 'p4', title: '报告', status: 0, deadline: '2026-01-01' }
    const s = getReminderSettings()
    console.log('settings.enabled:', s.enabled, 'quiet:', s.quietHoursStart, s.quietHoursEnd)
    const fire = computeDefaultFire(plan, s)
    console.log('fire:', fire, new Date(fire.ts).toString())
    console.log('now >= fire.ts:', Date.now() >= fire.ts)
    console.log('parseDateTimeToTs(deadline):', parseDateTimeToTs(plan.deadline))
    console.log('isTriggered p4|2026-01-01:', isTriggered('p4|2026-01-01'))
    initReminder(() => [plan])
    let n = 0
    const orig = uni.showModal
    uni.showModal = () => { n++ }
    checkAllReminders()
    console.log('triggered count:', n)
    uni.showModal = orig
    expect(n).toBeGreaterThanOrEqual(0)
  })
})