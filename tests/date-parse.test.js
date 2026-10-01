/**
 * date-parse 测试（4.9.0）— 相对日期短语的确定性解析
 *
 * 固定 now = 2026-10-02（周五），weekStart = 09-28（周一）。
 * 周口径与 plan-recur 一致：周一为一周起点。
 */
import { describe, it, expect } from 'vitest'
import { rangeFromText } from '../utils/date-parse.js'

const NOW = new Date(2026, 9, 2, 14, 0, 0).getTime() // 2026-10-02 周五

describe('单日短语', () => {
  it('今天/明天/后天/大后天', () => {
    expect(rangeFromText('今天交', NOW)).toEqual({ start: '2026-10-02', end: '2026-10-02', name: '今天' })
    expect(rangeFromText('明天交', NOW)).toEqual({ start: '2026-10-03', end: '2026-10-03', name: '明天' })
    expect(rangeFromText('后天交', NOW)).toEqual({ start: '2026-10-04', end: '2026-10-04', name: '后天' })
    expect(rangeFromText('大后天交', NOW)).toEqual({ start: '2026-10-05', end: '2026-10-05', name: '大后天' })
  })

  it('大后天优先于后天匹配（长词先判）', () => {
    expect(rangeFromText('大后天', NOW).name).toBe('大后天')
  })

  it('下周三 → 下周那一天（单日）', () => {
    expect(rangeFromText('下周三交周报', NOW)).toEqual({ start: '2026-10-07', end: '2026-10-07', name: '下周三' })
  })

  it('本周三已过 → 取下周的同一天，不给过去的日子', () => {
    expect(rangeFromText('本周三开会', NOW)).toEqual({ start: '2026-10-07', end: '2026-10-07', name: '本周三' })
  })

  it('裸周几 → 未来最近的那天', () => {
    expect(rangeFromText('周五晚上整理', NOW)).toEqual({ start: '2026-10-02', end: '2026-10-02', name: '周五' })
    expect(rangeFromText('周一交', NOW)).toEqual({ start: '2026-10-05', end: '2026-10-05', name: '周一' })
  })
})

describe('区间短语', () => {
  it('下周 → 下周一到周日', () => {
    expect(rangeFromText('下周把房子收拾了', NOW)).toEqual({ start: '2026-10-05', end: '2026-10-11', name: '下周' })
  })

  it('本周 → 周一到当前/周日', () => {
    const r = rangeFromText('这周背完单词', NOW)
    expect(r.start).toBe('2026-09-28')
    expect(r.end).toBe('2026-10-04')
  })

  it('周末 / 下周末', () => {
    expect(rangeFromText('周末去趟书店', NOW)).toEqual({ start: '2026-10-03', end: '2026-10-04', name: '周末' })
    expect(rangeFromText('下周末露营', NOW)).toEqual({ start: '2026-10-10', end: '2026-10-11', name: '下周末' })
  })

  it('下个月 → 整月；月底 → 今天到月末', () => {
    expect(rangeFromText('下个月开始跑步', NOW)).toEqual({ start: '2026-11-01', end: '2026-11-30', name: '下个月' })
    expect(rangeFromText('月底前交总结', NOW)).toEqual({ start: '2026-10-02', end: '2026-10-31', name: '月底' })
  })
})

describe('边界', () => {
  it('无短语返回 null；空输入安全', () => {
    expect(rangeFromText('随便写点什么', NOW)).toBe(null)
    expect(rangeFromText('', NOW)).toBe(null)
    expect(rangeFromText(null, NOW)).toBe(null)
  })

  it('节日词不在本层（由 holidays.js 优先处理）', () => {
    // 「中秋」不是相对日期短语 —— 执行器先查节日表，查不到才落到这里
    expect(rangeFromText('中秋团圆', NOW)).toBe(null)
  })
})
