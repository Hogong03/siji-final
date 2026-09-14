/**
 * SFC 模板绑定静态检查（3.5.5）
 *
 * 背景：模板里引用了 script setup 中不存在的标识符时编译期不报错，运行时点一下就崩：
 *  - pages/plan/records.vue 的 toggleDay / pages/plan/detail.vue 的 submitBackfill
 *  - pages/search/result.vue 把 v-if 写在 v-for 同一元素上，v-if 先求值拿不到 group
 * 做法：compileScript(inlineTemplate) 后未解析的标识符会落成 _ctx.x，扫描即可提前拦住。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parse, compileScript } from '@vue/compiler-sfc'

const ROOT = process.cwd()
const SCAN_DIRS = ['pages', 'components']

/** 模板里合法但不在 setup 作用域内的名字（全局对象与模板内置属性） */
const ALLOWED = new Set([
  'uni', 'wx', 'getApp', 'getCurrentPages',
  '$emit', '$slots', '$root', '$attrs', '$props', '$refs', '$el', '$options', '$forceUpdate'
])

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (entry.name.endsWith('.vue')) out.push(full)
  })
  return out
}

const files = SCAN_DIRS.flatMap(dir => walk(path.join(ROOT, dir)))

describe('SFC 模板绑定：不留未解析标识符', () => {
  it('扫描到页面与组件', () => {
    expect(files.length).toBeGreaterThan(50)
  })

  it('模板里的标识符都能在 script setup 里找到', () => {
    const bad = []
    files.forEach(file => {
      const rel = path.relative(ROOT, file).replace(/\\/g, '/')
      const src = fs.readFileSync(file, 'utf8')
      if (src.includes('lang="renderjs"')) return // renderjs 层是第二个 script，编译器不识别
      const { descriptor, errors } = parse(src, { filename: rel })
      if (errors.length > 0) {
        bad.push(rel + ' 解析失败：' + errors.map(e => String(e.message || e)).join('; '))
        return
      }
      if (!descriptor.scriptSetup || !descriptor.template) return
      const { content } = compileScript(descriptor, { id: rel, inlineTemplate: true })
      const unresolved = new Set()
      const re = /_ctx\.([A-Za-z_$][\w$]*)/g
      let hit = re.exec(content)
      while (hit) {
        if (!ALLOWED.has(hit[1])) unresolved.add(hit[1])
        hit = re.exec(content)
      }
      if (unresolved.size > 0) bad.push(rel + ' 未定义：' + [...unresolved].join(', '))
    })
    expect(bad).toEqual([])
  })
})
