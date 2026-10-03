/**
 * 版本日志数据段：3.5（新版本在前）
 *
 * 本段由 3.5.0~3.5.21 共 22 条逐版本记录整合为单条（应用发布前合并降噪），
 * 原逐版本分段条目已删，明细按主题归并进下方 categories，文件名与技术结论原样保留。
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V35 = [
  {
    version: '3.5.21',
    date: '2026-09-15',
    title: '3.5.21（整合 3.5.0~3.5.21，发布前合并）：循环任务打卡闭环、进入总结伪对话与持续性、Agent 硬化与记忆检索、只读能力与介绍网站',
    summary: [
      '循环任务打卡闭环：recur_type/recur_count 模型 + 六级备考两层递归模板 + 级联收尾 + 热力月视图/本周周历/任意历史日补记/撤销打卡，连续口径按天与达标周分流（utils/plan-recur.js、utils/plan-heatmap.js）',
      'AI 持续性与伪对话总结：回前台增量结算、动静摘要注入上下文、最小行动单卡；进入总结从顶部卡片演进为对话内伪消息，带预置按钮、覆盖开场白、销毁空壳（utils/progress-digest.js、utils/enter-dialogue.js）',
      'Agent 硬化：入口门控反转（isClearlyCasual）、记忆按相关度检索（BM25 + 45 天半衰期）、工具参数失败回传重发；记忆语义扩展（同义分组 + 拼音桥接）与联网搜索厂商解耦（search-adapters/search-config）',
      '三条只读能力：每周账单播报、社交能量预算、回复草稿 + prefill-input 通道（utils/bill-weekly.js、utils/social-quota.js）',
      '工程拆分：plan detail.vue 940→292 行、memory.js 692→八块门面、agent-loop 544→283 行；版本日志切 10 个纯数据段；新增 module-exports 静态导出核对（修 HBuilder X 白屏）与 sfc-bindings 模板绑定检查',
      '介绍网站 site/ 纯静态零依赖四件套 + 44 秒介绍片（滚动进入静音播、滚出暂停、reduced-motion 不自动播）'
    ],
    categories: [
      {
        title: '循环任务与打卡闭环（3.5.0~3.5.3）',
        items: [
          '循环任务模型：recur_type(daily/weekly) + recur_count，打卡计当天/本周、不置完成，到阶段截止日读取时自动收尾；级联收尾 collectCascadeCompletions（固定点迭代，冷藏/任意时间子计划阻断父级收尾）；normalizeRecur/setPlanRecur 统一清洗循环字段（utils/plan-recur.js + utils/storage/plan.js）',
          '内置「六级备考」模板（tpl_cet6）：唤醒 30 天→强化 40 天→冲刺 22 天三阶段，createPlanFromTemplate 升级两层递归（est_minutes、循环字段、相对日期偏移）；重复提醒按每天/每周(固定星期)/工作日逐日触发（去重键 planId|YYYY-MM-DD）；AI 计划 schema 支持循环字段并禁止逐日拆碎',
          '打卡可视化：utils/plan-heatmap.js + PlanHeatmap.vue 热力月视图（周一列首、0/1/2/3+ 四档强度、翻月不越未来）；PlanWeekStrip 本周七天格子（compact 模式供子计划卡内联）；长按补写打卡描述（checkinWithNote）；子计划卡内联循环设置与直接打卡（checkinChild）',
          '打卡统计：streak 与 weeklyDone 入 getPlanCheckInStats，详情显示「累计/连续/本周 x/N」；进入总结显示「已连续打卡 N 天」（calcGlobalStreak，与单计划共用 calcStreakFromDates）'
        ]
      },
      {
        title: '补记复盘与口径统一（3.5.4~3.5.7）',
        items: [
          '补记闭环：logPlanCheckIn 支持指定日期（只收今天与过去，非法回落今天）；温和补记昨天 backfillTargetOf → 任意历史日补记 isBackfillable/backfillCandidates（候选带祖先路径 planPathLabel）；补记按补记日归位（eventDayKey）；removePlanCheckIn 撤销打卡；MAX_BACKFILL_DAYS = 30 回溯上限',
          '口径统一：weeklyStreakOf 把每周任务连续改成连续达标周数（里程碑 2/4/8/12/26/52 周，daily 仍 3/7/14/30/60/100 天——上一版按天算里程碑永远触发不了）；plan-heatmap countsOf 热度唯一口径（记录页热力图与详情页日历同源）；streakMilestoneOf 跨里程碑轻量肯定「连续 N 天，稳」（utils/checkin-feedback.js）',
          '交互守卫与修复：热力格「可补记」小点 + 未来日期置灰 + 长按后 400ms 抑制 tap；详情页日历可翻月（不越未来）；记录页按事件归属日过滤分组（跨周补记不串周）；修复记录页 toggleDay/dayEvents/submitBackfill 与 pages/search/result.vue 的 v-if 同元素 v-for 两处「点一下就崩」',
          'pages/plan/composables/usePlanCheckin.js：打卡统计/明细/补记/撤销/本月日历整套抽成 composable，不依赖组件实例可直接跑测试'
        ]
      },
      {
        title: 'Agent 硬化与记忆检索（3.5.11 + 3.5.18）',
        items: [
          '入口门控反转：isClearlyCasual（≤14 字 + 无数字 + 无数据域词 + 无疑问句式）才走单轮流式快通道，其余全部进工具循环——修掉「说『记录』AI 却不执行」的白名单漏执行；工具参数解析失败（parseToolArgs）回传模型重发、写入失败追加 [系统] 纠正指令，不再静默用 {} 执行',
          '记忆检索升级：utils/memory-rank.js BM25 简化 + 45 天半衰期 + 事实/偏好加权（替代「最近 30 条」）；utils/memory-synonyms.js 同义分组 34 组 + 拼音桥接（说「对象」召回「女朋友」、「jihua」桥接「计划」），关键坑：扩展词必须再切二元组才能进检索空间，否则召回恒为 0',
          '联网搜索与聊天厂商解耦：utils/ai/search-adapters.js（后端注册表，内置 zhipu/tavily）+ search-config.js（开关/后端/独立 Key 三件套，Key 回落链：独立 Key → 同名 AI 厂商 Key）；此前非智谱厂商 web_search 被整条过滤；设置页新增「联网搜索」卡片',
          'delete_feedback 登记进 CONFIRM_TOOLS：开了「AI 自动执行写操作」也必须在确认卡上点确认才能删'
        ]
      },
      {
        title: '进入总结与持续性（3.5.12~3.5.13）',
        items: [
          '持续性总结：App.vue onHide 记离开基线（siji_enter_summary_leave_at）、onShow 结算增量；resolveSummaryWindow 取确认/离开基线更晚者，60s 节流 + 未读卡片不重算 + 时钟回拨容错；修掉不点「知道了」杀进程后同批进展重复报',
          'AI 上下文与轻引导：utils/progress-digest.js 动静摘要压 2-3 行进 system（只含已发生的事，未完成事项永不出现）；utils/next-step.js「今天可以从这件开始」单卡（每天最多一次、随时可关）；连续两天低落只提醒休息（scanMoodDip，不诊断不评分不催）'
        ]
      },
      {
        title: '伪对话与会话治理（3.5.16 + 3.5.19~3.5.21）',
        items: [
          '冷启动新对话：utils/chat-session.js（空会话判定/候选挑选/冷启动标志只真一次）+ useChatSession 编排，每次启动停在新对话；空态给「回去接着聊/选择历史对话」入口卡；store/chat.js pruneEmptyConversations 清空壳',
          '对话尺：消息 ≥20 条时聊天区左侧竖向刻度（utils/chat-ruler.js 纯计算 + composables/useChatRuler.js），锚点取用户消息、超 28 个降采样且首尾必留、点/拖跳转 120ms 节流、18 字预览 + 视口指示条',
          '进入总结改伪对话：utils/enter-dialogue.js 把总结落成 AI 消息（签名去重防刷屏、流式输出时排队不打断、正文 Markdown 列表渲染——裸「·」只会在同段换行是踩过的坑）；buildEnterButtons 预置按钮：navigate 直接跳页 / prefill 只填输入框不代发',
          '开场白治理：store/chat.js dropWelcomeMessages() 让总结覆盖欢迎语，不再叠两条开场白；resumeBack 销毁只带总结/欢迎语的空壳对话再切会话；空态入口让位（shouldOfferResume 的 hideWhenEnterSummary）'
        ]
      },
      {
        title: '只读能力（3.5.14）',
        items: [
          '三条只读能力：utils/bill-weekly.js 每周账单播报（跨月分片拼齐、每周一次按周一记 key、上周没记录直说不评价）；utils/social-quota.js 社交能量预算（同日同人算一次、额度自设、排满不催不评）+ SocialQuotaBar.vue；ReplyDrafts.vue 三条回复草稿（可延后但不消失，点按复制）+ prefill-input 通道（提示词直接落输入框）'
        ]
      },
      {
        title: '介绍网站与介绍片（3.5.9~3.5.10）',
        items: [
          'site/ 介绍网站：纯静态零依赖四件套（index.html/styles.css/main.js/app-icon.png），双击即开；视觉沿用 App Zinc 灰阶（零渐变零阴影），prefers-color-scheme 深色 / reduced-motion 关动画 / 960px+640px 断点；文案全部取自仓库真实内容，不编造功能',
          '44 秒介绍片：site/assets/siji-intro.mp4（1920×1080 / 30fps / 无音轨 / 1.10MB）+ 封面帧 poster；滚动进入视口静音播、滚出暂停、reduced-motion 不自动播；CDP 逐帧截屏 + ffmpeg 编码两段式管线（site/video/render.mjs + encode.mjs）'
        ]
      },
      {
        title: '工程拆分与防回归（3.5.7 + 3.5.8 + 3.5.14~3.5.15）',
        items: [
          '大文件拆分：pages/plan/detail.vue 940 → 292 行（usePlanForm/usePlanChildActions/usePlanNextStep + PlanActionSection/PlanFieldsSection/PlanAiTools + plan-section.scss）；utils/memory.js 692 行拆 utils/memory/ 八块 + 60 行门面（27 个旧导出逐个钉住）；agent-loop.js 544 → 283 行（拆 agent-transport/call-utils/chat-sse/chat-simulated，并补上缺失的 chatRequestChunkedStream import——修 App 端真机最终轮流式必抛的 ReferenceError，H5 条件编译剥离只在 App 暴露）',
          '版本日志数据分段：utils/storage/version-data.js 2065 → 34 行，61 条记录按大版本切 10 个纯数据段；tests/plan-detail-split.test.js 拆成表单/动作两线 + tests/helpers/plan-detail.js；版本历史测试改免维护断言（以 getDefaultHistory 与 manifest.versionName 为基准）',
          '修 HBuilder X 白屏：memory/monthly.js 漏导出 currentMonth，原生 ESM 抛 does not provide an export named（vitest 走 esbuild 互操作静默变 undefined 抓不到，只有 HBuilder X 当场报）；新增 tests/module-exports.test.js 静态核对 318 个源文件的具名 import',
          'tests/sfc-bindings.test.js：扫描全部 SFC 编译后拦「模板引用不存在的变量」；修掉 plan-checkin 每周一必失败用例（周一没有「本周历史日」可补，改走今天打卡）；触及相关 .vue/.scss 行尾统一 CRLF'
        ]
      }
    ]
  },
]
