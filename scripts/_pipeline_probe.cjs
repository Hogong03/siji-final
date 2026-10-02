// 决定性排查⑦：完整模拟 uni-app H5 管线 —— sass 编译 → @vue/compiler-sfc scoped 后处理
// 看 :global(...) 内层选择器 scoped 后的最终产物（这是浏览器真正收到的）
const sass = require('sass')
const { compileStyle } = require('@vue/compiler-sfc')

// 取真实项目文件：decisions.vue 的完整 style（scoped）
const fs = require('fs')
const src = fs.readFileSync('pages/settings/sub/decisions.vue', 'utf8')
const m = src.match(/<style[^>]*>([\s\S]*?)<\/style>/)
const scss = m[1]
const css = sass.compileString(scss).css

const out = compileStyle({ source: css, filename: 'd.vue', id: 'data-v-real', scoped: true })
// 打印所有含 theme-dark 或 :global 的选择器行
out.code.split('\n').forEach((ln, i) => {
  if (ln.includes('theme-dark') || ln.includes(':global')) console.log(String(i).padStart(4), ln.trim().slice(0, 130))
})
console.log('--- 非法选择器检测：残留 :global( 的行数 =', (out.code.match(/:global\(/g) || []).length)
