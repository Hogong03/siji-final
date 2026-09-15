/**
 * 版本日志数据段：3.5.11 - 3.5.4（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V35 = [
  {
    version: '3.5.21',
    date: '2026-09-15',
    title: '3.5.21 进入总结带一串预置按钮 + 回去接着聊时销毁这条伪对话',
    summary: [
      '总结这条对话自带按钮，不用自己想说什么：有进展给「查看详情 / 看计划」，有记录给「看新记录」，有账单播报给「看账单」，写着低落给「聊聊现在的状态」，另外固定给「记一笔 / 写个记录 / 定个计划」，最后是「返回旧对话」',
      '按钮分两种行为：navigate 直接跳页（查看详情 / 看计划 / 看新记录 / 看账单），prefill 只把话术填进输入框（记一笔 / 写个记录 / 定个计划），填完还能自己改，不会替你发出去',
      '点「回去接着聊」时销毁这条伪对话：只带总结或欢迎语、没真聊过的对话直接删掉，不在会话列表里留一条只有开场白的壳；真聊过的对话照旧保留，只切过去',
      '工程：utils/enter-dialogue.js 新增 buildEnterButtons（纯函数，按摘要内容生成按钮）；composables/useChatSession.js 的 resumeBack 先删空壳再切会话；pages/chat/index.vue 的 .enter-actions 改 v-for 渲染，旧的「查看详情」单独判断逻辑删除',
      '测试：tests/enter-dialogue.test.js 增 6 例（上下文按钮 / 通用按钮 / 去重 / 纯数据可落盘），tests/chat-session.test.js 增 4 例（销毁总结壳 / 销毁欢迎语壳 / 真聊过不销毁 / 没有目标不切），全量 61 文件 / 825 用例全绿'
    ],
    categories: [
      {
        title: '总结消息的预置按钮（3.5.21）',
        items: [
          'utils/enter-dialogue.js：新增 buildEnterButtons(summary)，返回 [{ key, label, action, value }]，action 为 navigate（value 是路由）或 prefill（value 是预置话术）；按钮顺序即渲染顺序',
          '上下文按钮按摘要内容给：eventsTotal > 0 → 查看详情（跳打卡记录，复用 enterSummaryRoute）+ 看计划；diaryCount > 0 → 看新记录；weekBill.text 有值 → 看账单；moodDip → 聊聊现在的状态（prefill）',
          '通用按钮固定三个：记一笔（prefill 记一笔 ）/ 写个记录（prefill 写个记录：）/ 定个计划（prefill 帮我定个计划）；「返回旧对话」不进这个列表 —— 它要 resumeTarget，只有页面知道指向哪条，仍由页面追加为 primary 按钮',
          'buildEnterSummaryMessage 把按钮挂到消息的 _enterButtons 字段（纯数据，可 JSON 序列化，跟着会话一起落盘）；老消息没有该字段时 v-for 渲染为空，只剩「返回旧对话」，不会渲染出错',
          'pages/chat/index.vue：.enter-actions 由两条写死的按钮改成 v-for="btn in (msg._enterButtons || [])"，新增 handleEnterButton(btn) 分发 —— navigate 先 dismissEnterSummary() 推进确认基线再 uni.navigateTo，prefill 走 handleWelcomeChip 填输入框（复用欢迎语快捷示例那套）；样式沿用 .enter-btn，父容器 flex-wrap 自动换行'
        ]
      },
      {
        title: '回去接着聊销毁伪对话（3.5.21）',
        items: [
          'composables/useChatSession.js：resumeBack() 在 switchConversation 之前，先判断当前对话（且不是目标那条）是否 isEmptyConversation —— 是就 store.deleteConversation(current.id)，直接销毁',
          '判定口径复用 3.5.19 的空会话定义（没有消息 / 只有欢迎语 / 只有进入总结消息），所以「只有总结」「只有欢迎语」两种壳都会被销毁；带用户消息或 AI 回复的对话一律保留',
          'store.deleteConversation 已在仓库内存在（从数组里移除、必要时改活跃 id、落盘），本次未改 store；删除后紧接着 switchConversation 把活跃会话指回目标，不存在悬空 id'
        ]
      }
    ]
  },
  {
    version: '3.5.20',
    date: '2026-09-15',
    title: '3.5.20 进入总结直接覆盖开场白（不再叠在欢迎语下面）',
    summary: [
      '进入总结直接顶掉开场白：新对话里已经写下的欢迎语会被总结覆盖，不再出现「先打招呼、再汇报进展」两条开场白 —— 此前总结是追加在欢迎语下面',
      '只覆盖开场白，不动真实对话：已经聊过的会话照旧把总结追加到末尾；欢迎语本来就是占位，这跟首次发消息时自动清除欢迎语是同一个处置',
      '两条来路都覆盖：冷启动 appReady 之后的宽窗口结算，与回前台算出的增量，都走 appendEnterSummary，落消息前先清欢迎语',
      '工程：store/chat.js 新增 dropWelcomeMessages()（只清 _isWelcome / 返回清掉条数 / 失效会话预览缓存并落盘），composables/useChatSession.js 接线；tests/chat-session.test.js 增 3 例，全量 61 文件 / 815 用例全绿'
    ],
    categories: [
      {
        title: '进入总结覆盖开场白（3.5.20）',
        items: [
          'store/chat.js：新增 dropWelcomeMessages() —— 过滤掉当前会话里的 _isWelcome 消息，返回清掉的条数；有变化才写，同时清 _slimCache 并 doPersist()；没有欢迎语返回 0，可重复调用（幂等）',
          'composables/useChatSession.js：appendEnterSummary 在 addMessage 之前调用 store.dropWelcomeMessages()，欢迎语与总结不会同时存在',
          '为什么必须覆盖：欢迎语由 pages/chat/index.vue 的 onMounted 与 composables/useConversationManager.js 的新建/切换对话写入，而进入总结可能晚一步到（回前台增量、appReady 之后的冷启动结算），追加就会出现两条开场白',
          '测试：tests/chat-session.test.js 增 3 例 —— 欢迎语已在场上时总结顶掉它而不是叠在下面 / 覆盖开场白不动真实对话 / dropWelcomeMessages 只清欢迎语并返回条数',
          '未改动：composables/useChatEngine.js 首次发消息清欢迎语的既有逻辑保持原样（同样语义，两处互不影响）'
        ]
      }
    ]
  },
  {
    version: '3.5.19',
    date: '2026-09-15',
    title: '3.5.19 进入总结改成伪对话（总结落进新对话 + 一键返回旧对话）',
    summary: [
      '进应用先看到的不再是顶部卡片：进入总结（新进展 / 离开这阵子的动静）改成 AI 的一条对话消息，直接落在新对话里 —— 能顺着它接着聊，消息下方挂「查看详情 / 返回旧对话」两个按钮，看总结和回旧对话在同一处完成',
      '同一条总结只写一遍：按「来源 + 离开时长 + 计划事件数 + 记录数 + 连续天数」算签名去重，回前台重复算出同一批进展不再刷屏；正在输出回复时先排队，等这一轮结束再落消息，不打断流式',
      '大段摘要按条念：最多念 3 条计划事件（其余归入「还有 N 项进展」），正文改用 Markdown 列表渲染，不再糊成一坨；开场白带时段问候，「刚刚」不写进文案',
      '空态入口让位：总结消息自带「返回旧对话」，此时不再叠一张「这是新对话」入口卡（两个入口不打架）；只带总结消息、没真聊过的对话算空壳，下次冷启动清掉，不在会话列表堆壳',
      '工程：新增 utils/enter-dialogue.js（纯函数、不 import uni）与 tests/enter-dialogue.test.js（18 例）；chat.scss 删除全部 .summary-* / .kind-* 卡片样式，换成 .enter-btn；全量 61 文件 / 812 用例全绿'
    ],
    categories: [
      {
        title: '进入总结伪对话（3.5.19）',
        items: [
          'utils/enter-dialogue.js（新增 130 行，纯函数、不 import uni）：ENTER_SUMMARY_FLAG(_isEnterSummary) 与 ENTER_LINE_LIMIT(3)；enterSummaryRoute —— 有进展去 /pages/plan/records，否则去 /pages/diary/list',
          'buildEnterOpener 开场白：时段问候（夜深了 / 早上好 / 中午好 / 下午好 / 晚上好）+ 按 source 区分「距上次小结 N」（冷启动）与「你离开的这 N」（回前台）；离开时长格式化成「刚刚」时不写进文案（时长与时间格式化见 utils/enter-summary.js 的 formatAwaySpan / formatSummaryTime）',
          'buildEnterLines 正文行：计划事件「打卡 计划「X」 今天 09:12：备注」（最多 3 条，kind=done 念「完成」）+「还有 N 项进展」+「新增记录 N 条」+「已连续打卡 N 天」（≥2 天才念）+ 账单播报 + 低落提示',
          'buildEnterSummaryMessage 组装 { role: assistant, content, _isEnterSummary, _enterSummaryKind(cold|away), _enterSummaryDigest }，无内容返回 null；正文用 markdown 列表语法「- 」—— 用裸字符「·」只会在同一段里换行、长摘要糊成一坨（本轮踩过的坑）',
          'enterSummarySignature + shouldAppendEnterSummary 去重与放行：签名 = 来源 | 离开时长 | 事件数 | 记录数 | 连续天数，相同即同一批进展不重复写；空内容直接拒绝；isEnterSummaryMessage(msg) 供渲染判定'
        ]
      },
      {
        title: '会话与页面接线（3.5.19）',
        items: [
          'utils/chat-session.js：isEmptyConversation 把 _isWelcome 与 _isEnterSummary 都算空壳（只带总结的对话下次冷启动被 pruneEmptyConversations 清掉，不在列表堆壳）；新增 hasEnterSummaryMessage(conv)；shouldOfferResume 增加 opts.hideWhenEnterSummary（默认开），当前对话已有总结时空态入口卡让位',
          'composables/useChatSession.js：新增 appendEnterSummary(summary)（无内容返回 false）；maybeStartFreshSession 增加 opts.enterSummary —— 有待展示的总结就把它当开场白写出去，没有才回落欢迎语',
          'pages/chat/index.vue：删除顶部 .summary-card 整块模板与 8 个 enterSummary* computed 及旧 openEnterSummaryDetail()；新增 injectEnterSummary（走 shouldAppendEnterSummary）/ flushEnterSummary（流式中排队、isSending 结束即落）/ summaryReturnVisible（仅「刚进来还没说过话」才给返回入口）/ openEnterSummaryDetail(msg) 按 digest.route 跳转',
          '消息模板在 MessageBubble 之后加 .enter-actions 操作行：「查看详情」按 digest 有无内容显示，「返回旧对话 · 对话标题」按 summaryReturnVisible 显示；总结消息 :operable 置 false，不给重新生成 / 换说法',
          'pages/chat/chat.scss：删掉全部 .summary-* / .kind-* 浅色与深色样式，换成 .enter-actions / .enter-btn / .enter-btn-text / .enter-btn-primary（含 @media (prefers-color-scheme: dark) 覆盖），纯黑白灰阶、零阴影零渐变、无 var(--xxx)',
          '测试：tests/enter-dialogue.test.js（新增 18 例）覆盖正文行 / 行数上限 / 备注拼接 / 四个时段开场白 / 冷启动与回前台文案 / 消息组装与 digest 路由 / 签名去重 / 空输入；tests/chat-session.test.js 补两段（空会话判定与入口让位、开场白换成总结），38 例'
        ]
      }
    ]
  },
  {
    version: '3.5.18',
    date: '2026-09-15',
    title: '3.5.18 记忆检索加语义扩展（换种说法也能召回）+ 联网搜索与聊天厂商解耦',
    summary: [
      '换个说法也召得回来：记忆检索加同义分组与拼音桥接 —— 用户说「对象」、记忆里写「女朋友」以前拿 0 分，现在能命中；「jihua / jh」这类拼音输入同样桥接到「计划」',
      '联网搜索不再看聊天厂商脸色：搜索后端独立配置（智谱 Web Search / Tavily），聊天换 DeepSeek / 通义 / Kimi 都能联网；此前非智谱厂商下 web_search 工具被整条过滤掉',
      '智谱用户零配置：搜索 Key 留空时自动复用同名 AI 厂商 Key，原行为不变；关掉总开关就一条都不搜，传 Key 也绕不过开关',
      '设置新增入口：设置 → AI 配置 → 联网搜索（开关 / 后端选择 / 独立 Key 输入与清除 / 状态行）',
      '工程：新增 utils/memory-synonyms.js、utils/ai/search-adapters.js、utils/ai/search-config.js 与 2 个测试文件；全量 60 文件 / 784 用例全绿'
    ],
    categories: [
      {
        title: '记忆语义扩展（3.5.18）',
        items: [
          'utils/memory-synonyms.js（新增 225 行，纯函数、不碰 uni）：SYNONYM_GROUPS 收录 34 组口语变体（对象 / 女友 / 媳妇 / 老婆 / 伴侣 互认，焦虑 / 内耗 / 担心 互认等），DOMAIN_LEXICON 收录 47 个高频域内词的拼音（全拼 + 首字母）',
          '权重设计：字面命中 1.0、全拼 0.75、首字母 0.65、同义扩展 0.6、拼音再取同义 0.45；单组扩展上限 8 词，防超大组把分数摊平',
          'utils/memory-rank.js：新增 export buildQueryTerms —— 扩展出的整词必须再切一次二元组才能进入检索空间（扩展词直接参与匹配时召回恒为 0，这是本次关键坑），并跳过扩展词的末位单字噪声（伴侣 → 侣、妻子 → 子）',
          'rankMemories / selectMemories 增加 opts.includeSynonyms（默认开），传 false 退回纯字面匹配，便于 A/B 与回归对照',
          '明确边界：拼音桥接只覆盖词表内约 50 词（不是全量拼音库），同义表是人工维护的口语表；不做指代消解与向量检索',
          '测试：tests/memory-semantic.test.js（新增 25 例）覆盖同义扩展、拼音桥接、权重取高、噪声过滤、语义召回回归（说对象召回女朋友）、对照组（关扩展则 0 分）、端到端注入 buildMemoryContext'
        ]
      },
      {
        title: '联网搜索解耦（3.5.18）',
        items: [
          'utils/ai/search-adapters.js（新增 126 行）：SEARCH_BACKENDS 后端注册表，每个后端只提供元信息 + buildRequest(query, key) + parseResponse(res)，新增后端零改动其余代码；内置 zhipu（search_pro，线上原实现不变）与 tavily（按官方文档实现，解析有单测覆盖，线上待真机跑一次）',
          'utils/ai/search-config.js（新增 120 行）：开关（siji_web_search_enabled，缺省视为开启）、后端（siji_web_search_backend）、独立 Key（siji_web_search_key，enc2 加密）三件套；resolveSearchConfig 裁决 available / reason(ok|disabled|no_key) / source(own|provider|none)',
          'Key 回落链：独立 Key → 同名 AI 厂商 Key（智谱用户零配置）→ 无。切到没有同名厂商的后端（Tavily）时不会误用 AI Key',
          'utils/ai/tools/web-search.js：删除 isWebSearchEnabled(providerId) 厂商硬门控，改用 search-config 裁决；executeWebSearch 不再接收 apiKey 参数，改为内部解析；关闭状态下即使传入 Key 也拒绝执行',
          'utils/ai/agent-transport.js：buildToolList 的 web_search 过滤条件由 isWebSearchEnabled(provider.id) 改为 isWebSearchAvailable()，工具注入与聊天厂商彻底无关',
          'utils/ai/agent-loop.js：web_search 分支改调 executeWebSearch(query)；utils/api.js 增加 search-adapters / search-config 门面导出',
          'pages/settings/sub/ai.vue + ai.scss：新增「联网搜索」卡片（开关 / 后端单选 / Key 输入保存清除 / 状态行「已配置（独立 Key）| 已配置（复用 AI 厂商 Key）| 未配置 Key，无法联网 | 已关闭」），样式复用 config-section / key-input-row，纯黑白灰阶、零阴影零渐变',
          '测试：tests/web-search-config.test.js（新增 23 例）覆盖请求体结构（智谱 Bearer / Tavily body）、响应解析（含空结果与 HTTP 错误）、Key 加密落盘、厂商复用、开关优先级、后端切换、执行路径（成功 / 失败 / 空关键词 / 70 字截断）'
        ]
      },
      {
        title: '测试与文档（3.5.18）',
        items: [
          'tests/agent-engine-smoke.test.js：联网搜索用例从「仅智谱启用」改为「配置驱动」；tests/ai-module-imports.test.js 的 WATCHED / FILES 纳入 search-config、search-adapters、web-search、memory-synonyms，补上 resolveSearchConfig / getSearchBackend / expandTerms / buildQueryTerms 的静态 import 断言',
          '全量测试：60 文件 / 784 用例，全绿（较 3.5.17 的 58 文件 / 731 用例净增 2 文件 53 例）',
          'pages/settings/sub/ai.scss 用 sass 单独编译通过（含新增 .search-card 全部分块）'
        ]
      }
    ]
  },
  {
    version: '3.5.17',
    date: '2026-09-15',
    title: '3.5.17 对话尺：消息够 20 条时聊天区左侧出现竖向刻度，点一下直达那一段对话',
    summary: [
      '够长才出现：会话消息数达到 20 条时，聊天区左侧冒出一条竖向刻度尺；短对话不显示、不占宽、不挤压输入区',
      '刻度锚点取用户消息：每个刻度对应一处提问位置（用户消息不足 6 条时退化为全部消息）；刻度超过 28 个自动降采样且首尾必留，长对话不会糊成一条',
      '点、拖都能跳：轻点刻度直达那条消息，按住上下滑连续跳（120ms 节流）；跳转前先把虚拟窗口扩到目标位置（上方保留 5 条上下文），再交给 scroll-into-view 精确定位',
      '两个辅助视图：刻度右侧滑出 18 字预览（图片消息显示「[图片]」）；刻度尺上的视口指示条按真实滚动比例移动，并高亮当前所在的一段',
      '工程：新增 utils/chat-ruler.js（纯计算）+ composables/useChatRuler.js（滚动与触摸编排）+ tests/chat-ruler.test.js（31 例）；全量 58 文件 / 731 用例全绿'
    ],
    categories: [
      {
        title: '对话尺（3.5.17）',
        items: [
          'utils/chat-ruler.js（新增 139 行，纯函数、不碰 DOM 与 store）：shouldShowRuler（阈值 RULER_MIN_MESSAGES = 20）/ summarizeMessage（压平空白 + 18 字截断 + 图片占位）/ buildRulerTicks（锚点判定、降采样、百分比）/ viewportRange / pickTickByPercent / pickTickByScroll / percentFromY / resolveWindowSize（跳转窗口条数，上方保留 RULER_KEEP_ABOVE = 5）',
          '百分比统一保留两位小数，避免 App 端 style 绑定里出现长浮点串；viewportRange 对首帧 scrollHeight 为 0 和视口高于内容两种情况都给安全值，视口条不会跳到尺外',
          'composables/useChatRuler.js（新增 210 行）：rulerVisible / rulerTicks / rulerActiveKey / rulerDragging / rulerViewportStyle / rulerPreview / rulerPreviewStyle / syncRulerScroll / jumpToTick / resetRuler / handleRulerTouchStart / Move / End / handleRulerTap',
          '跳转链路：resolveWindowSize 先扩 visibleCount → nextTick → applyScrollIntoView（msg-N 锚点）；扩窗后 90ms 再补一次跳转，兜住 App 端布局比 H5 慢一帧的情况',
          '双通道输入：H5 鼠标走 @tap（只认带 clientY 的事件，避免 App 端 tap 与 touch 重复触发两次跳转）；App 触摸走 touchstart / move / end / cancel，位移超过 8px 才算拖动（否则按轻点处理），拖动期间按 120ms 节流',
          '刻度尺尺寸用 uni.createSelectorQuery 量 #chat-scroll 与 #chat-ruler-track（150ms 防抖）；量不到时退回 0-100 全跨度，视口条不会卡死',
          'pages/chat/index.vue：messages-wrap 包住 scroll-view 并按 rulerVisible 加 has-ruler（列表左内边距 +44rpx 让开刻度）；每条消息外包 #msg-<globalIndex> 锚点视图；handleNewConversation / handleSwitchConversation 首行 resetRuler()，换会话不残留上一条对话的高亮与预览',
          'pages/chat/chat.scss：轨道贴左 4rpx、宽 40rpx，刻度弹条 20rpx（用户消息 #A1A1AA、当前段 28rpx×6rpx 纯黑），视口指示 4rpx 灰条（#D4D4D8、深色 #3F3F46），预览卡 340rpx 位于刻度右侧；纯黑白灰阶、零阴影零渐变、色值硬编码不依赖 CSS 变量，深色覆盖齐全'
        ]
      },
      {
        title: '测试（3.5.17）',
        items: [
          'tests/chat-ruler.test.js（新增 31 例）：显示阈值边界（19 / 20 / 非法输入）、预览文案（压平空白 / 截断 / 图片占位 / 空消息）、刻度生成（用户锚点、退化全部消息、降采样首尾必留、28 上限、百分比精度）、viewportRange 边界、最近刻度挑选、触摸坐标换算、resolveWindowSize 扩窗与保留上下文、useChatRuler 滚动同步与三种触摸手势',
          '全量：58 文件 / 731 用例，全绿（exit 0；3.5.16 基线 57 / 700）',
          'H5 已验收（iPhone 390×844 视口、61 条消息）：渲染 28 个刻度，点轨道 4% / 50% / 97% 分别滚到 198 / 2623 / 5096，msg-28 精确对齐视口顶部，视口指示条随滚动同步；App 端 scroll-into-view 与 touchmove 待 HBuilderX 真机确认',
          'AGENTS.md / CODEX_HANDOFF.md：测试数字、版本行、关键文件速查同步到本轮'
        ]
      }
    ]
  },
  {
    version: '3.5.16',
    date: '2026-09-15',
    title: '3.5.16 每次进来都是新对话：空对话上给「回去接着聊 / 选择历史对话」两个入口',
    summary: [
      '冷启动停在一条新对话上：以前启动会把上次聊到一半的会话直接铺开，容易被旧话题带着走；现在每次启动都是新对话，欢迎语待发，旧对话原样留在列表里（不删、不挪、不改）',
      '回前台、切 Tab、从设置页回来都不换会话：只有本次进程第一次进入对话页才换新（模块内标志只 true 一次），正在打字时切回来不会被清空',
      '新对话空态两个入口：「回去接着聊」一键回到最近一条有内容的对话（标题 + 今天 10:20 / 昨天 / 3 天前 + 条数），「选择历史对话」打开会话面板（搜索 / 标签 / 分组都还在）；卡片可关，换会话后重新给一次',
      '不留空壳：冷启动换新前顺手清掉历史空会话（没有消息或只有欢迎语的），列表不会被每次启动堆出来的空对话塞满',
      '工程：新增 utils/chat-session.js（纯判定）+ composables/useChatSession.js（编排）+ tests/chat-session.test.js（28 例）；全量 57 文件 / 700 用例全绿'
    ],
    categories: [
      {
        title: '冷启动新对话（3.5.16）',
        items: [
          'utils/chat-session.js（新增 101 行）：isEmptyConversation / pickResumeConversation / shouldOfferResume / formatConversationAge / consumeColdStart（进程内只 true 一次）/ resetColdStart（测试用）；不碰存储、不 import store',
          '空会话口径：没有 messages，或消息全是欢迎语（_isWelcome）；带 summary 的会话不算空（消息可能被裁剪过，不能当壳删掉）',
          'composables/useChatSession.js（新增 76 行）：maybeStartFreshSession 编排（清空壳 → 当前会话有内容才新开 → 补欢迎语）+ resume 状态（目标 / 可见 / 时间 / 条数 / 关闭 / 回去）',
          'pages/chat/index.vue：onMounted 首行调 maybeStartFreshSession（模拟演练待进入、模拟深链场景跳过不换）；onLoad 记 _deepLinkSim；既有「activeConversation 不存在就新建」「空会话补欢迎语」两条兜底保留',
          'store/chat.js：新增 pruneEmptyConversations(keepId) —— 清理空壳，活跃指针被清掉时落到最后一条并同步 persistActiveId；keepId 无条件保留；store/index.js 透传',
          '行为边界：冷启动标志只生效一次，回前台 / 切 Tab / 从别的页面回来都不换会话，不会打断正在进行的输入'
        ]
      },
      {
        title: '新对话空态入口（3.5.16）',
        items: [
          'pages/chat/index.vue + pages/chat/chat.scss：新对话卡片「这是新对话」+ 最近一条对话（标题 / 时间 / 条数）+「回去接着聊 / 选择历史对话」两个按钮 + 关闭按钮；纯黑白灰阶、零阴影，深色覆盖齐全（.resume-* 一组）',
          'utils/chat-session.js：时间说法「刚刚 / N 分钟前 / 今天 HH:MM / 昨天 HH:MM / N 天前 / M月D日」；设备时钟回拨按「刚刚」，非法输入给空串',
          '入口只在「当前会话为空 + 有其他有内容的对话」时出现；关掉后本次会话不再出现，切到别的会话再回来会重新给一次',
          '回到上次：直接 switchConversation（读同一份会话数据，消息、Agent 绑定、标签都不变），切完滚到底部'
        ]
      },
      {
        title: '测试（3.5.16）',
        items: [
          'tests/chat-session.test.js（新增 28 例）：空会话判定 5 例、候选挑选 5 例（排除当前 / 跳过空壳 / 取最近 / 回落 createdAt / 无候选）、入口显示条件 4 例（含 activeId 指向不存在会话时照样给入口）、时间说法 4 例、冷启动标志只真一次、pruneEmptyConversations 3 例、useChatSession 编排 7 例（含「回前台只换一次」与「模拟演练不换会话」）',
          '全量：57 文件 / 700 用例，全绿（exit 0；3.5.15 基线 56 / 672）',
          'AGENTS.md / CODEX_HANDOFF.md：测试数字、版本行、关键文件速查同步到本轮'
        ]
      }
    ]
  },
  {
    version: '3.5.15',
    date: '2026-09-14',
    title: '3.5.15 修白屏：记忆模块拆分漏导出 currentMonth，并补一条静态检查拦住同类错误',
    summary: [
      '修白屏：3.5.14 拆分长期记忆时漏了 utils/memory/monthly.js 的 currentMonth 导出，HBuilder X 的 dev server（原生 ESM）直接抛 does not provide an export named currentMonth，对话页起不来（import 阶段就抛）；已补导出，链路恢复',
      '为什么测试没拦住：vitest 走 esbuild 互操作，缺的具名导出会静默变成 undefined —— 拆 memory 时 STORAGE_KEY / persist 也是同一个坑（当时把记忆写进了名为 undefined 的存储键）；只有 HBuilder X 的原生 ESM 才会当场报错，所以这类错必须静态查',
      '新增 tests/module-exports.test.js：静态解析 utils / composables / store / pages / components 下 318 个源文件的 import，逐个核对目标模块确实导出该名字（写了 export * 的模块跳过，不误报优先）；已用「临时去掉 export」的方式验证它会失败',
      '全量 56 文件 / 672 用例全绿（3.5.14 基线 55 / 670）'
    ],
    categories: [
      {
        title: '修复（3.5.15）',
        items: [
          'utils/memory/monthly.js：currentMonth 补上 export —— utils/memory/auto-extract.js 的 aiSummarizeConversation 用它给月度记忆卡归月，缺导出时 HBuilder X dev 直接白屏（import 阶段就抛）',
          '影响面：H5 开发端（dev server）必现；App / 小程序端打包同样会在编译期报同类错误；修复后对话页与记忆提取链路恢复'
        ]
      },
      {
        title: '防回归（3.5.15）',
        items: [
          'tests/module-exports.test.js（新增 2 例）：扫描 318 个 .js/.vue（.vue 只取 script 块），按「具名 import 的名字必须在目标模块被导出」逐条核对；@/ 与 ./ ../ 三种写法都解析，目录 spec 回落 index.js',
          '判断口径：export function/const/let/var/class、export { a as b }、export { x } from …；目标模块含 export * 时整块跳过（静态无法枚举，宁可漏报不误报）',
          '验证方式：临时把 monthly.js 的 currentMonth 去掉 export，该用例失败并指名 \'utils/memory/auto-extract.js -> ./monthly.js :: currentMonth\'，恢复导出后通过',
          '全量：56 文件 / 672 用例，全绿（exit 0）'
        ]
      },
      {
        title: '文档（3.5.15）',
        items: [
          'AGENTS.md 注意事项新增：vitest 抓不到「import 了不存在的导出」（esbuild 互操作下变 undefined），改动模块导出后必须跑 tests/module-exports.test.js；这条同样解释了为什么 HBuilder X 里才会白屏',
          'AGENTS.md / CODEX_HANDOFF.md：测试数字与版本行同步到 56 文件 / 672 用例、v3.5.15'
        ]
      }
    ]
  },
  {
    version: '3.5.14',
    date: '2026-09-14',
    title: '3.5.14 三条只读能力：每周账单播报、社交额度、回复草稿，顺带把 692 行的记忆模块拆成八块',
    summary: [
      '每周账单播报：进入总结卡多一行「账」——本周花了多少、主要花在哪、比上周多还是少，每周只报一次（按本周周一记 key）；上周没有记录就直说，不设预算警告、不做评价（铁律 1：不制造新的失败感）',
      '社交额度（能量预算）：关系页可以自己定「每周几次社交」，顶部一行「本周社交 2/3 · 还能放 1 次」；计数口径是同一天同一个人算一次，排满只说「剩下的下周再说也行」，没设定就不显示',
      '回复草稿：人物详情页新增「回一条」——三条「可以延后，但不会消失」的草稿，点一下复制；也可以复制提示词并跳到对话让思迹起草（新增 prefill-input 通道，文案直接落进输入框）',
      '工程：utils/memory.js 692 行拆成 utils/memory/ 八块 + 60 行门面（旧引用一字不改，27 个旧导出逐个钉住，memory 系列 74 用例全绿）；全量 55 文件 / 670 用例全绿',
      '待拆登记：useChatEngine.js（518 行，handleSend 主体约 390 行）与 pages/chat/index.vue（636 行）、PlanChildPlans.vue（591 行）、memory.vue（549 行）留到下一轮，UI 拆分必须把 scoped 样式一起搬并真机验收'
    ],
    categories: [
      {
        title: '每周账单播报（3.5.14）',
        items: [
          'utils/bill-weekly.js（新增 151 行）：formatMoney / weekKeyOf / sumExpenseIn / buildWeeklyBill / formatWeeklyBillLine / readBillsForWeeks / shouldAnnounceWeeklyBill / markWeeklyBillAnnounced / buildWeeklyBillAnnouncement',
          'utils/bill-weekly.js：区间左闭右开；type 兼容「expense」与 0，收入（income / 1）不计；没有 bill_date 时用 created_at 兜底，两者都非法才跳过；按分类累计并取金额最大的分类作为「主要花在哪」',
          'utils/bill-weekly.js：上周为 0 时 diffPct 返回 null（文案「上周没有支出记录」，不算百分比）；持平日 diffPct 为 0（文案「和上周差不多」）',
          'utils/bill-weekly.js：readBillsForWeeks 用 monthsBetween(上周起点, 现在) 拼齐跨月分片 —— 本周周一落在上个月时也要读到上周所在分片（例：9-02 的本周起点是 8-31，需同时读 bill_2026-08 与 bill_2026-09）',
          'utils/bill-weekly.js：播报 key 为 siji_bill_weekly_at，存「本周周一日期」，生成即标记（由 useEnterSummary 写），跨周自动恢复；本周没有支出时返回 null 且不消耗额度',
          'composables/useEnterSummary.js：结算里调 buildWeeklyBillAnnouncement({ now })，结果挂 weekBill；只有账单播报也算有内容（会出卡），空内容判定加 !weekBill',
          'pages/chat/index.vue + pages/chat/chat.scss：总结卡新增「账」行（enterSummaryBill）与 .kind-bill 样式（浅色 #FEF3C7 / #92400E，深色 rgba(245,158,11,0.18) / #FCD34D）',
          'tests/bill-weekly.test.js（新增 25 例）：区间边界、type 兼容、created_at 兜底、分类累计、非数组与非法日期、周对比（null / 0 / 正负）、无支出返回空串、每周一次与跨周恢复、跨月分片合并并排除已删除'
        ]
      },
      {
        title: '社交能量预算与回复草稿（3.5.14）',
        items: [
          'utils/social-quota.js（新增 127 行）：getWeeklyQuota / setWeeklyQuota（0-30 取整，0 或非法值 = 关闭显示）、countSocialTouches、formatSocialQuotaLine、buildSocialQuota、buildReplyDrafts、buildReplyPrompt',
          'utils/social-quota.js：计数口径「同一天 + 同一个人只算一次社交」，按 relation_id / relation_name 加日期去重；date 缺失回落 created_at；已删除不计；额度由用户自己设，系统不发额度、不催不评',
          'utils/social-quota.js：三条草稿分别是「先接住 / 约个时间 / 一句话结」，语气约定写着「不写检讨、不拉长、不承诺立刻回」，单条 ≤ 60 字；buildReplyPrompt 把对象、场景与语气要求一次性写清（可直接粘给 AI）',
          'utils/relations.js：新增 getAllInteractions()（未删除、按时间倒序），供周额度统计等只读场景使用；原 getRecentInteractions 不动',
          'components/common/SocialQuotaBar.vue（新增 191 行）：关系页顶部一行额度 + 设定弹窗（数字输入，0 = 不显示）；未设置时显示「要不要给社交定个每周次数？」；深色覆盖齐全，零阴影零渐变',
          'components/relation/ReplyDrafts.vue（新增 167 行）：人物详情页「回一条」——三条草稿点一下复制，另有「让思迹起草」（复制提示词 + 跳对话）',
          'pages/chat/index.vue：新增 prefill-input 通道（缓冲区 + onShow 落到输入框），关系页起草的提示词一跳进来就在输入框里；onHide 清缓冲、onUnmounted 解绑',
          'tests/social-quota.test.js（新增 20 例）：额度钳制、同日同人去重、区间左闭右开、已删除排除、created_at 兜底、文案三态（未设置 / 有余量 / 排满）、草稿语气红线（不含「你应该 / 必须 / 尽快」等）、与 logInteraction 的联通'
        ]
      },
      {
        title: '记忆模块拆分（3.5.14）',
        items: [
          'utils/memory.js：692 行 → 60 行门面，只做转出，全部旧引用（composables / store / pages / tests 共 8 处）一字不改',
          'utils/memory/store.js（136 行）：CRUD + 记忆开关 + 过期清理，导出 STORAGE_KEY 与 persist 供治理模块复用',
          'utils/memory/normalize.js（22 行）：normalizeMemoryText（去空白标点、全半角统一、小写、去「我今天 / 我想 / 打算」前缀），去重与治理共用一套口径',
          'utils/memory/governance.js（156 行）：重复组发现、已整合超期隐藏候选、other 归类建议、applyGovernance、restoreHiddenMemory',
          'utils/memory/context.js（75 行）：buildMemoryContext —— 相关度选池（上限 30 条）→ 过滤已在画像中的偏好 → 按分类分组，另附月度卡与结构化记忆',
          'utils/memory/profile-values.js（34 行）：画像字段值提取（含噪声词表），context 与 monthly 共用',
          'utils/memory/profile-link.js（134 行）：记忆采纳进画像（单条 / 批量 / AI 写画像后回标记）',
          'utils/memory/monthly.js（70 行）：月度记忆卡（siji_monthly_memory，最多 12 个月 × 20 条）',
          'utils/memory/auto-extract.js（114 行）：对话后的本地规则提取 + 可选 AI 摘要',
          'tests/memory-facade.test.js（新增 4 例）：27 个旧导出逐个核对、模块间私有依赖（persist / STORAGE_KEY）不外露、八个分模块可单独导入、归一化口径与治理共用同一实现'
        ]
      },
      {
        title: '测试与工程（3.5.14）',
        items: [
          '全量：55 文件 / 670 用例，全绿（exit 0；3.5.13 基线 52 / 621）',
          '新增 tests/bill-weekly.test.js（25 例）、tests/social-quota.test.js（20 例）、tests/memory-facade.test.js（4 例）；拆分后 memory-governance / memory-profile / memory-rank / memory-structured / ai-module-imports 共 70 例逐项复跑通过',
          'AGENTS.md：测试数字、版本行、关键文件速查（每周账单播报 / 社交额度与草稿 / 长期记忆）同步；注意事项新增「记忆模块拆分后改哪一块」与「关系页额度条组件自带样式」',
          'CODEX_HANDOFF.md：目录结构与待办清单同步；待拆文件登记更新为 useChatEngine.js（518）/ pages/chat/index.vue（636）/ PlanChildPlans.vue（591）/ pages/settings/sub/memory.vue（549），并写明 useChatEngine 的拆法（handleSend 主体 ~390 行抽到 utils/ai/send-pipeline.js）'
        ]
      }
    ]
  },
  {
    version: '3.5.13',
    date: '2026-09-14',
    title: '3.5.13 持续性收口：AI 也知道「你不在时」发生了什么，对话后给一个可点的下一步',
    summary: [
      '动静摘要进 AI 上下文：发消息前把「上次离开以来的完成/打卡 + 今天累计 + 连续打卡天数」压成 2-3 行注入 system，AI 能自然续上你的进展（不再每次都说「我看看记录」）；只含已发生的事，未完成事项永不出现',
      '最小行动单卡：一次对话后，如果这轮没有待确认操作、没有轻追问 chips，就在输入框上方给一张「今天可以从这件开始」单卡（取今日行动条里最小的一件，约 X 分钟），点进计划详情；每天最多一次、随时可关、不追问',
      '修掉跨会话重复报：以前不点「知道了」直接退出应用，下次冷启动会把同一批进展再报一遍（窗口只认确认基线）；现在窗口取「确认基线与离开基线里更晚的那个」，卡片一展示就推进离开基线，冷启动与回前台口径完全一致',
      '连续两天低落只提醒休息：最近两个相邻记录日的情绪都是低落时，总结卡多一行「这两天记录里写着低落，今天慢一点也算数」——不诊断、不评分、不催进度',
      '工程：修掉每个周一必失败的 plan-checkin 用例，全量 52 文件 / 621 用例全绿（首次 0 失败）；新增 progress-digest / next-step 两个纯逻辑模块与对应测试',
    ],
    categories: [
      {
        title: 'AI 动静摘要（3.5.13）',
        items: [
          'utils/enter-summary.js：导出 CONFIRM_KEY / LEAVE_KEY（卡片与 AI 摘要共用同一对基线，不再各写一份 key 字符串）；新增 countEventsByKind(plans, since, now) → { done, checkin }，与 buildEnterSummary 同一套过滤规则',
          'utils/progress-digest.js（新增 75 行）：buildProgressDigest({ plans, now }) 输出「· 上次离开（3 小时）：完成 1 项、打卡 2 次 / · 今天：… / · 连续打卡 N 天」，无内容返回空串不占 token；只读当前月记录分片，不落盘',
          'utils/ai/chat-helpers.js：buildChatMessages 在计划上下文之后注入动静摘要，附「只在你自然需要时引用，不要逐条复述，不要提未完成的事」约束（铁律 8）',
          'tests/progress-digest.test.js（新增 7 例）：空内容不注入 / 计数与窗口时长 / 更晚基线优先（已报过不重复）/ 窗口外与已删除不计 / 未武装只报今天 / 记录计数与连续天数 / 默认 getPlanList',
        ]
      },
      {
        title: '最小行动单卡（3.5.13）',
        items: [
          'utils/next-step.js（新增 59 行）：pickNextStep（复用 collectDailySuggestions，与计划页今日行动条同一口径）/ shouldOfferNextStep / markNextStepShown，siji_next_step_shown 记「今天已给过」',
          'composables/useChatEngine.js：新增 nextStep 状态与 offerNextStep()（待确认操作、轻追问 chips、模拟演练、今天已给过、无候选都不出卡）与 clearNextStep()；发送开始时收起旧卡，回复成功且无待确认时触发',
          'pages/chat/index.vue + pages/chat/chat.scss：输入框上方单卡（标签 + 标题 + 约 X 分钟 + 关闭），点击跳 /pages/plan/detail?clientId=…；纯黑白灰阶、零阴影、带深色覆盖',
          'tests/next-step.test.js（新增 5 例）：最小叶子、跨主计划取更小、全完成/冷藏/删除返回 null、默认走 getPlanList、每天一次与跨天恢复',
        ]
      },
      {
        title: '口径统一与休息提示（3.5.13）',
        items: [
          'composables/useEnterSummary.js：initEnterSummary 窗口起点改为 max(确认基线, 离开基线)（此前只看确认基线，不点「知道了」直接杀进程会把同一批进展再报一遍）；本次冷启动若 onShow 已出卡则不覆盖；卡片展示即推进离开基线',
          'utils/enter-summary.js：新增 scanMoodDip({ since, now, diaryReader }) —— 最近两个相邻记录日都含低落关键词才成立，同一天多条要全部低落，窗口外/已删除/无情绪字段不计',
          'composables/useEnterSummary.js：结算结果附 moodDip，只有休息提示也算有内容（会出卡）',
          'pages/chat/index.vue + chat.scss：总结卡新增「休息」行与 .kind-mood 中性灰样式（含深色），不催不评',
          'tests/enter-summary.test.js 增 scanMoodDip 5 例；tests/enter-summary-refresh.test.js 增 3 例（展示推进离开基线 / onShow→appReady 不覆盖已挂起卡片 / 进程重启不重复报）+ 1 例 moodDip 接线',
        ]
      },
      {
        title: '测试与工程（3.5.13）',
        items: [
          'tests/plan-checkin.test.js：weekly 回执用例改走「今天打卡」——补记在周一没有「本周历史日」可补，导致每个周一必失败；补记链路仍由 daily 用例覆盖',
          '全量：52 文件 / 621 用例，全绿（首次 0 失败）',
          'CODEX_HANDOFF 待办清单：勾掉已完成的「拆分 reminder.js」（现 65 行 + utils/reminder/ 目录）',
          '待拆文件登记（含约束）：pages/chat/index.vue 616 行 —— 抽卡片组件必须把 chat.scss 里的 .summary-*/.next-step-* 一起搬进新组件的 scoped 样式（父页 scoped 样式不会作用于子组件内部元素），需真机验收',
        ]
      }
    ]
  },
  {
    version: '3.5.12',
    date: '2026-09-14',
    title: '3.5.12 持续性总结：回前台算「你不在时」的增量进展，与冷启动卡片共用一条确认基线',
    summary: [
      '持续性落地（方案 B：时间线增量）：以前只在冷启动算一次总结，切后台再回来什么都不提；现在 App.vue onHide 记下离开时刻、onShow 结算「离开 → 现在」的增量 —— 计划完成、打卡、新增记录都按这段时间报，回来就看到刚才发生了什么',
      '只报增量、不重复报：新增离开基线 siji_enter_summary_leave_at（onHide 写），确认基线 siji_enter_summary_at 仍在点「知道了/查看详情」时推进；进程被杀没写离开基线就回落确认基线，同一段进展不会重复弹',
      '不刷屏：60s 节流 + 已有未读卡片时不重算（被节流跳过时不推进窗口，那段进展下次补上）；后台不轮询、不设定时器，只在切回前台时算一次，不拿电量换「持续性」',
      '卡片文案区分来源：冷启动保持「回来啦 · 新进展小结」，回前台换「欢迎回来 · 这段时间的进展」并标出离开时长（刚刚/分钟/小时/天）；不催不罚，不写「你已 N 天没打卡」',
      '新增 tests/enter-summary-refresh.test.js（8 例，假定时器驱动）与 resolveSummaryWindow/formatAwaySpan 单测（9 例）：窗口裁决、节流、未读卡片保护、时钟回拨容错全覆盖',
    ],
    categories: [
      {
        title: '进入总结 · 前台恢复增量（3.5.12）',
        items: [
          'utils/enter-summary.js：新增 SUMMARY_QUIET_MS(60s) 与 resolveSummaryWindow({ confirmBaseline, leaveBaseline, now, lastCalcAt, hasPending, quietMs })，返回 skip + reason(ready|pending|unarmed|throttled|skew) + since + awayMs；离开基线晚于确认基线时优先用它（增量小），否则回落确认基线（进程被杀场景）',
          'utils/enter-summary.js：节流判定为 last > 0 && now > last && now - last < quietMs —— lastCalcAt 落在未来（设备时钟回拨）时不节流，避免卡死不再结算',
          'utils/enter-summary.js：新增 formatAwaySpan(ms) —— 刚刚 / N 分钟 / N 小时 / N 天，非法输入返回空串',
          'composables/useEnterSummary.js：新增 markLeaveBaseline()（onHide 写 siji_enter_summary_leave_at）与 refreshEnterSummary()（onShow 结算增量，无内容推进确认基线）；initEnterSummary 保留冷启动语义并记录 lastCalcAt 参与节流；dismissEnterSummary 同时推进两条基线',
          'App.vue：onShow 中 checkAllReminders 之后调 refreshEnterSummary（try/catch 兜底）；onHide 中先 markLeaveBaseline 再 flushPersist',
          'pages/chat/index.vue：卡片标题改走 enterSummaryHead（冷启动/前台两套文案），新增 enterSummarySpan 副标题（离开 X 小时 / 距上次小结 X 天）；pages/chat/chat.scss 新增 .summary-head-meta（含深色覆盖）',
        ]
      },
      {
        title: '测试与验收（3.5.12）',
        items: [
          'tests/enter-summary.test.js：新增 resolveSummaryWindow 8 例（离开基线优先、回落确认基线、未读卡片、60s 节流、时钟回拨不节流、自定义间隔、未武装、基线超前）+ formatAwaySpan 1 例',
          'tests/enter-summary-refresh.test.js（新增 8 例）：冷启动静默武装 / 算出窗口事件并标记 cold / 空窗口推进基线；回前台取离开基线只报新事件、已有未读卡片不重算、60s 节流不推进窗口且下次补算、空窗口推进确认基线、进程被杀回落确认基线',
          '全量：50 文件 / 600 用例，599 通过（唯一失败是 plan-checkin 周一日期相关历史用例，非本次回归）',
        ]
      }
    ]
  },
  {
    version: '3.5.11',
    date: '2026-09-14',
    title: '3.5.11 Agent 三处硬化：入口门控反转 + 记忆相关度检索 + 工具失败自纠，并修掉 App 端 Agent 崩溃',
    summary: [
      '入口门控反转：只有「明显闲聊」（≤14 字、无数字、无数据域词、无疑问句式）才走单轮流式快通道，其余全部进工具循环 —— 修掉「说『记录』AI 却不执行」这类漏执行（旧白名单正则不命中就永远调不到工具）',
      '长期记忆注入从「最近 30 条」改为按当前消息相关度检索（BM25 简化 + 45 天半衰期，事实/偏好加权），无命中回落最近 30 条：用久了早期关键事实不再被新条目挤出上下文',
      '工具参数解析失败不再静默用 {} 执行：把「参数不是合法 JSON」回传模型让它重发；本轮写入失败时追加 [系统] 纠正指令，禁止把失败文本当结论回复用户',
      '修掉 App 端 Agent 崩溃：agent-loop 里 chatRequestChunkedStream 从未 import，真机走到最终轮流式必抛 ReferenceError（H5 因条件编译被剥离，只在 App 暴露）',
      '文件瘦身：agent-loop 544 → 283 行，新增 agent-transport / call-utils / chat-sse / chat-simulated 四个模块，全部回到 300 行红线内；删除死常量 MAX_QUERY_RESULTS',
    ],
    categories: [
      {
        title: 'Agent 循环 3.5.11',
        items: [
          'utils/ai/chat-stream.js：门控反转 —— 新增 isClearlyCasual()（≤14 字 + 无数字 + 无数据域词 + 无疑问句式才判闲聊）并导出 CASUAL_MAX_LEN；删除 looksDataQuery / isCommandMessage 白名单正则',
          'utils/ai/agent-loop.js：工具参数解析改走 parseToolArgs，失败回传错误文本并记 ok:false（不再用空对象调用工具）；本轮写入失败时追加 [系统] 本轮写入未成功… 的 user 消息（用 TOOL_LABELS 中文标签），要求模型修正参数重试',
          'utils/ai/tools/call-utils.js（新增 53 行）：TOOL_RESULT_TRUNCATE_MAP / getTruncateLimit / parseToolArgs / argErrorResult 从 agent-loop 下沉，经 tools.js 门面导出',
          'utils/ai/agent-transport.js（新增 260 行）：callWithTools / callWithRetry / callWithToolsStream / callWithToolsSSE / buildToolList 拆出，并补上缺失的 chatRequestChunkedStream import（App 端 ReferenceError 修复）',
          'utils/ai/chat-sse.js（新增 181 行）：H5 真实 SSE 流式拆出；utils/ai/chat-simulated.js（新增 56 行）：降级模拟逐字拆出（单独 import chat-request，不引入循环依赖）',
          'utils/ai/prompt-actions.js：AGENT_TOOL_INSTRUCTION 移入（agent-loop 原样 re-export 兼容旧引用），并新增「多步任务先在心里列步骤」「工具返回失败必须换参数或先 query_* 定位后重试一次」两条',
        ],
      },
      {
        title: '记忆检索 3.5.11',
        items: [
          'utils/memory-rank.js（新增 121 行）：分词（CJK 二元组 + ASCII 单词）、BM25 简化打分（k1=1.2 + IDF）、分类权重（事实/偏好 1.25、事件 1.1、对话摘要 0.85）、45 天半衰期时间衰减',
          'utils/memory.js：buildMemoryContext(query) 支持传当前消息，改用 selectMemories() 选池（上限仍 30 条），保留「已采纳 / 与画像重复」过滤不变',
          'utils/ai/chat-helpers.js：buildChatMessages 把 userMessage 传给 buildMemoryContext，记忆注入随当前消息走',
        ],
      },
      {
        title: '安全与测试 3.5.11',
        items: [
          'utils/ai/tools/index.js：delete_feedback 登记进 CONFIRM_TOOLS —— 开了「AI 自动执行写操作」也必须在确认卡上点确认才能删',
          'tests/memory-rank.test.js（新增 10 条）：分词 / 排序 / 无命中回落 / 分类权重 / buildMemoryContext 接入',
          'tests/agent-gate.test.js（新增 22 条）：9 例明显闲聊走快通道、「记录 / 记账 / 和某人吃饭」等 10 例必须进工具循环、超长消息必进循环',
          'tests/agent-arg-recovery.test.js（新增 8 条）：parseToolArgs 边界、失败原因回传后模型重发、写入失败自检注入 [系统] 指令',
          'tests/ai-module-imports.test.js（新增 12 条）：静态校验 AI 核心模块「用到但没 import」——本次重构已靠它抓出 chat-sse.js 漏 import chatRequestNonStream',
          'tests/agent-tools.test.js 与 tests/action-schema-consistency.test.js：CONFIRM_TOOLS 断言从「空集」更新为「只登记真实存在的删除类工具」',
        ],
      },
    ],
  },
  {
    version: '3.5.10',
    date: '2026-09-13',
    title: '3.5.10 介绍网站新增 44 秒介绍片：滚到就静音播，滚走就暂停',
    summary: [
      '介绍网站新增「介绍片」区块（#demo）与导航入口，首屏主按钮改为直达：「看 44 秒介绍片」',
      '成片 1920×1080 / 30fps / 44.0 秒 / 无音轨 / 1.10 MB，全程纯黑白 Zinc，零渐变零阴影，与 App 同一套设计语言',
      '滚动进入视口（可见过半）自动静音播放，滚出立即暂停；系统开启「减弱动态效果」时完全不自动播，交还手动控制',
      '封面帧先出图、视频只预加载元数据，播放走原生 video 标签，不引入任何播放器库',
      '介绍片与站点同在 site/ 目录，与 HBuilder X 打包的 App 产物互不影响，App 包体内不含视频',
    ],
    categories: [
      {
        title: '介绍片 3.5.10',
        items: [
          'site/assets/siji-intro.mp4（新增 1,153,386 字节）：h264 / yuv420p / 1920×1080 / 30fps / 1320 帧 / 44.000 秒，无音轨',
          'site/assets/siji-intro-poster.jpg（新增 93,385 字节）：成片封面帧，由 video 的 poster 属性直接引用',
          'site/index.html：导航新增「介绍片」链接，首屏主按钮跳转 #demo，在「设计原则」前插入 #demo 区块（video + 降级链接 + 说明文字），首屏与页脚版本号同步 3.5.10',
          'site/styles.css（新增 5 条规则）：.demo / .demo__video（宽度 100%、16:9、纯黑底、1px 边框、卡片圆角）/ .demo__cap',
          'site/main.js（新增）：IntersectionObserver 阈值 0.55，进入视口 play()、离开视口 pause()，play() 返回的 Promise 异常静默吞掉，浏览器拦截自动播放时不报错',
          'site/video/render.mjs + site/video/encode.mjs（新增）：CDP 逐帧截屏 + ffmpeg libx264 编码的两段式管线，--out 指定输出，随时可增量重渲染',
        ],
      },
      {
        title: '文案与合规 3.5.10',
        items: [
          '介绍片文案只讲可验证的产品行为：说话点确认才落库、不打卡不连击不评分、静止是合法状态',
          '画面与文案均不含健康隐私描述，页脚「不做医疗诊断」的免责声明保持原样',
          '画面素材全部自绘，无第三方图片与字体，字体走系统默认栈',
        ],
      },
    ],
  },
  {
    version: '3.5.9',
    date: '2026-09-13',
    title: '3.5.9 新增思迹介绍网站：site/ 纯静态四件套，零依赖双击即开',
    summary: [
      '新增 site/ 介绍网站（index.html + styles.css + main.js + assets/app-icon.png），纯静态零依赖零构建，双击 site/index.html 即可打开，也能原样丢给任意静态托管',
      '视觉沿用 App 的整套设计语言：Zinc 灰阶与纯黑白、零渐变零阴影，prefers-color-scheme 自动深色，prefers-reduced-motion 关掉动画，960px / 640px 两级断点',
      '首屏对话演示按「用户说话 → AI 落库 → 给出下一步 → 加入计划」逐条播放，播完停顿再重放，切到后台暂停，进入视口才启动',
      '文案全部取自仓库真实内容（PRODUCT_VISION 的设计原则与「只做两件事」，版本日志里的 3.5.6 / 3.5.4 / 3.5.0 条目），不编造功能；页脚保留不做医疗诊断的免责声明',
      '窄屏 390px 实测：导航不再隐藏，改为可横向滑动的链接条；补全 og:title / og:image / twitter:card / theme-color 分享信息',
    ],
    categories: [
      {
        title: '介绍网站 3.5.9',
        items: [
          'site/index.html（新增 236 行）：hero / 设计原则 / 能做什么（六卡）/ AI 的角色 / 隐私 / 最近更新六个区块，含顶部导航与页脚',
          'site/styles.css（新增 193 行）：与 App 同套灰阶与圆角，深色模式走 prefers-color-scheme，640px 断点下导航可横滑、卡片单列',
          'site/main.js（新增 80 行）：导航滚动态、入场淡入、首屏对话演示循环播放，页面切后台暂停',
          'site/assets/app-icon.png（新增）：取自 unpackage 缓存里的 xxxhdpi 图标，同时作为 favicon 与导航 logo',
          '站点不在 pages.json 路由内，与 HBuilder X 打包互不影响；manifest 3.5.9 / 3509',
        ],
      },
    ],
  },
  {
    version: '3.5.8',
    date: '2026-09-13',
    title: '3.5.8 红线收尾：版本日志数据分段 + 计划详情测试拆成表单/动作两条线',
    summary: [
      '版本日志不再单文件堆 2065 行：utils/storage/version-data.js 收敛成 34 行聚合入口，61 条历史记录按大版本切成 utils/storage/version-log/ 下 10 个纯数据段，最长段 283 行',
      '新增版本记录的落点改为最新段 utils/storage/version-log/3.5.js 顶部，聚合入口与 getDefaultHistory() 调用签名不变（版本历史页与老用户增量合并零改动）',
      'tests/plan-detail-split.test.js（357 行）拆为表单线与动作线两个文件，共用装置抽到 tests/helpers/plan-detail.js，22 例用例一条不少',
      '顺手清掉测试里未使用的 getChildPlans import；全量 npx vitest run：45 文件 530 用例全绿（用例数与拆分前一致）'
    ],
    categories: [
      {
        title: '版本数据分段 3.5.8',
        items: [
          'utils/storage/version-data.js：2065 → 34 行，只剩分段 import 与 getDefaultHistory() 拼接',
          'utils/storage/version-log/（新增 10 个纯数据段）：3.5.js（3.5.7 - 3.5.4，168 行）/ 3.5-early.js / 3.4.js / 3.0-3.3.js / 2.3-late.js / 2.3-early.js / 2.2-late.js / 2.2-early.js / 2.0-2.1.js / 1.x.js',
          '搬运用脚本按行切片并逐段校验首尾括号，61 条记录原样保留（3.5.7 仍在最前，1.0.0 仍在最后）',
          'utils/storage/version-history.js：注释标注数据段位置，代码零改动'
        ]
      },
      {
        title: '测试拆分 3.5.8',
        items: [
          'tests/plan-detail-form.test.js（新增 135 行，9 例）：utils/plan-child 子计划落库 + usePlanForm 快照/换入/迁移/落库/冷藏',
          'tests/plan-detail-actions.test.js（新增 188 行，13 例）：usePlanChildActions 进度与侧写 + usePlanNextStep 下一步单卡',
          'tests/helpers/plan-detail.js（新增 69 行）：存储重置、uni mock 记录、makePlan/makeRecurChild、mountForm/mountChildren',
          '删掉原文件 tests/plan-detail-split.test.js（357 行）与其中未使用的 getChildPlans import',
          'manifest 3.5.8 / 3508'
        ]
      }
    ]
  },
  {
    version: '3.5.7',
    date: '2026-09-13',
    title: '3.5.7 计划详情拆分 + 补记回溯上限：detail.vue 940 行拆成 4 个组合式函数 + 3 个分块组件',
    summary: [
      '计划详情页拆到底：detail.vue 从 940 行降到 292 行，脚本只剩组合与生命周期；表单落库、打卡日历、子计划动作、下一步单卡各自独立成组合式函数（pages/plan/composables/usePlanForm.js + usePlanChildActions.js + usePlanNextStep.js）',
      '视图分块：行动区 / 字段区 / AI 区拆成 components/plan/PlanActionSection.vue + PlanFieldsSection.vue + PlanAiTools.vue，样式跟着组件走，公共分块样式抽到 plan-section.scss',
      '补记有上限了：MAX_BACKFILL_DAYS = 30，超过 30 天的历史日不再出现补记入口，热力图右下角小点也不再亮（utils/plan-recur.js isBackfillable）',
      '子计划落库与表单选项抽成纯函数：utils/plan-child.js（buildChildPlanForm / saveChildPlans 递归写孙计划）、utils/plan-options.js（优先级 / 状态 / 循环 / 提醒 / 重复选项）',
      '新增 tests/plan-detail-split.test.js（22 例）钉住拆分后的行为；全量 npx vitest run：44 文件 530 用例全绿',
    ],
    categories: [
      {
        title: '拆分 3.5.7',
        items: [
          'pages/plan/detail.vue：940 到 292 行，只保留组合 + 生命周期（onLoad / onShow / onBackPress）+ 跳转',
          'pages/plan/composables/usePlanForm.js（新增）：表单状态、选项、退出快照、存量计划换入、旧数据迁移、整体落库、冷藏与删除',
          'pages/plan/composables/usePlanChildActions.js（新增）：子计划进度与自动收尾、列表刷新、任意时间 / 打卡 / 循环设置',
          'pages/plan/composables/usePlanNextStep.js（新增）：执行日志、下一步候选、一键完成（循环子计划走打卡不置完成）',
          'components/plan/PlanActionSection.vue / PlanFieldsSection.vue / PlanAiTools.vue（新增）+ 各自 scss：模板分块，props 与 emits 显式传递，不直接改父级对象',
          'components/plan/plan-section.scss（新增）：.section / .section-label 分块公共样式（含深色）',
          'utils/plan-child.js（新增）：buildChildPlanForm / saveChildPlans（递归写孙计划、落库前剔除 _subCount 展示字段）',
          'utils/plan-options.js（新增）：优先级 / 状态 / 循环 / 提醒 / 重复选项常量，页面与分块组件共用',
          'pages/plan/detail.scss：630 到 71 行，只剩页面骨架与底部操作栏',
        ]
      },
      {
        title: '补记上限与测试 3.5.7',
        items: [
          'utils/plan-recur.js：新增 MAX_BACKFILL_DAYS = 30，isBackfillable 增加回溯窗口判断，backfillCandidates 只吐窗口内的日子',
          'tests/plan-recur.test.js：新增回溯上限边界用例（第 30 天可补、第 31 天不给补）',
          'tests/plan-detail-split.test.js（新增 22 例）：子计划落库 / 快照忽略 _subCount / 存量换入 / 旧数据迁移 / 落库字段 / 循环收尾 / 冷藏 / 子计划动作 / 下一步单卡',
          'manifest 3.5.7 / 3507',
        ]
      }
    ]
  },
  {
    version: '3.5.6',
    date: '2026-09-11',
    title: '3.5.6 打卡缺口补齐：补记可撤销 + 连续按天/周分流 + 热度口径统一 + 日历可翻月',
    summary: [
      '补记可撤销：新增 removePlanCheckIn(clientId, date)，打卡明细长按某条、日历选中日点「撤销这天」都能撤掉那天的打卡，累计与连续一起回退，误触不再等于永久脏数据（utils/storage/plan.js + pages/plan/detail.vue）',
      '连续口径按循环类型分流：「每周 N 次」的任务改成连续达标周数（该周打卡天数 >= 每周目标），里程碑 2/4/8/12/26/52 周；每日任务仍是 3/7/14/30/60/100 天。上一版每周任务按天算连续，里程碑永远触发不了（utils/plan-recur.js weeklyStreakOf + utils/checkin-feedback.js）',
      '热度口径统一：新增 utils/plan-heatmap.js countsOf(plan) 作为唯一口径（打卡 + 完成日志），记录页热力图与详情页日历都从这里取数，同一个日子在两页不再出现两种深浅',
      '长按不再盲试：热力格右下角给「可补记」小点，未来日期置灰且不可点不可补，长按抬手后的那次 tap 被 400ms 抑制窗丢掉（上一版会把刚展开的当天明细又翻掉）；补记候选改带祖先路径（主计划 / 阶段 / 子计划），同名子计划分得清（components/plan/PlanHeatmap.vue + utils/plan-recur.js planPathLabel）',
      '详情页日历可翻月（不允许翻到未来），跨月回到 App 自动拨回当前月；记录页改成按「事件归属日」过滤与分组同一口径，跨周补记不再冒进本周列表；打卡后主动失效 AI 提示缓存'
    ],
    categories: [
      {
        title: '撤销与口径 3.5.6',
        items: [
          'utils/storage/plan.js：removePlanCheckIn（按天删除打卡，非法日期/没打卡过返回 null）+ utils/storage.js 导出',
          'utils/plan-heatmap.js：countsOf（单计划热度唯一口径）、collectDayCounts 改为逐计划相加、monthGrid 增加 isFuture',
          'utils/plan-recur.js：weeklyStreakOf（连续达标周数）、planPathLabel / planDepthOf（祖先路径与层级）、backfillCandidates 带 label 与稳定排序、streakMilestoneOf(after, before, kind)',
          'utils/checkin-feedback.js（新增）：streakOfPlanRecord / streakKindOf / checkinFeedback，按类型给「连续 N 天」或「连续 N 周达标」'
        ]
      },
      {
        title: '页面与组件 3.5.6',
        items: [
          'pages/plan/composables/usePlanCheckin.js（新增）：打卡统计、明细、补记、撤销、本月日历整套状态与动作，不依赖组件实例可直接跑测试',
          'pages/plan/detail.vue：改用 usePlanCheckin（-136 行），打卡明细长按撤销、日历选中日撤销、日历翻月；表头补 TODO 标注剩余待拆项',
          'components/plan/PlanHeatmap.vue：backfillMap 小点、未来日期置灰、长按后 400ms 抑制 tap、提示文案改为「长按带点的日子」',
          'pages/plan/records.vue：传 backfillMap、区间改按事件归属日过滤（跨周补记不串周）、候选清单用祖先路径、事件上限 500→2000（避免热力图有颜色点开却为空）',
          'pages/plan/index.vue：今日行动条打卡改用共享 checkinFeedback',
          '代码卫生：本轮触及的 6 个 .vue/.scss 行尾统一为 CRLF（补丁脚本曾写入 LF 造成混合），usePlanCheckin 去掉只写不读的 selfExecLogs（页面自有 planExecLogs 聚合自身与子计划日志），AGENTS.md 修正测试命令说明（必须带 --maxWorkers=2 跑）'
        ]
      },
      {
        title: '测试 3.5.6',
        items: [
          'tests/plan-checkin.test.js（新增 22 例）：removePlanCheckIn 边界、composable 返回值完备性、打卡/撤销/补记守卫、weekly 与 daily 里程碑文案、补记候选路径标签',
          'tests/plan-heatmap.test.js：countsOf 4 例 + monthGrid isFuture 1 例',
          '全量 npx vitest run：43 文件 507 用例全绿',
          'manifest 3.5.6 / 3506'
        ]
      }
    ]
  },
  {
    version: '3.5.5',
    date: '2026-09-10',
    title: '3.5.5 打卡复盘三件套：任意历史日补记 + 计划详情本月打卡日历 + 连续达标轻量肯定',
    summary: [
      '任意历史日补记：记录页热力月视图长按某天 → 列出这天可补的循环任务（在跑 + 落在有效窗口内 + 这天没打卡），选一个即补记那天；没有可补任务时只回一句「这天没有可补记的循环任务」（utils/plan-recur.js isBackfillable / backfillCandidates + pages/plan/records.vue onBackfillDay）',
      '计划详情新增「本月打卡」日历：扁平化复用热力月视图组件，只统计本计划自身的打卡与完成，点某天看当天次数与描述，长按某天可补记（pages/plan/detail.vue onCalBackfill + components/plan/PlanHeatmap.vue flat/hideNav + detail.scss）',
      '连续达标轻量肯定：打卡跨过 3/7/14/30/60/100 天时给一句「连续 N 天，稳」toast，不弹窗、无音效、不打断；未跨过时保持原来的「已打卡」（utils/plan-recur.js streakMilestoneOf + 详情页三条打卡路径与列表页今日行动条）',
      '补记按补记的那天归位：记录页明细与分组改为优先用 checkins.date，补记昨天不再挂到今天（pages/plan/records.vue eventDayKey）',
      '修复未接线的打卡入口：记录页 toggleDay/dayEvents/selectedDate 与详情页 submitBackfill 此前只有模板引用没有实现，点热力格或补记按钮会直接报错，本轮补齐；搜索结果页把 v-if 写在 v-for 的同一元素上，分组标题一渲染就报错，改成只遍历非空分组（pages/search/result.vue）'
    ],
    categories: [
      {
        title: '任意历史日补记 3.5.5',
        items: [
          'utils/plan-recur.js：isBackfillable（在跑循环 + 早于今天 + 落在自身与祖先窗口内 + 当天未打卡）、backfillCandidates（返回 client_id/title/recur_type，排除已删除，标题兜底「未命名计划」）、backfillTargetOf 改为复用 isBackfillable',
          'pages/plan/records.vue：onBackfillDay 长按热力格选任务、applyBackfill 落库并刷新、eventDayKey 让补记按补记日归位、selectedDate/dayEvents/selectedLabel/toggleDay 补齐',
          'pages/plan/detail.vue：onCalBackfill 长按日历某天（仅循环任务、窗口内且未打卡），确认后补记并回写打卡统计与补记入口',
          'components/plan/PlanHeatmap.vue：backfill-day 事件、长按提示行'
        ]
      },
      {
        title: '计划详情本月打卡日历 3.5.5',
        items: [
          'pages/plan/detail.vue：calCounts（自身打卡 + 完成日志）/calWeeks/calTotals/calDayText/toggleCalDay、showCalendar（循环任务或已有打卡才显示）',
          'components/plan/PlanHeatmap.vue：flat 属性（去卡片底、嵌进详情 section）、hideNav 时隐藏翻月与提示行',
          'pages/plan/detail.scss：cal-section / cal-day-text / cal-hint 样式（含深色）'
        ]
      },
      {
        title: '连续达标轻量肯定 3.5.5',
        items: [
          'utils/plan-recur.js：streakMilestoneOf（里程碑 3/7/14/30/60/100，只在本轮跨过时返回该天数，持平或下降返回 0）',
          'pages/plan/detail.vue：checkinFeedback 统一反馈、reloadCheckins 统一回写、streakOfPlan 取打卡前连续天数；覆盖 submitCheckIn / submitBackfill / checkinChild / completeNextStep',
          'pages/plan/index.vue：今日行动条 quickCheckIn 与 checkinWithNote 同步轻量肯定'
        ]
      },
      {
        title: '测试 3.5.5',
        items: [
          'tests/plan-recur.test.js：isBackfillable 6 例（今天/未来不给补、历史日可补、非循环/完成/冷藏/任意时间不给补、窗口外不给补、已打卡与非法日期不给补、祖先窗口收缩）+ backfillCandidates 3 例 + streakMilestoneOf 4 例',
          'tests/sfc-bindings.test.js：扫描 pages 与 components 全部 SFC，compileScript(inlineTemplate) 后凡是落成 _ctx.x 的标识符即报错，专门拦「模板引用了不存在的变量」这类点一下就崩的问题',
          '全量 npx vitest run：42 文件 480 用例全绿',
          'manifest 3.5.5 / 3505'
        ]
      }
    ]
  },
  {
    version: '3.5.4',
    date: '2026-09-10',
    title: '3.5.4 打卡回看与温和补记：热力格点开当天明细 + 总览本周打卡 + 补记昨天',
    summary: [
      '热力格点开当天：记录页点击某天热力格 → 下方展开该天明细（打卡/完成 + 时刻 + 描述，可点进计划详情），再点一次收起，换月自动清空选择（components/plan/PlanHeatmap.vue select-day + pages/plan/records.vue toggleDay）',
      '计划总览新增「本周打卡 N 次」：周一起算、只算 checkins（完成日志不计），主计划与子计划一起统计，超过一天时补「（N 天）」（utils/plan-heatmap.js weekCheckinSummary + pages/plan/composables/usePlanList.js stats）',
      '温和补记昨天：循环任务漏了昨天且昨天落在有效窗口内时，详情页打卡卡出现「补记 M-D（昨天漏了）」，点一次即落库并为昨天记一天，不追问、不连续催（utils/plan-recur.js backfillTargetOf + pages/plan/detail.vue submitBackfill）',
      '打卡接口支持指定日期：logPlanCheckIn(clientId, note, dateStr) 第三参数可传 YYYY-MM-DD，只接受今天与过去，非法或未来日期自动回落到今天，仍按天幂等',
      '口径与守卫：昨天已打卡、非循环任务、已完成、冷藏、窗口在昨天前结束或今天才开始的循环任务都不提供补记入口'
    ],
    categories: [
      {
        title: '打卡回看 3.5.4',
        items: [
          'components/plan/PlanHeatmap.vue：selectedDate 属性、select-day 事件、选中态描边与提示行',
          'pages/plan/records.vue：selectedDate 状态、dayEvents 明细、toggleDay 切换、翻月清空'
        ]
      },
      {
        title: '本周打卡与补记 3.5.4',
        items: [
          'utils/plan-heatmap.js：weekCheckinSummary（本周次数与天数）',
          'utils/plan-recur.js：backfillTargetOf（漏昨天才给补）',
          'utils/storage/plan.js：logPlanCheckIn 支持第三个参数 dateStr（过去日期补记，未来/非法回落今天）',
          'pages/plan/components/PlanOverview.vue + pages/plan/composables/usePlanList.js：总览「本周打卡」展示',
          'pages/plan/detail.vue + detail.scss：补记入口与样式（含深色）'
        ]
      },
      {
        title: '测试 3.5.4',
        items: [
          'tests/plan-recur.test.js：backfillTargetOf 4 例（窗口内可补、已打卡/非循环/完成/冷藏不给补、窗口结束或今天开始不给补、祖先窗口覆盖）',
          'tests/plan-heatmap.test.js：weekCheckinSummary 2 例（唯一周口径/子计划计入/删除排除、完成日志不计数）',
          'tests/plan-action-log.test.js：带日期补记 1 例（指定过去日期落库、未来与非法回落今天）',
          'manifest 3.5.4 / 3504'
        ]
      }
    ]
  },
]
