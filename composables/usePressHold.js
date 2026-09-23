/**
 * usePressHold — 「长按」手势（4.4.0）
 *
 * 为什么不用 uni 的 @longpress：
 *   原生 longpress 只看「按住不动 350ms」，不看手指有没有滑动。列表里滑动页面时
 *   手指常常先按住再滑动，长按照样触发 —— 反馈列表就因此「滑动时弹出删除」。
 *
 * 这套判定补两条：① 按住期间手指移动超过容差就取消；② 触发后的一小段时间里
 * 忽略随后的 tap，避免长按弹窗的同时又跳进编辑页。
 *
 * 纯逻辑、不碰 DOM：手指坐标由调用方从事件里取，便于单测。
 */

/** 默认按住时长（ms）：比原生 350ms 略长，滑动时更不容易误触 */
export const PRESS_HOLD_DELAY = 550

/** 默认容差（px）：按住期间移动超过这个距离就当作滑动 */
export const PRESS_HOLD_TOLERANCE = 10

/** 触发后忽略 tap 的时长（ms） */
export const PRESS_HOLD_TAP_GUARD = 600

/**
 * 从触摸事件里取坐标（三端字段不一致，逐个回落）
 * @param {object} e
 * @returns {{x: number, y: number}}
 */
export function touchPoint(e) {
  const t = (e && (e.touches && e.touches[0])) || (e && e.changedTouches && e.changedTouches[0]) || null
  if (!t) return { x: 0, y: 0 }
  const x = t.clientX != null ? t.clientX : (t.pageX != null ? t.pageX : 0)
  const y = t.clientY != null ? t.clientY : (t.pageY != null ? t.pageY : 0)
  return { x: Number(x) || 0, y: Number(y) || 0 }
}

/**
 * 创建一个长按判定器
 * @param {{delay?: number, tolerance?: number, tapGuard?: number, now?: () => number, setTimer?: Function, clearTimer?: Function}} options
 */
export function createPressHold(options = {}) {
  const delay = Number(options.delay) > 0 ? Number(options.delay) : PRESS_HOLD_DELAY
  const tolerance = Number(options.tolerance) > 0 ? Number(options.tolerance) : PRESS_HOLD_TOLERANCE
  const tapGuard = Number(options.tapGuard) >= 0 ? Number(options.tapGuard) : PRESS_HOLD_TAP_GUARD
  const now = options.now || (() => Date.now())
  const setTimer = options.setTimer || ((fn, ms) => setTimeout(fn, ms))
  const clearTimer = options.clearTimer || ((id) => clearTimeout(id))

  let timer = null
  let startX = 0
  let startY = 0
  let moved = false
  let firedAt = 0

  function cancel() {
    if (timer !== null) {
      clearTimer(timer)
      timer = null
    }
  }

  /**
   * 手指按下：开始计时
   * @param {object} point {x,y}
   * @param {Function} onFire 达到时长且没滑动时调用
   */
  function start(point, onFire) {
    cancel()
    startX = point ? Number(point.x) || 0 : 0
    startY = point ? Number(point.y) || 0 : 0
    moved = false
    timer = setTimer(() => {
      timer = null
      if (moved) return
      firedAt = now()
      if (typeof onFire === 'function') onFire()
    }, delay)
  }

  /** 手指移动：超过容差即判定为滑动，取消长按 */
  function move(point) {
    if (moved) return true
    if (timer === null) return false
    const x = point ? Number(point.x) || 0 : 0
    const y = point ? Number(point.y) || 0 : 0
    if (Math.abs(x - startX) > tolerance || Math.abs(y - startY) > tolerance) {
      moved = true
      cancel()
      return true
    }
    return false
  }

  /** 手指抬起 / 触摸取消：不再等待 */
  function end() {
    cancel()
  }

  /** 刚触发过长按吗（用于忽略随后那次 tap） */
  function justFired() {
    return firedAt > 0 && (now() - firedAt) < tapGuard
  }

  return { start, move, end, cancel, justFired, get pending() { return timer !== null } }
}

/**
 * Vue 组件里用的封装：每个实例一份状态
 * @param {object} options
 */
export function usePressHold(options = {}) {
  const hold = createPressHold(options)

  function onTouchStart(e, onFire) {
    hold.start(touchPoint(e), onFire)
  }
  function onTouchMove(e) {
    return hold.move(touchPoint(e))
  }
  function onTouchEnd() {
    hold.end()
  }

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    cancel: hold.cancel,
    justFired: hold.justFired
  }
}
