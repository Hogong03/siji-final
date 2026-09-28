/**
 * nav-helper.js 测试
 */
import { describe, it, expect, vi } from 'vitest'
import './setup.js'
import { safeNavigateBack } from '@/utils/nav-helper.js'

describe('nav-helper.js', () => {
  it('正常返回时调用 navigateBack', () => {
    const mockBack = vi.fn()
    global.uni.navigateBack = mockBack
    safeNavigateBack()
    expect(mockBack).toHaveBeenCalled()
    // navigateBack 会被传入 { delta, fail } 对象
    expect(mockBack.mock.calls[0][0].delta).toBe(1)
  })

  it('navigateBack 失败时 fallback 到 switchTab', () => {
    global.uni.navigateBack = ({ fail }) => fail(new Error('no history'))
    const mockSwitch = vi.fn()
    global.uni.switchTab = mockSwitch
    safeNavigateBack()
    expect(mockSwitch).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/chat/index' }))
  })

  it('带自定义 delta', () => {
    const mockBack = vi.fn()
    global.uni.navigateBack = mockBack
    safeNavigateBack({ delta: 2 })
    expect(mockBack.mock.calls[0][0].delta).toBe(2)
  })

  it('带自定义 fallback url', () => {
    global.uni.navigateBack = ({ fail }) => fail(new Error('no history'))
    const mockSwitch = vi.fn()
    global.uni.switchTab = mockSwitch
    safeNavigateBack({ fallback: '/pages/functions/index' })
    expect(mockSwitch).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/functions/index' }))
  })
})
