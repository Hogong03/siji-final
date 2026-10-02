// 决定性判定：用 compileScript(inlineTemplate) 找出运行时会 _ctx.isDark 的组件
// （与 tests/sfc-bindings.test.js 同款方法，能精确命中运行时真实行为）
const fs = require('fs')
const path = require('path')
const { parse, compileScript } = require('@vue/compiler-sfc')

const ROOT = process.cwd()
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full, out)
    else if (e.name.endsWith('.vue')) out.push(full)
  })
  return out
}
const files = [...walk(path.join(ROOT, 'pages')), ...walk(path.join(ROOT, 'components'))]
const bad = []
for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/')
  const src = fs.readFileSync(file, 'utf8')
  if (src.includes('lang="renderjs"')) continue
  const { descriptor, errors } = parse(src, { filename: rel })
  if (errors.length || !descriptor.scriptSetup || !descriptor.template) continue
  try {
    const { content } = compileScript(descriptor, { id: rel, inlineTemplate: true })
    const hits = [...content.matchAll(/_ctx\.isDark/g)]
    if (hits.length) bad.push(rel + ' (运行时 _ctx.isDark x' + hits.length + ')')
  } catch (e) {
    bad.push(rel + ' 编译失败: ' + String(e.message).slice(0, 80))
  }
}
console.log(bad.length ? bad.join('\n') : '无组件在运行时引用未定义的 isDark')
console.log('--- 扫描', files.length, '个 vue ---')
