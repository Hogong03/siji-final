/**
 * 主题三态切换测试（4.8.0）
 *
 * 覆盖：
 *   1. utils/theme.js 纯函数层：normalizeMode 非法值归 system
 *   2. 守卫测试：全项目 CSS 深色规则必须走条件编译双路径 ——
 *      所有 @media (prefers-color-scheme) 必须位于 /* #ifdef MP-WEIXIN *​/ 分支内，
 *      且同文件 .theme-dark 类块（H5/App 路径）与 media 块一比一配对。
 *      防回归：以后新写的深色块漏掉包装，手动切换就会失效。
 *   3. 布线测试：useTheme 必须从 utils/theme.js 转出（单例），不得自建响应式源
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

/** 收集含 prefers-color-scheme 的样式载体（vue + scss），排除非编译目录 */
function collectTargets() {
  const out = []
  const SKIP_DIRS = new Set(['node_modules', 'unpackage', '.trash', 'trash', '.zwork', '.git', '.hbuilderx', '.claude', '.mimosa', '.zcode', 'site', 'docs', 'tests'])
  function walk(dir) {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue
        walk(path.join(dir, entry.name))
      } else if (entry.name.endsWith('.vue') || entry.name.endsWith('.scss')) {
        out.push(path.join(dir, entry.name))
      }
    }
  }
  walk(ROOT)
  return out.filter((f) => fs.readFileSync(f, 'utf8').includes('prefers-color-scheme'))
}

describe('theme.js 三态核心', () => {
  it('normalizeMode 非法值一律归 system', async () => {
    const mod = await import('@/utils/theme.js')
    expect(mod.normalizeMode('light')).toBe('light')
    expect(mod.normalizeMode('dark')).toBe('dark')
    expect(mod.normalizeMode('system')).toBe('system')
    expect(mod.normalizeMode('')).toBe('system')
    expect(mod.normalizeMode('blue')).toBe('system')
    expect(mod.normalizeMode(null)).toBe('system')
    expect(mod.normalizeMode(undefined)).toBe('system')
  })

  it('isDark 是响应式单例（useTheme 与 theme.js 同源）', async () => {
    const mod = await import('@/utils/theme.js')
    expect(mod.isDark).toBeDefined()
    expect(typeof mod.isDark.value).toBe('boolean')
    expect(typeof mod.setThemeMode).toBe('function')
    expect(typeof mod.initTheme).toBe('function')
    expect(typeof mod.applyTheme).toBe('function')
  })

  it('useTheme 转出的是同一个 isDark 引用', async () => {
    const { useTheme } = await import('@/composables/useTheme.js')
    const mod = await import('@/utils/theme.js')
    const { isDark } = useTheme()
    expect(isDark).toBe(mod.isDark)
  })
})

describe('深色双路径守卫（防新深色块漏包装）', () => {
  const targets = collectTargets()
  const rel = (f) => path.relative(ROOT, f).replace(/\\/g, '/')

  it('扫描到深色样式文件（≥80 个，防扫描失效静默通过）', () => {
    expect(targets.length).toBeGreaterThanOrEqual(80)
  })

  it('App.vue 根选择器块走 html.theme-dark 直写（不包 .theme-dark 大块）', () => {
    const src = fs.readFileSync(path.join(ROOT, 'App.vue'), 'utf8')
    expect(src).toContain('html.theme-dark')
    expect(src).toMatch(/html\.theme-dark[\s\S]*?background-color:\s*#18181B/)
  })

  it('除 App.vue 外，每个 media 深色块都必须在 #ifdef MP-WEIXIN 分支内，且与 #ifndef 分支的 html.theme-dark 块一比一配对（4.10.1 实证定案：scoped 内裸 .theme-dark 类选择器会被 scoper 注入 data-v 挂死；而 :global(html.theme-dark){嵌套子选择器} 会被编译器剥掉子选择器、塌缩成裸 html.theme-dark{} 只作用于 html 自身 —— 正确形态是 html 元素前缀直写：html.theme-dark { 嵌套子选择器 }，scoper 对 html 开头的选择器不注入 data-v）', () => {
    const bad = []
    for (const file of targets) {
      const name = path.basename(file)
      if (name === 'App.vue') continue // App.vue 全局无 scoped，单独断言
      const src = fs.readFileSync(file, 'utf8')
      const mediaCount = (src.match(/@media\s*\(prefers-color-scheme[^)]*\)/g) || []).length
      if (mediaCount === 0) continue
      const ifdef = (src.match(/\/\* #ifdef MP-WEIXIN \*\//g) || []).length
      const ifndef = (src.match(/\/\* #ifndef MP-WEIXIN \*\//g) || []).length
      // 4.10.1：类路径正确形态 = html 元素前缀直写（允许 SCSS 嵌套）
      const darkBlocks = (src.match(/(^|[^:\w-])html\.theme-dark\s*\{/g) || []).length
      // 4.8.4 的错误形态：:global 包嵌套子选择器 —— 编译后子选择器被剥掉，深色规则全部失效
      const brokenGlobal = (src.match(/:global\(html\.theme-dark\)/g) || []).length
      const bareDark = (src.match(/(^|[^:\w-])\.theme-dark\s*\{/g) || []).length
      if (mediaCount !== ifdef || mediaCount !== ifndef || darkBlocks !== mediaCount || bareDark > 0 || brokenGlobal > 0) {
        bad.push(`${rel(file)} media=${mediaCount} ifdef=${ifdef} ifndef=${ifndef} htmlDark=${darkBlocks} brokenGlobal=${brokenGlobal} bare=${bareDark}`)
      }
      // 每个 #ifdef MP-WEIXIN 之后必须能找到配对的 #endif（顺序扫描，栈深度校验）
      const tokens = [...src.matchAll(/\/\* #(ifdef|ifndef|endif)[^\n]*\*\//g)].map((m) => m[1])
      let depth = 0
      for (const t of tokens) {
        if (t === 'endif') depth = Math.max(0, depth - 1)
        else depth++
      }
      if (depth !== 0) bad.push(`${rel(file)} 条件编译未闭合`)
    }
    expect(bad).toEqual([])
  })

  it('theme.js 本体不得出现未包装的 @media 深色块（模块只管 JS 层）', () => {
    const src = fs.readFileSync(path.join(ROOT, 'utils', 'theme.js'), 'utf8')
    expect(src).not.toContain('@media')
  })
})
