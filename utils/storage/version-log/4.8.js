/**
 * 版本日志数据段：4.8.0（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V48 = [
  {
    version: '4.8.0',
    date: '2026-10-01',
    title: '4.8.0 深色模式手动切换：设置页「外观」三选一（跟随系统/浅色/深色）',
    summary: [
      '设置页新增「外观」入口，三选一切换主题：立即生效、重启保持；默认「跟随系统」= 存量用户零感知',
      '架构升级：深色 CSS 从纯媒体查询驱动改为「类驱动 + 条件编译双路径」——H5/App 由 html 上的 .theme-dark 类控制（JS 可切），微信小程序保持系统跟随（96 个深色块全部分支改写，浅色/深色规则内容不变）',
      '新建 utils/theme.js 三态核心：siji_theme_mode 存取、响应式 isDark 单例、applyTheme 统一应用（挂类 + setTabBarStyle/setTabBarItem 换深浅 tab 图标 + setNavigationBarColor）',
      'main.js 全局 mixin：每个页面 onShow 幂等重刷主题（覆盖 App 每页独立 webview、切档后返回、H5 直接刷新三种场景）',
      'useTheme 改薄壳转出单例 isDark：图表配色/原生 switch/标签圆点等 15 处 JS 注入色消费方零改动自动跟随手动切换',
      '测试 86 文件 / 1213 用例：theme-mode 新增 7 用例全绿；全量 1212 绿，唯一失败为 plan-checkin 跨月日期既有失败（10月1日触发，干净树同样失败）',
    ],
    categories: [
      {
        title: '设置页外观入口（P0）',
        items: [
          'pages/settings/index.vue：外观行（moon 图标 + 当前模式 + ActionSheet 三选），#ifndef MP-WEIXIN 包裹，小程序端隐藏',
          '切换立即生效并落盘 siji_theme_mode；手动档下系统主题变化不再影响应用',
        ],
      },
      {
        title: '主题核心与接线（P0）',
        items: [
          'utils/theme.js（新建）：normalizeMode 非法值归 system；initTheme 启动初始化；setThemeMode 切档；applyTheme 幂等应用；平台 API 全部能力探测 + try/catch 静默退化（沿用 useTheme 历史教训）',
          'composables/useTheme.js：改为从 theme.js 转出响应式单例，{ isDark } 导出签名不变，15 处消费方零改动',
          'main.js：全局 mixin onShow 调 applyTheme；App.vue onLaunch 最前调 initTheme（防首屏闪浅色）',
          'tabBar 深浅切换复用既有 12 个图标文件（chat/functions/settings × 普通/选中 × 浅/深）',
        ],
      },
      {
        title: '深色 CSS 双路径改写（P0）',
        items: [
          '85 个文件 95 个 @media 深色块脚本化改写为双路径：#ifndef MP-WEIXIN 包 .theme-dark 类版 + #ifdef MP-WEIXIN 包原 media 版，块内规则原样保留',
          'App.vue 两个根选择器块（page/html/body 底色 + 占位符）手工改写为 html.theme-dark 直写（包大块选不中根元素）',
          'uni.scss 的深色块同步双路径；H5/App 深色优先级 .theme-dark .foo 比浅色 .foo 高一级，必胜',
          '新增守卫测试：全项目 media 深色块必须位于 MP 分支内且与 .theme-dark 一比一配对，防以后新写的深色块漏包装导致手动切换失效',
        ],
      },
    ],
  },
]
