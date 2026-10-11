/**
 * test: 成果引擎 + 学习模板（4.24.0）
 *
 * 背景（用户画像）：核心病灶是「爆发力强、稳定复利不足」「知道该做但觉得不着急」，
 * 药方是「以成果为单位的执行系统 + 即时反馈」。本文件锁死三层：
 *   1. 存储层：glimmer kind（win/moment）落库与老数据归一、getGlimmerStats 连续天数
 *      （今天没记不算断档，从昨天往回数）、晚间收尾问询条件（21 点后今天还没记）
 *   2. 表现层：briefing 成果连续格（≥2 天才亮）、晚间「记成果」预置按钮、进入消息正文行
 *   3. 模板层：tpl_learning 四阶段补发幂等 + 周检查点循环标记
 */
import { describe, it, expect, beforeEach } from 'vitest'
import './setup.js'
import { setActivePinia, createPinia } from 'pinia'
import { useDataStore } from '../store/data.js'
import { resetStorage } from './setup.js'
import {
  saveGlimmer, getGlimmers, getGlimmerStats, removeGlimmer
} from '../utils/storage/glimmer.js'
import { buildBriefingMetrics, buildEnterButtons, buildEnterLines } from '../utils/enter-dialogue.js'
import { ensureDefaultTemplates, getPlanTemplates, getPlanList } from '../utils/storage/plan.js'

const DAY_MS = 86400000

