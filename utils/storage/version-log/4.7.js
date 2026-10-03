/**
 * 版本日志数据段：4.7.x（新版本在前）
 *
 * 发布前合并：4.7.0 / 4.7.1 两条补丁记录合并为一条 4.7.1（应用未发布，合并降噪；
 * title 注明整合范围，明细按主题归并，原文的文件名/技术结论/排坑记录保留）。
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V47 = [
  {
    version: '4.7.1',
    date: '2026-09-30',
    title: '4.7.1（整合 4.7.0~4.7.1，发布前合并）：深色模式全面适配（系统配置打通 + 全页面 CSS + 图表主题化）+ JS 注入色/占位符深色补漏',
    summary: [
      '深色模式失效根因是系统级配置缺失：三端 manifest 未开启 darkmode、项目无 theme.json，原生导航栏/tabBar 不随系统切换、主题事件不触发、小程序不识别深色 —— 补齐系统配置后再做全页面 CSS',
      '系统级配置：manifest 三端 darkmode + themeLocation，新建 theme.json 双主题变量，pages.json 的 globalStyle/tabBar/40 处导航栏全部改 @变量引用；6 个 tab 深色图标（普通 #A1A1AA、选中 #FFFFFF）',
      '全页面/组件深色 CSS 统一 Zinc 映射（页面 #18181B、卡片 #27272A、输入区/按压/边框 #3F3F46、主文字 #FAFAFA、次文字 #A1A1AA），状态色深色提亮；用户气泡与品牌主按钮深色下反白（白底黑字）',
      '原生组件与图表主题化：新建 useTheme 响应式检测深色（H5 matchMedia、App/小程序 onThemeChange，能力探测 + try/catch），原生 switch/slider 动态绑定；chart-renderer 出 light/dark 两套配色，账单/计划 8 个图表与关系图 ECharts 全部主题化',
      '深色覆盖审计（4.7.1）：117 个 vue/scss 全扫，真缺口集中在 JS 注入色与占位符（CSS 媒体查询盖不到的层）—— App.vue 全局占位符规则（浅 #A1A1AA/深 #71717A，约 70 个输入框受益）、标签圆点/tagColor 兜底色、反馈分类标题、AgentAvatar 文字模式全部随主题',
      '测试 84 文件 / 1203 用例全绿（NODE_OPTIONS=--max-old-space-size=4096 + maxWorkers=2）'
    ],
    categories: [
      {
        title: '系统级配置（4.7.0，P0）',
        items: [
          'manifest.json：app-plus / h5 / mp-weixin 三节点均加 darkmode:true，app-plus 另加 themeLocation:"theme.json"；新建 theme.json 定义 navBgColor/navTxtStyle/bgColor/tabFontColor/tabSelectedColor 等 + 6 个 tab 图标路径变量（light/dark 两套）',
          'pages.json：globalStyle、tabBar（颜色与 iconPath/selectedIconPath）、40 处导航栏背景/文字全部改 @变量引用；保留 CRLF + UTF-8 BOM',
          'static/tab/：新增 chat/functions/settings × 普通/选中共 6 个深色图标（-v2-dark），普通态 #A1A1AA、选中态 #FFFFFF'
        ]
      },
      {
        title: '全页面/组件深色 CSS（4.7.0，P0）',
        items: [
          '账单组件（AmountInput/CategoryPicker/DatePicker）、聊天组件（GuideModal/MessageBubble + scss）、通用组件（EmptyState/Skeleton）、计划组件（PlanReminderSection/PlanTagPicker/PlanTimeSection）与 disclaimer、lock、TemplateForm、settings 子页 data/decision-detail/privacy/relation-detail 全部主题化；外部 scss：functions.scss、settings 子页 about/agent/feedback-new/profile/relations/simulation/ai、search/result.scss 末尾补齐深色块',
          '统一 Zinc 映射：页面 #18181B、卡片 #27272A、输入区/按压 #3F3F46、边框 #3F3F46、主文字 #FAFAFA、次文字 #A1A1AA；状态色浅底改半透明深底（绿/橙/红/蓝提亮）'
        ]
      },
      {
        title: '原生组件与图表主题化（4.7.0，P0/P1）',
        items: [
          '新建 composables/useTheme.js：响应式 isDark，H5 用 matchMedia、App/小程序用 onThemeChange，全程能力探测 + try/catch + onUnmounted 清理（规避无条件调 onThemeChange 导致引导页白屏的历史崩溃）；原生 switch/slider（PlanReminderSection/profile/relation-detail）改 isDark 动态绑定',
          '重写 utils/chart-renderer.js：light/dark 两套 PALETTE，坐标轴/网格/中心圆/文字/填充随 dark 切换；SijiChart.vue 新增 dark prop + dark/colors watcher；bill/plan stats 8 个图表接入',
          'pages/settings/sub/relation-graph.vue + relation-graph.scss：ECharts 节点/连线/标签/图例及页面外壳主题化（此前深色下整图隐形）'
        ]
      },
      {
        title: '深色覆盖审计与 JS 注入色补漏（4.7.1）',
        items: [
          '全量扫描 117 个 vue/scss：83 个含 prefers-color-scheme 深色块，34 个无深色块文件逐一核实为「样式在外部 scss 已盖」或「无颜色定义」，误报清零；系统层（darkmode/theme.json/pages.json @变量/12 个 tab 图标）核实无缺口；已知遗留维持规格决策（优先级色深色可辨、分类标签彩点为功能色）',
          'App.vue：全局 .uni-input-placeholder/.uni-textarea-placeholder 浅色 #A1A1AA、深色 #71717A —— 约 70 个未配置 placeholder-style 的输入框在深色下不再用系统默认偏淡色（H5/App-vue 生效，小程序原生 input 走系统默认）；标签圆点与兜底色随主题：ExecResultCard 标签面板 + 记录详情标签选择器未选中圆点浅 #3F3F46/深 #E4E4E7，tagColor 兜底 #000000 深色提为 #FAFAFA（useTagPicker/useExecTags/useDiaryList），feedback-list 未知分类标题兜底色随主题',
          'AgentAvatar 文字模式深色适配：浅底 #EBEBEB 改深 #27272A、文字改 #FAFAFA，CSS 深色块补 .avatar-text 色；顺带修既有笔误（$ai-primary 写在非 SCSS 块从未生效）；清理：chat-mixins.scss 删未被使用的 card-base 死 mixin、Skeleton.vue 修浅色区多余右括号'
        ]
      }
    ]
  }
]
