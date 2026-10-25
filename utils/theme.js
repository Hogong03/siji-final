/**
 * theme.js — 深色模式三态核心（4.8.0）
 *
 * 模式：'system'（默认，跟随系统，存量用户零感知）/ 'light' / 'dark'
 * 存储：siji_theme_mode
 *
 * 架构（4.8.0 类驱动 + 条件编译双路径）：
 *   - H5 / App-vue：CSS 深色规则由 95 个 .theme-dark 类块驱动（媒体查询版仅存于 MP 分支），
 *     本模块往 html 元素挂/摘 .theme-dark；原生 tabBar / 导航栏由 JS API 刷色
 *   - MP-WEIXIN：不支持类驱动，保持系统跟随（媒体查询版），本模块全部跳过
 *
 * 与 useTheme.js 的关系：本文件是唯一事实源，useTheme 只是薄壳（保持 { isDark } 签名，
 * 15 处消费方零改动）。isDark 是模块级响应式单例：手动切模式与系统切换都汇到这里。
 *
 * 平台守卫原则（沿用 useTheme 的历史教训）：所有平台 API 调用做能力探测 + try/catch，
 * 任何环境不支持时静默退化，绝不抛错导致白屏。
 */
import { ref } from 'vue'

const STORAGE_KEY = 'siji_theme_mode'
const DARK_CLASS = 'theme-dark'

/** 模块级响应式单例：当前是否深色（手动档直读；system 档跟随系统检测） */
const isDark = ref(false)

/** 当前模式（不落盘的内存态，落盘走 setThemeMode） */
let mode = 'system'

/** H5 媒体查询监听（仅 system 模式挂载） */
let mql = null
let mqlHandler = null

/** uni.onThemeChange 监听（仅 system 模式挂载，App/MP） */
let uniHandler = null

/**
 * 读系统深色态。
 *
 * 4.35.0 修正读取顺序：**先读 uni.getSystemInfoSync().theme，再退 matchMedia**。
 * 原来 matchMedia 在前 —— App 逻辑层只要有 window（有没有 document 是另一件事），
 * 第一分支就命中并返回它自己的结果，`getSystemInfoSync().theme` 那条路永远走不到。
 * 官方口径（DarkMode 适配指南）：声明了 darkmode: true 的平台 theme 返回 'light'/'dark'，
 * 未声明则 theme 为 undefined —— 所以只有拿到 'light'/'dark' 才算权威结论，undefined 才继续往下试。
 */
function readSystemDark() {
  try {
    if (typeof uni !== 'undefined' && typeof uni.getSystemInfoSync === 'function') {
      const th = uni.getSystemInfoSync().theme
      if (th === 'dark') return true
      if (th === 'light') return false
      // undefined：该平台 manifest 未开 darkmode，继续往下试
    }
  } catch (e) { /* 忽略，退到 matchMedia */ }
  try {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches === true
    }
  } catch (e) { /* 忽略，按浅色处理 */ }
  return false
}

/** 读存储的模式值，非法值一律归 'system' */
function readStoredMode() {
  try {
    const v = uni.getStorageSync(STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch (e) { /* 读取失败按默认 */ }
  return 'system'
}

// ─── tabBar API 守卫（4.8.1）───
// setTabBarStyle / setTabBarItem 只能在 tab 页（对话/功能/设置）上调用，
// 否则报 "not TabBar page"（启动时无页面、子页面 onShow 时都会命中）。
const TAB_ROUTES = ['pages/chat/index', 'pages/functions/index', 'pages/settings/index']

function isOnTabPage() {
  try {
    if (typeof getCurrentPages !== 'function') return false
    const pages = getCurrentPages()
    const top = pages && pages.length > 0 ? pages[pages.length - 1] : null
    const route = top && top.route ? String(top.route) : ''
    if (!route) return false
    return TAB_ROUTES.some((r) => route === r || route.indexOf(r) === 0)
  } catch (e) {
    return false
  }
}

/**
 * H5 tabBar 图标 DOM 兜底（4.8.1）：
 * uni-h5 把 tabBar 渲染成 .uni-tabbar DOM（任意页面下都在文档里，非 tab 页只是隐藏）。
 * setTabBarItem 只在 tab 页可用，这里直接换 img 的 src，保证任意页面切档图标立即跟随；
 * 幂等：已是目标后缀就跳过，与 API 成功后的结果一致不冲突。
 */
function syncH5TabIcons() {
  try {
    if (typeof document === 'undefined') return
    const items = document.querySelectorAll('.uni-tabbar__item')
    for (let i = 0; i < items.length; i++) {
      const img = items[i].querySelector('img')
      if (!img) continue
      const src = img.getAttribute('src') || ''
      if (src.indexOf('/static/tab/') === -1) continue
      if (isDark.value && src.indexOf('-dark.png') === -1) {
        img.setAttribute('src', src.replace(/-v2\.png$/, '-v2-dark.png'))
      } else if (!isDark.value && src.indexOf('-dark.png') !== -1) {
        img.setAttribute('src', src.replace(/-v2-dark\.png$/, '-v2.png'))
      }
    }
  } catch (e) { /* 结构不符则无操作，API 层仍会兜 */ }
}

// 4.30.1：切 tab 时 uni-h5 重渲染 tabBar img，theme.json 变量不重新求值 → 选中图标回到浅色版。
// 用 MutationObserver 监听 tabBar img src 变化，一旦发现与当前主题不符立刻替换，比 hashchange 更可靠
// （uni-h5 内部路由可能不触发标准 hashchange）。
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const _sync = () => { try { syncH5TabIcons() } catch (e) {} }
  window.addEventListener('hashchange', _sync)
  // 初始延迟挂 MutationObserver，等 .uni-tabbar 渲染出来
  setTimeout(() => {
    try {
      const bar = document.querySelector('.uni-tabbar')
      if (!bar) return
      new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.attributeName === 'src') _sync()
        }
      }).observe(bar, { attributes: true, subtree: true, attributeFilter: ['src'] })
    } catch (e) {}
  }, 300)
}

