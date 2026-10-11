/**
 * test: 人生周报多维度 + 本周焦点契约（4.27.0）
 *
 * 覆盖：weekly-insights 的成果维度（微光/成果周条数 + streak）、身体维度（运动标签记录）、
 * 上周焦点对照；week-focus 的周切换/读写；briefing 的焦点按钮（本周未定才给）与正文行。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import './setup.js'
import {
  buildWeeklyInsightText, countSportDiaries, buildWeeklyInsightAnnouncement
} from '../utils/weekly-insights.js'
import { setWeekFocus, getWeekFocus, focusWeekKeyOf } from '../utils/week-focus.js'
import { markWeeklyBillAnnounced } from '../utils/bill-weekly.js'
import { buildEnterButtons, buildEnterLines } from '../utils/enter-dialogue.js'
import { saveGlimmer } from '../utils/storage/glimmer.js'

const DAY_MS = 86400000
/** 本周三中午（与 weekly-insights 测试同口径：周一为一周起点） */
function wednesdayNoon() {
  const d = new Date()
  const dayIndex = (d.getDay() + 6) % 7
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dayIndex)
  return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 2, 12, 0, 0, 0).getTime()
}
const NOW = wednesdayNoon()
const WEEK_START = focusWeekKeyOf(NOW)

function diary(ts, tags) {
  const d = new Date(ts)
  const pad = n => String(n).padStart(2, '0')
  const month = d.getFullYear() + '-' + pad(d.getMonth() + 1)
  return { month, rec: { client_id: 'd' + ts + tags.join(''), created_at: ts, tags, is_deleted: 0 } }
}

describe('身体维度：countSportDiaries（运动标签口径）', () => {
  beforeEach(() => { uni.clearStorageSync() })

  it('命中「健康/运动/篮球」任一标签计入，其他标签不算，软删不算', () => {
    uni.setStorageSync('diary_2026-10', JSON.stringify([
      diary(new Date(NOW - 2 * DAY_MS).getTime(), ['健康']).rec,
      diary(new Date(NOW - 3 * DAY_MS).getTime(), ['篮球', '朋友']).rec,
      diary(new Date(NOW - 4 * DAY_MS).getTime(), ['工作']).rec,
      diary(new Date(NOW - 5 * DAY_MS).getTime(), ['运动']).rec
    ]))
    const d = new Date(NOW)
    // 上周五~本周四窗口内的运动记录（NOW-2/3/5 三条命中，NOW-4 是工作标签不算）
    expect(countSportDiaries(new Date(NOW - 5 * DAY_MS).getTime(), NOW + DAY_MS)).toBe(3)
  })
})

describe('人生周报正文：成果 / 运动 / 焦点对照', () => {
  beforeEach(() => { uni.clearStorageSync() })

  it('成果维度：本周条数与连续天数进正文', () => {
    const text = buildWeeklyInsightText({
      total: 0,
      planStat: { checkinCount: 0 },
      glimmerStat: { weekCount: 5, streakDays: 4, todayCount: 1, needWinPrompt: false },
      diaryCount: 0
    })
    expect(text).toContain('记了 5 条成果/微光，已连续 4 天')
  })

  it('运动与焦点对照进正文；无焦点不出', () => {
    const withAll = buildWeeklyInsightText({
      total: 0,
      planStat: { checkinCount: 0 },
      glimmerStat: { weekCount: 2, streakDays: 2, todayCount: 1, needWinPrompt: false },
      sportCount: 3,
      weekFocus: { text: '补齐 Java 后端', done: false },
      diaryCount: 0
    })
    expect(withAll).toContain('运动了 3 次')
    expect(withAll).toContain('上周焦点「补齐 Java 后端」')
    const without = buildWeeklyInsightText({
      total: 0, planStat: { checkinCount: 0 }, sportCount: 0, diaryCount: 0,
      glimmerStat: { weekCount: 0, streakDays: 0 }
    })
    expect(without).not.toContain('运动')
    expect(without).not.toContain('焦点')
  })

  it('聚合门控：只有成果/运动也有周报（不只盯着钱）', () => {
    uni.setStorageSync('siji_bill_weekly_at', '')
    // 近 7 天记 2 条成果
    saveGlimmer('看懂了 RAG 流程', { kind: 'win', date: focusWeekKeyOf(NOW - 2 * DAY_MS) })
    saveGlimmer('跑步 5 公里', { kind: 'moment', date: focusWeekKeyOf(NOW - 1 * DAY_MS) })
    const r = buildWeeklyInsightAnnouncement({ now: NOW, bills: [], plans: [] })
    expect(r).not.toBeNull()
    expect(r.glimmerStat.weekCount).toBeGreaterThanOrEqual(2)
    expect(r.text).toContain('成果/微光')
    markWeeklyBillAnnounced(NOW)
  })
})

describe('本周焦点契约：读写 / 周切换 / briefing', () => {
  beforeEach(() => { uni.clearStorageSync() })

  it('set/get 往返；isCurrent 按 weekKey 判定；跨周后失活', () => {
    setWeekFocus('补齐 Java 后端', NOW)
    const cur = getWeekFocus(NOW)
    expect(cur.isCurrent).toBe(true)
    expect(cur.text).toBe('补齐 Java 后端')
    // 下周三：同一焦点已不属于"本周"
    const nextWeek = NOW + 7 * DAY_MS
    expect(getWeekFocus(nextWeek).isCurrent).toBe(false)
    // 重新定 → 覆盖为新周 key
    setWeekFocus('全栈项目收尾', nextWeek)
    expect(getWeekFocus(nextWeek).isCurrent).toBe(true)
    expect(getWeekFocus(nextWeek).text).toBe('全栈项目收尾')
  })

  it('briefing：本周未定焦点给「定本周焦点」按钮；已定出正文行；未定不出按钮', () => {
    const notSet = buildEnterButtons({ weekFocus: { text: '', isCurrent: false, weekKey: '' } })
    expect(notSet.find(b => b.key === 'focus')).toBeTruthy()
    const set = buildEnterButtons({ weekFocus: { text: 'X', isCurrent: true, weekKey: WEEK_START } })
    expect(set.find(b => b.key === 'focus')).toBeUndefined()
    const lines = buildEnterLines({ eventsTotal: 0, diaryCount: 0, weekFocus: { text: '补齐 Java 后端', isCurrent: true, weekKey: WEEK_START } })
    expect(lines.some(l => l === '本周焦点：补齐 Java 后端')).toBe(true)
  })
})
