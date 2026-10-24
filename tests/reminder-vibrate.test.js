/**
 * reminder-vibrate.test.js — 应用内提醒震动（4.48.2）
 *
 * 真机故障：notifier 调用了不存在的 `uni.vibrate`，每次提醒都打一条
 * 「vibrate failed: uni.vibrate is not a function」，震动从未生效。
 *
 * 锁三件事：
 *  1. 有 uni.vibrateShort 就用它（medium + fail 回调吞掉机型不支持）
 *  2. uni 接口缺失时退到 plus.device.vibrate
 *  3. 都没有 / 抛错时静默 false，且源码里不再出现 uni.vibrate
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { vibrateForReminder } from '../utils/reminder/vibrate.js'

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

describe('vibrateForReminder', () => {
  it('优先 uni.vibrateShort（medium，带 fail 回调）', () => {
    const calls = []
    const uni = { vibrateShort: (opts) => calls.push(opts) }
    expect(vibrateForReminder({ uni, plus: null })).toBe(true)
    expect(calls.length).toBe(1)
    expect(calls[0].type).toBe('medium')
    expect(typeof calls[0].fail).toBe('function')
  })

  it('uni 没有震动接口 → 退到 plus.device.vibrate', () => {
    const calls = []
    const plus = { device: { vibrate: (ms) => calls.push(ms) } }
    expect(vibrateForReminder({ uni: {}, plus })).toBe(true)
    expect(calls).toEqual([120])
  })

  it('vibrateShort 抛错时仍尝试 plus 兜底', () => {
    let plusCalled = 0
    const uni = { vibrateShort: () => { throw new Error('no permission') } }
    const plus = { device: { vibrate: () => { plusCalled++ } } }
    expect(vibrateForReminder({ uni, plus })).toBe(true)
    expect(plusCalled).toBe(1)
  })

  it('两端都不支持 → false，不抛错', () => {
    expect(vibrateForReminder({ uni: {}, plus: {} })).toBe(false)
    expect(vibrateForReminder({ uni: null, plus: null })).toBe(false)
  })
})

describe('源码守卫', () => {
  it('不再调用不存在的 uni.vibrate（官方只有 vibrateShort / vibrateLong）', () => {
    const notifier = read('../utils/reminder/notifier.js')
    expect(notifier).not.toMatch(/uni\.vibrate\s*\(/)
    expect(notifier).toContain('vibrateForReminder')
  })
})
