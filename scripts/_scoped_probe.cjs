// 决定性实验：用 @vue/compiler-sfc 编译 decisions.vue 的 scoped style，
// 看 .theme-dark .page 在 scoped 后的真实选择器形态
const fs = require('fs')
const { parse, compileStyle } = require('@vue/compiler-sfc')

const src = fs.readFileSync('pages/settings/sub/decisions.vue', 'utf8')
const { descriptor } = parse(src, { filename: 'decisions.vue' })
const style = descriptor.styles[0]
const id = 'data-v-test'
const out = compileStyle({
  source: style.content,
  filename: 'decisions.vue',
  id,
  scoped: true,
  lang: style.lang || 'css'
})
const css = out.code
// 打印含 theme-dark 的选择器行
css.split('\n').forEach((ln, i) => {
  if (ln.includes('theme-dark')) console.log(String(i).padStart(4), ln.trim().slice(0, 120))
})
console.log('--- 总行数', css.split('\n').length)
