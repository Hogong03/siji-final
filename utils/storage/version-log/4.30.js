/**
 * 版本日志数据段：4.30.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V430 = [
  {
    version: '4.48.0',
    date: '2026-10-24',
    title: '引导式表达：从「问什么答什么」升级为「每次把下一步递到你手边」',
    summary: [
      '新增 utils/ai/guide.js 作为引导三式的单一事实源：收一步（把话收成 5 分钟内能做的一步）/ 深一句（追问一个具体感受或细节）/ 给两选（卡住时给两个具体选项）；写进系统提示词，JSON 兜底路径与 Agent 工具路径同时生效',
      '引导边界写死在提示里：一条回复最多一句、不连续两轮同式、纯查询/刚执行完写操作/用户说「别问了」「先这样」时不给、低落时只留最轻的一句、宁缺毋滥；禁止「你应该 / 建议你 / 必须 / 为什么不 / 加油」',
      '能力开关「引导追问」升级为「引导式表达」（id 仍是 guide_ask，老开关继续生效、默认开）；关掉后提示段与兜底短句一起消失，缓存随设置页写开关时失效',
      '回复下方短句升级为引导型：已给一小步时给「好，现在开始 / 换个更小的」，提议记录或排计划时给一键可答的「好，记下来 / 先不用」，陪伴类回复不推进；规则从 chat-suggestion.js 收归 guide.js，AI suggestions 仍原样优先',
      '欢迎语收尾改为引导（今天想从哪儿开始 + 记一笔 / 写两句 / 拆成第一步三个入口），并删掉「还有 N 个未完成计划」「本月只写了 N 篇记录」两处盘点缺口的提示（铁律 8：未完成信息只在用户主动问时出现）',
      '新增 tests/ai-guide.test.js（17 例）与 2 条 AI 自检语料（提不起劲不劝不写库 / 不知道从哪开始不建大计划）'
    ],
    categories: [
      {
        title: 'AI 行为',
        items: [
          'utils/ai/guide.js（新增）：GUIDE_KINDS 三式、GUIDE_SECTION 提示段、buildGuideSection()、pickGuideChips()、hasGuideTail()、guideKindOf()、PRESSURE_WORDS；规则全部纯函数，无 UI 依赖',
          'utils/ai/prompt-builder.js：guide_ask 开关打开时注入 buildGuideSection()，替换 4.11.0 的单句「记录后追问」；full / lite / agentMode 三条路径全覆盖（都经 buildSystemPrompt）',
          'utils/ai/eval/cases.js：新增 guide-no-lecture（提不起劲：不建计划不写库，回复不得出现劝进词）与 guide-min-step（不知道从哪开始：不建大计划，回复不得说教）',
          'utils/ai/chat-suggestion.js：兜底规则收归 guide.js，本文件只保留 mergeSuggestions 合并入口（AI 给了 suggestions 仍原样优先，最多 3 条）'
        ]
      },
      {
        title: '开关与文案',
        items: [
          'utils/ai/features.js：guide_ask 名称改「引导式表达」，描述改为「每次回复末尾留一句引导，把下一步递到你手边（不催）」；分组与默认值不变',
          'composables/useWelcomeMessage.js：收尾改「今天想从哪儿开始？说一句就行：记一笔、写两句，或者把卡住的一件事拆成第一步」；删除未完成计划数与记录篇数两条压力提示，只保留本月支出这一条事实'
        ]
      },
      {
        title: '测试与语料',
        items: [
          'tests/ai-guide.test.js（新增 17 例）：三式齐全、压力词进禁止清单、三路径注入、开关关掉整段消失、chips 分支（提议/一小步/陪伴/失败/写操作后）、长度与伪建议约束、hasGuideTail / guideKindOf、欢迎语不盘点缺口',
          'tests/chat-suggestion.test.js 原 11 例不改断言全绿：旧口径（账单/计划/长段分享/失败）与新增步进分支互不覆盖'
        ]
      }
    ]
  },
  {
    version: '4.47.0',
    date: '2026-10-20',
    title: '计划打卡语义校正：到期收尾不再冒充「完成」，同日补写不丢描述，打卡被拒原因统一，读侧口径全量对齐',
    summary: [
      '到期收尾改写 end_reason=expired + 执行日志 ended（不再写 done），记录页标签区分「完成 / 到期 / 打卡」；级联收尾不再把到期子计划当完成，父级保持进行中待回顾',
      '同日再打卡保留首次 at（补写描述不改记录时刻）并新增 note_at；note 改为三态：undefined 不动已有描述、空串明确清空、非空覆盖 —— 快捷打卡与 AI 不带描述时不再清空用户已写内容',
      '新增 checkinBlockReason() 单一判定：详情页 / 今日行动条 / 子计划列表 / 聊天卡直达 / AI 执行器共用同一份原因（计划不存在 / 已删除 / 已冷藏 / 已完成 / 已到期收尾）',
      '去催促化：删除「今天还没打卡，连续性就保住了」这条建议规则；「打卡进度条会往前走一格」改为「今天这次就留下了」；回执文案「已打卡，今天完成」改为「已记录，今天这次算数」',
      '读侧口径全量对齐：新增 endKindOf / isDonePlan / isExpiredPlan / planStatusLabel；计划卡片、看板、筛选、总览统计、聊天汇总表、搜索、CSV 导出、子计划标签、AI query_plan 与 AI 文本全部区分「已完成 / 已到期」，完成数与完成率不再把到期算成达成',
      '已知限制（P1 解决）：到期后 30 天补记窗口尚未恢复；4.46 及以前自动收尾的存量计划没有 end_reason，升级后仍按「已完成」显示，无法回溯区分（本轮不做数据迁移）'
    ],
    categories: [
      {
        title: '计划打卡语义',
        items: [
          'utils/storage/plan.js：reconcilePlanStatus 到期分支改推 ended + end_reason=expired，已标记的跳过防重复日志；savePlan 中 status 2→非 2 的重开动作清掉 end_reason 与 done_at',
          'utils/plan-recur.js：collectCascadeCompletions 把 end_reason=expired 的子计划视为「未结束」，避免一个循环项到期就把阶段与主计划一起关掉；新增 checkinBlockReason(plan) 纯函数',
          'utils/plan-daily.js：collectPlanExecEvents 收集 ended 事件（kind 原样透传），记录流不再把到期读成完成',
          'pages/plan/records.vue：kindLabel() 映射三种标签（完成/到期/打卡），补 rk-ended 明暗两套样式；补记调用改传 undefined 不动描述',
          'store/executors/plan.js：note 缺省时不传描述；冷藏/已完成/到期收尾的失败文案改走 checkinBlockReason'
        ]
      },
      {
        title: '交互与文案',
        items: [
          'pages/plan/index.vue：快捷打卡与长按补写改走 note 三态；失败提示给具体原因；回执改「已记录，今天这次算数」',
          'pages/plan/composables/usePlanCheckin.js / usePlanChildActions.js / usePlanNextStep.js：补记与快捷打卡不再传空串覆盖描述，阻断提示统一走 checkinBlockReason',
          'utils/advice-rules.js：删除 plan-checkin 催促规则（空白不等于断签）；plan-today 文案不再暗示打卡会推进进度'
        ]
      },
      {
        title: '读侧语义统一',
        items: [
          'utils/plan-recur.js：新增 endKindOf / isDonePlan / isExpiredPlan / planStatusLabel 四个纯函数；utils/plan-summary.js 统计拆出 expired，分组新增「已到期」（expiredHidden 截断说明）',
          '计划 UI：PlanCard 状态标签与样式区分「已到期」（不再删除线 + 降透明度冒充完成）；看板第三列改「已结束」并给到期卡加角标；筛选 chip 改「已结束」；总览与统计新增到期计数',
          '其他读端：搜索索引 extra、CSV 导出（顺带修 status=0 误标「已完成」）、功能中心完成数、执行卡完成数、子计划标签与进度、AI 计划分析的子计划状态，全部走统一判定',
          'AI：execQueryPlan 的 completed 过滤排除 expired 并在 message 注明「另有 N 个已到期（未确认完成）」；formatPlans 输出 [已到期]；usePlanForm 仅在真完成时连带关闭循环子计划'
        ]
      },
      {
        title: '测试',
        items: [
          'tests/plan-recur.test.js：过期收尾断言改为 ended + end_reason，新增「到期子计划不触发父级级联」、checkinBlockReason、endKindOf/planStatusLabel、重开清 end_reason 用例；阶段截止后父级保持进行中的旧语义同步改写',
          'tests/plan-action-log.test.js：新增 note 三态 5 例（保留/传 null/清空/执行器不清空/历史缺 at 与 note_at 不崩）',
          'tests/plan-summary.test.js：新增「到期单独成组、不计完成/完成率」「已到期分组截断 expiredHidden」2 例；tests/executors.test.js：新增 completed 不含到期 + AI 文本 [已到期] 1 例',
          'tests/backup.test.js：新增 CSV 计划状态文案 1 例（待开始/进行中/已完成/已到期，锁住 status=0 不再误标已完成）；tests/plan-daily.test.js：新增 ended 事件进入记录流 1 例',
          '全量 117 文件 / 1645 用例全绿',
          'H5 实测（HBuilderX 5.26 CLI 编译 → 静态服务 → headless Chrome 驱动真实构建产物）：到期计划列表显示「0 完成 · 1 到期」、记录页标「到期」；同日连点两次只留 1 条且描述/首次时刻不变；冷藏计划点打卡提示「计划已冷藏，先放一放」且不落库；已完成子计划不提供打卡入口'
        ]
      }
    ]
  },
  {
    version: '4.46.0',
    date: '2026-10-19',
    title: '关系回溯观察日志落成可填写文件（模板 + 合成示例 + CSV 表头），真实记录本地隔离（无代码行为变更）',
    summary: [
      '新增 docs/关系回溯观察日志.md：12 列可填表（编号/日期/案例类别/脱敏输入/是否应该触发/是否实际触发/人物是否正确/历史事实是否准确/事实与推测是否分开/回答是否有帮助/问题分类/处理决定）+ 3 条明确标注为「示例」的合成案例 + 15 行空白 + 逐字段填写说明',
      '「是否应该触发」与「是否实际触发」强制分列并写明理由：只有分开才能区分漏触发（应该=是、实际=否）与误触发（应该=否、实际=是）；合成一列只能统计触发次数，看不出对错',
      '三类特殊情形给了规定记法：① 不确定的案例（没有人名，如「我感觉我们之间有点远了」）记「不确定/不适用」，**不算漏触发**，观察重点是 AI 有没有自然反问是谁；② 归属错误 1 例即处理，但**先按四层定位**（意图门 / 人物筛选 / 归属判断 / 上下文组装）再决定改哪里；③ 历史事实查询走 query_interaction，不算「未触发」',
      '.gitignore 增加 docs/关系回溯观察日志-本地.md 与 -本地.csv：发布流程含 git add -A，真实私人记录必须放本地副本，避免被误提交（模板与合成示例才进仓库）',
      'docs/关系回溯观察记录.md 收敛为「判定标准 + 处置流程」，记录表迁到日志文件并交叉引用，补上四层定位表。**本轮无代码行为变更**（不改触发规则、不动生产链路、不引入自动采集/数据库），观察期规则保持冻结；全量 117 文件 / 1628 用例保持全绿'
    ],
    categories: [
      {
        title: '观察记录文件',
        items: [
          'docs/关系回溯观察日志.md（新增）：填写说明（时机/粒度/姓名脱敏）、12 列记录表（3 行合成示例 + 15 行空白）、三类特殊情形记法、观察期结束后的四类问题统计门槛表、CSV 表头与统计口径示例（漏触发率/误触发率的算法）',
          'docs/关系回溯观察记录.md：头部指向日志文件与本地副本；第四节改为口径要点（分列理由、不确定不算漏触发、历史查询不算未触发）；第五节补「②类先分层定位再改规则」的四层检查表',
          '.gitignore：新增本地记录文件名两条（docs/关系回溯观察日志-本地.md / .csv）'
        ]
      },
      {
        title: '文档索引',
        items: [
          'docs/速查表.md：把日志文件与本地副本隔离说明补进「验证关系回溯整条链路 / 进观察期」一行',
          'docs/会话检查点.md：文档布局行补四份关系回溯按需文档（触发评估 / 观察记录 / 观察日志 / score_source 设计分析）'
        ]
      }
    ]
  },
  {
    version: '4.45.0',
    date: '2026-10-19',
    title: '关系回溯端到端回归：14 条链路断言锁到最终提示词，规则冻结进入观察期；score_source 设计分析（不改代码）',
    summary: [
      '触发规则四轮打磨后，本轮验证的不是「规则能否识别」而是「接入真实链路后是否稳定」：新增 tests/relation-traceback-e2e.test.js（14 例），断言对象一律是 buildChatMessages 产出的 **messages[0].content**（真正发给模型的提示词），而不是中间函数返回值 —— 中间通过不代表链路无遗漏',
      '覆盖 8 类必测场景：明确关系变化的事实进提示词 / 含蓄表达全链路 / 第三人关系不注入错误人物 / 多人每人独立成段且顺序按出现（含三人上限只展开 2 人）/ 无人物指向不擅自选人 / 无历史记录如实说明且不编造 / 历史事实查询不走回溯而走 query_interaction / 回溯被归属拦截时关系图谱与记忆等合法上下文照常注入',
      '另有 query_interaction 兜底路径 3 例（两条路径各自独立、均能拿到同一批事实）与回答层约束 1 例（推测标注与禁令确实进了提示词；生成质量由真实模型语料与观察窗口负责）',
      '测试方法学修正：「不含」类断言曾被提示词自带例句骗过 —— BEHAVIOR_RULES 里就有「今天和阿伟吃了午饭」这个例子，夹具撞车导致误判成链路泄漏。现改为唯一夹具文案 + 一条「夹具唯一性自检」（无关消息的提示词里不得出现任何夹具文案）',
      '本轮**未改任何触发规则**。新增 docs/关系回溯观察记录.md（观察窗口与隐私原则、应该/不应该触发的判定标准、记录表、四类问题分类与处置门槛、离线回归网命令）与 docs/score_source设计分析.md（现状盘点、不可区分记录的只读量化方法、A/B/C 方案对比与推荐 A、影响面清单、迁移原则「不推断用户曾评分」、待决策三问）。全量 117 文件 / 1628 用例全绿（无 expected fail）'
    ],
    categories: [
      {
        title: '端到端回归',
        items: [
          'tests/relation-traceback-e2e.test.js（新增 14 例）：数据固定（阿伟 2 条含结果与情绪、小王 1 条）、不调模型；断言对象是最终提示词',
          '覆盖链路：用户消息 → detectTracebackIntent → selectTracebackPersons → analyzeTracebackOwnership → buildTracebackContext → buildChatMessages 组装',
          '夹具唯一性自检：UNIQUE_TEXTS 在无关消息提示词中不得出现（防止断言被提示词自带例句骗过）',
          'query_interaction 兜底路径单独验证：不依赖关系变化语义、与回溯路径各自独立、两条路径读到同一批事实'
        ]
      },
      {
        title: '观察准备',
        items: [
          'docs/关系回溯观察记录.md（新增）：窗口建议 1–2 周或 30–50 例（声明非统计充分性保证）；只存必要匿名信息、优先等价改写合成句、不要无差别保存完整对话；应该触发 5 类 / 不应该触发 5 类的判定表；记录表 11 列；问题四分类与处置门槛（归属类 1 例即处理，其余 ≥3 例，且改前先补语料）；离线回归网命令',
          'docs/关系回溯触发评估.md：结论指向观察阶段（不再扩规则）'
        ]
      },
      {
        title: 'score_source 设计分析（不改代码）',
        items: [
          'docs/score_source设计分析.md（新增）：问题定义（默认值 5 / 用户评 5 / 历史模板与 AI 遗留值三者同形）；现状盘点（字段、默认值、唯一合法写入路径、AI 写入已被执行层拒绝、模板预填已移除、下游消费点）',
          '只读量化方法：控制台片段统计总人数 / 等于 5 分 / 其他分数，并说明「等于 5 分」是来源不可确认记录的上界',
          '方案对比：A 新增 score_source: user|default|legacy_unknown（推荐，向后兼容、不丢信息）；B 默认值改 null（语义最干净但破坏统计/模拟器/UI）；C 仅加 UI 文案（治标不治本）',
          '影响面清单（写入 / 迁移 / UI 展示 / 统计口径 / AI 注入文案 / 情景模拟分档 / 测试）与迁移四原则（旧数据一律 legacy_unknown、不写回填脚本、统计不删数据、UI 不显示假精度）；留三个待产品决策的问题与实施顺序'
        ]
      }
    ]
  },
  {
    version: '4.44.0',
    date: '2026-10-19',
    title: '关系回溯含蓄表达修复：按「双方指向 + 变化线索」结构触发（不做关键词表），召回 82.4% → 100%',
    summary: [
      '修最后一个缺口 1：「感觉和阿伟不如以前了」「和小王聊天越来越没话说了」「我和阿伟没以前那么亲近了」不触发。诊断显示这 5 条的**人物门本来就能构建上下文**，唯一卡点是意图门 —— 所以只改了意图门的结构识别，没动人物门逻辑',
      '规则是**结构组合而非关键词表**：(和|跟|与|同) + 某人 + 10 字内 + 变化线索 才触发；线索词单独出现一律不触发。线索词单一口径 IMPLICIT_CHANGE（不如以前/没以前/不像以前/没话说/没得聊/无话可说/话越来越少/联系越来越少/越来越没话/越来越客气/越来越淡/生疏…），**意图门与分句合格性共用**，避免「意图命中却没人建段」的错配',
      '明确边界（本轮确立的语义）：「阿伟最近有点怪怪的」这类只有状态词、没有「用户与他的关系」指向的说法**不触发** —— 它以前被记成缺口，现在明确为正确行为，并加哨兵测试防回潮',
      '反例全部不注入：转述他人（「小王说阿伟变了」）、转述他人双方关系（「小王说他跟阿伟没以前那么亲近了」意图命中但归属过滤挡下）、无关语境（「我以前不如现在会处理关系」）、无指向（「这家店的服务越来越客气了」）；标点边界（分号/句号/问号）人物不串；无标点口语同样识别',
      '四个缺口全部关闭：错误归属（4.42.0）、多人静默取一（4.43.0）、含蓄漏触发（4.44.0）、历史询问（判定不必修）。指标：召回 82.4% → **100%**（22/22）、注入层误触发保持 **0/21**、人物匹配 **100%**（22/22）；语料 34 → 45 例；全量 116 文件 / 1614 用例**全部通过（无 expected fail）**'
    ],
    categories: [
      {
        title: '含蓄触发规则',
        items: [
          'utils/relation-traceback.js：新增单一口径常量 IMPLICIT_CHANGE；TRACEBACK_INTENT 增加「双方指向 + 变化线索」分支（(?:和|跟|与|同)\\s*[^，,。！？!?；;\\s]{1,6}[^，,。！？!?；;]{0,10}?(?:线索词)）',
          'CHANGE_CLAUSE（分句合格性）改用同一个 IMPLICIT_CHANGE，覆盖 没以前/没得聊/无话可说/生疏 等此前缺失的线索词',
          '未改动人物门的归属判定、出现顺序、上限 2 与每人一段的组装逻辑'
        ]
      },
      {
        title: '语料与测试',
        items: [
          'utils/ai/eval/traceback-corpus.js：含蓄类补 3 例（我和阿伟没以前那么亲近了 / 我跟阿伟没以前那么亲近了（无标点）/ 最近我跟阿伟越来越没话说了）；新增 category counter 反例 5 例与 category boundary 标点边界 3 例；implicit-weird 预期改为「不触发」',
          'tests/relation-traceback-trigger.test.js：3 条 it.fails 全部转正；新增「含蓄表达按结构组合触发」8 条（两类语义 / 无标点 / 状态词不触发 / 反例 / 第三人双方结构被归属挡下 / 标点边界 / 摘掉双方指向即不触发）；基线与门槛更新为 22/22、0/21、22/22；缺口哨兵 1 条',
          'tests/relation-traceback.test.js：归属与既有语义测试全部保持通过',
          'docs/关系回溯触发评估.md：缺口 1 标记为已修复（含规则与不触发边界），缺口清单四条状态齐平，结论改为「整体回归与真实使用观察」'
        ]
      }
    ]
  },
  {
    version: '4.43.0',
    date: '2026-10-19',
    title: '关系回溯多人场景修复：每人一段、按出现顺序、上限 2 人（确定性），人物匹配 61.5% → 100%',
    summary: [
      '修缺口 2：「为什么我和阿伟、小王都疏远了」只注入了小王 —— 旧实现按 last_interaction 排序取第一个，**选择依据与用户说的是谁无关**，静默丢掉另一个人',
      '新增 selectTracebackPersons（只动候选筛选与组装）：① 合格性 —— 必须落在含关系变化信号的**同一个分句**里（顺带提及不算）；② 归属 —— 复用第三人判定，第三人关系的人跳过；③ 顺序 —— 按消息中出现先后（与 last_interaction、存储顺序无关）；④ 上限 MAX_TRACEBACK_PERSONS=2，超出按上述顺序**确定性丢弃**，不是「只看前两名」的隐式行为',
      '组装改为每人一段、段首标明对应人物，结尾共用一条表达规则并声明「各段分别对应谁，不要混在一起说」，避免把两个人的时间线混在一起',
      '修复过程中又暴露两处「跨句」缺陷，均已修：转述引语的匹配跨过逗号会把下一分句的「对我」当成上一句关系的对象；转述动词的回溯跨过逗号会把上一分句的「他说…」算到下一分句的名字头上 —— 结论是**归属判定必须与分句结构绑定**',
      '指标：召回 76.5% → **82.4%**（14/17）、人物匹配 61.5% → **100%**（14/14）、注入层误触发保持 **0/15**、多人静默取一 4 例 → **0**；语料 29 → 34 例（含 3 人上限与「顺序随消息而非时间」两组对照），剩 3 条 it.fails = 缺口 1（含蓄漏触发）。全量 116 文件 / 1609 用例（1606 通过 + 3 expected fail）'
    ],
    categories: [
      {
        title: '多人选择与组装',
        items: [
          'utils/relation-traceback.js：新增 MAX_TRACEBACK_PERSONS=2、selectTracebackPersons(message, opts)（归属 + 合格性 + 去重 + 出现顺序 + 上限）、isInChangeClause（按标点切句，句内判断）',
          'buildTracebackContext 改为「每人一段」：抽出 buildPersonSection（单人事实 + 感受），共用 EXPRESS_RULE；多人时表达规则里声明各段对应哪个人、不要混说',
          'lastReportVerbEnd 的分句边界加入逗号；REPORT_VERB_TAIL 的引语截取限定在同一分句内（两条都是多人组合场景暴露出来的）',
          '显式传入 opts.relation 时只做归属过滤（调用方已决定回溯谁），不要求消息里有变化句'
        ]
      },
      {
        title: '语料与测试',
        items: [
          'utils/ai/eval/traceback-corpus.js：新增 multi_person 场景 7 例 —— 两人明确都注入 / 顺序按出现（与互动时间相反）/ 顺带提及不注入 / 两人中一人为第三人关系 / 三人上限（两种书写顺序对照）；multi-implicit 预期改为「不注入」（缺口 1 未放宽）',
          'utils/ai/eval/traceback-eval.js：支持 expect.persons（有序完全一致才判匹配）、多人物提取、neitherGate 分类（两道门都未经过，如历史事实查询）',
          'tests/relation-traceback-trigger.test.js：缺口 2 的 it.fails → 8 条正常测试（两段独立成段 / 时间不同不丢人 / 顺带提及不算 / 第三人跳过 / 三人上限确定性 / 上限是常量 / 多次评估一致 / 引语里的名字不进回溯）；基线与门槛更新为 14/17、0/15、14/14',
          'docs/关系回溯触发评估.md：缺口 2 标记为已修复（含规则与两处跨句缺陷），结论与下一步更新，指标段重新生成'
        ]
      }
    ]
  },
  {
    version: '4.42.0',
    date: '2026-10-19',
    title: '关系回溯第三人归属修复：识别关系的主体与对象，注入层误触发率 11.1% → 0%',
    summary: [
      '修的是评估里优先级最高的缺口 3：「阿伟说他跟女朋友关系变差了」命中了意图，却把**我和阿伟**的互动时间线注入了 —— 关系数据是私人的，错误归属比漏触发更贵',
      '新增 analyzeTracebackOwnership（识别这段关系属于谁，**不做关键词屏蔽**）：① 转述引语「X 说/告诉我/抱怨…」后面是 X 自己的关系；② 配对结构「X + 跟/和/与 + 他者称谓」；③ 名字落在别人的引语里（「阿伟说他跟小王关系变差了」里的小王）；④ 引语主语或对象是用户时一律按 self；⑤ 保守默认 self（宁可漏挡第三人，也不误挡用户自己的关系）',
      '只跳过回溯注入，**不屏蔽整条消息**：同一句里的关系卡片、记忆、计划等上下文照常注入（有测试锁定）。未顺带放宽含蓄触发、未动多人场景，严格按 3 → 2 → 1 的顺序',
      '语料 22 → 29 例（5 种第三人说法 + 用户自己的对照组 + 含蓄基线不变），缺口 3 的 it.fails 转正并新增 4 条守住修复的测试（含「挡住它们的是归属判定而不是碰巧没命中意图」与「其他上下文不受影响」）',
      '指标变化：召回 66.7% → **69.2%**（9/13，分母加入了用户自己的对照组）、注入层误触发 11.1% → **0%**（0/14）、人物匹配 100%（8/8）、安全性全过；剩余 3 条 it.fails = 缺口 1（含蓄漏触发 2 条）+ 缺口 2（多人静默取一）。全量 116 文件 / 1599 用例（1596 通过 + 3 expected fail）'
    ],
    categories: [
      {
        title: '第三人归属规则',
        items: [
          'utils/relation-traceback.js：新增 analyzeTracebackOwnership(message, personName) → self | third_party；配套 lastReportVerbEnd（找转述动词结束位置，句内边界用 。！？；\\n 切分）、OTHER_PARTY_ROLE（他者称谓表）、REPORT_VERB_TAIL（转述引语）、PAIR_WITH（跟/和/与 配对结构）',
          'buildTracebackContext 在解析出目标人物后、取时间线之前调用归属判定，third_party 直接返回空串（只影响回溯这一段）',
          '规则优先级：用户优先（引语主语/对象是我 → self）高于第三人信号；没有确凿第三人信号一律 self'
        ]
      },
      {
        title: '语料与测试',
        items: [
          'utils/ai/eval/traceback-corpus.js：新增 category: third_party 段（阿伟说他跟女朋友关系变差了 / 我觉得阿伟最近跟女朋友闹矛盾了 / 阿伟说他最近和家里人不太和睦 / 阿伟跟我说，他最近不太想理女朋友 / 阿伟说他跟小王关系变差了）+ self-still-triggers-after-fix（用户自己的关系必须照常触发）+ implicit-baseline-unchanged（不通放宽含蓄触发，保持基线）',
          'tests/relation-traceback-trigger.test.js：缺口 3 的 it.fails → 正常测试；新增「5 种第三人说法全部不注入」「挡住它们的是人物门（归属判定）」「用户自己的关系不受影响（对照组）」「第三人消息的其他上下文照常处理」；基线更新为 9/13、0/14',
          'tests/relation-traceback.test.js：新增 7 条归属识别单元测试（转述引语 / 配对结构 / 名字落在别人引语里 / 引语主语或对象是用户 → self / 用户自己的描述 → self / 保守默认不误挡 / 参数缺失安全返回）+ buildTracebackContext 对第三人返回空串',
          'docs/关系回溯触发评估.md：缺口 3 标记为已修复（含修法与边界），结论与下一步更新，指标段重新生成'
        ]
      }
    ]
  },
  {
    version: '4.41.0',
    date: '2026-10-19',
    title: '关系回溯触发范围离线评估：召回 66.7%、误触发 11.1%、人物匹配 100%，4 个缺口登记为 it.fails（本轮不改规则）',
    summary: [
      '建立 22 例确定性评估语料（8 类：明确关系变化 / 含蓄关系变化 / 怀疑对方态度 / 询问历史事件 / 一般情绪倾诉 / 泛化讨论 / 多人场景 / 无记录人物），每例自带数据前置，任何机器上结果一致，不调模型不联网',
      '新增评估器与四类指标：召回率、注入层误触发率、人物匹配准确率、行为安全性；**两道门（意图门 + 人物门）分开记录**，否则会把「上下文能构建」误判成「已注入」（本轮首跑就踩了这个坑）',
      '实测结果：召回 66.7%（8/12，漏触发 4 例全是含蓄说法与多人场景）、注入层误触发 11.1%（1 例：第三人关系「阿伟说他跟女朋友关系变差了」被错误归属）、人物匹配 100%（7/7）、安全性全部通过、历史询问 0/2 注入',
      '关键结论：人物门很硬 —— 被它拦下的 5 例全是「没有人名指向」，「有人名但话题无关」一例都没有，说明放宽意图门的误注入风险主要由人物门承担；但**必须先修「第三人关系归属」与「多人静默只选一人」**，否则放宽会同时放大这两类错误',
      '本轮**未修改任何触发规则**：4 个缺口用 it.fails 标注（修好后会报错提醒转正），完整报告见 docs/关系回溯触发评估.md（幂等生成，人工分析段在标记之后、重新生成时保留）。全量 116 文件 / 1587 用例（1583 通过 + 4 条 expected fail）'
    ],
    categories: [
      {
        title: '评估语料与评估器',
        items: [
          'utils/ai/eval/traceback-corpus.js（新增）：22 例语料，字段含 message / relations（数据前置）/ expect.intent / expect.injection（true|false|optional）/ expect.person / expect.multiPerson / contains / notContains',
          'utils/ai/eval/traceback-eval.js（新增）：seedTracebackFixture（按前置写库）、runTracebackCase（同时记录 contextBuilt 与 injected）、analyzeTracebackCase、summarizeTracebackMetrics、formatMetricLine、buildTracebackReport（可复现 Markdown）',
          'tests/relation-traceback-trigger.test.js（新增 17 例）：硬不变量 7 条 + 基线快照 5 条 + 已知缺口 4 条 it.fails + 缺口记录可查 1 条；支持 $env:TRACEBACK_EVAL_REPORT 打印报告、$env:TRACEBACK_EVAL_OUT 落盘（幂等，保留人工分析段）、$env:TRACEBACK_EVAL_DEBUG 单例调试',
          'docs/关系回溯触发评估.md（新增）：指标 + 22 例逐例表（自动生成）+ 方法与口径 + 4 个缺口清单与最小修法建议 + 结论（人工维护）'
        ]
      },
      {
        title: '实测结论与下一步',
        items: [
          '缺口 1（漏触发，4 例）：「阿伟最近有点怪怪的」「感觉和阿伟不如以前了」「和小王聊天越来越没话说了」「阿伟和小王最近都不太对劲」——意图层不命中；建议加结构规则（已收录人名 + 关系状态词），不扩关键词表',
          '缺口 2（多人静默取一）：「为什么我和阿伟、小王都疏远了」只注入了小王（按最近互动挑）；建议多人时注入全部（最多 2 人）并写明都要照顾到',
          '缺口 3（错误归属，优先级最高）：「阿伟说他跟女朋友关系变差了」注入了「我和阿伟」的时间线；建议加第三人结构负向规则，且不能简单要求消息含「我」（会误伤缺口 1 的含蓄说法）',
          '缺口 4（历史询问 0/2）：判定不必修 —— 事实查询走 query_interaction 更合适，回溯面向关系变化分析，语料已标 optional',
          '口径修正留痕：语料是合成的（无真实对话日志），结论只说明正则行为；上下文里的反面例句会让 notContains 误断言，回复级安全交给 cases.js 的 replyExcludes'
        ]
      }
    ]
  },
  {
    version: '4.40.0',
    date: '2026-10-19',
    title: '关系事件回溯：问「为什么和他疏远了」时先给事实与你的感受，原因只能作为推测说',
    summary: [
      '此前问「为什么我最近觉得和小王疏远了」，AI 只能拿到关系卡片（角色/特征/一个来路不明的分数）与最近 3 条互动摘要，容易直接给出「他变冷淡了」这类断言',
      '新增 utils/relation-traceback.js（纯函数）：按人 + 时间窗取互动时间线、情绪走向摘要（时间线对半比负面占比，带情绪记录不足 4 条时不给走向）、关系变化提问识别、以及三段式回溯上下文',
      '严格三层分离：【事实】用户自己记录过的互动（时间/场景/做了什么/结果）；【你的感受】用户自己写下的情绪（不是 AI 判断的情绪）；【表达规则】原因只能作为推测提出并用「可能/也许」标注，禁止断言对方的态度或想法',
      '注入点在 buildChatMessages 的关系上下文之后，仅在命中「关系变化」提问且人脉能力开启时注入；没提到任何已收录人物时**不注入**（不猜是谁），多个人被提到时取最近有互动的那个',
      '数据全部复用现有 siji_interactions（scene/content/result/emotion/date），**不新增存储字段**；query_interaction 的输出改为事实与感受分开标注（结果 / 用户当时的情绪）。行为准则 +1 条，语料 +1 条（共 36 条），新增 tests/relation-traceback.test.js 21 例，全量 115 文件 / 1570 用例全绿'
    ],
    categories: [
      {
        title: '回溯模块',
        items: [
          'utils/relation-traceback.js（新增）：classifyEmotion（正/负/中性/未知，含「不太开心」这类否定式正面归负面）、getRelationTimeline(relationId,{sinceDays=90,limit=20,now})、summarizeEmotionShift（返回 counts + sample + trend up/down/flat/unknown）、detectTracebackIntent、buildTracebackContext',
          '没有互动记录时如实说「最近 90 天没有记录到互动」，并明确这不能证明关系变差；没有情绪记录时明说没有感受数据、不要替用户编造感受',
          '回溯上下文里不出现亲密度分数（分数来源未必可追溯，不能当关系变化的证据）'
        ]
      },
      {
        title: '注入与工具',
        items: [
          'utils/ai/chat-helpers.js：在关系上下文之后按 detectTracebackIntent + isFeatureOn(\'relation\') 注入回溯上下文',
          'store/executors/relation.js 的 execQueryInteraction：逐条输出改为「日期 · 场景：内容（结果：…）（用户当时的情绪：…）」，明确均来自用户自己的记录，供 AI 区分事实与感受',
          'utils/ai/prompt-actions.js BEHAVIOR_RULES：新增「先摆事实与感受、原因只能是推测、禁止断言对方态度、没记录就说没记录」一条'
        ]
      },
      {
        title: '测试',
        items: [
          'tests/relation-traceback.test.js（新增 21 例）：情绪极性（含否定式）/ 按人回溯只取本人且倒序带 days_ago / 时间窗过滤 / limit / 空数据 / 走向 down / 样本不足 unknown / 无情绪 sample=0 / 意图命中与不命中 / 三段齐全 / 无互动如实说明 / 无情绪不编造 / 没提到人物不注入 / 多人取最近有互动者 / 事实不含分数 / buildChatMessages 命中才注入 / 行为准则存在 / query_interaction 标注结果与情绪',
          'utils/ai/eval/cases.js 新增语料 relation-traceback-facts-not-verdicts（问关系为什么变差 → 禁止建卡改卡记互动、禁止断言「他变冷淡了」），语料总数 36 条'
        ]
      }
    ]
  },
  {
    version: '4.39.0',
    date: '2026-10-19',
    title: '关系模板不再预填亲密度：产品预设值不再伪装成用户评价，模板逻辑抽成可测纯函数',
    summary: [
      '模板此前自带亲密度 5/6/7/8/9：用户点一下模板再提交，产品设计者预设的分数就变成「用户评价」，污染平均亲密度统计、关系图谱排序与情景模拟人设',
      '取消预填：模板只填角色/场景/特征/偏好/备注；新建表单默认值仍为 5（不扩大改动范围）；编辑已有关系时套用模板不覆盖用户已评的分数',
      '模板数据与「应用模板」逻辑从 pages/settings/sub/relations.vue 抽到 utils/relation-templates.js（纯数据 + 纯函数 buildRelationForm / applyRelationTemplate）—— 「模板不许改分」需要有真断言，而 .vue 内部逻辑只能靠读源码文本判断',
      '已知限制（暂不处理）：仍然无法区分「默认 5 分」与「用户主动评为 5 分」，需要新增来源标记才能解决；本轮先把产品预设值这个最明确的污染源掐掉',
      '用户手动拖滑块仍是亲密度唯一合法写入路径（4.38.0 的 trustScore 机制保持）。新增 tests/relation-template-score.test.js 11 例，全量 114 文件 / 1549 用例全绿'
    ],
    categories: [
      {
        title: '模板治理',
        items: [
          'utils/relation-templates.js（新增）：RELATION_TEMPLATES 六个模板去掉 score 字段；buildRelationForm(overrides) 给出表单初始值（亲密度固定 DEFAULT_RELATIONSHIP_SCORE）；applyRelationTemplate(form, tpl) 只写 role/context/traitsStr/preferencesStr/notes，**绝不触碰 relationship_score**',
          'pages/settings/sub/relations.vue：删除本地模板数组与 form 字面量，改调 buildRelationForm() / applyRelationTemplate()；resetForm 与 handleEdit 一并改用 buildRelationForm，applyTemplate 里移除 form.relationship_score = tpl.score',
          '模板「其他」项（空模板）应用后不会清空姓名等用户已填内容'
        ]
      },
      {
        title: '测试',
        items: [
          'tests/relation-template-score.test.js（新增 11 例）：6 个模板都不含 score/relationship_score（防回潮）/ 逐个应用模板后分数仍是默认值 / 领导·朋友·家人·伴侣四个高危模板不会把分数改成 6-9 / 编辑已有关系（已评 8 分）套用全部模板后仍是 8 / 用户拖滑块后再套模板不被覆盖 / 新建默认值仍 5 / 其他字段（role·context·traits·preferences·notes）照常填充 / 空模板不清空姓名 / 参数缺失安全返回 / 套模板+手动评分提交后落库为用户给的分 / 不手动评分时落库是默认值而不是模板值',
          '守卫：sfc-bindings（.vue 模板标识符）与 module-exports（新增模块的具名导入）同步通过'
        ]
      }
    ]
  },
  {
    version: '4.38.0',
    date: '2026-10-19',
    title: '亲密度改由用户自己评价：执行层默认拒绝 AI 写入（建卡忽略、更新剥离），顺带修 last_interaction 永远写不进去',
    summary: [
      '审查发现亲密度有 6 条写入通道：AI 建卡可自填（create_relation 参数暴露该字段）、AI 更新可覆盖（update_relation 白名单含它）、默认值 5、模板预填 5/6/7/8/9、用户滑块；写进去的数还会被注入回提示词当事实读，并直接决定情景模拟里对方的语气',
      '约束落在**执行层**而不是只改提示词：utils/relations.js 的 createRelation/updateRelation 新增 opts.trustScore，**默认拒绝**写入亲密度（连"将来某条新路径忘了剥离"也拦得住），只有 UI 手动建卡/编辑传 true',
      '提示词同步收口：extSection 与 create_relation 工具 schema 移除亲密度字段（连英文字段名都不再出现）；新增两条行为准则（禁止 AI 改分并引导用户到详情页拖滑块、现存分数来源未必可追溯禁止断言用户评价过）；关系上下文注入补一句来源说明',
      '顺带修既有 bug：last_interaction 不在 updateRelation 的白名单里，logInteraction 里那句更新被静默丢弃 —— 关系图谱的「N 人超过 30 天没联系」「7 天内互动」一直失真；现已修复，且执行器白名单不含它，AI 仍然改不到',
      'AI 更新同时传 notes 与亲密度时，备注照常写入、分数不动；绕过提示词直接调执行器或 utils 层同样写不进去。新增 tests/relation-score-governance.test.js 17 例，语料库补 1 条（`relation-score-not-ai-writable`：要求改分时禁止调用 update_relation、禁止谎称已改，语料共 35 条），全量 113 文件 / 1538 用例全绿'
    ],
    categories: [
      {
        title: '亲密度治理',
        items: [
          'utils/relations.js：新增 DEFAULT_RELATIONSHIP_SCORE=5；createRelation(data, opts) 仅当 opts.trustScore===true 才采信 data.relationship_score，否则落默认值；updateRelation(id, updates, opts) 缺省时跳过 relationship_score（其余字段照常更新）',
          'store/executors/relation.js：execCreateRelation 回报「未采信亲密度 X」；execUpdateRelation 只请求改分时直接拒绝（不写库），同时传其他字段时剥离分数、detail.updated_fields 不再包含它，并回报「亲密度未改」',
          'pages/settings/sub/relations.vue 与 relation-detail.vue：手动建卡/编辑三处传 { trustScore: true } —— 这是亲密度唯一的合法写入路径',
          'AI 未获得任何改分 action：不给新建「set_relationship_score」，也不把内置更新变成可改分（避免模型自称用户授权即生效）'
        ]
      },
      {
        title: '提示词收口',
        items: [
          'utils/ai/prompt-builder.js extSection：create_relation / update_relation 的 JSON schema 去掉 relationship_score（有数据与无数据两个分支）',
          'utils/ai/tools/relation.js：create_relation 工具 schema 删除该字段，描述补「亲密度由用户自己在关系页评价，不要传分数」',
          'utils/ai/prompt-actions.js BEHAVIOR_RULES：新增「亲密度只能由用户自己评价，禁止 AI 设置/修改，用户要求时引导到详情页滑块」与「现存分数来源未必可追溯，禁止断言用户评价过」两条',
          'utils/relations.js buildRelationsContext：两类关系上下文标题都带上「亲密度是现存记录值，来源未必可追溯，不要据此断言用户评价过；你也不能修改它」'
        ]
      },
      {
        title: '顺带修复',
        items: [
          'utils/relations.js updateRelation 白名单补 last_interaction：此前不在白名单，logInteraction 的 last_interaction 更新被静默丢弃（关系图谱久未联系/7 天内互动统计失真）',
          '执行器 update_relation 的字段白名单维持不含 last_interaction，AI 改不到该记账字段（测试锁定）'
        ]
      },
      {
        title: '测试',
        items: [
          'tests/relation-score-governance.test.js（新增 17 例）：AI 建卡传分被忽略且回报未采信 / 不传走默认 / 只请求改分被拒 / notes+分只写 notes（额外验收 1）/ 普通更新不受影响 / utils 层不带 trustScore 写不进（额外验收 2）/ 带 relation_id 别名写不进 / AI 改不到 last_interaction / UI 建卡与编辑可写分 / 单次带情绪互动不改分 / 提示词不含该字段 / 关系上下文含来源说明 / 两条行为准则存在 / 增删改查与软删除回归',
          'utils/ai/eval/cases.js 新增语料 relation-score-not-ai-writable（要求改亲密度 → forbid update_relation + 禁止谎称已改），语料总数 35 条',
          '相邻回归：AI 三件套（action-schema-consistency + module-exports + ai-eval 三个文件）+ relation-ambiguity + social-quota + simulation-prompts + prompt-builder + ai-features + bugfix-regression 共 11 文件 148 例全绿'
        ]
      }
    ]
  },
  {
    version: '4.37.0',
    date: '2026-10-19',
    title: '人脉互动不再猜人：同名/模糊多候选只返回候选不写入，确认后按 relation_id 落库',
    summary: [
      '旧实现按姓名匹配后直接取 matched[0]：同名两人或模糊命中多人时，一次真实互动会被记到错的人名下，污染后续画像、关系分析与 AI 建议，且用户很难发现',
      '匹配拆三层：findRelationsByExactName（严格相等，同名返回全部）/ findRelationCandidates（**只匹配姓名**，不看 context 与 tags）/ resolveInteractionTarget（只读不写，返回 resolved/ambiguous/none）',
      '执行器歧义时返回 needChoice + 候选（含 id、角色、场景），一条互动都不写；无匹配保持原有「关系卡片不存在」提示；唯一精确/唯一模糊匹配照旧直接写入（兼容旧行为）',
      'agent-loop 把目标解析提到确认卡之前：解析成功则把 relation_id 写回参数（确认卡与最终写入用同一个 ID），歧义与未找到不挂起确认、改为把候选回传模型由用户确认',
      '工具描述与 CORE_ACTIONS 同步加约束「匹配到多人禁止猜第一个」；单字关键词不做模糊候选（噪声保护，避免把场景词/单字当人名）；新增 tests/relation-ambiguity.test.js 18 例，全量 112 文件 / 1521 用例全绿'
    ],
    categories: [
      {
        title: '人脉匹配',
        items: [
          'utils/relations.js：新增 findRelationsByExactName / findRelationCandidates / briefRelation / resolveInteractionTarget；findRelationsByName 保留给 query_relation 关键词检索（姓名+场景+标签）',
          'resolveInteractionTarget 规则：有效 relation_id 优先 → 精确唯一 → 精确同名歧义 → 模糊唯一（兼容） → 模糊多个歧义 → 未找到；ID 失效时退回按姓名解析；软删除由 getAllRelations 过滤，不参与候选',
          'briefRelation 只带 id/name/role/context/tags(≤3)/last_interaction/score，控制回传给模型的体积'
        ]
      },
      {
        title: '写入链路',
        items: [
          'store/executors/relation.js 的 execLogInteraction：歧义 → { success:false, needChoice:true, detail.candidates }，不调用 logInteraction；无匹配 → 保留「关系卡片不存在，请先创建该人脉」文案',
          'utils/ai/tools/executor.js：log_interaction 在确认闸门之前解析目标；歧义/未找到直接 ok:false（不带 confirm，不给确认卡），解析成功则把 relation_id 写进 args，后续确认卡 payload 与写入共用同一 ID',
          'utils/ai/agent-loop.js：pendingCalls 收集阶段先解析 log_interaction 目标，非 resolved 的跳过挂起（落到写入循环由 executeTool 回传候选），resolved 的把 id 写进确认卡参数',
          'utils/ai/tools/relation.js 与 prompt-builder 的 CORE_ACTIONS：description/说明补「匹配到多人禁止猜，先让用户确认再用 id 重调」'
        ]
      },
      {
        title: '测试',
        items: [
          'tests/relation-ambiguity.test.js（新增 18 例）：id 优先 / id 失效不误配 / 精确唯一 / 同名歧义候选齐全 / 模糊唯一兼容 / 模糊多个歧义 / 精确与模糊函数分工 / 场景词标签词不算人名 / 单字不做模糊候选 / 歧义双方零写入 / 无匹配不产生孤立互动 / 软删除不入候选 / 候选选中后按 id 落到正确人名下 / 单人照旧成功 / executeTool 歧义文本带 id 且不给确认卡 / executeTool 成功时 payload 已注入 relation_id',
          '回归：bugfix-regression 的按姓名记录与未知人名错误文案全部保持通过'
        ]
      }
    ]
  },
  {
    version: '4.36.0',
    date: '2026-10-19',
    title: '个人画像真正进入每轮对话：600 字预算摘要 + 字段优先级 + 修掉画像关闭仍过滤记忆的开关不一致',
    summary: [
      '画像卡此前从不进 AI 上下文：buildProfileContext 在 prompt-builder 里只 import 未调用（全仓零调用点），每轮注入的「用户近期数据」只是支出/记录/计划概览，不含画像任何字段',
      '新增 buildProfileContextBrief：只取 portrait 卡的关键字段，最终输出 ≤ 600 字符（标题+正文+尾注一起算），单字段超 60 字截断，白名单 22 个字段按优先级占预算，未登记字段自动兜底排序',
      '冲突语义修正：不再声明「以本摘要为准」，改为「稳定性内容可长期沿用；职业/作息/目标/关系状态等可变信息，若与更近期的记录冲突以更近期的记录为准」',
      'lite 档不按模式名打折：lite 的判据是「无指令动词 + 无金额 + 长度≥4」，恰好覆盖情绪倾诉与自我认知类消息（最需要画像），而它省下的是 CORE_ACTIONS 的 3.5k 字符',
      '修开关不一致：getProfileValues 不看 enabled，导致关掉画像后记忆仍被画像字段静默过滤；现改为关闭时返回空数组（调用方每轮记忆注入 + 月结，均为去重用途）',
      '删死代码：buildProfileContext（全量拼接、无预算）与 prompt-builder 的死导入一并移除；新增 tests/profile-injection.test.js 12 例，全量 111 文件 / 1503 用例全绿'
    ],
    categories: [
      {
        title: '画像注入',
        items: [
          'utils/profileContext.js：删除 buildProfileContext；新增 PROFILE_BRIEF_FIELDS（key/label/order 三列分离，中英键并存）、PROFILE_BRIEF_MAX_CHARS=600、PROFILE_FIELD_MAX_CHARS=60、buildProfileContextBrief(opts)',
          '预算拆分：overhead = 标题 + 尾注 + 两个换行，正文只在剩余预算内按行累加；超预算整行跳过（不半截截断），保证保留字段完整可读；返回 { text, chars, dropped, fields }',
          'utils/ai/chat-helpers.js：在「用户近期数据」之后、记忆上下文之前接入 buildProfileContextBrief()，仅画像 enabled 时注入',
          'utils/ai/prompt-builder.js：移除 buildProfileContext 死导入；utils/profile.js 的 re-export 改为导出新函数与常量'
        ]
      },
      {
        title: '记忆过滤',
        items: [
          'utils/memory/profile-values.js：getProfileValues 增加 enabled 门（false 时返回 []），修「关闭画像仍按画像字段过滤记忆」的语义不一致',
          '影响面已核：调用方只有 memory/context.js（每轮记忆注入）与 memory/monthly.js（月结去重），关闭画像后放开过滤符合预期'
        ]
      },
      {
        title: '测试',
        items: [
          'tests/profile-injection.test.js（新增 12 例）：开关关闭不注入 / 空画像不报错 / 只有非 portrait 卡不注入 / 总长 ≤600 / 多字段裁剪时高优先级字段保留 / 单字段截断带省略号 / maxChars 可注入 / 冲突语义措辞 / lite 与完整档长度一致 / 注入位置在数据概览之后 / 记忆过滤随开关变化',
          '断言对象是 buildChatMessages 的 messages[0].content，防「函数写对但没接上」的回归'
        ]
      }
    ]
  },
  {
    version: '4.35.2',
    date: '2026-10-19',
    title: '后台常驻插件补上原生模块入口：HBuilderX 打包校验拒绝空 plugins，签名全部经基座 dex 实证',
    summary: [
      '4.35.0 的空 plugins 数组被 HBuilderX 打包校验拒绝（「_dp_nativeplugin.android.plugins 节点下存在为空的对象」）；从校验器源码（plugins/uniapp-extension/out/index.js）确认硬性要求：plugins 非空且每条必须有 type(module/component)/name/class',
      '新增 SijiKeepAliveModule：@UniJSMethod 的 start/stop/isRunning，成为 uni.requireNativePlugin 正路入口；JS 侧模块优先、plus.android 反射降级为兜底（双路径打同一个 Service）',
      'DCloud API 签名全部从本机 HBuilderX 标准基座（android_base.apk）的 dex 逐字节实证，不走教程印象：mUniSDKInstance 声明在 WXModule 上且类型是 AbsSDKInstance（不是 UniSDKInstance）、getContext 直接声明在 AbsSDKInstance 接口上',
      '无 uniapp SDK 也能编译：native/keepalive/stubs/ 六个同 FQN stub 只进 classpath 不进 aar；构建脚本新增 stub 编译阶段 + 泄漏闸门（classes 出现 com/siji/keepalive 之外的类即终止）+ 产物复核（模块类与服务类必须在 aar 内）',
      'javap 字节码复核通过（superclass / getfield 描述符 / RUNTIME 注解 / fastjson 方法签名）；AAR 4KB→5.6KB；tests/keepalive.test.js 15→21 例；全量 110 文件 / 1491 用例全绿'
    ],
    categories: [
      {
        title: '原生插件（合法性修复）',
        items: [
          'native/keepalive/src/main/java/com/siji/keepalive/SijiKeepAliveModule.java（新增）：extends UniModule，start(JSONObject,UniJSCallback)/stop(UniJSCallback)/isRunning(UniJSCallback) 三个 @UniJSMethod；mUniSDKInstance.getContext() 拿 Context，new Intent(ctx, Service.class) 显式类引用；异常全部 catch 回传 JS 不崩',
          'native/keepalive/src/main/java/com/siji/keepalive/SijiKeepAliveService.java：补静态 running 标志（onCreate 置 true / onDestroy 置 false）+ isRunning() 供模块查询',
          'nativeplugins/siji-keepalive/package.json：plugins 从 [] 改为 [{type:module, name:siji-keepalive, class:com.siji.keepalive.SijiKeepAliveModule}]，version 1.0.0→1.1.0',
          'nativeplugins/siji-keepalive/android/siji-keepalive.aar：重构建（5.6KB，含模块类+服务类，无 stub 泄漏）'
        ]
      },
      {
        title: 'stub 编译体系（本仓库无 uniapp SDK）',
        items: [
          'native/keepalive/stubs/（新增 6 个文件）：com/taobao/weex/common/WXModule（public AbsSDKInstance mUniSDKInstance）、io/dcloud/feature/uniapp/common/UniModule、io/dcloud/feature/uniapp/AbsSDKInstance（接口，Context getContext()）、annotation/UniJSMethod（RUNTIME retention）、bridge/UniJSCallback（invoke/invokeAndKeepAlive）、com/alibaba/fastjson/JSONObject（无参构造/getString/put）——全部从基座 dex 实证后落 stub',
          'scripts/build-keepalive-aar.ps1：4.35.2 重写 —— stub 编译到独立目录只进 classpath；泄漏闸门（插件 classes 只允许 com/siji/keepalive）；AAR 复核（模块类与服务类必须存在）；BOM 提醒（PS 5.1 无 BOM 按 GBK 读会打断语法）',
          '验证方法（可复现）：解 android_base.apk 的 classes*.dex → node dex-classdef.mjs 解析 class_def/field_ids/method_ids → 对照 javap -v 的描述符'
        ]
      },
      {
        title: 'JS 双路径',
        items: [
          'utils/keepalive.js：新增 MODULE_NAME 与模块探测缓存；startKeepAlive/stopKeepAlive 先走 uni.requireNativePlugin（只在类探测通过后才碰，标准基座零接触），同步抛错落反射兜底；异步回执只记日志不重试（权限拒绝时两条路径同样失败）；原反射实现保留为 startKeepAliveByReflection/stopKeepAliveByReflection',
          'tests/keepalive.test.js：新增「模块路径」组 6 例 —— start/stop 走模块、文案兜底、回调失败不影响返回值、requireNativePlugin 缺失/抛错/缺方法时的兜底行为、syncKeepAlive 三态'
        ]
      }
    ]
  },
  {
    version: '4.35.1',
    date: '2026-10-19',
    title: '打断提醒模块循环依赖：Push 探测抽成叶子模块，动态 import 全部改静态',
    summary: [
      '消掉 HBuilder 构建日志里的两条警告（notifier / push-schedule 既被动态又被静态引用）—— 根因是 notifier → push-schedule → scheduler → notifier 的循环依赖',
      '新增 utils/reminder/push-probe.js（只依赖 logger 的叶子模块）：widgetHasPush + probePushModule 从 push-schedule 搬出，push-schedule 用 re-export 保持旧引用可用',
      'notifier 的 plus.push 探测改静态引用；PlanReminderSection.vue 的 ensureNotifyPermission 从动态 import 改静态（notifier 本就在同一 chunk，动态写法不省分包）',
      '新增 tests/reminder-module-cycle.test.js：依赖图无环 + push-probe 叶子不变量 + 提醒链路无动态 import 三条守卫',
      '逻辑与 4.29.3 真机修复版逐字一致，无用户可见行为变化；全量 110 文件 / 1485 用例全绿'
    ],
    categories: [
      {
        title: '提醒模块依赖整理',
        items: [
          'utils/reminder/push-probe.js（新增）：widgetHasPush / probePushModule / __resetPushProbeCache，只 import logger，探测结果进程内缓存',
          'utils/reminder/push-schedule.js：删掉本地探测实现与 pushModuleAvail 缓存，改为 import + re-export（旧引用 `from push-schedule` 不用改）',
          'utils/reminder/notifier.js：`import(\'@/utils/reminder/push-schedule.js\').then(...)` 改静态 `import { probePushModule } from \'./push-probe.js\'`，触发路径少一层 Promise',
          'components/plan/PlanReminderSection.vue：requestNotify 里的动态 import 改静态 import（顶部 ensureNotifyPermission）',
          'manifest.json：versionName 4.35.1 / versionCode 4351（文件被 HBuilderX 重新格式化为 4 空格 + `"key" : value`，diff 变大但无字段变化）'
        ]
      },
      {
        title: '测试',
        items: [
          'tests/reminder-module-cycle.test.js（新增，5 例）：utils/reminder/ 静态依赖图无环、push-probe 只依赖 logger、notifier 不再依赖 push-schedule/scheduler、push-schedule re-export 仍在、提醒链路无 `import(` 动态导入'
        ]
      }
    ]
  },
  {
    version: '4.35.0',
    date: '2026-10-19',
    title: 'Android 后台常驻：前台服务原生插件 + 提示与提醒页后台运行开关',
    summary: [
      '新增原生插件 nativeplugins/siji-keepalive（4KB AAR）：Android 前台服务 + 常驻通知，退后台/从最近任务划掉后进程不再被立刻回收',
      '构建不依赖 Android Studio / Gradle / uniapp 插件 SDK —— 纯 Java 源码 + android.jar 用 javac 编译，scripts/build-keepalive-aar.ps1 一条命令出 AAR',
      '设置 - 提示与提醒新增「后台运行」组（App 端）：后台常驻开关 + 电池优化放行入口；开关存 siji_keepalive_enabled，默认关',
      '插件没打进包（标准基座/旧包）时静默降级、启动不崩；App.vue 在 appReady 与 onShow 各同步一次服务状态',
      '新增 tests/keepalive.test.js；真机验证项登记进 docs/真机验证清单.md，方案与打包步骤见 docs/后台保活方案.md'
    ],
    categories: [
      {
        title: '后台常驻（原生插件）',
        items: [
          'native/keepalive/src/main/java/com/siji/keepalive/SijiKeepAliveService.java（新增）：前台服务，START_STICKY 自重启、stopWithTask=false 划任务不停、通知渠道 siji_keepalive（IMPORTANCE_LOW、不响不震、点通知回 App）',
          'native/keepalive/src/main/AndroidManifest.xml（新增）：声明 service + FOREGROUND_SERVICE / FOREGROUND_SERVICE_SPECIAL_USE / POST_NOTIFICATIONS，foregroundServiceType=specialUse（dataSync 在 Android 15 有 6 小时/24 小时上限）',
          'nativeplugins/siji-keepalive/package.json（新增）：本地原生插件描述，integrateType=aar、minSdkVersion=21、无 UniModule（plugins 为空数组）',
          'nativeplugins/siji-keepalive/android/siji-keepalive.aar（构建产物，4KB）：classes.jar + AndroidManifest.xml',
          'scripts/build-keepalive-aar.ps1（新增）：定位 android.jar → javac(-source/-target 8) → jar → zip 出 AAR；JDK 8/17 都吃',
          '文档 docs/后台保活方案.md（新增）：可行性边界、构建/打包步骤、Android 14+ 类型选择、Store 审核口径、真机验证清单'
        ]
      },
      {
        title: 'JS 封装与接入',
        items: [
          'utils/keepalive.js（新增）：isKeepAliveOn/setKeepAliveOn（键 siji_keepalive_enabled）、isKeepAliveSupported（plus.android.importClass 探测 + 结果缓存）、startKeepAlive（API 26+ startForegroundService）、stopKeepAlive（stopService）、syncKeepAlive（按开关幂等同步）、openBatteryOptimizationSettings（ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS，兜底应用详情页）',
          'App.vue：appReady 与 onShow 各调一次 syncKeepAlive（try/catch 兜住，插件缺失不影响启动）',
          'manifest.json：app-plus.nativePlugins 注册 siji-keepalive + 补 FOREGROUND_SERVICE / FOREGROUND_SERVICE_SPECIAL_USE 权限 + versionName 4.35.0 / versionCode 4350'
        ]
      },
      {
        title: '设置页',
        items: [
          'pages/settings/sub/notify.vue：新增「后台运行」组（#ifdef APP-PLUS）：后台常驻开关（含 keepAliveSupported 置灰态说明）+ 允许后台运行（电池优化引导）+ 深色配套 .np-row-tap/.np-arrow'
        ]
      },
      {
        title: '测试',
        items: [
          'tests/keepalive.test.js（新增）：开关归一、shouldStartKeepAlive 双条件、buildStartSpec（类名/action/文案兜底）、androidMajorVersion、开关读写、插件缺失时的四条降级路径',
          '真机项：常驻通知是否出现、划掉最近任务后 60s 轮询是否还在跑、特殊 ROM 是否需要电池白名单（docs/真机验证清单.md）'
        ]
      }
    ]
  },
  {
    version: '4.34.0',
    date: '2026-10-18',
    title: '人脉页改版：砍ECharts力导向图，改分组卡片+最近互动',
    summary: [
      '砍掉 relation-graph 页的 ECharts 力导向图（H5下黑块渲染失败）',
      '新设计：顶部概览数字 + 按家人/伴侣/朋友/工作/师长分组卡片',
      '每人显示首字头像+名字+context+tags+上次互动距今几天',
      'role 归一化映射：母亲/父亲自动归入家人，女友归入伴侣等',
      '深色模式适配，零阴影零渐变纯Zinc灰阶'
    ],
    categories: [
      {
        title: '人脉',
        items: [
          'pages/settings/sub/relation-graph.vue 整体重写，删除 RelationGraphECharts 依赖',
          'pages/settings/sub/relation-graph.scss 整体重写',
          '新增顶部概览行：总人数/7天内互动/平均亲密度',
          '新增 role 归一化映射 ROLE_GROUPS，把具体角色归到5大类',
          '人物卡片：80rpx首字头像 + 名字 + context+tags + 距今时间',
          '超30天未联系的人头像变灰、时间文字变红'
        ]
      }
    ]
  },
  {
    version: '4.33.4',
    date: '2026-10-18',
    title: '画像按钮颜色加深、图标放大、间距收紧',
    summary: [
      '按钮图标从低 opacity 灰改为固定深灰 #52525B/#71717A，颜色更清晰',
      '字段行图标 16→20、卡片头 18→22，视觉尺寸再放大',
      '按钮热区从 48rpx 收到 40rpx、padding 10→6rpx、按钮间距 gap 4→2rpx，整体更紧凑',
    ],
    categories: [
      {
        title: 'UI 调整',
        items: [
          'pages/settings/sub/profile.scss：.field-edit/.field-clear/.card-edit-btn/.card-delete/.card-collapse 去掉 opacity 改 color: #52525B/#71717A；min 48rpx→40rpx；padding 10rpx→6rpx；.field-actions gap 4rpx→2rpx',
          'pages/settings/sub/profile.vue：SijiIcon size 16→20（字段行）、18→22（卡片头），加 color 属性固定色',
        ],
      },
    ],
  },
  {
    version: '4.33.3',
    date: '2026-10-18',
    title: '画像页小按钮热区扩大到 48rpx，图标同步放大',
    summary: [
      '字段行铅笔/删除按钮、卡片头部编辑/删除/折叠箭头热区统一扩到 48rpx 最小触控尺寸',
      'chip 删除按钮热区扩到 36rpx',
      '图标尺寸同步放大：字段行 12→16，卡片头部 14/16→18',
    ],
    categories: [
      {
        title: 'UI 调整',
        items: [
          'pages/settings/sub/profile.scss：.field-edit/.field-clear/.card-edit-btn/.card-delete/.card-collapse 统一加 display:flex + min-width/min-height 48rpx + padding 10rpx；.chip-remove 加 min 36rpx',
          'pages/settings/sub/profile.vue：SijiIcon size 从 12→16（字段行）、14/16→18（卡片头部）',
        ],
      },
    ],
  },
  {
    version: '4.33.2',
    date: '2026-10-18',
    title: '画像卡片标题行只读，折叠/展开收敛到右侧箭头',
    summary: [
      '点"我的画像"标题文字不再误触折叠，标题行默认只读',
      '折叠/展开操作收敛到右侧 chevron 箭头按钮，明确可点区域',
      '自定义卡片的标题编辑仍走右侧铅笔按钮，入口不变',
    ],
    categories: [
      {
        title: '交互调整',
        items: [
          'pages/settings/sub/profile.vue：card-header 去掉整行 @tap，card-title-wrap 去掉 @tap.stop="handleTitleTap"，card-collapse 加 @tap.stop="toggleCard(card.id)"',
        ],
      },
    ],
  },
  {
    version: '4.33.1',
    date: '2026-10-18',
    title: '画像字段防误触：已填值默认只读，点正文不弹编辑框',
    summary: [
      '已填值字段点击正文不再触发编辑，避免阅读画像时误触弹输入框',
      '右侧新增小铅笔按钮才触发编辑，删除按钮保留在铅笔旁',
      '空字段（"点击填写"）保持原交互，点击直接进入填写',
    ],
    categories: [
      {
        title: '交互调整',
        items: [
          'pages/settings/sub/profile.vue：三处 field-display 的 @tap 从"整行触发"改为"仅空值触发"（!value && startEditField），有值字段右侧包一层 field-actions，内含 field-edit 铅笔按钮与 field-clear 删除按钮',
          'pages/settings/sub/profile.scss：新增 .field-actions（flex+gap 4rpx）与 .field-edit（padding 8rpx、opacity 0.4），与 .field-clear 同尺寸小图标',
        ],
      },
    ],
  },
  {
    version: '4.33.0',
    date: '2026-10-18',
    title: '删除"基本信息/生活方式"两张固定卡，字段并入"我的画像"',
    summary: [
      '我的信息页从三张固定卡收敛为一张"我的画像"卡：昵称/性别/生日/职业/所在地/简介/预算/作息/爱好/饮食全部归入画像卡，平铺在三层分组下方',
      '一次性迁移：老用户刷新后，basic/lifestyle 两张卡自动消失，已填值合并进 portrait（标量不覆盖、数组去重合并），不丢数据',
      '记忆自动采纳（suggestProfileAdoption）目标从 basic/lifestyle 统一改为 portrait，AI 抽取的事实/偏好直接写画像卡',
      'addArrayItem 字段不是数组时自动初始化为空数组再追加，行为更健壮；画像卡改为不可删除',
    ],
    categories: [
      {
        title: '数据结构',
        items: [
          'utils/profile.js：createEmptyProfile 默认 cards 从 [basic, lifestyle] 改为 []（portrait 由 profile-seed 注入）',
          'utils/profile.js：新增 migrateLegacyCards(data)，把 basic/lifestyle 卡字段 merge 进 portrait（数组用 Set 去重、标量仅空值才写），merge 完 filter 删除这两张卡',
          'utils/profile.js：getProfile 里"确保 basic/lifestyle 存在"的自动补卡逻辑改为调用 migrateLegacyCards；deleteCard 守卫从 basic/lifestyle 改为 portrait',
          'utils/profile.js：addArrayItem 在 card.fields[field] 不是数组时初始化为 [] 再追加',
        ],
      },
      {
        title: '记忆联动',
        items: [
          'utils/memory/profile-link.js：FACT_RULES（9条）与 PREF_RULES（2条）的 cardId/cardTitle 从 basic/生活方式、lifestyle/基本信息统一改为 portrait/我的画像',
        ],
      },
      {
        title: '测试适配',
        items: [
          'tests/memory-profile.test.js：seedProfile helper 改为确保 portrait 卡存在；所有 lifestyle/basic 引用改为 portrait',
          'tests/memory-governance.test.js：seedProfileField helper 从 lifestyle 改为 portrait，不存在则新建',
        ],
      },
    ],
  },
  {
    version: '4.32.0',
    date: '2026-10-18',
    title: '关系图谱入口内联到标题行 + 内置画像字段重构（补"我怎么做"三层）',
    summary: [
      '关系图谱入口从独立卡片移到"个人信息"标题右边，灰色小胶囊"♡ 关系图谱·N人"，节省一屏高度',
      '内置画像卡字段从 9 个扩到 12 个，与三层分组完全对齐：新增"我怎么做"层（行动原则/产品意识/创业潜力）',
      'ensureProfileSeed 的卡写入逻辑从"存在即跳过"改为 merge：老用户刷新后自动补全新字段，已填的自定义值不被覆盖',
      'seed_v 从 1 bump 到 2，记录内容同步刷新；人生关键词扩为"不要后悔；回头看时不觉得白活了"',
    ],
    categories: [
      {
        title: 'UI 调整',
        items: [
          'pages/settings/sub/profile.vue：删除独立 relations-entry 卡，header-title 行内加 rel-link 小胶囊（心形图标 + "关系图谱·N人"），v-if="enabled" 且 @tap.stop 跳关系图谱',
          'pages/settings/sub/profile.scss：新增 .header-title-row（flex+gap 12rpx）与 .rel-link（22rpx 字、#71717A 字、#F4F4F5 底、20rpx 圆角），深色双通道补 .rel-link { background:#3F3F46; color:#A1A1AA }',
        ],
      },
      {
        title: '内置画像重构',
        items: [
          'utils/storage/profile-seed.js：PROFILE_CARD_FIELDS 从 9 字段扩到 12 字段，按三层分组重排；新增行动原则（以成果为单位/不等待动力/做项目接触用户）、产品意识（先调研需求/从会调用 AI 到能做 AI 系统）、创业潜力（技术壁垒→副业→条件成熟再创业，不裸辞）',
          'ensureProfileSeed 卡写入逻辑改为 merge：卡不存在则新建；已存在则遍历 PROFILE_CARD_FIELDS，只补"缺失或空"的字段，用户已填的非空值不覆盖，并更新 card.updatedAt',
          'PROFILE_SEED_VERSION 从 1 bump 到 2，老用户刷新后自动获得新字段且不丢手改内容',
        ],
      },
    ],
  },
  {
    version: '4.31.0',
    date: '2026-10-18',
    title: '我的信息升级：画像三层分组 + 完整度进度条 + 人生六维概览 + JSON 导出',
    summary: [
      '画像卡字段按「我是谁 / 我要去哪 / 我怎么做」三层分组渲染（参考 Replika、Serenity 人生领域划分），不再 12 字段平铺',
      '顶部开关卡显示完整度百分比与细进度条（已完善 X%，已填/总项）',
      '新增人生六维概览条：职业/财务/家庭/感情/成长/健康，已填实色、未填灰点',
      '底部新增「导出画像 JSON」按钮（H5 下载文件，App/MP 复制到剪贴板），解决 localStorage 换机丢失',
    ],
    categories: [
      {
        title: '我的信息页面',
        items: [
          'pages/settings/sub/profile.vue：新增 PROFILE_GROUPS 三层映射、groupCardFields 分组函数、cardGroups 预计算、LIFE_DIMENSIONS 六维 computed、totalFields/fillPercent 完整度、handleExport 导出函数；模板按分组渲染（hasGroups 分支 vs 平铺分支）、顶部进度条、六维概览条、底部导出按钮',
          'pages/settings/sub/profile.scss：新增 .progress-wrap/.progress-bar/.progress-fill、.life-wheel/.lw-title/.lw-dims/.lw-dim/.dot/.lw-label、.field-group/.group-label、.btn-secondary 浅色样式，深色双通道（H5/App html.theme-dark + MP @media）同步补齐',
        ],
      },
    ],
  },
  {
    version: '4.30.0',
    date: '2026-10-18',
    title: '提示体系收敛：删每日小结卡、计划汇总表改版（今日焦点 + 折叠 + 可关）、提示开关落地',
    summary: [
      '删掉聊天页顶部「每日小结」横条 —— 它讲的今日记录/支出/进行中/打卡，在计划汇总表与简报卡里都有更细的版本，留着就是同一件事说两到三遍',
      '计划汇总表改版：新增「今日焦点」置顶（逾期最久 1 条 + 今天/明天/3 天内到期，最多 4 条）；「今天/明天」独立成组并默认展开，其余分组折叠；统计头从 4 格收成 2 个大数字（已过期 / 今天明天）+ 一行小字；删掉优先级色条（与行内圆点信息重复）；新增本周打卡迷你条',
      '简报卡减行：计划状态从三行（1 行过时 + 最多 2 行快到期）合并成一句「计划：N 项已过期 · M 项快到期」，点名与动作交给汇总表与「看计划」按钮；指标格去掉「连续打卡」格',
      '新增「提示与提醒」页（pages/settings/sub/notify）：计划汇总表 / 进入简报卡 / 应用内提醒 / 应用外通知四个开关，全部并入既有 siji_reminder_settings（不新增存储键）；计划汇总表内也给了「不再自动弹出」与「提示设置」直通入口',
      '计划速览面板新增「查看计划汇总」—— 关掉每日自动弹出后，汇总表仍可从聊天页顶部计划按钮打开',
    ],
    categories: [
      {
        title: '计划汇总表改版',
        items: [
          'utils/plan-summary.js：`buildPlanSummary` 返回新增 `focus`（今日焦点）/ `weekBar`（本周打卡条）/ `stats.todayTodo`；`groups` 插入 `today`（已过期 → 今天/明天 → 进行中 → 待开始 → 已完成）；删除 `priorityBar`；新增导出 `FOCUS_LIMIT = 4` 与 `DUE_SOON_DAYS`（复用 utils/plan-alerts.js 同口径）',
          'utils/plan-heatmap.js：新增 `weekCheckinDays(plans, now)` 返回 7 个逐日标记；抽出 `weekCheckinScan` 让 `weekCheckinSummary` 与它共用同一次扫描（口径单一来源，原返回值 `{ times, days }` 不变，旧断言无需改）',
          'components/plan/PlanSummarySheet.vue：今日焦点区（tag + 色点 + 直达详情）/ 两个大数字 + 一行小字 / 分组折叠（默认只展开「已过期」「今天/明天」，其余点开才展开）/ 本周打卡迷你条 / 底部「不再自动弹出」「提示设置」；emit 新增 `disable-auto`、`open-notify`；深色双通道（H5/App `html.theme-dark`，小程序 `#ifdef MP-WEIXIN` 内 @media）',
        ],
      },
      {
        title: '提示收敛',
        items: [
          'pages/chat/index.vue：删除每日小结卡（import / ref / onShow 分支 / 模板 / 样式全清）；`injectEnterSummary` 接 `briefing` 开关；`maybeShowPlanSummary` 接 `summarySheet` 开关（延迟回调里二次确认）；新增 `disablePlanSummaryAuto` / `openNotifySettings` / `openSummaryFromSheet`；计划速览面板加「查看计划汇总」入口',
          'utils/enter-dialogue.js：`buildPlanAlertLines` 由「逐条点名」改为合并成一句（同时删除只服务于它的 `ALERT_LINE_LIMIT`）；`buildBriefingMetrics` 去掉「连续打卡」格',
          'composables/useDailyBrief.js：整文件删除（`siji_daily_brief_day` 不再写入；已有该键的存量数据不影响任何逻辑）',
        ],
      },
      {
        title: '提示开关',
        items: [
          'utils/reminder/settings.js：新增 `PROMPT_FLAG_DEFAULTS`（summarySheet / briefing / reminderToast，默认全开）、`getPromptFlag(key)`、`setPromptFlag(key, on)`；开关并入 `siji_reminder_settings` 的 `prompts` 字段，只认显式 false 为关，存储异常一律回落「开」',
          'utils/reminder/notifier.js：`showReminderToast` 接 `reminderToast` 开关 —— 4.29.3 把应用内提醒改 toast 时漏掉的开关',
          'pages/settings/sub/notify.vue（新增）+ pages.json 注册：分「进入聊天页」「计划到点」两组，含应用外通知总开关（`siji_reminder_settings.enabled`，此前无任何 UI）',
        ],
      },
      {
        title: '测试',
        items: [
          'tests/plan-summary.test.js：新增「今日焦点排序与上限」「今天/明天成组并从进行中待开始移出」「本周打卡条逐日标记与次数的同一口径」「空数据」四例；原优先级色条用例改为只断言统计分布与行内圆点',
          'tests/enter-dialogue.test.js：状态行断面对齐「计划：3 项已过期 · 1 项快到期」；指标格断言改为 `expense / diary / events`',
        ],
      },
    ],
  },
]
