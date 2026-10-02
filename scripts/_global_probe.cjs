// 决定性排查⑥：用真实 dart-sass 编译 :global + & 嵌套，看产物是否产生非法 CSS
const sass = require('sass')
const tests = {
  'A_global+&嵌套': `:global(html.theme-dark) {
  .custom-nav {
    background: #27272A;
    &.nav-scrolled { border-bottom-color: #3F3F46; }
  }
}`,
  'B_global+双层嵌套': `:global(html.theme-dark) {
  .pin-dot {
    &.filled {
      background: #FFFFFF;
      .x { color: red; }
    }
  }
}`,
  'C_纯类嵌套': `:global(html.theme-dark) {
  .chat-page {
    @include flex;
  }
}`,
}
// C 需要 mixin，先定义
tests['C_纯类嵌套'] = '@mixin flex { display: flex; }\n' + tests['C_纯类嵌套']

for (const [name, scss] of Object.entries(tests)) {
  try {
    const r = sass.compileString(scss)
    console.log('=== ' + name + ' ===')
    console.log(r.css.trim())
    console.log('')
  } catch (e) {
    console.log('=== ' + name + ' 编译报错 ===')
    console.log(e.message.slice(0, 200))
    console.log('')
  }
}
