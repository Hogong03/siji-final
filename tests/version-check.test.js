import { describe, it, expect } from 'vitest'
import './setup.js'
import { compareVersion, getVersion, getVersionStatus, isRunningOlderThan } from '@/utils/version-check.js'
import manifest from '../manifest.json'

describe('version-check.js', () => {
  it('compareVersion 应正确比较语义化版本', () => {
    expect(compareVersion('1.0.0', '1.0.0')).toBe(0)
    expect(compareVersion('1.0.1', '1.0.0')).toBe(1)
    expect(compareVersion('1.0.0', '1.0.1')).toBe(-1)
    expect(compareVersion('2.0.0', '1.9.9')).toBe(1)
    expect(compareVersion('1.0.0', '2.0.0')).toBe(-1)
  })

  it('compareVersion 应处理不同位数版本号', () => {
    expect(compareVersion('1.0', '1.0.0')).toBe(0)
    expect(compareVersion('1.0.1', '1.0')).toBe(1)
    expect(compareVersion('1.0', '1.0.1')).toBe(-1)
  })

  it('compareVersion 应处理空值', () => {
    expect(compareVersion('', '')).toBe(0)
    expect(compareVersion('1.0.0', '')).toBe(1)
    expect(compareVersion('', '1.0.0')).toBe(-1)
  })

  it('compareVersion 应处理非数字部分', () => {
    expect(compareVersion('1.0.0', '1.0.b')).toBe(0) // 'b' → NaN → 0
  })

  it('getVersion 等于 manifest.versionName（版本号不许再回落成 1.0.0）', () => {
    expect(getVersion()).toBe(manifest.versionName)
    expect(getVersion()).not.toBe('1.0.0')
  })

  it('isRunningOlderThan：运行版本落后于日志最新时为真（版本历史页据此提示旧构建）', () => {
    // 运行版本 = manifest（4.x 起 getVersion 读编译进包的 versionName）
    expect(isRunningOlderThan('1.0.0')).toBe(false)   // 日志比运行版本旧 → 不是旧构建
    expect(isRunningOlderThan(getVersion())).toBe(false)
    expect(isRunningOlderThan('99.0.0')).toBe(true)    // 日志已经更高 → 说明在跑旧构建
    expect(isRunningOlderThan('')).toBe(false)         // 拿不到日志版本时不误报
  })

  it('getVersion 应返回版本字符串', () => {
    const v = getVersion()
    expect(typeof v).toBe('string')
    expect(v.length).toBeGreaterThan(0)
  })

  it('getVersionStatus 应返回状态对象', () => {
    const status = getVersionStatus()
    expect(status).toHaveProperty('current')
    expect(status).toHaveProperty('lastKnown')
    expect(status).toHaveProperty('updated')
    expect(status).toHaveProperty('lastCheckTime')
    expect(typeof status.current).toBe('string')
    expect(typeof status.updated).toBe('boolean')
  })
})
