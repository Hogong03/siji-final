/**
 * 版本日志数据段：4.10.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V410 = [
  {
    version: '4.10.6',
    date: '2026-10-03',
    title: '4.10.6 自检 v5 复跑 27/29 后收尾：打卡语料改绑 checkinPlan 前置（补建上班模板）+ 语料网络错误重试一次',
    summary: [
      'v5 复跑结果（GLM-5.3 Flash）：27/29（93%），纠偏轮生效 —— work-checkout-chain 从「零工具直接回闲聊」变成「先 query_plan 再如实答复」，multi-intent / bill-stat 两条转绿',
      'work-checkout-chain 剩余失败的根因是语料绑数据：库里没有可打卡的每日计划，模型查完如实说「没有找到能打卡的计划」——行为正确却被判失败（3.7.2 同款教训再次出现）。修复：needs 从 plan 改绑新前置 checkinPlan（打卡子计划平铺存储 query_plan 看不到，自检页从存储直读 childPlans），缺前置时弹窗一键按「上班」模板建计划',
      'long-form-article 那条是网络抖动（请求失败：网络连接失败），29 条连发的单条网络错误不该留假失败 —— runCase 对抛错重试一次（800ms 后）',
      '测试 90 文件 / 1249 用例全绿（ai-eval-context 新增 2 例：打卡前置命中/未命中 + 缺前置判跳过）',
    ],
    categories: [
      {
        title: '自检体系收尾（4.10.6）',
        items: [
          'utils/ai/eval/runner.js：buildEvalContext 新增 checkinPlan 检测（childPlans 打卡子计划优先，顶层计划标题/描述含打卡也命中）+ NEED_LABELS 补「一个可打卡的每日计划（如「上班」模板）」+ runCase 网络错误重试一次',
          'utils/ai/eval/cases.js：work-checkout-chain 的 needs: plan → checkinPlan',
          'pages/settings/sub/ai-eval.vue：fetchEvalContext 直读 getPlanList 的子计划；缺打卡前置时弹窗按「上班」模板一键建（getPlanTemplates 找 tpl_work → store.createPlanFromTemplate）；数据前置栏显示打卡计划状态',
        ],
      },
      {
        title: 'v5 首跑记录（4.10.6 登记）',
        items: [
          '通过 27/29（93%）、跳过 1（bill-correction 缺前置账单）、网络出错 1（long-form-article）',
          '纠偏轮实测有效：work-checkout-chain 调了 query_plan（此前零工具）；转绿的是 multi-intent / bill-stat',
        ],
      },
    ],
  },
  {
    version: '4.10.5',
    date: '2026-10-03',
    title: '4.10.5 修 AI 零工具直接回闲聊（GLM-5.3 Flash 三类实测失败）：提示词补规则 + agent 循环短指令纠偏轮 + 自检页一键补建前置账单',
    summary: [
      '4.10.4 自检报告（26/29）：multi-intent / bill-stat / work-checkout-chain 三条全是「模型零工具直接回闲聊」—— 排查确认工具是全量注入的（闲聊闸门与传输层都无过滤），是 GLM-5.3 Flash 对三类短消息的真实行为：不点名打卡（"下班啦，打个卡"）/ 口头问花费（"这个月花了多少钱"）/ 一句多意图（"记一笔…再写个记录…"）',
      '提示词补 3 规则（AGENT_TOOL_INSTRUCTION）：花了多少钱也是数据问题先查再答；不点名打卡先 query_plan 再 log_plan_checkin；禁止不调工具就声称「已记录/都记好了」',
      'agent 循环新增一次性纠偏轮（agent-loop.js）：STRONG_ACTION_RE 命中的强操作指令 + 整个循环零工具 + 回复里无可执行 JSON action → 追问一轮「请先调工具」；被丢弃的首轮回复不推流（上层 onChunk 按累加消费，先推再纠会重复气泡）；只纠一次不无限循环；cfg.nudge=false 可关',
      '排坑：STRONG_ACTION_RE 首版漏了「打个卡」——"打"和"卡"之间隔着"个"，不含"打卡"子串，正则改成 打个?卡（测试先于发版抓到）',
      '自检页缺前置账单时弹窗一键补建（¥42 测试账单，真实写入需确认，可删）：bill-correction 语料不再被迫跳过；自检口径 bump v5（纠偏改变工具序列产出，v4 报告与 v5 不可直接比）；测试 90 文件 / 1247 用例全绿（新增 tests/agent-nudge.test.js 8 例）',
    ],
    categories: [
      {
        title: 'AI 行为修复（4.10.5）',
        items: [
          'utils/ai/prompt-actions.js：AGENT_TOOL_INSTRUCTION 新增三条规则 —— 花费查询先 query_bill/query_stat、不点名打卡走 query_plan → log_plan_checkin 链路、禁止零工具口头声称完成',
          'utils/ai/agent-loop.js：导出 STRONG_ACTION_RE（打个?卡/记一笔/记一下/记账/花了多少/查一下/改一下/撤销等指令式动词）与 AGENT_NUDGE_TEXT；runAgentLoop 在「零工具直接回复」分支加纠偏判定，追问后继续正常工具循环（MAX_ROUNDS 不变）',
          '纠偏的三个豁免：回复里已带可执行 JSON action（走 JSON 路径语义）、已纠偏过一次、cfg.nudge === false',
          '边界测试钉死（tests/agent-nudge.test.js）：三类实测原话命中 / 纯叙述闲聊不命中 / 丢弃回复不推流 / 追问文案进第二轮 messages / JSON action 豁免 / 纠偏后仍闲聊则接受（恰好两次请求）',
        ],
      },
      {
        title: '自检体系更新（4.10.5）',
        items: [
          'utils/ai/eval/runner.js：EVAL_PROTOCOL_VERSION 4 → 5，口径标签加「短指令纠偏轮」',
          'pages/settings/sub/ai-eval.vue：startEval 前检测缺前置账单 → uni.showModal 一键补建（executeTool 真实写入 ¥42「自检前置」，用户确认后才写，可随时删除）→ 重取数据前置后开跑',
          'docs/AI效果自检基线.md：登记 4.10.4 的 26/29 实测行与 4.10.5 修复行',
        ],
      },
    ],
  },
  {
    version: '4.10.4',
    date: '2026-10-03',
    title: '4.10.4 外观选择改自定义底部弹层：原生 ActionSheet 不随主题变色，重做为带图标的三选弹层',
    summary: [
      '用户实测：点「外观」弹出的系统 ActionSheet 是原生控件，深色模式下弹框仍是白底，且无配套图标 —— 原生控件样式不可控，重做为自定义底部弹层（与全项目「面板一律底部弹出」规矩一致）',
      'pages/settings/index.vue：uni.showActionSheet 替换为 .theme-sheet 自定义弹层（蒙层 rgba(0,0,0,0.4) + 底部滑出动画 + 三行选项），每行 = SijiIcon 图标 + 名称 + 说明 + 激活对勾；样式带 html.theme-dark 深色块（弹层 #27272A / 文字 #FAFAFA）',
      '新增「跟随系统」图标 monitor：components/common/SijiIcon.vue 的 KNOWN 集合登记 + scripts/gen-monitor-icon.cjs 一次性生成 monitor-v2.png / monitor-v2-dark.png（96×96 RGBA，Lucide monitor 几何：rect(2,3→22,17, rx2) + 底座线，×4 缩放描边 8px）',
      '排坑记录：首版 PNG 三个 chunk 的 CRC 全是同一个常量 0x492f023f —— 根因不是环境改写文件，是生成脚本 crc32 手抄漏了「最低位为 1 才异或」分支（无条件异或是收缩映射，任何输入 32 轮后收敛到同一不动点）；补上 (c & 1) 分支后 CRC 校验通过',
      '浏览器实测：深色弹层 #27272A / 浅色弹层 #FFFFFF，monitor/sun/moon/check 浅深两版 8 张图全部加载成功，激活行对勾随选择切换；测试 89 文件 / 1239 用例全绿',
    ],
    categories: [
      {
        title: '外观弹层重做（4.10.4）',
        items: [
          'pages/settings/index.vue：themeOptions 数据驱动三选（system=monitor / light=sun / dark=moon），pickTheme 打开弹层、chooseTheme 写入并关闭；点击蒙层关闭',
          '样式浅深两套：浅色弹层 #FFFFFF + 边框 #E4E4E7 + 文字 #18181B；深色 html.theme-dark 弹层 #27272A + 文字 #FAFAFA；激活行对勾（check 图标）标当前模式',
          'components/common/SijiIcon.vue：KNOWN 集合新增 monitor（渲染为 /static/icons/monitor-v2.png 与 -v2-dark.png，浅深自动切换）',
          'scripts/gen-monitor-icon.cjs：一次性生成脚本入库（Canvas 原语手绘 PNG，与 gen-icons.cjs 同一套），crc32 为标准算法（含 LSB 分支）',
        ],
      },
      {
        title: '排坑记录（4.10.4）',
        items: [
          'PNG CRC 常量化之谜：仓库内外写读对照、同进程 write→read 复查均正常，最终定位到脚本自身算法缺陷 —— crc32 迭代漏写 (c & 1) 判断；教训：手写二进制编码先跑标准向量（IEND CRC 恒为 0xae426082）',
          'uni-app 的 <image> 在 H5 编译为 uni-image 自定义元素（内层 div 背景 + img），调试加载状态要查内层 img.complete / naturalWidth，不能直接读外层 src',
        ],
      },
    ],
  },
  {
    version: '4.10.3',
    date: '2026-10-03',
    title: '4.10.3 修浅色下点 tab 变深（P0）：manifest 的 darkmode 框架跟随与手动切换体系打架，app-plus/h5 摘除 darkmode + App.vue 补浅色 tabbar 镜像',
    summary: [
      '用户实测浅色下点 tabbar 变深色：浏览器取证 —— tabbar 元素带内联深色背景，且每次切页被重新写入；来源是 manifest 的 darkmode: true（app-plus/h5），框架跟随系统主题自动应用 theme.json 深色值，与 4.8.0 的手动类驱动切换体系互相打架',
      '修复：app-plus / h5 摘除 darkmode（保留 mp-weixin —— 小程序本来就设计为系统跟随），框架不再抢写；主题唯一事实源 = 4.8.0 的类驱动手动切换',
      'App.vue 补浅色 tabbar 镜像（html:not(.theme-dark) .uni-tabbar 系列 !important 规则）：框架或任何来源写下的深色内联在浅色侧都压不过镜像，双向兜底',
      '浏览器实测：浅色下 functions/chat/settings 往返四跳 tabbar 恒为 #F4F4F5 浅底；深色切换（4.10.1/4.10.2 修复）不受影响',
      '注意：manifest 变更需重启 dev server / 重新编译才完整生效（HMR 只覆盖样式部分）；测试 89 文件 / 1239 用例全绿',
    ],
    categories: [
      {
        title: '架构冲突修正（4.10.3）',
        items: [
          'manifest.json：app-plus 与 h5 摘除 "darkmode": true（保留 mp-weixin 与 themeLocation）—— 框架 darkmode 会按系统主题自动应用 theme.json 深色 tabbar（内联样式），绕过并对抗 4.8.0 建立的手动类驱动切换；H5/App 的主题唯一事实源 = html.theme-dark 类',
          'App.vue：新增浅色 tabbar 镜像规则（html:not(.theme-dark) .uni-tabbar / __label / active label，全部 !important）—— 与深色规则对称，框架内联、uni.setTabBarStyle 残留等任何来源在浅色下都无法翻盘',
        ],
      },
      {
        title: '验证记录（4.10.3）',
        items: [
          '浅色：functions/chat/settings 往返四跳 tabbar 恒 #F4F4F5、内联干净（chat 页 uni 会写回浅色内联值，无害）',
          '深色：4.10.1/4.10.2 修复不变（对话页 #27272A 底 + tabbar 深底深图标）',
          '全量 NODE_OPTIONS=--max-old-space-size=4096 + vitest run --maxWorkers=2：89 文件 / 1239 用例全绿',
        ],
      },
    ],
  },
  {
    version: '4.10.2',
    date: '2026-10-03',
    title: '4.10.2 修深色切换两处残留：tabBar 内联样式卡死（uni.setTabBarStyle 在 H5 是静默 no-op）+ 功能页滑块激活文字与白滑块同色',
    summary: [
      'tabBar 切换不跟色：实测 uni.setTabBarStyle 在 H5 是静默 no-op（success 回调照走、元素纹丝不动），它历史写下的内联深色背景永远压住 CSS，切回浅色也不清除 —— applyClass 挂类后直接清掉 tabbar 内联 background-color/backdrop-filter，深色由 !important 规则接管、浅色回框架默认',
      '功能页滑块：深色下滑块为白底（#FAFAFA）而激活文字同为 #FAFAFA ——「AI 面板」白字压白滑块看不见，激活文字改 #18181B（两个深色块同修）',
      '浏览器实测双向闭环：深→浅（tabbar 回浅底、图标回浅色变体）→ 深（tabbar 深底、图标深色变体）全通过；测试 89 文件 / 1239 用例全绿',
    ],
    categories: [
      {
        title: 'tabBar 内联样式卡死（4.10.2）',
        items: [
          'utils/theme.js：applyClass（H5 分支）挂类后清掉 .uni-tabbar 的内联 background-color / backdrop-filter —— uni.setTabBarStyle 在 H5 实测不写任何样式（参数隔离实验：连 backgroundColor:#FF0000 单独调用都无效），内联残留只能 DOM 清理',
          '参数隔离实验记录：完整 light 参数与单参数调用后元素 style 均无变化 → 该 API 在 H5 无法用于主题切换，颜色职责完全归 CSS（App.vue !important 深色规则 + 框架默认浅色）',
        ],
      },
      {
        title: '功能页滑块文字（4.10.2）',
        items: [
          'pages/functions/functions.scss：两个深色块的 .seg-item.active .seg-text 从 #FAFAFA 改 #18181B —— 深色下滑块是白底，激活文字必须深色；非激活文字 #A1A1AA 不变',
        ],
      },
    ],
  },
  {
    version: '4.10.1',
    date: '2026-10-02',
    title: '4.10.1 修深色模式全页面失效（P0）：4.8.4 的 :global(html.theme-dark){嵌套} 写法被编译器剥掉子选择器，85 文件 96 处改回 html 元素前缀直写',
    summary: [
      '用户实测深色模式下切到对话页整页不可见（白底白字）—— 浏览器实测取证：编译产物里所有 :global(html.theme-dark) 块的嵌套子选择器被剥掉，塌缩成裸 html.theme-dark{...} 只作用于 html 自身，目标元素完全没有深色规则',
      '探针实证三种形态：html 元素前缀直写（html.theme-dark { 嵌套 }）在 uni scoped 管线下编译完全正确（scoper 对 html 开头的选择器不注入 data-v）；整选择器 :global 包裹也可用；唯独 4.8.4 的 :global 包嵌套子选择器形态整块失效',
      '85 文件 96 处 :global(html.theme-dark) 全部改回 html.theme-dark 直写（保留 SCSS 嵌套），浏览器复测：对话页背景 #27272A、文字 #F4F4F5、无 JS 报错',
      'theme-mode 守卫测试改写为实证正确的不变量：禁止 :global(html.theme-dark)，要求 html.theme-dark 块与 media 块一比一配对（4.8.4 的守卫把错误写法锁成了规矩）',
      '测试 89 文件 / 1239 用例全绿',
    ],
    categories: [
      {
        title: '深色失效根因与修复（P0）',
        items: [
          '根因链：scoped 组件里裸 .theme-dark 类选择器会被 scoper 注入 data-v（.theme-dark[data-v-x]，挂在 html 永远命不中）→ 4.8.4 用 :global(html.theme-dark){嵌套子选择器} 整体替换 → uni 的 scoped 编译器对这种形态剥掉全部嵌套子选择器，96 处深色块全部塌缩成裸 html.theme-dark{}（只改 html 自身样式）→ 深色模式下所有组件保持白底，而全局深色规则把文字改成浅色 → 白底白字整页不可见',
          '修复：85 文件（pages/components/App.vue）的 :global(html.theme-dark) 全部替换为 html.theme-dark 元素前缀直写 —— 探针实证 html 开头的选择器 scoper 不注入 data-v，SCSS 嵌套正常编译',
          '实证探针记录：flat html.theme-dark .x ✓ / :global(整选择器) ✓ / html.theme-dark{嵌套} ✓ / :global(html.theme-dark){嵌套} ✗（子选择器被剥）',
        ],
      },
      {
        title: '守卫测试改写（4.10.1）',
        items: [
          'tests/theme-mode.test.js：双路径守卫的不变量从「:global(html.theme-dark) 一比一配对」改为「html.theme-dark { 一比一配对 + 禁止 :global(html.theme-dark) + 禁止裸 .theme-dark」—— 守卫注释写明三种形态的实证结论，防止再次回退',
          '保留：media 块必须在 #ifdef MP-WEIXIN 内、条件编译栈深度校验、App.vue 直写单独断言',
        ],
      },
    ],
  },
  {
    version: '4.10.0',
    date: '2026-10-02',
    title: '4.10.0 AI 能力拆分：11 项能力按组开关（设置 → AI 配置 → AI 能力），关掉即从工具/提示词/UI 三处消失',
    summary: [
      'AI 能力注册表：新增 utils/ai/features.js 单一事实源 —— 11 项可选能力按 5 组管理（信息获取/上下文感知/主动关怀/记录通道/输入方式），状态存 siji_ai_features 随备份走',
      '设置页新增「AI 能力」分组卡：每行能力名 + 一句话说明 + 开关，联网搜索/读网址与原有配置卡共用同一开关，图片识别开关控制输入区按钮显隐',
      '注入五处收口：工具注入按能力过滤（原 web_search 专用过滤泛化成 TOOL_FEATURE_MAP）、执行器拦截幻觉调用（提示到设置开启）、动静摘要/能量感知段、extSection 人脉/演练段、进入消息的下一步与周播报',
      '旧开关无缝迁移：siji_memory_enabled 首次读取迁移进注册表并写穿回旧键（记忆提取侧 isMemoryEnabled 无缝跟随），联网/读网址开关直接转发既有配置',
      '默认全开 —— 升级用户零感知；关掉的能力同时省 token（agent 工具 38→按需）与心智；安全底座（确认闸门/操作白名单/撤销/记忆治理）不可关',
      '测试 89 文件 / 1239 用例全绿（新增 ai-features 10 例：注册表/迁移/写穿/delegate 转发/执行器拦截/extSection 门控）',
    ],
    categories: [
      {
        title: '能力注册表（4.10.0）',
        items: [
          'utils/ai/features.js（新增）：AI_FEATURES 11 项清单 + FEATURE_GROUPS 5 组 + TOOL_FEATURE_MAP（工具名→能力 id，注入过滤与执行拦截共用）+ isFeatureOn/setFeatureOn/isFeatureActive（开关 + Key 资源可用性双裁决）',
          '存储键 siji_ai_features；已登记进备份 AI_KEYS（export.js），随「AI 与记忆」分域导出',
          'delegate 模式：联网搜索/读网址的开关与 Key 裁决由 search-config/read-config 承担，注册表只转发 —— 不复制状态，两处开关永不打架',
          'legacy 模式：长期记忆开关写穿旧键 siji_memory_enabled（memory/store.js 的 isMemoryEnabled 管提取侧），读取侧兼容旧值',
        ],
      },
      {
        title: '注入收口（4.10.0）',
        items: [
          'utils/ai/agent-transport.js：buildToolList 过滤从 web_search 专用改为 TOOL_FEATURE_MAP 通查（微光/人脉/联网/读网址按开关出列）',
          'utils/ai/tools/executor.js：executeTool 对已关能力直接拒绝（「功能已在设置中关闭」，不含确认卡），模型幻觉调用不再落库',
          'utils/ai/chat-helpers.js：动静摘要段、能量感知段按开关注入（能量关闭按中等档处理，不降载不抑制点破）',
          'utils/ai/prompt-builder.js：checkExtensionData 的 hasRelations/hasSimulations 叠加能力开关（数据存在且开关打开才注入完整 extSection）',
          'composables/useEnterSummary.js：next_step / week_bill 开关短路（关闭时进入消息不再出现下一步行与账单行）',
          'components/chat/InputArea.vue：图片识别按钮按 vision 开关显隐（监听 ai-features-changed 即时刷新）',
          'utils/memory/context.js：buildMemoryContext 改查注册表（兼容旧键），注入与提取随同一开关',
        ],
      },
      {
        title: '设置页（4.10.0）',
        items: [
          'pages/settings/sub/ai.vue：新增「AI 能力」五组分组卡（置于联网搜索卡上方），开关切换即时生效并失效提示词缓存（invalidatePromptCache）；联网搜索/读网址行的开关与原配置卡双向同步',
          'pages/settings/sub/ai.scss：feature-card 浅色 + 双深色块（:global 类驱动与媒体查询）样式',
        ],
      },
      {
        title: '测试与工程（4.10.0）',
        items: [
          'tests/ai-features.test.js（新增 10 例）：清单完整性与分组、持久化、未知 id 安全、旧键迁移与写穿、delegate 转发、isFeatureActive 双裁决、执行器拦截（关=拒绝无确认卡，开=走正常确认流）、extSection 门控（关=不注入 update_relation）、TOOL_FEATURE_MAP 与清单一致性',
          '边界明确：确认闸门 / 操作白名单 / 撤销 / 记忆治理 / 对话核心 CRUD 不可关（安全与数据完整性底座）',
          '全量 NODE_OPTIONS=--max-old-space-size=4096 + vitest run --maxWorkers=2：89 文件 / 1239 用例全绿',
        ],
      },
    ],
  },
]
