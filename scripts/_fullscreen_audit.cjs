// 排查终章：把 uni-h5 真实 DOM 结构 + 全部全局 CSS + :global 展开规则放进同一个文档，
// 检查 tab 切换瞬间 chat 页上可能出现的全屏覆盖元素（uni-tabbar 是 flex 布局的兄弟节点，
// 若 CSS 使其 position:fixed 且高度 100% 就会盖住页面 —— 逐一验证每个全局规则的作用对象）
const sass = require('sass')
const fs = require('fs')

// 1) 编译 chat.scss（:global 版），看产物里有没有意外产生 position/top/bottom 的规则
const chatScss = fs.readFileSync('pages/chat/chat.scss', 'utf8')
const css = sass.compileString(chatScss).css
const lines = css.split('\n')
lines.forEach((ln, i) => {
  if (/position\s*:\s*(fixed|absolute)/.test(ln)) {
    // 找它所属选择器：向前找最近的选择器行
    for (let j = i - 1; j >= 0; j--) {
      if (lines[j].trim().endsWith('{')) {
        console.log('chat.scss 定位规则:', lines[j].trim().slice(0, 80), '=>', ln.trim())
        break
      }
    }
  }
})

// 2) 全项目扫：:global 块内是否有 fixed/absolute + inset/top+bottom 的规则（全屏覆盖的构成要素）
console.log('\n=== 全项目 :global 块内全屏定位审计 ===')
const SKIP = ['node_modules', 'unpackage', '.zwork', '.git']
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP.includes(e.name)) walk(dir + '/' + e.name); continue }
    if (!e.name.endsWith('.vue') && !e.name.endsWith('.scss')) continue
    const p = dir + '/' + e.name
    const raw = fs.readFileSync(p, 'utf8')
    const gm = raw.match(/:global\(html\.theme-dark\)\s*\{/)
    if (!gm) continue
    let css2
    try {
      css2 = sass.compileString(raw.slice(gm.index), { loadPaths: [dir, dir + '/..', dir + '/../..', '.', 'pages/chat', 'pages/chat/..', 'components/chat', 'components/plan', 'components/bill', 'common'], quietDeps: true }).css
    } catch (err) {
      console.log('编译失败(跳过):', p, '—', String(err.message).split('\n')[0].slice(0, 80))
      continue
    }
    const rules = css2.split('}').map(r => r.trim()).filter(Boolean)
    for (const r of rules) {
      if (/position\s*:\s*fixed/.test(r) && /(?:top|inset|bottom)[^;]*:\s*0/.test(r)) {
        console.log(p, '=>', r.split('{')[0].trim().slice(0, 90))
      }
    }
  }
}
walk('.')
console.log('=== 审计完成 ===')
