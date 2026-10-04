/**
 * theme.js 运行时分支测试（4.12.3）
 *
 * 背景：App 端逻辑层没有 document，4.8.0 的 H5 DOM 挂类路径在 App 全程静默空转，
 * 表现为「App 端外观只能改 tabBar/导航栏（原生层），页面内容不跟色」。
 * 修复：App 分支改 plus.webview.all() 逐 WebView evalJS（buildToggleJs 产出注入脚本）。
 *
 * vitest 环境没有条件编译：theme.js 的三个平台赋值按顺序执行，最终绑定 App 分支
 * （需要 plus，node 里没有 → applyClass 静默返回，正好断言「不抛错」这条底线）。
 */
import { describe, it, expect } from 'vitest'
import './setup.js'
import { buildToggleJs, applyTheme, getThemeMode, setThemeMode } from '../utils/theme.js'

describe('buildToggleJs：注入 WebView 的类切换脚本', () => {
  it('深色 → classList.add，浅色 → classList.remove，脚本自带 try/catch', () => {
    expect(buildToggleJs(true)).toContain("classList.add('theme-dark')")
    expect(buildToggleJs(false)).toContain("classList.remove('theme-dark')")
    expect(buildToggleJs(true)).toMatch(/^try\{.*\}catch\(e\)\{\}$/)
  })
})

describe('App 分支在无 plus 环境的底线行为', () => {
  it('applyTheme 在 node（无 document 无 plus）下静默返回，不抛错', () => {
    expect(() => applyTheme()).not.toThrow()
  })

  it('setThemeMode 切档不抛错，模式可读回', () => {
    expect(() => setThemeMode('dark')).not.toThrow()
    expect(getThemeMode()).toBe('dark')
    expect(() => setThemeMode('light')).not.toThrow()
    expect(() => setThemeMode('system')).not.toThrow()
    expect(getThemeMode()).toBe('system')
  })
})
