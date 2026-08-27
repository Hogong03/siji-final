import { describe, it, expect } from 'vitest'
import { parseDateTime, combineDateTime, toPlanTs } from '@/utils/datetime.js'

describe('datetime.js', () => {
  it('parseDateTime 应解析 "YYYY-MM-DD HH:mm:ss"', () => {
    const result = parseDateTime('2026-07-19 14:30:00')
    expect(result.date).toBe('2026-07-19')
    expect(result.time).toBe('14:30:00')
  })

  it('parseDateTime 应解析 "YYYY-MM-DD HH:mm"', () => {
    const result = parseDateTime('2026-07-19 14:30')
    expect(result.date).toBe('2026-07-19')
    expect(result.time).toBe('14:30')
  })

  it('parseDateTime 应解析仅日期 "YYYY-MM-DD"', () => {
    const result = parseDateTime('2026-07-19')
    expect(result.date).toBe('2026-07-19')
    expect(result.time).toBe('')
  })

  it('parseDateTime 对空值应返回空对象', () => {
    expect(parseDateTime('')).toEqual({ date: '', time: '' })
    expect(parseDateTime(null)).toEqual({ date: '', time: '' })
  })

  it('parseDateTime 对非日期字符串应返回原值', () => {
    const result = parseDateTime('hello')
    expect(result.date).toBe('hello')
    expect(result.time).toBe('')
  })

  it('combineDateTime 应合并日期和时间', () => {
    expect(combineDateTime('2026-07-19', '14:30')).toBe('2026-07-19 14:30')
    expect(combineDateTime('2026-07-19', '14:30:00')).toBe('2026-07-19 14:30')
  })

  it('combineDateTime 无时间应只返回日期', () => {
    expect(combineDateTime('2026-07-19', '')).toBe('2026-07-19')
    expect(combineDateTime('2026-07-19', null)).toBe('2026-07-19')
  })

  it('combineDateTime 无日期应返回空', () => {
    expect(combineDateTime('', '14:30')).toBe('')
  })

  it('combineDateTime 应补零', () => {
    expect(combineDateTime('2026-07-19', '9:5')).toBe('2026-07-19 09:05')
  })

  it('toPlanTs 解析标准日期时间', () => {
    const ts = toPlanTs('2026-08-22 09:30')
    expect(ts).toBe(new Date(2026, 7, 22, 9, 30).getTime())
  })

  it('toPlanTs 容忍非补零日期', () => {
    const ts = toPlanTs('2026-8-5')
    expect(ts).toBe(new Date(2026, 7, 5).getTime())
  })

  it('toPlanTs date-only 默认当天 0 点，endOfDay 为 23:59:59', () => {
    const ts = toPlanTs('2026-08-22')
    expect(ts).toBe(new Date(2026, 7, 22).getTime())
    expect(toPlanTs('2026-08-22', true)).toBe(new Date(2026, 7, 22).getTime() + 86400000 - 1)
  })

  it('toPlanTs 空值/非法输入返回 null', () => {
    expect(toPlanTs('')).toBe(null)
    expect(toPlanTs(null)).toBe(null)
    expect(toPlanTs('abc')).toBe(null)
  })
})
