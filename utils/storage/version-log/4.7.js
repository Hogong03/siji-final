/**
 * 版本日志数据段：4.7.0（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V47 = [
  {
    version: '4.7.0',
    date: '2026-09-29',
    title: '4.7.0 深色模式全面适配：系统级配置打通 + 全页面/组件/图表/tabBar 深色',
    summary: [
      '深色模式失效根因是系统级配置缺失：三端 manifest 均未开启 darkmode、项目无 theme.json，导致原生导航栏/原生 tabBar 不随系统切换、主题事件不触发、小程序不识别深色。本轮先补齐系统配置，再做全页面 CSS',
      '系统级配置：manifest 三端开启 darkmode + themeLocation；新建 theme.json 定义导航栏/背景/tabBar 两套变量与 tab 图标路径；pages.json 的 globalStyle、tabBar、40 处导航栏背景/文字全部改 @变量引用',
      '深色 tabBar 图标：6 个 tab 图标深色版（普通态灰 #A1A1AA、选中态白 #FFFFFF），深色背景下层级清晰',
      '全页面/组件深色 CSS：统一 Zinc 中性色映射（页面 #18181B、卡片 #27272A、输入区/按压 #3F3F46、边框 #3F3F46、主文字 #FAFAFA、次文字 #A1A1AA），状态色深色提亮（绿 #34D399、橙 #FBBF24、红 #F87171、蓝 #38BDF8）；用户气泡与品牌主按钮深色下反白（白底黑字）',
      '原生组件与图表主题化：新建 useTheme composable 响应式检测深色，原生 switch/slider 颜色动态绑定；重写 chart-renderer 出 light/dark 两套配色，账单/计划统计 8 个图表与人物关系图 ECharts 全部主题化；测试 84 文件 / 1203 用例全绿',
    ],
    categories: [
      {
        title: '系统级配置（深色模式失效根因，P0）',
        items: [
          'manifest.json：app-plus / h5 / mp-weixin 三节点均加 darkmode:true，app-plus 另加 themeLocation:"theme.json"',
          '新建 theme.json：定义 navBgColor/navTxtStyle/bgColor/bgTxtStyle/tabFontColor/tabSelectedColor/tabBgColor/tabBorderStyle 及 6 个 tab 图标路径变量（light/dark 两套）',
          'pages.json：globalStyle、tabBar（颜色与 iconPath/selectedIconPath）、40 处导航栏背景/文字样式全部改 @变量引用；保留 CRLF + UTF-8 BOM',
        ],
      },
      {
        title: '深色 tabBar 图标（P0）',
        items: [
          'static/tab/：新增 chat-v2-dark.png / chat-active-v2-dark.png、functions-v2-dark.png / functions-active-v2-dark.png、settings-v2-dark.png / settings-active-v2-dark.png，普通态 #A1A1AA、选中态 #FFFFFF',
        ],
      },
      {
        title: '全页面/组件深色 CSS（P0）',
        items: [
          '账单组件：components/bill/AmountInput.vue、CategoryPicker.vue、DatePicker.vue 加深色块，键盘/弹层/分隔线转深色，金额橙、收入绿提亮',
          '聊天组件：components/chat/GuideModal.vue、MessageBubble.vue + MessageBubble.scss，弹层/标签/气泡/文件卡全部主题化，用户气泡反白',
          '通用组件：components/common/EmptyState.vue、Skeleton.vue 加深色块（图标容器/骨架块转深色）',
          '计划组件：components/plan/PlanReminderSection.vue、PlanTagPicker.vue、PlanTimeSection.vue，chip/弹层/选择器/分隔线转深色',
          '页面：pages/disclaimer/index.vue、pages/lock/index.vue、pages/plan/components/TemplateForm.vue、pages/settings/sub 的 data.vue / decision-detail.vue / privacy.vue / relation-detail.vue 全部主题化',
          '外部 scss：pages/functions/functions.scss、pages/settings/sub 的 about.scss / agent.scss / feedback-new.scss / profile.scss / relations.scss / simulation.scss / ai.scss、pages/search/result.scss 末尾补齐深色块',
          '统一 Zinc 映射：页面 #18181B、卡片 #27272A、输入区/按压 #3F3F46、边框 #3F3F46、主文字 #FAFAFA、次文字 #A1A1AA；状态色浅底改半透明深底',
        ],
      },
      {
        title: '原生组件与图表主题化（P0/P1）',
        items: [
          '新建 composables/useTheme.js：响应式 isDark，H5 用 matchMedia、App/小程序用 onThemeChange，全程能力探测 + try/catch + onUnmounted 清理（规避历史上无条件调用 onThemeChange 导致引导页白屏的崩溃）',
          '原生 switch/slider：PlanReminderSection.vue、profile.vue、relation-detail.vue 的 color/activeColor/backgroundColor 改 isDark 动态绑定',
          '重写 utils/chart-renderer.js：light/dark 两套 PALETTE，坐标轴/网格/中心圆/文字/填充随 dark 切换；SijiChart.vue 新增 dark prop 并补 dark/colors watcher',
          'pages/bill/stats.vue、pages/plan/stats.vue：8 个图表全部接入（系列色/饼色/图例点/热力图改 computed）',
          'pages/settings/sub/relation-graph.vue + relation-graph.scss：ECharts 节点/连线/标签/图例及页面外壳全部主题化（此前深色下整图隐形）',
        ],
      },
      {
        title: '清理与修复（P2）',
        items: [
          'pages/chat/chat-mixins.scss：删除未被任何地方使用的 card-base 死 mixin',
          'components/common/Skeleton.vue：修复浅色区第 100 行多余右括号笔误',
        ],
      },
    ],
  },
]
