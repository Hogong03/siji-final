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
 * 读系统深色态。H5 走 matchMedia，App/MP 走 getSystemInfoSync().theme。
 * 全部失败按浅色处理（与 useTheme 历史行为一致）。
 */
function readSystemDark() {
  try {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches === true
    }
  } catch (e) { /* 忽略，退到 uni 分支 */ }
  try {
    if (typeof uni !== 'undefined' && typeof uni.getSystemInfoSync === 'function') {
      return uni.getSystemInfoSync().theme === 'dark'
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

// ─── 平台分支实现：声明一次，运行时按平台能力分流 ───
// 注意：不能用 #ifdef/#ifndef 包两份 function 声明 —— 条件编译只在 uni-app 编译器里生效，
// vitest（node）会把两份声明同时编入报重复声明。这里统一用 let 绑定 + 赋值切换，
// MP 分支实现在编译期被梱件编译剔除（赋值语句包裹在 #ifdef 内）。
let applyClass = () => {}
let setNativeBars = () => {}
let watchSystem = () => {}

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
    watchSystem(false) // 手动档摘掉系统监听
  } else {
    isDark.value = readSystemDark()
    watchSystem(true) // system 档重新挂监听
  }
  applyTheme()
}

/** 当前模式（只读） */
function getThemeMode() {
  return mode
}

/**
 * 初始化：App.vue onLaunch 调一次。
 * 读存储 → 算 isDark → 挂监听 → 应用。重复调用安全（幂等）。
 */
function initTheme() {
  mode = readStoredMode()
  if (mode === 'light' || mode === 'dark') {
    isDark.value = mode === 'dark'
    watchSystem(false)
  } else {
    isDark.value = readSystemDark()
    watchSystem(true)
  }
  applyTheme()
}

export {
  isDark,
  initTheme,
  setThemeMode,
  getThemeMode,
  applyTheme,
  normalizeMode
}
