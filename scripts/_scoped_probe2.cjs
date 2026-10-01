// 实验：scoped 下四种 theme-dark 写法，哪种能命中 html.theme-dark 祖先
const { compileStyle } = require('@vue/compiler-sfc')

const cases = {
  A_现状: '.theme-dark { .page { color: red; } }',
  B_deep包裹内层: '.theme-dark { :deep(.page) { color: red; } }',
  C_root伪类: ':root .theme-dark { .page { color: red; } }',
  D_global包裹: ':global(html.theme-dark) { .page { color: red; } }',
  E_deep包theme: ':deep(.theme-dark) { .page { color: red; } }',
  F_page根写法: 'html.theme-dark & { .page { color: red; } }'
}

for (const [name, scss] of Object.entries(cases)) {
  try {
    // scss 需要先编译；这里项目装了 sass，用其同步 API
    const sass = require('sass')
    const css = sass.compileString(scss).css
    const out = compileStyle({ source: css, filename: name + '.vue', id: 'data-v-t', scoped: true })
    const sel = out.code.split('{')[0].trim().replace(/\s+/g, ' ')
    console.log(name.padEnd(16), '=>', sel.slice(0, 90))
  } catch (e) {
    console.log(name.padEnd(16), '=> ERROR', e.message.slice(0, 60))
  }
}
