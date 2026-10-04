/**
 * 版本日志数据段：4.12.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V412 = [
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
