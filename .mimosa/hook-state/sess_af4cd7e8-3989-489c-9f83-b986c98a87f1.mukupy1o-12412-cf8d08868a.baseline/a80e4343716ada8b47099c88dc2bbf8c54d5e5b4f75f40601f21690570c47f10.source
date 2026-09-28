import { describe, it, expect, vi } from 'vitest'
import { debounce, throttle } from '@/utils/debounce.js'

describe('debounce.js', () => {
  it('debounce 应延迟执行', () => {
    return new Promise(resolve => {
      const fn = vi.fn()
      const debounced = debounce(fn, 50)
      debounced()
      expect(fn).not.toHaveBeenCalled()
      setTimeout(() => {
        expect(fn).toHaveBeenCalledTimes(1)
        resolve()
      }, 100)
    })
  })

  it('debounce 多次调用应只执行最后一次', () => {
    return new Promise(resolve => {
      const fn = vi.fn()
      const debounced = debounce(fn, 50)
      debounced('a')
      debounced('b')
      debounced('c')
      setTimeout(() => {
        expect(fn).toHaveBeenCalledTimes(1)
        expect(fn).toHaveBeenCalledWith('c')
        resolve()
      }, 100)
    })
  })

  it('debounce.cancel 应取消待执行调用', () => {
    return new Promise(resolve => {
      const fn = vi.fn()
      const debounced = debounce(fn, 50)
      debounced()
      debounced.cancel()
      setTimeout(() => {
        expect(fn).not.toHaveBeenCalled()
        resolve()
      }, 100)
    })
  })

  it('throttle 应在间隔内只执行一次', () => {
    return new Promise(resolve => {
      const fn = vi.fn()
      const throttled = throttle(fn, 50)
      throttled()
      throttled()
      throttled()
      expect(fn).toHaveBeenCalledTimes(1)
      setTimeout(() => {
        resolve()
      }, 100)
    })
  })
})