/**
 * 构造注入到页面 WebView 的类切换 JS（4.12.3 抽出可单测）
 * App 端逻辑层没有 document，只能通过 plus.webview.evalJS 在各页面的视图层执行
 */
export function buildToggleJs(dark) {
  const op = dark ? 'add' : 'remove'
  return "try{document.documentElement.classList." + op + "('theme-dark')}catch(e){}"
}

// ─── 平台分支实现：声明一次，运行时按平台能力分流 ───
// 注意：不能用 #ifdef/#ifndef 包两份 function 声明 —— 条件编译只在 uni-app 编译器里生效，
// vitest（node）会把两份声明同时编入报重复声明。这里统一用 let 绑定 + 赋值切换，
// MP 分支实现在编译期被梱件编译剔除（赋值语句包裹在 #ifdef 内）。
let applyClass = () => {}
let setNativeBars = () => {}
let watchSystem = () => {}
let applyNativeUiStyle = () => {}

// #ifdef MP-WEIXIN
// MP：无 DOM 无类驱动，媒体查询版 CSS 自行跟随系统；pages.json @变量编译期已随系统。
// 仅保留 isDark 跟随（图表等 JS 注入色仍需要）
applyClass = () => {}
setNativeBars = () => {}
watchSystem = (on) => {
  if (!on) return
  try {
    if (typeof uni !== 'undefined' && typeof uni.onThemeChange === 'function') {
      uniHandler = (res) => { isDark.value = !!(res && res.theme === 'dark') }
      uni.onThemeChange(uniHandler)
    }
  } catch (e) { /* 忽略监听失败 */ }
}
// #endif

// #ifndef MP-WEIXIN
applyClass = () => {
  try {
    if (typeof document === 'undefined' || !document.documentElement) return
    const root = document.documentElement
    if (isDark.value) root.classList.add(DARK_CLASS)
    else root.classList.remove(DARK_CLASS)
    syncH5TabIcons()
    // 4.10.2：清掉 uni.setTabBarStyle 写下的内联 tabbar 样式 —— 实测该 API 在 H5 是
    // 静默 no-op（success 回调照走但不写任何样式），它历史写下的内联深色背景会永远
    // 压住 CSS（浅色模式没有任何代码清除它 → tabbar 卡在深色）。清掉后：深色由
    // App.vue 的 !important 规则接管，浅色回框架默认。setTabBarItem 的图标交换仍走 DOM 兜底。
    try {
      document.querySelectorAll('.uni-tabbar').forEach((el) => {
        if (el.style) {
          el.style.removeProperty('background-color')
          el.style.removeProperty('backdrop-filter')
        }
      })
    } catch (e) { /* 清理失败不影响类切换 */ }
  } catch (e) { /* 挂类失败静默 */ }
}

