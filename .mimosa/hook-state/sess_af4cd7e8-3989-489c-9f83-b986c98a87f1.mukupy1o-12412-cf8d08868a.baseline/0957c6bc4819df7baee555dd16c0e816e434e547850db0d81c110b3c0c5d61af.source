/**
 * 长按手势（4.4.0）
 *
 * 背景：反馈列表用 uni 原生 @longpress 做删除，滑动页面时手指先按住再滑，
 * 长按照样触发 —— 用户反馈「在历史反馈里滑动页面也会触发删除」。
 * 这里用自研判定替换：按住超时 + 手指没移动，才认。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import './setup.js'
import {
  createPressHold,
  touchPoint,
  PRESS_HOLD_DELAY,
  PRESS_HOLD_TOLERANCE
} from '../composables/usePressHold.js'

const ROOT = process.cwd()
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')

/** 手动时钟：不依赖真实计时器，测试完全确定 */
function makeClock() {
  let t = 0
  let seq = 0
  const jobs = new Map()
  return {
    now: () => t,
    setTimer: (fn, ms) => {
      const id = ++seq
      jobs.set(id, { fn, at: t + ms })
      return id
    },
    clearTimer: (id) => jobs.delete(id),
    advance: (ms) => {
      t += ms
      for (const [id, job] of [...jobs]) {
        if (job.at <= t) {
          jobs.delete(id)
          job.fn()
        }
      }
    },
    get pendingCount() {
      return jobs.size
    }
  }
}

function makeHold() {
  const clock = makeClock()
  const hold = createPressHold({
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer
  })
  return { clock, hold }
}

describe('长按判定：按住才算，滑动不算', () => {
  it('按住不动到时长 → 触发', () => {
    const { clock, hold } = makeHold()
    let fired = 0
    hold.start({ x: 100, y: 200 }, () => fired++)
    clock.advance(PRESS_HOLD_DELAY - 1)
    expect(fired).toBe(0)
    clock.advance(1)
    expect(fired).toBe(1)
  })

  it('按住时手指滑动超过容差 → 不触发（这就是滑动误删的根因）', () => {
    const { clock, hold } = makeHold()
    let fired = 0
    hold.start({ x: 100, y: 200 }, () => fired++)
    clock.advance(120)
    expect(hold.move({ x: 100, y: 200 + PRESS_HOLD_TOLERANCE + 6 })).toBe(true)
    clock.advance(2000)
    expect(fired).toBe(0)
    expect(hold.pending).toBe(false)
  })

  it('容差内的轻微抖动不算滑动', () => {
    const { clock, hold } = makeHold()
    let fired = 0
    hold.start({ x: 100, y: 200 }, () => fired++)
    clock.advance(100)
    expect(hold.move({ x: 103, y: 205 })).toBe(false)
    clock.advance(PRESS_HOLD_DELAY)
    expect(fired).toBe(1)
  })

  it('滑走又滑回来也不算长按（一旦判为滑动就作废）', () => {
    const { clock, hold } = makeHold()
    let fired = 0
    hold.start({ x: 0, y: 0 }, () => fired++)
    hold.move({ x: 80, y: 0 })
    hold.move({ x: 0, y: 0 })
    clock.advance(2000)
    expect(fired).toBe(0)
  })

  it('提前抬手 → 不触发，且不留悬挂计时器', () => {
    const { clock, hold } = makeHold()
    let fired = 0
    hold.start({ x: 10, y: 10 }, () => fired++)
    clock.advance(300)
    hold.end()
    expect(clock.pendingCount).toBe(0)
    clock.advance(2000)
    expect(fired).toBe(0)
  })

  it('触发后 600ms 内忽略随后的 tap，之后恢复', () => {
    const { clock, hold } = makeHold()
    hold.start({ x: 1, y: 1 }, () => {})
    clock.advance(PRESS_HOLD_DELAY)
    expect(hold.justFired()).toBe(true)
    clock.advance(599)
    expect(hold.justFired()).toBe(true)
    clock.advance(2)
    expect(hold.justFired()).toBe(false)
  })
})

describe('触摸坐标：三端字段回落', () => {
  it('优先 clientX/Y', () => {
    expect(touchPoint({ touches: [{ clientX: 12, clientY: 34 }] })).toEqual({ x: 12, y: 34 })
  })

  it('没有 clientX 时回落 pageX/Y', () => {
    expect(touchPoint({ touches: [{ pageX: 5, pageY: 6 }] })).toEqual({ x: 5, y: 6 })
  })

  it('用 changedTouches（touchend）也取得到', () => {
    expect(touchPoint({ changedTouches: [{ clientX: 7, clientY: 8 }] })).toEqual({ x: 7, y: 8 })
  })

  it('空事件不炸', () => {
    expect(touchPoint(null)).toEqual({ x: 0, y: 0 })
    expect(touchPoint({})).toEqual({ x: 0, y: 0 })
  })
})

describe('反馈列表静态回归', () => {
  it('不再使用原生 @longpress 做删除', () => {
    const vue = read('pages/settings/sub/feedback-list.vue')
    // 只看绑定，注释里提到 @longpress 不算（那段注释正是在解释为什么不用它）
    expect(vue).not.toMatch(/@longpress\s*=/)
    expect(vue).toContain('usePressHold')
    expect(vue).toContain('@touchmove="press.onTouchMove($event)"')
    expect(vue).toContain('press.justFired()')
  })
})
