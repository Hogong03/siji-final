import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { applyTheme, refreshSystemTheme } from '@/utils/theme.js'

export function createApp() {
  const app = createSSRApp(App)
  app.use(createPinia())
  // 4.8.0：每个页面 onShow 幂等重刷主题（DOM 类 + tabBar/导航栏原生条）。
  // 覆盖三类场景：App-vue 每页独立 webview、手动切档后从设置页返回、H5 直接刷新单页路由
  // 4.49.0：onShow 先 refreshSystemTheme——system 档按当前系统态重算，
  // 兜底 App 端 onThemeChange 因基座限制未触发（iOS 标准基座不支持）时「切系统后回 App 即跟随」
  app.mixin({
    onShow() {
      try {
        refreshSystemTheme()
        applyTheme()
      } catch (e) { /* 主题重刷失败不拦页面 */ }
    }
  })
  return { app }
}
