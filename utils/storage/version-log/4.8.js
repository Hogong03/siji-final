/**
 * 版本日志数据段：4.8.x（新版本在前）
 *
 * 发布前合并：4.8.0~4.8.4 五条补丁记录合并为一条 4.8.4（应用未发布，合并降噪；
 * title 注明整合范围，明细按主题归并，原文的文件名/技术结论/排坑记录保留）。
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V48 = [
  {
    version: '4.8.4',
    date: '2026-10-02',
    title: '4.8.4（整合 4.8.0~4.8.4，发布前合并）：深色手动切换（外观三选一）+ 深色失效三层根因修复（双路径改写 / page 体底色 / scoped :global 穿透）+ AI 链路审查修复',
    summary: [
      '设置页新增「外观」三选一（跟随系统/浅色/深色，立即生效、重启保持）：新建 utils/theme.js 三态核心（siji_theme_mode 存取 + applyTheme 统一应用），深色 CSS 从纯媒体查询改为「类驱动 + 条件编译双路径」（96 个深色块全部分支改写），main.js 全局 mixin onShow 幂等重刷；默认跟随系统，存量用户零感知',
      '修 tabBar 两坑：setTabBarStyle/setTabBarItem 在非 tab 页报 not TabBar page（加 isOnTabPage 守卫 + fail 静默）；H5 深色 tab 图标直接换 .uni-tabbar img 的 src（任意页面切档立即生效），App.vue 补深色 CSS 兜底',
      'AI 链路审查修复：query 结果带 client_id 修「先查后改」结构性断裂（update 类工具实际不可达）；混合轮查询不再静默丢弃；兜底记账过确认闸门（5000 元不再绕过确认直接落库）；点停止真正中止工具轮请求；MAX_ROUNDS 兜底轮不再把失败装成「走神了」',
      '修「切深色大量页面仍白」：H5 的 page 选择器编译成 uni-page-body 运行时默认白底挡住画布 —— App.vue 深浅两套根规则双写选择器补齐；45 个白底顶层类批量补 theme-dark 覆盖；黑色主按钮深色反白（品牌反白规格）',
      '深色失效总根因实锤：scoped 样式里的 .theme-dark 编译成 .theme-dark[data-v-x]（类挂在 html 根元素无 data-v 属性，永远匹配失败）—— 4.8.0 以来所有写进 scoped 的类驱动深色块整体失效；93 处全量改 :global(html.theme-dark)（编译实验定案），决策页/计划页/功能页滑块/SijiIcon 四症状全部归因此根因',
      '工程清理：删除从未接线的 bumpDataVersion 数据版本机制（缓存失效统一走 invalidatePromptCache）；短 query（嗯/哦）不再回落全量记忆；未闭合 think 标签剥离；SSE 收尾分片补读 finish_reason；移除「提取待办」幽灵广告'
    ],
    categories: [
      {
        title: '外观手动切换（4.8.0）',
        items: [
          'pages/settings/index.vue：外观行（moon 图标 + 当前模式 + ActionSheet 三选，#ifndef MP-WEIXIN 包裹小程序隐藏）；切换立即生效落盘 siji_theme_mode，手动档下系统主题变化不再影响应用',
          'utils/theme.js（新建）：normalizeMode 非法值归 system / initTheme 启动初始化 / setThemeMode 切档 / applyTheme 幂等应用（挂类 + setTabBarStyle/setTabBarItem 换图标 + setNavigationBarColor），平台 API 全部能力探测 + try/catch 静默退化；useTheme 改薄壳转出响应式单例 isDark（15 处 JS 注入色消费方零改动）；main.js 全局 mixin onShow 重刷，App.vue onLaunch 最前调 initTheme（防首屏闪浅色）',
          '85 个文件 95 个 @media 深色块脚本化改写双路径：#ifndef MP-WEIXIN 包 .theme-dark 类版 + #ifdef MP-WEIXIN 包原 media 版，块内规则原样保留；新增守卫测试（media 深色块必须位于 MP 分支内且与 .theme-dark 一比一配对，防新写深色块漏包装）'
        ]
      },
      {
        title: 'tabBar 修复（4.8.1）',
        items: [
          'utils/theme.js：新增 isOnTabPage()（getCurrentPages 顶栏路由比对三个 tab 路由）守卫 + fail 静默回调；新增 syncH5TabIcons()（.uni-tabbar__item > img 的 src 在 -v2 与 -v2-dark 互转，幂等）；App.vue 补 html.theme-dark .uni-tabbar 深色 CSS（#ifndef MP-WEIXIN 包裹，背景 #18181B / 未选中 #A1A1AA / 选中 #FFFFFF）'
        ]
      },
      {
        title: 'AI 链路审查修复（4.8.2）',
        items: [
          '先查后改断裂：utils/ai/tools/executor.js 的 formatBills/formatDiaries/formatPlans/formatCombined 四个格式化函数在结果行尾附 [id:client_id] —— update 类工具 schema 强制 client_id，原来格式化层把 ID 剥掉了，「先 query 再 update」永远改不动（agent-loop「查询真跑才能拿 client_id」的设计意图被架空）',
          '确认闸门与混合轮：utils/ai/fallback.js 兜底提取的 create_bill 带 needConfirm:true（原来 false 直接绕过，5000 元静默落库）；agent-loop.js pendingCalls 收集后不再立即 return —— 查询并行、非确认写入串行的结果照常回传，确认卡最后追加；useChatEngine.js handleSend 起点清空旧确认挂起态并剥离旧消息确认标记（旧确认卡点错 action 的错位修复）',
          '稳定性：agent-transport.js 的 RequestTask 接收为 task 再 abort（原来引用未定义变量抛 ReferenceError 被 catch 吞掉，点停止无效），SSE 90s 超时的半截内容按截断标记；agent-loop.js MAX_ROUNDS 兜底轮 response.error 直接抛给上层（原来静默变「走神了」正常气泡）；chat-sse.js 收尾 buffer 分片补读 finish_reason；response-parser.js 剥未闭合的 <think>/<thinking>（流式截断常见），思考内容不再当正文',
          '提示词与缓存：prompt-builder.js 删除 P1-B2 的 bumpDataVersion/_dataVersion 死机制与 isLiteChatMode 再导出，失效统一走 invalidatePromptCache；store/executors/plan.js 的 execLogPlanCheckIn 补缓存失效（提醒弹窗直达打卡是唯一不失效缓存的写执行器）；prompt-actions.js + tools/index.js 移除 extract_todos 幽灵广告（有广告有名字、无 schema 无 handler，JSON 模式下被静默滤掉）；constants.js op-claim 两集对齐（基础集补「记了一笔」、收窄集补「修改」）',
          '记忆与自检：memory-rank.js 非空短 query（<4 字）BM25 零命中时不再回落注入最近 30 条全量记忆；eval/runner.js buildEvalContext 选数排除冷藏/顺延计划（plan-checkin 语料不再假失败）；chat-helpers.js getRecentHistory 补文件正文保留（窗口内最后一条带文件消息拼正文，更早的留卡片摘要）+ very_low 能量档跳过动静摘要；providers.js getAsrProvider 删 qwen 兜底（url 网关模式客户端选中必败）；reminder/settings.js 免打扰时段显式空串 = 关闭'
        ]
      },
      {
        title: '深色补漏二期（4.8.3）',
        items: [
          '页面体底色根因：App.vue 浅色根规则补 .uni-page-body、深色根规则补 html.theme-dark .uni-page-body / uni-page-body 双写（不赌编译器替换行为）—— 4.7.x 系统跟随下 media 版 page{} 编译后被替换为 uni-page-body 命中故无此问题，4.8.0 类驱动后 page.theme-dark 匹配不上而暴露',
          '45 个白底顶层类批量补齐 theme-dark 覆盖：chat.scss 16 处主通道（页面壳/自定义导航/徽标/弹窗/引导/切换器/建议条/回去接着聊卡）、agent_add.scss 7 处（4.7.0 时代深色块就只有 start-chip 两条的存量欠账）、ai/about 各 3 处、memory/dev-feedback/decisions 各 2 处等；映射规格：白 #FFF/#F4F4F5→#27272A、#FAFAFA→#18181B、边框 #E4E4E7→#3F3F46、文字 #18181B→#FAFAFA',
          '反白主操作：decisions.vue FAB/确认按钮、agent_add 保存按钮、bill FAB、聊天发送停止钮 黑底白字→白底黑字；lock 页 pin-dot.filled 补双路径反白（黑底沉浸页白点）；14 处黑底白字按钮/白字文字/SCSS 变量背景确认为设计意图不补'
        ]
      },
      {
        title: 'scoped 穿透总根因（4.8.4）',
        items: [
          '实验定案（scripts/_scoped_probe.cjs / _scoped_probe2.cjs）：compileStyle(scoped:true) 把 .theme-dark { .page{} } 编译成 .theme-dark[data-v] .page[data-v]，html 上的类挂载点无 data-v 属性永远匹配失败；:global(html.theme-dark) 编译后为干净祖先链无属性注入 —— 官方语义正解；scripts/_scoped_fix.py 全量 93 处替换（幂等，已 :global 跳过），替换后零裸残留；「外观切浅色不变」同根因（深色从未由类驱动上过色）',
          'tests/theme-mode.test.js 守卫升级：双路径配对断言改 :global(html.theme-dark) 形态 + 新增裸 .theme-dark 禁止断言，防新写深色块再踩 scoped 坑'
        ]
      },
      {
        title: '测试',
        items: [
          '新增 tests/ai-audit-fixes.test.js（4 例：query 带 id、混合轮执行+挂起、兜底记账需确认、短 query 不回落）；plan-checkin 周一日期用例改周条件断言（map 只标本周，此前每周一必挂）；全量演进 86 文件/1213 → 88 文件/1228 用例全绿（NODE_OPTIONS=--max-old-space-size=4096 + vitest run --maxWorkers=2）'
        ]
      }
    ]
  }
]
