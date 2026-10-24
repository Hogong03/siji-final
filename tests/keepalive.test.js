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
  MODULE_NAME,
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
  delete global.plus
  delete global.uni.requireNativePlugin
})

/** 最小 plus mock：Android 环境（4.48.2 起支持判据只看原生模块，importClass 不再参与判定） */
function mockPlusAndroid(extra) {
  global.plus = Object.assign({
    os: { name: 'Android' },
    android: { importClass: () => ({}) }
  }, extra || {})
}

/** 假原生模块：记录调用，模拟 uni.requireNativePlugin('siji-keepalive') 的返回 */
function mockNativeModule() {
  const calls = { start: [], stop: [] }
  const mod = {
    start(opts, cb) { calls.start.push({ opts, cb }) },
    stop(cb) { calls.stop.push({ cb }) }
  }
  global.uni.requireNativePlugin = (name) => (name === MODULE_NAME ? mod : null)
  return calls
}

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

describe('模块路径（4.35.2 正路：uni.requireNativePlugin）', () => {
  it('模块可用 → start 走模块并带文案兜底', () => {
    mockPlusAndroid()
    const calls = mockNativeModule()
    expect(isKeepAliveSupported()).toBe(true)

    expect(startKeepAlive()).toBe(true)
    expect(calls.start.length).toBe(1)
    // 不传 opts → 用常驻通知默认文案
    expect(calls.start[0].opts).toEqual({ title: NOTIFY_TITLE, text: NOTIFY_TEXT })
    expect(typeof calls.start[0].cb).toBe('function')

    // 传自定义文案 → 原样下发
    expect(startKeepAlive({ title: 'T', text: 'X' })).toBe(true)
    expect(calls.start[1].opts).toEqual({ title: 'T', text: 'X' })
  })

  it('stop 走模块路径', () => {
    mockPlusAndroid()
    const calls = mockNativeModule()
    expect(stopKeepAlive()).toBe(true)
    expect(calls.stop.length).toBe(1)
    expect(typeof calls.stop[0].cb).toBe('function')
  })

  it('模块回调 ok=false 不影响返回值（异步失败只记日志，反射同样会失败，不重试）', () => {
    mockPlusAndroid()
    let captured = null
    global.uni.requireNativePlugin = () => ({
      start(opts, cb) { captured = cb },
      stop() {}
    })
    expect(startKeepAlive()).toBe(true)
    expect(typeof captured).toBe('function')
    // 回执失败不抛错（logger.warn 吞掉）
    expect(() => captured({ ok: false, error: 'denied' })).not.toThrow()
    expect(() => captured(null)).not.toThrow()
  })

  it('模块缺失 → 不支持，不再用类探测误判（4.48.2 真机：标准基座类探测会过）', () => {
    mockPlusAndroid()
    expect(isKeepAliveSupported()).toBe(false)
    expect(startKeepAlive()).toBe(false)
    expect(stopKeepAlive()).toBe(false)
  })

  it('模块探测抛错 → 不支持且不落反射（aar 都没进包，反射也起不来）', () => {
    mockPlusAndroid()
    global.uni.requireNativePlugin = () => { throw new Error('bridge gone') }
    expect(isKeepAliveSupported()).toBe(false)
    expect(startKeepAlive()).toBe(false)
    delete global.uni.requireNativePlugin
    __resetKeepAliveCache()
  })

  it('开关关着时 syncKeepAlive 不探测插件（标准基座启动日志不再出现框架报错）', () => {
    mockPlusAndroid()
    let calls = 0
    global.uni.requireNativePlugin = () => { calls++; return null }
    const r = syncKeepAlive()
    expect(r).toEqual({ on: false, supported: false, acted: false })
    expect(calls).toBe(0)
  })

  it('requireNativePlugin 返回缺方法的对象 → 视为不可用，不调 start', () => {
    mockPlusAndroid()
    let called = 0
    global.uni.requireNativePlugin = () => ({ start() { called++ } }) // 缺 stop
    expect(startKeepAlive()).toBe(false)
    expect(called).toBe(0)
  })

  it('syncKeepAlive：开关开 + 平台支持 + 模块可用 → acted true', () => {
    mockPlusAndroid()
    const calls = mockNativeModule()
    setKeepAliveOn(true)
    const r = syncKeepAlive()
    expect(r).toEqual({ on: true, supported: true, acted: true })
    expect(calls.start.length).toBe(1)
  })
})
