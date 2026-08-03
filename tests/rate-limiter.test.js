/**
 * rate-limiter.js 测试
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { checkRateLimit, recordRequest, resetRateLimiter, waitForAvailability } from '@/utils/ai/rate-limiter.js'

describe('rate-limiter.js', () => {
  beforeEach(() => {
    resetRateLimiter()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('首次请求应允许', () => {
    const result = checkRateLimit()
    expect(result.allowed).toBe(true)
    expect(result.waitMs).toBe(0)
  })

  it('最小间隔内第二次请求应被拒绝', () => {
    recordRequest()
    const result = checkRateLimit()
    expect(result.allowed).toBe(false)
    expect(result.waitMs).toBeGreaterThan(0)
  })

  it('等待最小间隔后应允许', () => {
    recordRequest()
    vi.advanceTimersByTime(1100) // > MIN_INTERVAL (500ms)
    const result = checkRateLimit()
    expect(result.allowed).toBe(true)
  })

  it('超过窗口最大请求数应被拒绝', () => {
    // 模拟 20 次请求（每次间隔 > MIN_INTERVAL）
    for (let i = 0; i < 20; i++) {
      vi.advanceTimersByTime(1100)
      recordRequest()
    }
    vi.advanceTimersByTime(1100)
    const result = checkRateLimit()
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('限制')
  })

  it('resetRateLimiter 应清空所有状态', () => {
    recordRequest()
    recordRequest()
    resetRateLimiter()
    const result = checkRateLimit()
    expect(result.allowed).toBe(true)
  })

  it('waitForAvailability 在限流解除后应返回 true', async () => {
    recordRequest()
    const promise = waitForAvailability(2000)
    vi.advanceTimersByTime(1100)
    const result = await promise
    expect(result).toBe(true)
  })
})
