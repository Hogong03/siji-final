/**
 * 版本日志数据段：4.12.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V412 = [
  {
    version: '4.12.5',
    date: '2026-10-05',
    title: '4.12.5 修 App 端图标不跟主题：SijiIcon 从 CSS 双图切换改为 JS 驱动换 src（消费 theme.js 响应式 isDark）',
    summary: [
      '用户真机截图实证：App 深色下页面/简报卡/tabBar 都正常，但输入区图片/文件按钮等 primary/secondary 系图标仍停留在浅色版（黑线条在深底上若隐若现），而 white 系图标（发送箭头）正常 —— 指向 SijiIcon 的「双 <image> 叠放 + html.theme-dark CSS 切显隐」在 App 样式编译器下不生效（页面背景等同类选择器却生效，属 App 编译器差异）',
      '修复：SijiIcon v5 改为单 <image>，src 直接由 theme.js 的响应式 isDark 单例驱动（isDark ? darkSrc : lightSrc）—— 彻底移除对 CSS 编译器行为的依赖，三端行为一致；secondary 灰图标的降权透明度沿用两档（浅 0.45 / 深 0.55）',
      'MP-WEIXIN 同样受益：isDark 在 MP 走 uni.onThemeChange 系统跟随，无需 @media 包裹的 CSS 切换',
      'theme-mode / theme-runtime 守卫 10 例全绿（SijiIcon 移除自身深色块后配对数 0:0 合法）；全量 93 文件 / 1299 用例全绿；App 端需 HBuilder X 重新编译目检',
    ],
    categories: [
      {
        title: 'SijiIcon v5（4.12.5）',
        items: [
          'components/common/SijiIcon.vue：模板改单 <image> :src="currentSrc"；currentSrc = isDark ? darkSrc : lightSrc（tone 语义不变：primary/secondary 浅色用 -v2、white 恒用 -v2-dark、amber 用 sun-amber 系列）；移除双图叠放与 html.theme-dark/@media 深色块',
          '教训沉淀：跨三端的「主题切换视觉」优先 JS 驱动（响应式状态换 src/样式绑定），CSS 选择器方案（html.theme-dark 嵌套）在 H5 与 App 的样式编译器之间存在行为差异，真机必验',
        ],
      },
    ],
  },
  {
    version: '4.12.4',
    date: '2026-10-05',
    title: '4.12.4 图标分型补齐深色处理：厂商 logo 深色垫白底托（chat 顶部/设置首页）+ Agent 头像深色底托，品牌色与插画一律不反色',
    summary: [
      '用户反馈「只有一套浅色图标缺乏深色图标」—— 全量盘点：56 张功能图标中 41 张早有 -v2-dark 深色版（SijiIcon 双图自动切换，4.12.3 后 App 端也生效）；真缺口是 15 张无深色版的图标，分属两类「本就不该反色」的东西：厂商品牌 logo ×5 与 Agent 插画头像 ×20（-v2/-v3 各十张）',
      '方案按图标分型：A 型线条功能图标 = 必须浅深成对（gen-icons.cjs 成对产出）；B 型品牌 logo 与 C 型彩色插画头像 = 不做反色，深色下垫白色/中性底托区分边界 —— 行业惯例（微信/Telegram 头像同款处理），反色反而破坏品牌识别',
      '修复一：chat 顶部厂商 logo（.nav-badge-logo 深色块）垫白底托 —— 之前只有 ai.scss（AI 配置页）有，chat 顶部的透明底黑 logo（智谱/OpenAI）在深色下直接隐形',
      '修复二：设置首页厂商行 logo（.row-provider-logo 深色块）垫白底托，与 ai.scss 同规矩',
      '修复三：AgentAvatar 深色下底托 #F4F4F5 → #27272A（描边 4.8.x 已有）—— 头像 PNG 已验证全透明底，底托能透出来',
      '盘点确认 AgentSwitcher 与 agent_add 选择格的深色块 4.8.x 已盖过，无需改；AGENTS.md 图片资源节补「图标分型规矩」防复发；改动文件过 dev server 编译审计全 200，theme-mode 守卫 7 例全绿',
    ],
    categories: [
      {
        title: '图标分型补齐（4.12.4）',
        items: [
          'pages/chat/chat.scss：深色块 .nav-badge-logo 加 background: #FFFFFF',
          'pages/settings/index.vue：深色块 .row-provider-logo 加 background: #FFFFFF',
          'components/common/AgentAvatar.vue：深色块 .agent-avatar--icon 加 background: #27272A（描边已有）',
          'AGENTS.md：图片资源节新增「图标分型规矩」——A 型成对产出 / B 型 logo 与 C 型头像不反色、垫底托',
        ],
      },
    ],
  },
  {
    version: '4.12.3',
    date: '2026-10-05',
    title: '4.12.3 修 App 端深色切换只换 tabBar 不换页面：逻辑层没有 document，App 分支改 plus.webview 逐页 evalJS 挂类',
    summary: [
      '用户实测：App 端切外观只有 tabBar/导航栏变色，页面内容不跟色 —— 根因：App 端逻辑层跑在独立 v8 引擎里没有 document，4.8.0 的 H5 DOM 挂类路径（applyClass）在 App 全程静默空转；tabBar/导航栏是原生层（setNativeBars 的 uni API 真生效），所以只有它们变色',
      '修复：utils/theme.js 新增 App 分支（#ifdef APP-PLUS）—— plus.webview.all() 逐个 WebView evalJS 往各页面 html 元素挂/摘 theme-dark 类；新开页面的兜底靠 main.js 已有的全局 onShow mixin（applyTheme 幂等，页面显示时必重挂）',
      'buildToggleJs(dark) 抽成导出的纯函数（注入脚本可单测）；新增 tests/theme-runtime.test.js 3 例（注入脚本内容 + 无 plus/document 环境下 applyTheme 不抛错的底线）',
      '顺手修 tests/reminder-snooze.test.js 的跨天假失败：凌晨 00:00~00:05 跑测试时夹具的「5 分钟前」落在昨天，而调度器按「今天 + customTime 钟点」算触发永不命中 —— 夹具时间夹回今天',
      '测试 93 文件 / 1299 用例全绿；App 端实际效果需真机验证（HBuilder X 重新编译后：切深色 → 各页面背景/文字即时跟色，新开页面也带色）',
    ],
    categories: [
      {
        title: 'App 端主题修复（4.12.3）',
        items: [
          'utils/theme.js：#ifdef APP-PLUS 分支重赋 applyClass —— plus.webview.all() 循环 evalJS(buildToggleJs(isDark))，单个 WebView 失败不影响其余；H5 分支（document 路径）与 MP 分支（no-op）不变',
          '排坑记录：typeof document 在 App 逻辑层是 undefined，4.8.0 的 applyClass 第一行守卫就 return 了 —— 三平台的「条件编译同时编入 vitest」教训再次生效，用 let 绑定 + 赋值切换而非双份 function 声明',
          '已知边界：App 冷启动深色模式下首帧可能有短暂浅色闪现（页面 WebView 创建先于 evalJS），onShow 兜底会立即补挂；刷新耗时随页面数线性增长（当前 <20 个 WebView，无感）',
        ],
      },
      {
        title: '测试基建（4.12.3）',
        items: [
          'tests/theme-runtime.test.js（新增 3 例）+ tests/reminder-snooze.test.js 夹具跨天修复（00:00~00:05 的假失败窗口消除）',
        ],
      },
    ],
  },
  {
    version: '4.12.2',
    date: '2026-10-04',
    title: '4.12.2 修「web 端读不了 docs」的体验缺口：缺解析 Key 时报错弹窗带「去配置」直达 + 连接 AI 页写明读 Word/PDF 需要 Moonshot',
    summary: [
      '用户实测 web 端发 docs 文件提示读不了 —— 排查结论：不是 bug，doc/docx/pdf/xls/ppt 走 Moonshot 云端解析（三端一致），该浏览器环境一个 Key 都没配所以必然被拒；文本类（txt/md/csv 等）本地直读不受影响',
      '修复一（components/chat/InputArea.vue）：文档类读取失败且未配置解析 Key 时，弹窗改为「读 Word/PDF 需要解析 Key」+「去配置」直达 AI 配置页 —— 之前只给一句死胡同提示，用户会以为是 bug（本次即被坑）',
      '修复二（pages/settings/sub/key-guide.vue）：Moonshot 引导卡卖点补一句「读 Word/PDF 文档也走它的云端解析」—— 之前配了 DeepSeek 的用户读不了 docs 会误判为缺陷',
      '两个改动文件过 dev server 编译审计（4.12.1 的 sass 坑复查）：主模块 + style 虚拟模块全 200；测试 92 文件 / 1296 用例全绿',
    ],
    categories: [
      {
        title: '文档解析引导（4.12.2）',
        items: [
          'components/chat/InputArea.vue：新增 hintDocKey(result) —— kind=document 且 isDocParseAvailable()=false 时弹「去配置」模态框（确认 → /pages/settings/sub/ai），其他失败照旧走 hint()',
          'pages/settings/sub/key-guide.vue：GUIDE_SELL.moonshot 补文档解析说明（读 Word/PDF 走 Moonshot 云端，Key 可与 Kimi 聊天共用）',
        ],
      },
    ],
  },
  {
    version: '4.12.1',
    date: '2026-10-04',
    title: '4.12.1 修简报卡 SFC 编译崩溃：EnterBriefing 用了页面局部 mixin（text-ellipsis），scoped SCSS 里不存在导致整个聊天页 chunk 500',
    summary: [
      '用户报 bug：聊天页打不开，显示「连接服务器超时，点击屏幕重试」—— 现场排查：遮罩是 uni-h5 的 uni-async-error（异步页面 chunk 加载失败），不是 dev 服务器挂了（模块 fetch 全 200）；动态 import 逐模块定位到 EnterBriefing.vue',
      '根因：EnterBriefing.vue 的 scoped 样式里写了 @include text-ellipsis —— 该 mixin 定义在 pages/chat/chat-mixins.scss（只有 chat.scss 上下文有），组件编译时 sass 报 Undefined mixin → 样式虚拟模块 500 → 页面 chunk 加载失败',
      '修复：组件里改纯 CSS 三件套（white-space/overflow/text-overflow）；浏览器实测：简报卡正常渲染（问候池「早。」+ 通用 chips + 空状态无指标），页级按钮行对 v2 消息正确隐藏',
      '教训：组件 scoped SCSS 里禁止 @include 页面局部 mixin（text-ellipsis 等定义在各页面的 *-mixins.scss，不进组件编译上下文）—— 要么写纯 CSS，要么把 mixin 上移到 uni.scss',
    ],
    categories: [
      {
        title: '修复与排坑（4.12.1）',
        items: [
          'components/chat/EnterBriefing.vue：@include text-ellipsis → white-space: nowrap + overflow: hidden + text-overflow: ellipsis',
          '排坑路径记录：uni-async-error 遮罩 = 页面 chunk 加载失败 → fetch 模块全 200 说明是传递依赖挂 → 动态 import 逐模块缩小（EnterBriefing FAIL / enter-dialogue OK）→ fetch style 虚拟模块（?vue&type=style&lang.scss）拿到 sass 500 的具体报错',
          '注意：sass 编译错误只在「加载该组件的模块请求」上暴露（fetch 主模块仍是 200），vitest 不编译 SFC 样式所以全量测试抓不到 —— 新组件入库前应在 HBuilder X 里跑一次页面',
        ],
      },
    ],
  },
  {
    version: '4.12.0',
    date: '2026-10-04',
    title: '4.12.0 初始对话重设计：进入消息从纯文本升级为结构化简报卡（指标格 + 唯一主按钮 + 次级 chips + 问候变化池）',
    summary: [
      '方案：保持 4.5.0 的「进入收敛为一条消息」语义与落盘/签名机制不动，渲染层卡片化 —— 解决旧版「问候+一串列表行+最多 10 个平铺按钮」信息无层级、按钮无主次、模板句式每天一字不差的问题',
      '结构化 payload：enter-dialogue.js 新增 buildBriefing（纯函数可单测）产出 _briefing 挂在进入消息上（_briefingVersion: 2）；文本 content 照旧生成（老版本回落渲染 + AI 历史窗口都吃它），存量旧消息无该字段自动回落旧渲染，零迁移',
      '指标格：昨日支出（useEnterSummary 新增 readYesterdayExpense）/ 连续打卡（≥2 才上格）/ 新记录 / 新进展，最多 3 格、无数据不渲染',
      '主按钮唯一化：一屏只推一件事，优先级 上班卡 > 过时/快到期计划 > 下一步；其余降为状态行与 chips（上限 3 个）；按钮事件仍走 handleEnterButton 统一通道',
      '问候变化池：按时段（深夜/早/午/下午/晚）× 年积日轮换，同一天同句、隔天换句，本地零成本不调 AI',
      '新组件 components/chat/EnterBriefing.vue（MessageBubble 按 _briefingVersion===2 整卡渲染，替代文本正文与页级按钮行；样式进组件 scoped，深色块 html.theme-dark 嵌套 + MP @media 双路）',
      '测试 92 文件 / 1296 用例全绿（enter-dialogue 新增简报卡 7 例：v2 标记/指标规则/主按钮优先级/chips 收口/兼容回落/问候池/空状态）',
    ],
    categories: [
      {
        title: '简报卡数据层（4.12.0）',
        items: [
          'utils/enter-dialogue.js：新增 BRIEFING_VERSION/isBriefingV2/buildBriefingGreeting（GREETING_POOL 五时段轮换）/buildBriefingMetrics/buildBriefingPrimary（上班卡 > 计划 > 下一步）/buildBriefingChips（去主按钮截 3 个）/buildBriefing；buildEnterSummaryMessage 挂 _briefingVersion + _briefing',
          'composables/useEnterSummary.js：新增 readYesterdayExpense（按昨日月份分片读账单过滤合计，异常吞掉返回 0）进 summary',
          'store/chat/persist.js：落盘白名单加 _briefingVersion / _briefing（丢了重启后回落旧版文本渲染）',
          'pages/chat/index.vue：MessageBubble 增加 @briefing-action 转发；页级按钮行条件加 !isBriefingV2(msg)（v2 按钮在卡内，旧消息照旧）',
        ],
      },
      {
        title: '简报卡渲染（4.12.0）',
        items: [
          'components/chat/EnterBriefing.vue（新增）：问候行（away 来源加「回来了」）→ 指标格 → 主按钮（黑底唯一 primary）→ 状态行（圆点列表）→ 下一步/低落软行 → 次级 chips；点击只 emit action，跳转/预填/打卡仍由页面统一处理',
          '样式硬编码双主题：浅色（#F4F4F5 格子底 / #000 主按钮）+ html.theme-dark 嵌套深色块（H5/App）+ MP @media（#ifdef MP-WEIXIN）双路，theme-mode 守卫通过',
        ],
      },
      {
        title: '验证记录（4.12.0）',
        items: [
          '全量 NODE_OPTIONS=--max-old-space-size=4096 + vitest run --maxWorkers=2：92 文件 / 1296 用例全绿',
          '浏览器验收被开发环境卡住：HBuilder X dev 进程僵死（splash 报「连接服务器超时」，非项目源码问题，重启 dev 进程即恢复）—— 简报卡的实际渲染由真机/HBuilder 重启后目检（打开新对话即见）',
        ],
      },
    ],
  },
]
