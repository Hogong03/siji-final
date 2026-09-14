/**
 * 打卡闭环测试（3.5.6）
 *
 * 上一版这三件事只有纯函数有测试，UI 接线 0 覆盖（点了没反应、日期写错全靠真机发现）。
 * usePlanCheckin 不依赖组件实例，这里直接当普通模块调用，把 UI 层逻辑也纳入测试。
 * 覆盖：撤销打卡 / 日历补记守卫 / 连续里程碑（天与周两种口径）/ 候选路径标签
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ref } from 'vue'
import { resetStorage } from './setup.js'
import { savePlan, getPlanList, logPlanCheckIn, removePlanCheckIn } from '../utils/storage.js'
import { usePlanCheckin } from '../pages/plan/composables/usePlanCheckin.js'
import { checkinFeedback, streakOfPlanRecord } from '../utils/checkin-feedback.js'
import { weeklyStreakOf, streakMilestoneOf, planPathLabel, backfillCandidates, buildPlanIndex } from '../utils/plan-recur.js'

const DAY = 24 * 60 * 60 * 1000
let toasts = []
let modalConfirm = true

function pad(n) { return String(n).padStart(2, '0') }
function ymd(ts) {
  const d = new Date(ts)
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}
const TODAY = ymd(Date.now())
function daysAgo(n) { return ymd(Date.now() - n * DAY) }

beforeEach(() => {
  resetStorage()
  toasts = []
  modalConfirm = true
  uni.showToast = ({ title }) => { toasts.push(title) }
  uni.showModal = ({ success }) => { if (success) success({ confirm: modalConfirm }) }
})

function makePlan(extra = {}) {
  const plan = Object.assign({
    client_id: 'p1',
    title: '每天听 30 分钟',
    status: 1,
    priority: 0,
    is_deleted: 0,
    recur_type: 'daily',
    recur_count: 1
  }, extra)
  savePlan(plan)
  return plan
}

function mount(plan, recurType) {
  const isNew = ref(false)
  const planId = ref(plan.client_id)
  const selfRecurType = ref(recurType === undefined ? plan.recur_type : recurType)
  const selfRecurCount = ref(plan.recur_count || 1)
  const isFrozen = ref(false)
  const api = usePlanCheckin({ isNew, planId, selfRecurType, selfRecurCount, isFrozen })
  api.syncFromPlan(getPlanList().find(p => p.client_id === plan.client_id))
  return api
}

describe('removePlanCheckIn：撤销某天打卡', () => {
  it('删掉那一天，其余打卡保留', () => {
    makePlan({ checkins: [{ date: daysAgo(2), at: 1, note: 'a' }] })
    logPlanCheckIn('p1', 'b', daysAgo(1))
    const rec = removePlanCheckIn('p1', daysAgo(1))
    expect(rec.checkins.map(c => c.date)).toEqual([daysAgo(2)])
    expect(getPlanList()[0].checkins.length).toBe(1)
  })

  it('那天本来没打卡 / 日期不合法 / 计划不存在 → 返回 null', () => {
    makePlan({ checkins: [] })
    expect(removePlanCheckIn('p1', daysAgo(1))).toBe(null)
    expect(removePlanCheckIn('p1', '2026-9-1')).toBe(null)
    expect(removePlanCheckIn('p1', '')).toBe(null)
    expect(removePlanCheckIn('nope', daysAgo(1))).toBe(null)
  })
})

describe('usePlanCheckin：状态与动作都接上了', () => {
  it('导出的每个名字都不是 undefined（防解构写错名字）', () => {
    const api = mount(makePlan())
    Object.keys(api).forEach(k => {
      expect(api[k], k).not.toBe(undefined)
    })
  })

  it('打卡写入今天，摘要跟着变', () => {
    const api = mount(makePlan())
    api.submitCheckIn()
    expect(api.selfCheckins.value.map(c => c.date)).toEqual([TODAY])
    expect(api.checkinStats.value.todayDone).toBe(true)
    expect(api.checkinSummaryText()).toContain('累计 1 天')
    expect(toasts).toEqual(['已打卡'])
  })

  it('第 3 天连上 → 一句里程碑，不是普通回执', () => {
    const api = mount(makePlan({ checkins: [{ date: daysAgo(2), at: 1 }, { date: daysAgo(1), at: 2 }] }))
    api.submitCheckIn()
    expect(toasts).toEqual(['连续 3 天，稳'])
  })

  it('撤销：确认后那天消失，累计回退', () => {
    const api = mount(makePlan())
    api.submitCheckIn()
    api.removeCheckin(TODAY)
    expect(api.selfCheckins.value.length).toBe(0)
    expect(api.checkinStats.value.todayDone).toBe(false)
    expect(toasts.pop()).toBe('已撤销 ' + TODAY.slice(5))
  })

  it('撤销：点了「保留」什么都不发生', () => {
    const api = mount(makePlan())
    api.submitCheckIn()
    modalConfirm = false
    api.removeCheckin(TODAY)
    expect(api.selfCheckins.value.length).toBe(1)
  })
})

describe('日历补记守卫', () => {
  it('未来的日子补不了，也不写库', () => {
    const api = mount(makePlan())
    api.onCalBackfill(ymd(Date.now() + 3 * DAY))
    expect(toasts).toEqual(['这天补不了（窗口外或已打卡）'])
    expect(getPlanList()[0].checkins || []).toEqual([])
  })

  it('已打卡的日子补不了（按天幂等，不给重复写）', () => {
    const api = mount(makePlan({ checkins: [{ date: daysAgo(1), at: 1 }] }))
    api.onCalBackfill(daysAgo(1))
    expect(toasts).toEqual(['这天补不了（窗口外或已打卡）'])
  })

  it('窗口内的历史日：确认后补记那天', () => {
    const api = mount(makePlan())
    api.onCalBackfill(daysAgo(1))
    expect(api.selfCheckins.value.map(c => c.date)).toEqual([daysAgo(1)])
    expect(api.calSelected.value).toBe(daysAgo(1))
    expect(toasts).toEqual(['已补记 ' + daysAgo(1).slice(5)])
  })

  it('非循环任务不给补记', () => {
    const plan = makePlan({ client_id: 'p2', recur_type: '' })
    const api = mount(plan, '')
    api.onCalBackfill(daysAgo(1))
    expect(toasts).toEqual(['这天补不了（窗口外或已打卡）'])
  })

  it('可补记的日子会进 backfillMap（热力图据此显示小点）', () => {
    const api = mount(makePlan())
    expect(api.calBackfillMap.value[daysAgo(1)]).toBe(true)
    expect(api.calBackfillMap.value[TODAY]).toBe(undefined)
  })
})

describe('连续口径：weekly 看周，其余看天', () => {
  function weekStartYmd(offsetWeeks) {
    const d = new Date()
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offsetWeeks * 7)
    return ymd(d.getTime())
  }

  it('weeklyStreakOf：连续达标周数，断一周就归零', () => {
    const plan = { recur_type: 'weekly', recur_count: 1 }
    expect(weeklyStreakOf(plan)).toBe(0)
    const two = { recur_type: 'weekly', recur_count: 1, checkins: [{ date: weekStartYmd(0) }, { date: weekStartYmd(-1) }] }
    expect(weeklyStreakOf(two)).toBe(2)
    const gap = { recur_type: 'weekly', recur_count: 1, checkins: [{ date: weekStartYmd(0) }, { date: weekStartYmd(-2) }] }
    expect(weeklyStreakOf(gap)).toBe(1)
  })

  it('weekly 的 recur_count 决定达标线：每周 3 次只打 1 次不算达标', () => {
    const one = { recur_type: 'weekly', recur_count: 3, checkins: [{ date: weekStartYmd(0) }] }
    expect(weeklyStreakOf(one)).toBe(0)
    const week = weekStartYmd(0)
    const three = {
      recur_type: 'weekly',
      recur_count: 3,
      checkins: [{ date: week }, { date: ymd(new Date(week).getTime() + DAY) }, { date: ymd(new Date(week).getTime() + 2 * DAY) }]
    }
    expect(weeklyStreakOf(three)).toBeGreaterThanOrEqual(1)
  })

  it('weekly 计划打卡后按「周」给回执（不再是永远触发不了的「天」）', () => {
    const plan = makePlan({
      client_id: 'w1',
      recur_type: 'weekly',
      recur_count: 1,
      checkins: [{ date: weekStartYmd(-1), at: 1 }]
    })
    const api = mount(plan)
    api.onCalBackfill(weekStartYmd(0))
    expect(toasts).toEqual(['连续 2 周达标，稳'])
  })

  it('streakOfPlanRecord 按类型取数', () => {
    expect(streakOfPlanRecord({ recur_type: 'weekly', recur_count: 1, checkins: [{ date: weekStartYmd(0) }] })).toBe(1)
    expect(streakOfPlanRecord({ recur_type: 'daily', checkins: [{ date: TODAY }] })).toBe(1)
    expect(streakOfPlanRecord(null)).toBe(0)
  })
})

describe('checkinFeedback：只有跨过才说那句', () => {
  it('按天跨过 3 → 连续 3 天，稳', () => {
    checkinFeedback(3, 2, '已打卡')
    expect(toasts).toEqual(['连续 3 天，稳'])
  })

  it('按周跨过 2 → 连续 2 周达标，稳', () => {
    checkinFeedback(2, 1, '已打卡', 'week')
    expect(toasts).toEqual(['连续 2 周达标，稳'])
  })

  it('没跨过 → 原样返回 fallback 文案', () => {
    expect(checkinFeedback(4, 3, '已打卡')).toBe(0)
    expect(toasts).toEqual(['已打卡'])
  })

  it('里程碑不跳级重复：7 天只在第 7 天说一次', () => {
    expect(streakMilestoneOf(7, 6)).toBe(7)
    expect(streakMilestoneOf(8, 7)).toBe(0)
  })
})

describe('补记候选：同名子计划分得清', () => {
  it('planPathLabel 拼出「主计划 / 阶段 / 子计划」', () => {
    const root = { client_id: 'r', title: '六级备考' }
    const mid = { client_id: 'm', title: '唤醒期', parent_id: 'r' }
    const leaf = { client_id: 'l', title: '背单词', parent_id: 'm' }
    const byId = buildPlanIndex([root, mid, leaf])
    expect(planPathLabel(leaf, byId)).toBe('六级备考 / 唤醒期 / 背单词')
    expect(planPathLabel(root, byId)).toBe('六级备考')
  })

  it('backfillCandidates 带 label 与层级，父级在前', () => {
    const root = { client_id: 'r', title: '六级备考', recur_type: 'daily', status: 1 }
    const leaf = { client_id: 'l', title: '背单词', parent_id: 'r', recur_type: 'daily', status: 1 }
    const out = backfillCandidates([leaf, root], daysAgo(1))
    expect(out.map(c => c.client_id)).toEqual(['r', 'l'])
    expect(out[1].label).toBe('六级备考 / 背单词')
  })
})
