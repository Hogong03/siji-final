/**
 * SFC 模板绑定静态检查（3.5.5；4.29.4 补 options API 盲区）
 *
 * 背景：模板里引用了 script setup 中不存在的标识符时编译期不报错，运行时点一下就崩：
 *  - pages/plan/records.vue 的 toggleDay / pages/plan/detail.vue 的 submitBackfill
 *  - pages/search/result.vue 把 v-if 写在 v-for 同一元素上，v-if 先求值拿不到 group
 * 做法：compileScript(inlineTemplate) 后未解析的标识符会落成 _ctx.x，扫描即可提前拦住。
 *
 * 4.29.4：上面那条路只对 `<script setup>` 生效（`if (!descriptor.scriptSetup) return`），
 * options API 组件被整体跳过 —— EnterBriefing.vue 模板里的 `{{ dateLine }}` 两侧都没实现，
 * 一直没被拦住，运行时每渲染一次报一次 Vue warn。补一条 options API 通道：
 * 不给 bindingMetadata 编译模板时，编译器不知道实例上有哪些属性，全部落成 _ctx.x；
 * 于是反向判 —— 某个 _ctx.x 在 script 里**压根没出现过**，就一定是漏实现。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import { parse as parseJs } from '@babel/parser'

const ROOT = process.cwd()
const SCAN_DIRS = ['pages', 'components']

/** 模板里合法但不在 setup 作用域内的名字（全局对象与模板内置属性） */
const ALLOWED = new Set([
  'uni', 'wx', 'getApp', 'getCurrentPages',
  '$emit', '$slots', '$root', '$attrs', '$props', '$refs', '$el', '$options', '$forceUpdate'
])

/** 取对象字面量的键名（含字符串键） */
function keysOfObject(node, out) {
  if (!node) return
  if (node.type === 'ObjectExpression') {
    node.properties.forEach(p => {
      if (p.type === 'ObjectProperty' && p.key) out.add(p.key.name || p.key.value)
      else if (p.type === 'ObjectMethod' && p.key) out.add(p.key.name || p.key.value)
    })
  } else if (node.type === 'ArrayExpression') {
    node.elements.forEach(el => {
      if (el && el.type === 'StringLiteral') out.add(el.value)
    })
  }
}

/** 收集函数体里所有 return 的对象字面量键名（data() / setup() 的值来源） */
function keysOfReturns(fnNode, out) {
  if (!fnNode || !fnNode.body) return
  const walk = (n) => {
    if (!n || typeof n !== 'object') return
    if (Array.isArray(n)) { n.forEach(walk); return }
    if (n.type === 'ReturnStatement') keysOfObject(n.argument, out)
    // 不深入嵌套函数，避免把无关对象算进来
    if (n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression') return
    for (const k of Object.keys(n)) {
      if (k === 'loc' || k === 'start' || k === 'end') continue
      const v = n[k]
      if (v && typeof v === 'object') walk(v)
    }
  }
  walk(fnNode.body)
}

/**
 * 收集 options API 组件实例上能被模板访问的名字
 * （props / computed / methods / data / inject / setup 返回键 —— 只认真正的选项键，
 * 注释与字符串里的同名文字不算，4.29.4 首版就是被注释骗过所以形同虚设）
 */
function collectOptionsNames(scriptSrc) {
  const names = new Set()
  let ast
  try {
    ast = parseJs(scriptSrc, { sourceType: 'module', plugins: ['jsx'] })
  } catch (e) {
    return names // 解析不了就不判它，避免误报
  }
  const opts = ast.program.body
    .filter(n => n.type === 'ExportDefaultDeclaration' && n.declaration && n.declaration.type === 'ObjectExpression')
    .map(n => n.declaration)[0]
  if (!opts) return names

  opts.properties.forEach(prop => {
    if (prop.type !== 'ObjectProperty' && prop.type !== 'ObjectMethod') return
    const key = prop.key && (prop.key.name || prop.key.value)
    if (!key) return
    if (key === 'mixins') return // mixin 里的名字静态看不到，交给 ALLOWED 兜
    if (key === 'props' || key === 'computed' || key === 'methods' || key === 'inject') {
      keysOfObject(prop.value, names)
    } else if (key === 'data') {
      keysOfReturns(prop.value, names)
    } else if (key === 'setup') {
      keysOfReturns(prop.value, names)
    }
  })
  return names
}

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

  it('options API 组件的模板标识符必须在选项里真的定义过（4.29.4 补）', () => {
    const bad = []
    files.forEach(file => {
      const rel = path.relative(ROOT, file).replace(/\\/g, '/')
      const src = fs.readFileSync(file, 'utf8')
      if (src.includes('lang="renderjs"')) return
      const { descriptor, errors } = parse(src, { filename: rel })
      if (errors.length > 0) return // 解析失败已由上一条用例报出
      // script setup 走上面那条通道；这里只管 options API（有 script、无 scriptSetup）
      if (descriptor.scriptSetup || !descriptor.script || !descriptor.template) return

      const defined = collectOptionsNames(descriptor.script.content)
      // 不给 bindingMetadata：实例属性编译器一概不认识，统统落成 _ctx.x
      const { code } = compileTemplate({
        source: descriptor.template.content,
        filename: rel,
        id: rel
      })
      const unresolved = new Set()
      const re = /_ctx\.([A-Za-z_$][\w$]*)/g
      let hit = re.exec(code)
      while (hit) {
        if (!ALLOWED.has(hit[1]) && !defined.has(hit[1])) unresolved.add(hit[1])
        hit = re.exec(code)
      }
      if (unresolved.size > 0) bad.push(rel + ' 未定义：' + [...unresolved].join(', '))
    })
    expect(bad).toEqual([])
  })
})
