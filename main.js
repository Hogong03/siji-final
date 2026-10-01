import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { applyTheme } from '@/utils/theme.js'

export function createApp() {
  const app = createSSRApp(App)
  app.use(createPinia())
  // 4.8.0：每个页面 onShow 幂等重刷主题（DOM 类 + tabBar/导航栏原生条）。
  // 覆盖三类场景：App-vue 每页独立 webview、手动切档后从设置页返回、H5 直接刷新单页路由
  app.mixin({
    onShow() {
      try { applyTheme() } catch (e) { /* 主题重刷失败不拦页面 */ }
    }
  })
  return { app }
}
