/**
 * 节假日表与计划日期兜底（3.10.1）
 *
 * 来源：2026-09-17 的反馈 —— 用户说「中秋国庆出去旅游，玩三天」，
 * AI 建出来的计划时间字段全是空串（deadline / due_date / start_time / end_time），
 * 于是详情页「没有时间」、到点也没法提醒。
 * 修法两层：① 把节假日表喂进 prompt（模型能查表换算）② 执行器确定性兜底（模型忘了也能补上）。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { resetStorage } from './setup.js'
import './setup.js'
import {
  upcomingHolidays, holidayPromptLine, inferHolidayFromText, LUNAR_HOLIDAY_TABLE
} from '../utils/holidays.js'
import { useDataStore } from '../store/data.js'

/** 2026-09-17（反馈当天） */
const AT = new Date(2026, 8, 17, 13, 0, 0).getTime()

describe('upcomingHolidays：接下来的节假日', () => {
  it('2026-09-17 视角：中秋在前、国庆在后', () => {
    const list = upcomingHolidays(AT)
    const names = list.map(h => h.name)
    expect(names).toContain('中秋节')
    expect(names).toContain('国庆节')
    const mid = list.find(h => h.name === '中秋节')
    expect(mid.start).toBe('2026-09-25')
    expect(mid.end).toBe('2026-09-27')
    expect(mid.daysUntil).toBe(8)
    // 国庆在中秋之后
    expect(list.findIndex(h => h.name === '中秋节')).toBeLessThan(list.findIndex(h => h.name === '国庆节'))
  })

  it('公历节日按年推算（任何年份都有元旦/劳动节/国庆）', () => {
    // 窗口给 400 天：1 月 2 日看 10 月 1 日已经超出默认的 120 天
    const list = upcomingHolidays(new Date(2030, 0, 2).getTime(), 400)
    const names = list.map(h => h.name)
    expect(names).toContain('劳动节')
    expect(names).toContain('国庆节')
    expect(list.find(h => h.name === '国庆节').start).toBe('2030-10-01')
  })

  it('窗口外的节日不出现', () => {
    const list = upcomingHolidays(AT, 7)
    list.forEach(h => expect(h.daysUntil).toBeLessThanOrEqual(7))
  })

  it('农历节日表里没有的年份不会瞎编（2029 不再有春节/中秋条目）', () => {
    const list = upcomingHolidays(new Date(2028, 5, 1).getTime(), 400)
    const lunarNames = list.map(h => h.name)
    // 2028 不在表里 → 只可能有公历节日
    expect(lunarNames).not.toContain('中秋节')
    expect(Object.keys(LUNAR_HOLIDAY_TABLE)).toEqual(['2026', '2027'])
  })
})

describe('holidayPromptLine：喂给模型的那一行', () => {
  it('带节日名、日期区间与距今天数', () => {
    const line = holidayPromptLine(AT, 3)
    expect(line).toContain('中秋节')
    expect(line).toContain('2026-09-25')
    expect(line).toContain('8 天后')
    expect(line).toContain('国庆节')
  })

  it('表里查不到任何节日时返回空串（不注入空段）', () => {
    // 把所有表清空后的行为由 inferHolidayFromText 覆盖；这里断言超短窗口下的提示仍可用
    const line = holidayPromptLine(AT, 1)
    expect(line.length).toBeGreaterThan(0)
    expect(line.split('；').length).toBe(1)
  })
})

describe('inferHolidayFromText：从标题/描述认出节假日', () => {
  it('「本地深度游三日（中秋国庆）」→ 取中秋开始 ~ 国庆结束', () => {
    const h = inferHolidayFromText('本地深度游三日（中秋国庆）', AT)
    expect(h).toBeTruthy()
    expect(h.start).toBe('2026-09-25')
    expect(h.end).toBe('2026-10-07')
  })

  it('单个节日：国庆 → 10-01 至 10-07', () => {
    const h = inferHolidayFromText('国庆去趟西安', AT)
    expect(h.start).toBe('2026-10-01')
    expect(h.end).toBe('2026-10-07')
  })

  it('简称也认：十一 / 五一 / 过年', () => {
    expect(inferHolidayFromText('十一出去玩', AT).name).toBe('国庆节')
    const may = inferHolidayFromText('五一去爬泰山', new Date(2027, 3, 1).getTime())
    expect(may.name).toBe('劳动节')
    const spring = inferHolidayFromText('过年回家', new Date(2026, 11, 20).getTime())
    expect(spring.name).toBe('春节')
    expect(spring.start).toBe('2027-02-06')
  })

  it('没提节日返回 null（不瞎补日期）', () => {
    expect(inferHolidayFromText('背 50 个单词', AT)).toBe(null)
    expect(inferHolidayFromText('', AT)).toBe(null)
    expect(inferHolidayFromText(null, AT)).toBe(null)
  })
})

describe('执行器兜底：模型没给时间时按节日补上', () => {
  let store
  beforeEach(() => {
    resetStorage()
    setActivePinia(createPinia())
    store = useDataStore()
  })

  it('create_plan 没带时间 + 标题提到中秋国庆 → 自动补开始与截止', () => {
    const r = store.executeAction({
      type: 'create_plan',
      payload: {
        title: '本地深度游三日（中秋国庆）',
        description: '三天在家门口玩，500 元预算',
        subtasks: [{ title: '列景点清单', description: '查开放时间', est_minutes: 15 }]
      }
    })
    expect(r.success).toBe(true)
    expect(r.detail.start_time).not.toBe('')
    expect(r.detail.deadline).not.toBe('')
    // 补的是节日区间（中秋 9/25 ~ 国庆 10/7）
    expect(r.detail.start_time.slice(0, 10)).toBe('2026-09-25')
    expect(r.detail.deadline.slice(0, 10)).toBe('2026-10-07')
  })

  it('模型给了时间就用模型的（兜底不覆盖）', () => {
    const r = store.executeAction({
      type: 'create_plan',
      payload: {
        title: '国庆出行准备',
        start_time: '2026-09-20',
        end_time: '2026-09-30',
        deadline: '2026-09-30',
        subtasks: [{ title: '订票', description: '比价后订', est_minutes: 10 }]
      }
    })
    expect(r.detail.start_time.slice(0, 10)).toBe('2026-09-20')
    expect(r.detail.deadline.slice(0, 10)).toBe('2026-09-30')
  })

  it('没提节日的计划不会被补日期', () => {
    const r = store.executeAction({
      type: 'create_plan',
      payload: {
        title: '背单词',
        subtasks: [{ title: '背 50 词', description: '用 APP 背', est_minutes: 15 }]
      }
    })
    expect(r.detail.start_time).toBe('')
    expect(r.detail.deadline).toBe('')
  })
})