setNativeBars = () => {
  try {
    if (typeof uni === 'undefined') return
    // tabBar API 只在 tab 页可用（4.8.1 守卫），否则报 not TabBar page；H5 图标另有 DOM 兜底
    const onTab = isOnTabPage()
    if (onTab && typeof uni.setTabBarStyle === 'function') {
      uni.setTabBarStyle({
        color: '#A1A1AA',
        selectedColor: isDark.value ? '#FFFFFF' : '#000000',
        backgroundColor: isDark.value ? '#18181B' : '#F4F4F5',
        borderStyle: isDark.value ? 'black' : 'white',
        fail: () => { /* 静默：CSS 层已兜底 */ }
      })
    }
    if (onTab && typeof uni.setTabBarItem === 'function') {
      const items = [
        { index: 0, iconPath: '/static/tab/chat-v2.png', selectedIconPath: '/static/tab/chat-active-v2.png' },
        { index: 1, iconPath: '/static/tab/functions-v2.png', selectedIconPath: '/static/tab/functions-active-v2.png' },
        { index: 2, iconPath: '/static/tab/settings-v2.png', selectedIconPath: '/static/tab/settings-active-v2.png' }
      ]
      const dark = [
        { index: 0, iconPath: '/static/tab/chat-v2-dark.png', selectedIconPath: '/static/tab/chat-active-v2-dark.png' },
        { index: 1, iconPath: '/static/tab/functions-v2-dark.png', selectedIconPath: '/static/tab/functions-active-v2-dark.png' },
        { index: 2, iconPath: '/static/tab/settings-v2-dark.png', selectedIconPath: '/static/tab/settings-active-v2-dark.png' }
      ]
      const list = isDark.value ? dark : items
      list.forEach((it) => {
        try {
          it.fail = () => { /* 静默：DOM 层已兜底 */ }
          uni.setTabBarItem(it)
        } catch (e) { /* 单项失败不影响其余 */ }
      })
    }
    // 导航栏：非 custom 页面（39 个）由这条刷；5 个 custom 页无导航栏天然跳过
    if (typeof uni.setNavigationBarColor === 'function') {
      uni.setNavigationBarColor({
        frontColor: isDark.value ? '#ffffff' : '#000000',
        backgroundColor: isDark.value ? '#18181B' : '#FFFFFF',
        fail: () => { /* custom 导航页会 fail，静默 */ }
      })
    }
  } catch (e) { /* 原生条刷色失败静默 */ }
}

// #ifdef APP-PLUS
// App 端挂类（4.12.3）：逻辑层跑在独立 v8 引擎里没有 document，上面的 H5 DOM 路径在 App
// 全程静默空转 —— 这就是「App 端外观只能改 tabBar/导航栏（原生层）、页面内容不跟色」的根因。
// App 每个页面是独立 WebView：用 plus.webview.all() 逐个 evalJS 往各页面的 html 元素挂/摘类；
// 新开页面的兜底靠 main.js 的全局 onShow mixin（applyTheme 幂等，页面显示时必重挂）。
applyClass = () => {
  try {
    if (typeof plus === 'undefined' || !plus.webview || typeof plus.webview.all !== 'function') return
    const js = buildToggleJs(isDark.value)
    const wvs = plus.webview.all() || []
    for (let i = 0; i < wvs.length; i++) {
      try { if (wvs[i] && typeof wvs[i].evalJS === 'function') wvs[i].evalJS(js) } catch (e) { /* 单个 WebView 失败不影响其余 */ }
    }
  } catch (e) { /* App 挂类失败静默 */ }
}

/**
 * App 端原生 UI 风格（4.35.0）。
 * 官方文档（DarkMode 适配指南 · 监听主题切换事件）明确：
 * **「在 App 上需要先调用 plus.nativeUI.setUIStyle('auto') 开启跟随系统主题切换的功能，
 * 才能监听到主题切换事件」** —— 不调这个，uni.onThemeChange 永远不来。
 * 现象就是「冷启动那次能读对系统态，运行中切系统主题完全不跟随」。
 * system 档 → 'auto'（把跟随能力打开）；手动档 → 直接把原生层钉到该档，与页面内容一致。
 */
applyNativeUiStyle = () => {
  try {
    if (typeof plus === 'undefined' || !plus.nativeUI) return
    if (typeof plus.nativeUI.setUIStyle !== 'function') return
    const style = mode === 'dark' ? 'dark' : (mode === 'light' ? 'light' : 'auto')
    plus.nativeUI.setUIStyle(style)
  } catch (e) { /* 原生层不支持时静默，页面换色仍由 JS 驱动 */ }
}
// #endif

