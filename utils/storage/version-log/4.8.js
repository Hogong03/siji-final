/**
 * 版本日志数据段：4.8.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V48 = [
  {
    version: '4.8.4',
    date: '2026-10-02',
    title: '4.8.4 深色失效总根因修复：scoped 穿透（:global）—— 所有页面深色真正生效',
    summary: [
      '总根因实锤：scoped 样式里的 .theme-dark 编译成 .theme-dark[data-v-x]（属性选择器挂在自身），而类挂在 html 根元素（无 data-v 属性）—— 4.8.0 以来所有写进 scoped 的类驱动深色块整体失效，包括决策页/计划页/功能页滑块/SijiIcon 图标切换',
      '修法：93 处裸 .theme-dark { 全量改为 :global(html.theme-dark) {（编译实验证明产出干净祖先选择器，无 data-v 注入）；App.vue 全局样式无 scoped 不受影响',
      '用户四症状全部归因此根因：决策页白 = scoped 失效；计划页白 = 同；功能页滑块不变 = 深色规则在但 scoped 失效；图标不变 = SijiIcon 的显隐切换同为 scoped 失效',
      '「外观切浅色不变」同根因：此前手动摘类无效果是因为深色从未由类驱动上过色（页面一直是 4.7.x 系统跟随的旧产物）',
      '守卫测试升级：新增断言禁止裸 .theme-dark（必须 :global 穿透），防回归；测试 88 文件 / 1228 用例绿（ai-enhance-490 为 uni-agent 进行中工作，其 1 失败与其无关）',
    ],
    categories: [
      {
        title: 'scoped 穿透总根因（P0）',
        items: [
          '实验定案（scripts/_scoped_probe.cjs / _scoped_probe2.cjs）：compileStyle(scoped:true) 把 .theme-dark { .page{} } 编译成 .theme-dark[data-v] .page[data-v]，html 上的类挂载点无 data-v 属性，永远匹配失败',
          '写法对比实验：:global(html.theme-dark) 编译后为干净祖先链 html.theme-dark，无属性注入 —— 官方语义正解',
          'scripts/_scoped_fix.py：全量 93 处替换（幂等，已 :global 跳过），替换后零裸残留',
        ],
      },
      {
        title: '守卫升级（P1）',
        items: [
          'tests/theme-mode.test.js：双路径配对断言改为 :global(html.theme-dark) 形态 + 新增裸 .theme-dark 禁止断言，防止以后新写深色块再踩 scoped 坑',
        ],
      },
    ],
  },
  {
    version: '4.8.3',
    date: '2026-10-02',
    title: '4.8.3 深色补漏二期：页面体底色 + 白底类全量补齐（45 类）+ 反白按钮',
    summary: [
      '修「切深色后大量页面仍白」的根因：H5 的 page 选择器编译成 uni-page-body，运行时默认白底挡住画布色 —— App.vue 深浅两套根规则都补 .uni-page-body / uni-page-body 双写选择器',
      '45 个白底顶层类批量补齐 theme-dark 覆盖（聊天页 16 处主通道、Agent 创建页 7 处、AI 配置 3 处等），背景/边框/文字按 Zinc 深色映射改写，规则内容与浅色结构一一对应',
      '黑色主按钮深色反白：决策/账单 FAB、保存/确认按钮、发送停止钮 黑底白字 -> 白底黑字（品牌反白规格）',
      '误报排除：黑底白字按钮、白字文字、SCSS 变量背景等 14 处确认为设计意图不补；确认按钮白底反白、锁屏白点、透明 logo 白底托 5 处深色反白保留',
      '测试 86 文件 / 1213 用例全绿；守卫扫描剩余 15 处全部定性为设计意图',
    ],
    categories: [
      {
        title: '页面体底色根因（P0）',
        items: [
          'App.vue：浅色根规则补 .uni-page-body；深色根规则补 html.theme-dark .uni-page-body / html.theme-dark uni-page-body（类 + 元素双写，不赌编译器替换行为）',
          '4.7.x 系统跟随模式下 media 版 page{} 编译后被替换为 uni-page-body 命中，故无此问题；4.8.0 类驱动后 page.theme-dark 匹配不上，暴露',
        ],
      },
      {
        title: '白底类批量补齐（P1）',
        items: [
          'pages/chat/chat.scss：聊天页主通道 16 处（页面壳/自定义导航/徽标/弹窗/引导/切换器/建议条/回去接着聊卡）',
          'pages/settings/sub/agent_add.scss：7 处（表单输入/头像选项/操作栏/取消按钮/查看态）—— 4.7.0 时代深色块就只有 start-chip 两条，存量欠账',
          'pages/settings/sub/ai.scss 3 处 + about.scss 3 处 + memory/dev-feedback/decisions 各 2 处 + lock/records/bill/trash/MessageBubble/PlanDailyStrip/ExecResultCard 各 1-4 处',
          '映射规格：背景白 #FFF/#F4F4F5 -> #27272A、#FAFAFA -> #18181B；边框 #E4E4E7 -> #3F3F46；文字 #18181B -> #FAFAFA',
        ],
      },
      {
        title: '反白主操作（P1）',
        items: [
          'decisions.vue FAB/确认按钮、agent_add 保存按钮、bill FAB、聊天发送停止钮：黑底白字 -> 白底黑字',
          'lock 页 pin-dot.filled 补双路径反白（黑底沉浸页白点）',
        ],
      },
    ],
  },
  {
    version: '4.8.2',
    date: '2026-10-02',
    title: '4.8.2 AI 链路审查修复：先查后改带得回 ID、混合轮不再静默丢弃、兜底记账过确认闸门等 20 项',
    summary: [
      'query 结果带 client_id：修「先查后改」结构性断裂 —— AI 查到了账单/记录也拿不到 ID，update_bill/update_diary/update_feedback 实际不可达（全量 AI 功能审查发现的 P1）',
      '混合轮不再静默丢弃：同一轮「查询 + 大额写入」时，查询与非确认写入照常执行、结果照常回传，只挂起确认卡（原来命中确认即 return，本轮查询一个都不回传）',
      '兜底产出的记账同样过确认闸门：needConfirm 不再写死 false，5000 元不再绕过确认直接落库',
      '稳定性三连：点停止真正中止工具轮请求（未定义变量 task 修复）；MAX_ROUNDS 兜底轮检查 API 错误，不再把失败装成「走神了」正常回复；新消息发出时清理上一轮确认挂起态（旧确认卡点错 action 的错位修复）',
      '工程清理：删除从未接线的 bumpDataVersion 数据版本机制（缓存失效统一走 invalidatePromptCache）、打卡补缓存失效、免打扰时段支持显式关闭、自检选数排除冷藏计划、短 query（嗯/哦）不再扛全量记忆、未闭合 think 标签剥离、流式超时/收尾分片的截断标记补全、移除「提取待办」幽灵广告与三处死代码',
      '测试 86 文件 / 1213 用例全绿（新增 ai-audit-fixes 回归 4 例）；plan-checkin 的周一日期用例改为周条件断言，不再每周一必挂',
    ],
    categories: [
      {
        title: '先查后改（P1 修复）',
        items: [
          'utils/ai/tools/executor.js：formatBills / formatDiaries / formatPlans / formatCombined 四个格式化函数在结果行尾附 [id:client_id] —— update 类工具 schema 强制 client_id，原来格式化层把 ID 剥掉了，AI「先 query 再 update」永远改不动（agent-loop 里「查询真跑才能拿 client_id」的设计意图被架空）',
        ],
      },
      {
        title: '确认闸门与混合轮',
        items: [
          'utils/ai/fallback.js：兜底提取的 create_bill 带 needConfirm:true，交给 confirm-gate 按金额判（原来 false 直接绕过，5000 元静默落库）',
          'utils/ai/agent-loop.js：pendingCalls 收集后不再立即 return —— 查询类并行执行、非确认写入串行执行的结果先进 execResults，确认卡最后追加返回（pendingCallSet 按调用对象跳过挂起项）',
          'composables/useChatEngine.js：handleSend 起点清空 pendingAction/pendingActions/pendingReply 并剥离旧消息上的确认标记 —— 引擎 refs 只有一份，旧确认卡可点且执行的是最新挂起 action',
        ],
      },
      {
        title: '稳定性',
        items: [
          'utils/ai/agent-transport.js：uni.request 返回的 RequestTask 接收为 task 再 abort（原来引用未定义变量抛 ReferenceError 被 catch 吞掉，点停止无效）；删除 supportsStream 恒真假条件；SSE 90s 超时的半截内容按截断标记（finishReason 空时回落 length）',
          'utils/ai/agent-loop.js：MAX_ROUNDS 兜底轮 response.error 直接抛给上层（原来静默变「走神了」正常气泡）',
          'utils/ai/chat-sse.js：收尾 buffer 分片补读 finish_reason（最后一片可能同时带 length 截断）',
          'utils/ai/response-parser.js：未闭合的 <think>/<thinking>（流式截断常见）从开标签剥到结尾，思考内容不再当正文展示',
        ],
      },
      {
        title: '提示词与缓存',
        items: [
          'utils/ai/prompt-builder.js：删除 P1-B2 的 bumpDataVersion/_dataVersion 机制（生产零调用，死重），失效统一走 invalidatePromptCache；删除 isLiteChatMode 再导出',
          'store/executors/plan.js：execLogPlanCheckIn 补 invalidatePromptCache（提醒弹窗直达打卡走这里，是唯一不失效缓存的写执行器）',
          'utils/ai/prompt-actions.js + tools/index.js：移除 extract_todos 幽灵广告（CORE_ACTIONS 有广告、TOOL_LABELS 有名字，但无 schema 无 handler，JSON 模式下被静默滤掉）；relation/decision/simulation 的 action 由 extSection 按数据存在性注入的既有设计核实无误，不动',
          'utils/ai/constants.js：op-claim 两集对齐（基础集补「记了一笔」、收窄集补「修改」），reply 修正不再漏剥',
        ],
      },
      {
        title: '记忆与自检',
        items: [
          'utils/memory-rank.js：非空短 query（<4 字，如「嗯」「哦」）BM25 零命中时不再回落注入最近 30 条全量记忆；空 query（无消息上下文）保留回落原行为',
          'utils/ai/eval/runner.js：buildEvalContext 选数排除冷藏/顺延计划（plan-checkin 语料不再因 AI 正确拒绝打卡而假失败）',
          'utils/ai/chat-helpers.js：getRecentHistory 补文件正文保留（窗口内最后一条带文件消息拼 [文件 名]+正文，更早的留卡片摘要，与 buildChatHistory 同口径）；very_low 能量档跳过动静摘要（与「不主动提任务」降载口径冲突）',
          'utils/ai/providers.js：getAsrProvider 删 qwen 兜底 —— 它的 ASR 是 url 网关模式，客户端选中必败',
        ],
      },
      {
        title: '测试与工程',
        items: [
          '新增 tests/ai-audit-fixes.test.js（4 例）：query 带 id、混合轮执行+挂起、兜底记账需确认、短 query 不回落',
          'tests/plan-checkin.test.js：backfillMap 用例改周条件断言（map 只标本周，周一昨天在上周，此前每周一必挂）',
          'utils/reminder/settings.js：免打扰时段显式空串 = 关闭（isInQuietHours 对空串本就返回 false，读取层却强制回落默认值）',
          '全量 NODE_OPTIONS=--max-old-space-size=4096 + vitest run --maxWorkers=2：86 文件 / 1213 用例全绿',
        ],
      },
    ],
  },
  {
    version: '4.8.1',
    date: '2026-10-01',
    title: '4.8.1 修 tabBar：not TabBar page 报错与图标不随主题',
    summary: [
      '修 setTabBarStyle/setTabBarItem 在非 tab 页报 not TabBar page：加当前页守卫，只在对话/功能/设置三个 tab 页调 API，fail 回调静默',
      '修深色下 tab 图标不变化：H5 端直接换 .uni-tabbar 图标 img 的 src（任意页面切档立即生效，幂等），不再依赖仅在 tab 页可用的 API',
      'App.vue 新增 H5 tabBar 深色 CSS 兑底（.uni-tabbar 背景色/文字色/选中白），颜色不依赖 JS API 成败',
      '测试 86 文件 / 1213 用例全绿（4.8.0 时的 plan-checkin 跨月日期既有失败随日期窗口自然恢复）',
    ],
    categories: [
      {
        title: 'tabBar 修复（P0）',
        items: [
          'utils/theme.js：新增 isOnTabPage()（getCurrentPages 顶栏路由比对三个 tab 路由），setNativeBars 内 API 调用前守卫，setTabBarStyle/setTabBarItem 加 fail 静默回调',
          'utils/theme.js：新增 syncH5TabIcons()（.uni-tabbar__item > img 的 src 换 -v2 与 -v2-dark 互转），applyClass 挂类后同步一次，任意页面切档图标立即跟随',
          'App.vue：html.theme-dark .uni-tabbar 系列深色 CSS（#ifndef MP-WEIXIN 包裹），背景 #18181B、未选中 #A1A1AA、选中 #FFFFFF',
        ],
      },
    ],
  },
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
