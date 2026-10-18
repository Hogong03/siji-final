/**
 * test: 提醒模块依赖图守卫（4.35.1）
 *
 * 为什么需要这层守卫：4.35.0 那轮 HBuilder 构建日志一直在刷两条警告 ——
 *   notifier.js is dynamically imported by PlanReminderSection.vue but also statically imported by reminder.js / scheduler.js
 *   push-schedule.js is dynamically imported by notifier.js but also statically imported by App.vue
 * 两条都是**循环依赖**的症状：notifier →(动态)→ push-schedule → scheduler → notifier。
 * 当时用动态 import 硬绕，构建把模块留在主 chunk（不报错但分包失效），下次改推送逻辑必踩。
 * 4.35.1 把探测抽成叶子模块 push-probe.js，环打断、动态 import 全部改静态。
 *
 * 这个测试守三件事：
 *  1. utils/reminder/ 下（含聚合入口 utils/reminder.js）的静态依赖图无环
 *  2. push-probe.js 只依赖 logger（叶子不变量 —— 它一旦引入别的模块，环就会重新长出来）
 *  3. 提醒链路里不再有 `import(` 动态导入（动态 + 静态混用就是构建警告的来源）
 */
import { describe, it, expect } from 'vitest'
import './setup.js'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..')
const REMINDER_DIR = path.join(ROOT, 'utils', 'reminder')

/** 收集某个 js 文件里的静态依赖（只认相对路径），返回不带扩展名的模块名集合 */
function staticDeps(file) {
  const src = fs.readFileSync(file, 'utf8')
  const out = new Set()
  const re = /from\s+['"]([^'"]+)['"]/g
  let m
  while ((m = re.exec(src))) {
    const spec = m[1]
    if (!spec.startsWith('.')) continue
    out.add(path.basename(spec).replace(/\.js$/, ''))
  }
  return out
}

/** 拼依赖图：key 是不带扩展名的模块名 */
function buildGraph() {
  const graph = new Map()
  const files = fs.readdirSync(REMINDER_DIR).filter(f => f.endsWith('.js'))
  for (const f of files) {
    const name = f.replace(/\.js$/, '')
    graph.set(name, staticDeps(path.join(REMINDER_DIR, f)))
  }
  // 聚合入口 utils/reminder.js 也在同一张图里（它是 App.vue / 组件的主要引用点）
  graph.set('reminder', staticDeps(path.join(ROOT, 'utils', 'reminder.js')))
  return graph
}

/** 深度优先找环，返回环路径字符串数组（空数组 = 无环） */
function findCycles(graph) {
  const cycles = []
  const visited = new Set()
  const walk = (node, stack) => {
    if (stack.includes(node)) {
      cycles.push([...stack.slice(stack.indexOf(node)), node].join(' -> '))
      return
    }
    if (visited.has(node)) return
    visited.add(node)
    for (const dep of graph.get(node) || []) {
      if (graph.has(dep)) walk(dep, [...stack, node])
    }
  }
  for (const node of graph.keys()) walk(node, [])
  return cycles
}

describe('提醒模块依赖图（4.35.1 起无环）', () => {
  it('utils/reminder/ 与聚合入口之间不存在循环依赖', () => {
    expect(findCycles(buildGraph())).toEqual([])
  })

  it('push-probe 是叶子模块（只依赖 logger）', () => {
    const deps = staticDeps(path.join(REMINDER_DIR, 'push-probe.js'))
    expect([...deps]).toEqual(['logger'])
  })

  it('notifier 不再依赖 push-schedule / scheduler（环的两条边已断）', () => {
    const deps = staticDeps(path.join(REMINDER_DIR, 'notifier.js'))
    expect(deps.has('push-schedule')).toBe(false)
    expect(deps.has('scheduler')).toBe(false)
    // 探测能力仍然要能拿到，否则应用外通知会整体失效
    expect(deps.has('push-probe')).toBe(true)
  })

  it('push-schedule 仍对外暴露 widgetHasPush / probePushModule（re-export 兼容旧引用）', () => {
    const src = fs.readFileSync(path.join(REMINDER_DIR, 'push-schedule.js'), 'utf8')
    expect(src).toContain("export { widgetHasPush, probePushModule } from './push-probe.js'")
  })

  it('提醒链路里没有动态 import（动态 + 静态混用会出构建警告、且分包失效）', () => {
    const files = [
      ...fs.readdirSync(REMINDER_DIR).filter(f => f.endsWith('.js')).map(f => path.join(REMINDER_DIR, f)),
      path.join(ROOT, 'utils', 'reminder.js'),
      path.join(ROOT, 'components', 'plan', 'PlanReminderSection.vue')
    ]
    const offenders = []
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8')
      // 去掉注释行再判，避免把「说明为什么不用动态 import」的注释误判成违规
      const code = src
        .split('\n')
        .filter(line => !/^\s*(\*|\/\/)/.test(line))
        .join('\n')
      if (/\bimport\s*\(/.test(code)) offenders.push(path.relative(ROOT, file).replace(/\\/g, '/'))
    }
    expect(offenders).toEqual([])
  })
})