watchSystem = (on) => {
  // H5：matchMedia change
  try {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      if (on && !mql) {
        mql = window.matchMedia('(prefers-color-scheme: dark)')
        mqlHandler = (e) => {
          if (mode !== 'system') return // 手动档下系统切换不生效（4.8.0 预期行为）
          isDark.value = !!(e && e.matches)
          applyClass()
          setNativeBars()
        }
        if (typeof mql.addEventListener === 'function') {
          mql.addEventListener('change', mqlHandler)
        } else if (typeof mql.addListener === 'function') {
          mql.addListener(mqlHandler) // 旧 Safari
        }
      } else if (!on && mql && mqlHandler) {
        if (typeof mql.removeEventListener === 'function') {
          mql.removeEventListener('change', mqlHandler)
        } else if (typeof mql.removeListener === 'function') {
          mql.removeListener(mqlHandler)
        }
        mql = null
        mqlHandler = null
      }
    }
  } catch (e) { /* 忽略监听失败 */ }
  // App：uni.onThemeChange（H5 下该 API 不存在，自然跳过）
  try {
    if (on && !uniHandler) {
      if (typeof uni !== 'undefined' && typeof uni.onThemeChange === 'function') {
        uniHandler = (res) => {
          if (mode !== 'system') return
          isDark.value = !!(res && res.theme === 'dark')
          applyClass()
          setNativeBars()
        }
        uni.onThemeChange(uniHandler)
      }
    } else if (!on && uniHandler) {
      try {
        if (typeof uni !== 'undefined' && typeof uni.offThemeChange === 'function') {
          uni.offThemeChange(uniHandler)
        }
      } catch (e) { /* 忽略清理失败 */ }
      uniHandler = null
    }
  } catch (e) { /* 忽略监听失败 */ }
}
// #endif

/** 把当前 isDark 落到 DOM 类 + 原生条（页面 onShow 也会调，幂等） */
function applyTheme() {
  try {
    applyClass()
    setNativeBars()
  } catch (e) { /* 平台实现缺失时静默 */ }
}

/** 模式解析：非法输入归 system */
function normalizeMode(v) {
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
}

/**
 * 设置模式（设置页三选一调这里）。
 * light/dark 立即生效并落盘；system 落盘后按当前系统态重算。
 */
function setThemeMode(next) {
  mode = normalizeMode(next)
  try { uni.setStorageSync(STORAGE_KEY, mode) } catch (e) { /* 落盘失败静默，本次会话仍生效 */ }
  if (mode === 'light' || mode === 'dark') {
    isDark.value = mode === 'dark'
    applyNativeUiStyle() // App：原生层也钉到手动档
    watchSystem(false) // 手动档摘掉系统监听
  } else {
    isDark.value = readSystemDark()
    applyNativeUiStyle() // App：setUIStyle('auto') 是 onThemeChange 能来的前提
    watchSystem(true) // system 档重新挂监听
  }
  applyTheme()
}

/** 当前模式（只读） */
function getThemeMode() {
  return mode
}

/**
 * system 档下重读系统主题并应用（4.49.0 兜底）。
 * 场景：App 端 uni.onThemeChange 因基座限制未触发时（iOS 标准基座官方不支持，
 * 需要自定义基座/云打包才生效），页面 onShow / 回到前台仍能按当前系统态重算一遍，
 * 保证「切系统后回到 App 即跟随」。手动档（light/dark）不动；幂等：系统态未变零副作用。
 */
function refreshSystemTheme() {
  if (mode !== 'system') return
  const dark = readSystemDark()
  if (dark !== isDark.value) {
    isDark.value = dark
    applyClass()
    setNativeBars()
  }
}

/**
 * 初始化：App.vue onLaunch 调一次。
 * 读存储 → 算 isDark → 挂监听 → 应用。重复调用安全（幂等）。
 */
function initTheme() {
  mode = readStoredMode()
  if (mode === 'light' || mode === 'dark') {
    isDark.value = mode === 'dark'
    applyNativeUiStyle() // App：原生层也钉到手动档
    watchSystem(false)
  } else {
    isDark.value = readSystemDark()
    applyNativeUiStyle() // App：setUIStyle('auto') 是 onThemeChange 能来的前提
    watchSystem(true)
  }
  applyTheme()
  // 4.13.0：冷启动预挂 —— 首页 WebView 在 onLaunch 后才出现，逐轮把类挂上（有界，防泄漏）
  for (let i = 1; i <= 10; i++) {
    setTimeout(() => { try { applyTheme() } catch (e) { /* 静默 */ } }, 150 * i)
  }
}

export {
  isDark,
  initTheme,
  setThemeMode,
  getThemeMode,
  applyTheme,
  refreshSystemTheme,
  normalizeMode
}
