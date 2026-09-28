/**
 * 模块导出静态检查（3.5.14）
 *
 * 背景：vitest 走 esbuild 互操作，缺的具名导出会变成 undefined 而不报错；
 * HBuilder X 的 dev server 走原生 ESM，同一处会直接抛
 * "The requested module '/utils/memory/monthly.js' does not provide an export named 'currentMonth'"，
 * 页面白屏。所以这条检查必须在测试里静态做：解析每个文件的 import，核对目标模块真的导出该名字。
 *
 * 已知限制：目标模块写了 export * 时无法静态枚举，跳过（不误报优先）。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SCAN_DIRS = ['utils', 'composables', 'store', 'pages', 'components']
const SKIP_DIRS = new Set(['node_modules', 'unpackage', '.git', 'site'])

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
    if (SKIP_DIRS.has(entry.name)) return
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (entry.name.endsWith('.js') || entry.name.endsWith('.vue')) out.push(full)
  })
  return out
}

/** .vue 只取 script 块（template/style 里不会有 import） */
function scriptOf(src) {
  const m = src.match(/<script[^>]*>([\s\S]*?)<\/script>/)
  return m ? m[1] : src
}

function exportInfo(src) {
  const names = new Set()
  let wildcard = false
  let m
  const reDecl = /export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z0-9_$]+)/g
  while ((m = reDecl.exec(src))) names.add(m[1])
  const reList = /export\s*\{([\s\S]*?)\}\s*(?:from\s*['"][^'"]+['"])?/g
  while ((m = reList.exec(src))) {
    m[1].split(',').forEach(part => {
      const t = part.trim()
      if (!t) return
      const asMatch = t.match(/\bas\s+([A-Za-z0-9_$]+)$/)
      names.add(asMatch ? asMatch[1] : t.split(/\s+/)[0])
    })
  }
  if (/export\s+\*/.test(src)) wildcard = true
  return { names, wildcard }
}

function resolveTarget(file, spec) {
  let target = null
  if (spec.startsWith('@/')) target = path.join(ROOT, spec.slice(2))
  else if (spec.startsWith('./') || spec.startsWith('../')) target = path.resolve(path.dirname(file), spec)
  else return null
  if (!fs.existsSync(target)) return target
  if (fs.statSync(target).isFile()) return target
  for (const cand of [target + '.js', path.join(target, 'index.js')]) {
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand
  }
  return null
}

const files = SCAN_DIRS.flatMap(dir => walk(path.join(ROOT, dir)))

describe('模块导出：import 的名字必须真的被导出', () => {
  it('扫描到项目源文件', () => {
    expect(files.length).toBeGreaterThan(250)
  })

  it('没有指向不存在导出的具名 import', () => {
    const problems = []
    files.forEach(file => {
      const rel = path.relative(ROOT, file).replace(/\\/g, '/')
      const src = scriptOf(fs.readFileSync(file, 'utf8'))
      const reImp = /import\s+([\s\S]*?)\s+from\s*['"]([^'"]+)['"]/g
      let m
      while ((m = reImp.exec(src))) {
        const clause = m[1].trim()
        const spec = m[2]
        if (!clause.startsWith('{')) continue
        const target = resolveTarget(file, spec)
        if (!target) continue
        if (!fs.existsSync(target)) {
          problems.push(rel + ' -> ' + spec + ' :: 文件不存在')
          continue
        }
        const info = exportInfo(scriptOf(fs.readFileSync(target, 'utf8')))
        if (info.wildcard) continue
        clause.replace(/[{}]/g, '').split(',').forEach(part => {
          const t = part.trim()
          if (!t) return
          const name = t.split(/\s+as\s+/)[0].trim()
          if (!name || name === 'default') return
          if (!info.names.has(name)) problems.push(rel + ' -> ' + spec + ' :: ' + name)
        })
      }
    })
    expect(problems).toEqual([])
  })
})