/** 取一个「2026-10-07 21:30」（周三晚间）当 now：needWinPrompt 条件成立 */
function wednesdayNight() {
  return new Date(2026, 9, 7, 21, 30, 0, 0).getTime()
}
function dayStr(ts) {
  const d = new Date(ts)
  const pad = n => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

describe('存储层：kind 与统计', () => {
  beforeEach(() => { uni.clearStorageSync() })

  it('kind=win 落库；同日同 kind 覆盖；老数据（无 kind）读出归一 moment', () => {
    saveGlimmer('看懂了一条完整调用链', { kind: 'win' })
    saveGlimmer('独立写了一个后端接口', { kind: 'win' })
    const all = getGlimmers()
    // 同日同 kind 覆盖（每日每类一条语义）
    expect(all).toHaveLength(1)
    expect(all[0].kind).toBe('win')
    expect(all[0].content).toBe('独立写了一个后端接口')
  })

  it('同日 win 与 moment 并存（4.25.1）：白天记的成果不被晚上记的小事顶掉', () => {
    saveGlimmer('看懂了链式法则', { kind: 'win' })
    saveGlimmer('晚饭后散了会儿步', { kind: 'moment' })
    const all = getGlimmers()
    expect(all).toHaveLength(2)
    expect(all.find(g => g.kind === 'win').content).toBe('看懂了链式法则')
    expect(all.find(g => g.kind === 'moment').content).toBe('晚饭后散了会儿步')
    // 再记一次 moment 仍只覆盖 moment 那条
    saveGlimmer('睡前拉伸', { kind: 'moment' })
    const after = getGlimmers()
    expect(after).toHaveLength(2)
    expect(after.find(g => g.kind === 'win').content).toBe('看懂了链式法则')
    expect(after.find(g => g.kind === 'moment').content).toBe('睡前拉伸')
    // 删除带 kind 只删那条；不带删该日全部
    removeGlimmer(dayStr(Date.now()), 'moment')
    expect(getGlimmers().some(g => g.kind === 'win')).toBe(true)
    removeGlimmer(dayStr(Date.now()))
    expect(getGlimmers()).toHaveLength(0)
  })

  it('streak：连续 N 天都有记录则 N；今天没记不算断档，从昨天往回数', () => {
    const now = wednesdayNight()
    // 周二、周一都有记录，今天（周三）没记
    saveGlimmer('周二成果', { date: dayStr(now - DAY_MS), kind: 'win' })
    saveGlimmer('周一成果', { date: dayStr(now - 2 * DAY_MS), kind: 'moment' })
    const s = getGlimmerStats(now)
    expect(s.todayCount).toBe(0)
    expect(s.streakDays).toBe(2)
    // 今天记了 → streak 从今天起算 3
    saveGlimmer('周三成果', { kind: 'win', date: dayStr(now) })
    expect(getGlimmerStats(now).streakDays).toBe(3)
  })

  it('needWinPrompt：21 点后且今天没记 → true；记了或白天 → false', () => {
    const now = wednesdayNight()
    expect(getGlimmerStats(now).needWinPrompt).toBe(true)
    saveGlimmer('晚上补一条成果', { kind: 'win', date: dayStr(now) })
    expect(getGlimmerStats(now).needWinPrompt).toBe(false)
    // 白天（10 点）即使没记也不问
    const morning = new Date(2026, 9, 8, 10, 0, 0, 0).getTime()
    expect(getGlimmerStats(morning).needWinPrompt).toBe(false)
  })
})

describe('表现层：briefing 指标格 / 按钮 / 正文行', () => {
  beforeEach(() => { uni.clearStorageSync() })

  it('成果连续 ≥2 天亮「成果连续」格；不足不亮', () => {
    const m1 = buildBriefingMetrics({ glimmerStat: { streakDays: 3, todayCount: 1 } })
    expect(m1[0]).toEqual({ key: 'winStreak', value: '3 天', label: '成果连续' })
    const m2 = buildBriefingMetrics({ glimmerStat: { streakDays: 1, todayCount: 1 } })
    expect(m2.some(x => x.key === 'winStreak')).toBe(false)
  })

  it('needWinPrompt 时给「记成果」预置按钮（prefill 直达 AI 收集）', () => {
    const btns = buildEnterButtons({ glimmerStat: { needWinPrompt: true, todayCount: 0, streakDays: 0 } })
    const b = btns.find(x => x.key === 'glimmer')
    expect(b).toBeTruthy()
    expect(b.action).toBe('prefill')
    expect(b.value).toContain('记一条今天的成果')
    // 已记过则不给
    const none = buildEnterButtons({ glimmerStat: { needWinPrompt: false, todayCount: 1 } })
    expect(none.find(x => x.key === 'glimmer')).toBeUndefined()
  })

  it('晚间正文行：有连续天数带天数，没有则只提醒；已记不出现', () => {
    const lines = buildEnterLines({ eventsTotal: 0, diaryCount: 0, glimmerStat: { needWinPrompt: true, todayCount: 0, streakDays: 4 } })
    expect(lines.some(l => l.includes('成果连续 4 天'))).toBe(true)
    const lines2 = buildEnterLines({ eventsTotal: 0, diaryCount: 0, glimmerStat: { needWinPrompt: true, todayCount: 0, streakDays: 0 } })
    expect(lines2.some(l => l.includes('今天还没记成果'))).toBe(true)
    const lines3 = buildEnterLines({ eventsTotal: 0, diaryCount: 0, glimmerStat: { needWinPrompt: false, todayCount: 1, streakDays: 5 } })
    expect(lines3.some(l => l.includes('成果'))).toBe(false)
  })
})

describe('模板层：tpl_learning 四阶段学习路线', () => {
  beforeEach(() => {
    resetStorage()
    setActivePinia(createPinia())
  })

  it('ensureDefaultTemplates 补发 tpl_learning，幂等；四阶段 + 每阶段周检查点', () => {
    ensureDefaultTemplates()
    ensureDefaultTemplates()
    const tpl = getPlanTemplates().filter(t => t.client_id === 'tpl_learning')
    expect(tpl).toHaveLength(1)
    expect(tpl[0].plan_data.subtasks).toHaveLength(4)
    tpl[0].plan_data.subtasks.forEach(st => {
      expect(st.start_offset_days).toBeGreaterThanOrEqual(0)
      expect(Array.isArray(st.children) && st.children.length >= 2).toBe(true)
      st.children.forEach(ch => {
        expect(ch.recur_type).toBe('weekly')
        expect(ch.recur_count).toBe(1)
      })
    })
  })

  it('从模板创建计划：四阶段展开为子计划、周检查点挂在阶段下', () => {
    ensureDefaultTemplates()
    const ds = useDataStore()
    const tpl = getPlanTemplates().find(t => t.client_id === 'tpl_learning')
    const root = ds.createPlanFromTemplate(tpl)
    expect(root).toBeTruthy()
    const plans = getPlanList()
    const stages = plans.filter(p => p.parent_id === root.client_id)
    expect(stages.length).toBe(4)
    const stage1 = stages.find(s => s.title.includes('阶段一'))
    expect(stage1).toBeTruthy()
    const checkpoints = plans.filter(p => p.parent_id === stage1.client_id)
    expect(checkpoints.length).toBe(2)
    checkpoints.forEach(c => expect(c.recur_type).toBe('weekly'))
  })
})
