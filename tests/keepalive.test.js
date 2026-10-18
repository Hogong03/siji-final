/**
 * test: Android 后台常驻封装（4.35.0）
 *
 * 覆盖 utils/keepalive.js 的纯逻辑与降级路径：
 *  - 开关归一（只认显式真值，默认关）
 *  - shouldStartKeepAlive 双条件（开关 + 平台支持）
 *  - buildStartSpec 的 Service 类名 / action / 文案兜底
 *  - androidMajorVersion 解析（决定 startForegroundService 还是 startService）
 *  - 插件没打进包时（node 环境没有 plus）全部安全降级为 false / no-op
 *
 * 注意：App 端真实拉起 Service 的行为**只能在真机验证**（docs/真机验证清单.md），
 * 这里只保证不崩、不误启动。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import './setup.js'
import {
  KEEPALIVE_KEY,
  SERVICE_CLASS,
  ACTION_START,
  NOTIFY_TITLE,
  NOTIFY_TEXT,
  normalizeKeepAliveFlag,
  shouldStartKeepAlive,
  buildStartSpec,
  androidMajorVersion,
  isKeepAliveOn,
  setKeepAliveOn,
  isKeepAliveSupported,
  startKeepAlive,
  stopKeepAlive,
  syncKeepAlive,
  openBatteryOptimizationSettings,
  __resetKeepAliveCache
} from '../utils/keepalive.js'
import { resetStorage } from './setup.js'

beforeEach(() => {
  resetStorage()
  __resetKeepAliveCache()
})

describe('normalizeKeepAliveFlag（开关归一）', () => {
  it('显式真值才算开', () => {
    expect(normalizeKeepAliveFlag(true)).toBe(true)
    expect(normalizeKeepAliveFlag('1')).toBe(true)
    expect(normalizeKeepAliveFlag('true')).toBe(true)
    expect(normalizeKeepAliveFlag('TRUE')).toBe(true)
    expect(normalizeKeepAliveFlag(' on ')).toBe(true)
  })

  it('缺省 / 假值一律算关（默认关）', () => {
    ;[undefined, null, '', '0', 'false', 0, false, 'no', 'off'].forEach(v => {
      expect(normalizeKeepAliveFlag(v)).toBe(false)
    })
  })
})

describe('shouldStartKeepAlive（开关 + 平台支持）', () => {
  it('两个条件都满足才启动', () => {
    expect(shouldStartKeepAlive('1', true)).toBe(true)
    expect(shouldStartKeepAlive(true, true)).toBe(true)
  })

  it('缺任一条都不启动', () => {
    expect(shouldStartKeepAlive('1', false)).toBe(false)
    expect(shouldStartKeepAlive('0', true)).toBe(false)
    expect(shouldStartKeepAlive(undefined, false)).toBe(false)
  })
})

describe('buildStartSpec（Intent 参数）', () => {
  it('类名与 action 与 aar 里的 Service 一致', () => {
    const spec = buildStartSpec()
    expect(spec.className).toBe(SERVICE_CLASS)
    expect(spec.action).toBe(ACTION_START)
    expect(SERVICE_CLASS).toBe('com.siji.keepalive.SijiKeepAliveService')
    expect(ACTION_START).toBe('com.siji.keepalive.action.START')
  })

  it('文案缺省走常驻提示，传了就用传入值', () => {
    const d = buildStartSpec()
    expect(d.extraTitle).toBe(NOTIFY_TITLE)
    expect(d.extraText).toBe(NOTIFY_TEXT)
    const c = buildStartSpec('自定义标题', '自定义正文')
    expect(c.extraTitle).toBe('自定义标题')
    expect(c.extraText).toBe('自定义正文')
  })

  it('空串 / null 视为没传（否则通知栏会出现一条空白）', () => {
    expect(buildStartSpec('', '').extraTitle).toBe(NOTIFY_TITLE)
    expect(buildStartSpec(null, null).extraText).toBe(NOTIFY_TEXT)
  })
})

describe('androidMajorVersion（API 26 = Android 8.0 分界）', () => {
  it('解析主版本号', () => {
    expect(androidMajorVersion('13')).toBe(13)
    expect(androidMajorVersion('8.1.0')).toBe(8)
    expect(androidMajorVersion(9)).toBe(9)
  })

  it('读不到时返回 0（走 startService 分支，不冒 startForegroundService 的崩溃风险）', () => {
    expect(androidMajorVersion('')).toBe(0)
    expect(androidMajorVersion(undefined)).toBe(0)
    expect(androidMajorVersion(null)).toBe(0)
    expect(androidMajorVersion('abc')).toBe(0)
  })
})

describe('开关读写', () => {
  it('默认关', () => {
    expect(isKeepAliveOn()).toBe(false)
    expect(uni.getStorageSync(KEEPALIVE_KEY)).toBe('')
  })

  it('写入后能读回，并归一存储值', () => {
    expect(setKeepAliveOn(true)).toBe(true)
    expect(uni.getStorageSync(KEEPALIVE_KEY)).toBe('1')
    expect(isKeepAliveOn()).toBe(true)

    expect(setKeepAliveOn(false)).toBe(false)
    expect(uni.getStorageSync(KEEPALIVE_KEY)).toBe('0')
    expect(isKeepAliveOn()).toBe(false)
  })
})

describe('插件不可用时的降级（node 环境没有 plus）', () => {
  it('isKeepAliveSupported 为 false', () => {
    expect(isKeepAliveSupported()).toBe(false)
  })

  it('拉起 / 停止 / 电池优化都安全返回 false，不抛错', () => {
    expect(startKeepAlive()).toBe(false)
    expect(stopKeepAlive()).toBe(false)
    expect(openBatteryOptimizationSettings()).toBe(false)
  })

  it('syncKeepAlive：开关开着但本端不支持 → 不误报 acted', () => {
    setKeepAliveOn(true)
    const r = syncKeepAlive()
    expect(r.on).toBe(true)
    expect(r.supported).toBe(false)
    expect(r.acted).toBe(false)
  })

  it('syncKeepAlive：开关关着 → acted 恒 false', () => {
    const r = syncKeepAlive()
    expect(r.on).toBe(false)
    expect(r.acted).toBe(false)
  })
})
