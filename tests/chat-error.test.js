/**
 * chat-error - 流式请求错误透出与重试策略
 * 覆盖：chat-chunked 错误解析、streamRetry 可重试性判定与请求次数
 */
import { describe, it, expect, vi } from 'vitest'
import './setup.js'
import { parseApiError, computeChunkDelta } from '@/utils/ai/chat-chunked.js'
import { isRetryableError, retryStreamWithBackoff } from '@/utils/ai/streamRetry.js'

describe('parseApiError', () => {
  it('对象错误提取 error.message', () => {
    expect(parseApiError({ error: { message: 'Model Not Exist' } })).toBe('Model Not Exist')
  })

  it('JSON 字符串错误可解析', () => {
    expect(parseApiError('{"error":{"message":"invalid image"}}')).toBe('invalid image')
  })

  it('message / errMsg 字段兜底', () => {
    expect(parseApiError({ message: 'boom' })).toBe('boom')
    expect(parseApiError({ errMsg: 'request fail' })).toBe('request fail')
  })

  it('空值与普通字符串处理', () => {
    expect(parseApiError('')).toBe('')
    expect(parseApiError(null)).toBe('')
    expect(parseApiError(undefined)).toBe('')
    expect(parseApiError('raw text')).toBe('raw text')
  })

  it('超长错误信息截断到 300 字符', () => {
    const msg = 'x'.repeat(500)
    expect(parseApiError({ error: { message: msg } }).length).toBe(300)
  })
})

describe('isRetryableError', () => {
  it('参数/权限类 4xx 不重试', () => {
    expect(isRetryableError({ _error: 'HTTP 400: bad request' })).toBe(false)
    expect(isRetryableError({ _error: 'HTTP 401: unauthorized' })).toBe(false)
    expect(isRetryableError({ _error: 'HTTP 404' })).toBe(false)
  })

  it('限流与 5xx 可重试', () => {
    expect(isRetryableError({ _error: 'HTTP 429: too many requests' })).toBe(true)
    expect(isRetryableError({ _error: 'HTTP 500' })).toBe(true)
    expect(isRetryableError({ _error: 'HTTP 503' })).toBe(true)
  })

  it('网络错误与空回复可重试', () => {
    expect(isRetryableError({ _error: 'request:fail timeout' })).toBe(true)
    expect(isRetryableError({})).toBe(true)
    expect(isRetryableError(null)).toBe(true)
  })
})

describe('retryStreamWithBackoff', () => {
  it('非可重试错误只请求一次并透出错误', async () => {
    const streamFn = vi.fn().mockResolvedValue({
      reply: '',
      _emptyReply: true,
      _error: 'HTTP 400: Model Not Exist'
    })
    const updateLastMessage = vi.fn()
    const { result, streamedText } = await retryStreamWithBackoff(streamFn, 'hi', updateLastMessage, null)
    expect(streamFn).toHaveBeenCalledTimes(1)
    expect(updateLastMessage).not.toHaveBeenCalled()
    expect(result._error).toBe('HTTP 400: Model Not Exist')
    expect(streamedText).toBe('')
  })

  it('正常回复直接返回，不触发重试', async () => {
    const streamFn = vi.fn().mockResolvedValue({ reply: 'ok', action: null })
    const { result, streamedText } = await retryStreamWithBackoff(streamFn, 'hi', vi.fn(), null)
    expect(streamFn).toHaveBeenCalledTimes(1)
    expect(result.reply).toBe('ok')
    expect(streamedText).toBe('ok')
  })
})


describe('computeChunkDelta', () => {
  it('累积模式：只取新增部分', () => {
    expect(computeChunkDelta('', 'A')).toEqual({ delta: 'A', processed: 'A' })
    expect(computeChunkDelta('A', 'AB')).toEqual({ delta: 'B', processed: 'AB' })
    expect(computeChunkDelta('AB', 'ABCD')).toEqual({ delta: 'CD', processed: 'ABCD' })
  })

  it('增量模式：新内容直接处理', () => {
    expect(computeChunkDelta('A', 'B')).toEqual({ delta: 'B', processed: 'AB' })
    expect(computeChunkDelta('ABC', 'D')).toEqual({ delta: 'D', processed: 'ABCD' })
  })

  it('相同数据重发：返回空增量，避免整段重复', () => {
    expect(computeChunkDelta('AB', 'AB')).toEqual({ delta: '', processed: 'AB' })
    expect(computeChunkDelta('ABCD', 'ABCD')).toEqual({ delta: '', processed: 'ABCD' })
  })

  it('空数据直接跳过', () => {
    expect(computeChunkDelta('AB', '')).toEqual({ delta: '', processed: 'AB' })
    expect(computeChunkDelta('AB', null)).toEqual({ delta: '', processed: 'AB' })
  })
})
