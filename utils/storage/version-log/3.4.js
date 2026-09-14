/**
 * 版本日志数据段：3.4.5 - 3.4.0（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V34 = [
  {
    version: '3.4.5',
    date: '2026-09-09',
    title: '3.4.5 进入总结：冷启动新进展卡片（计划完成 + 打卡 + 新增记录）',
    summary: [
      '冷启动触发：仅 App.vue appReady 时计算一次（方案 B，前台恢复不重复弹）；composables/useEnterSummary.js 持有模块级 pending，siji_enter_summary_at 记录确认基线，点「知道了/查看详情」后推进基线，同批事件不重复出现',
      '纯逻辑口径：utils/enter-summary.js buildEnterSummary 聚合基线以来计划的 executions(done) 与 checkins 事件（倒序、上限 6 条）及跨月新增记录数量；formatSummaryTime 输出 今天/昨天/日期 标签',
      '首页卡片：pages/chat/index.vue 导航下新增总结卡（纯黑白灰、深浅色适配），最多展示 3 条进展 + 剩余条数 + 新增记录数；「查看详情」有进展跳计划执行记录页、只有记录时跳记录列表',
      '首次升级静默武装：无基线时间时写入当前时间不弹历史数据，避免升级后老数据一次性全量弹出；有内容才挂卡，空窗口自动推进基线避免重复扫描'
    ],
    categories: [
      {
        title: '触发与去重 3.4.5',
        items: [
          'App.vue appReady 内调用 initEnterSummary（仅在冷启动执行一次）',
          'siji_enter_summary_at 基线：首启武装 / 空窗口推进 / 确认后推进',
          '模块级 pending 单例：聊天页展示，跨页面切换不重复计算'
        ]
      },
      {
        title: '数据口径 3.4.5',
        items: [
          'utils/enter-summary.js：计划完成（executions done）+ 打卡（checkins）+ 跨月新增记录',
          'is_deleted 计划与记录排除，事件窗口按 at/created_at 过滤并倒序',
          '事件列表上限 6 条，eventsTotal 保留真实总数供「还有 N 项」展示'
        ]
      },
      {
        title: '界面 3.4.5',
        items: [
          'pages/chat/index.vue：summary-card 位于导航下、消息列表上方，不打断会话',
          '完成/打卡/记录三类灰阶标识 + 深浅色适配（chat.scss）',
          '查看详情跳转 /pages/plan/records 或 /pages/diary/list'
        ]
      },
      {
        title: '测试',
        items: [
          'tests/enter-summary.test.js：窗口过滤/删除排除/条数上限/跨月记录/时间标签共 8 用例',
          'tests/version-history.test.js：默认数据首条升级为 3.4.5'
        ]
      }
    ]
  },
  {
    version: '3.4.4',
    date: '2026-09-09',
    title: '3.4.4 聊天对话优化：发送状态行 + 轻追问稳定 + H5 粘贴图片 + AI 气泡操作',
    summary: [
      'P1 发送中状态行：发送期间输入区上方显示「正在思考/正在回复… + 计时」，流式开始自动切换状态，停止/结束后立即消失（composables/useChatEngine.js sendStage/sendElapsedMs + pages/chat/index.vue sending-strip）',
      'P2 轻追问 chips 稳定：新增 utils/ai/chat-suggestion.js 本地兜底生成（账单→再记一笔/计划→排进我的计划等，禁止评价式、催促式、问心情的伪建议），JSON 与纯文本回复路径都会输出 suggestions，各厂商回复后 chips 不再随机缺失',
      'P3 H5 粘贴图片识别：输入框内直接 Ctrl+V/截图粘贴图片会自动进入压缩与待发送预览，不再触发浏览器下载弹框（components/chat/InputArea.vue @paste + utils/image.js compressFileObject）',
      'P4 AI 气泡操作：最后一条 AI 回复气泡新增「重新生成/换一种说法」显式按钮，可原样重发或换一种更自然简洁的说法重答（components/chat/MessageBubble.vue + useChatActions 透传指令，换说法时禁止再次执行操作）'
    ],
    categories: [
      {
        title: '聊天体验 3.4.4',
        items: [
          'pages/chat/index.vue：发送中状态条（圆点脉冲 + 阶段文案 + 计时），与 loading 气泡/停止按钮并存',
          'useChatEngine.js：sendStage idle/thinking/streaming + 1s 步进计时，finally 统一复位，早退路径不残留',
          'MessageBubble.vue：assistant 气泡 meta 新增「重新生成」「换一种说法」，仅在对话最后一条 AI 回复且无执行卡片时出现'
        ]
      },
      {
        title: '多端适配 3.4.4',
        items: [
          'InputArea.vue：textarea @paste 拦截图片（#ifdef H5），进入统一压缩预览管线，非 H5 平台无副作用',
          'utils/image.js：新增 compressFileObject(File/Blob)，复用 Canvas/uni.compressImage 压缩，结束后释放 objectURL',
          'H5 不再弹浏览器下载框（拦截默认行为），App 端粘贴不受影响'
        ]
      },
      {
        title: 'AI 行为约束 3.4.4',
        items: [
          'utils/ai/chat-suggestion.js：纯规则兜底生成，账单/记录/计划/个人信息分主题映射，最多 2 条、去重',
          'response-parser.js：纯文本与 JSON 无 suggestions 路径自动补齐；带 action 的 JSON 不强补，避免执行后弹无关建议',
          'prompt-builder.js 输出格式新增 suggestions 可选字段约束；prompt-actions.js 行为准则新增伪建议禁令'
        ]
      },
      {
        title: '测试',
        items: [
          'tests/chat-suggestion.test.js：主题映射/免噪音/失败文案/伪建议禁令/parser 接入共 11 用例',
          'tests/response-parser.test.js + tests/prompt-builder.test.js 回归通过'
        ]
      }
    ]
  },
  {
    version: '3.4.3',
    date: '2026-09-09',
    title: '3.4.3 计划「今日一页」：今日行动条 + 任意时间池 + 执行记录',
    summary: [
      'pages/plan/index.vue 计划页新增「今日一页」行动条 components/plan/PlanDailyStrip.vue：从活跃主计划与子计划按日期/周几聚合当天候选，最多推 3 条，可直接打卡或开始；候选口径、轮询与去重见 utils/plan-daily.js collectDailySuggestions',
      '任意时间池：utils/storage/plan.js 新增 setPlanSomeday，支持把计划/子计划标记为「任意时间」（someday_at 不设日期不催），详情与列表可一键放入/移出，恢复时清除 someday_at',
      '计划执行记录页 pages/plan/records.vue：聚合打卡、状态变更、子计划完成等事件（utils/plan-daily.js collectPlanExecEvents），按天倒序展示最近执行明细，详情可回看描述',
      'usePlanAI 同步：AI 生成/修改计划时子计划带具体时间与描述/预估时长约束，保证「今日一页」候选有细节可用'
    ],
    categories: [
      {
        title: '今日一页 3.4.3',
        items: [
          'utils/plan-daily.js collectDailySuggestions：候选口径 + 排序轮询 + 去重 + 每计划最多 3 条',
          'components/plan/PlanDailyStrip.vue：1-3 条今日行动 + 打卡/开始入口',
          'pages/plan/index.vue + usePlanList.js：接入 dailyItems 渲染'
        ]
      },
      {
        title: '任意时间池 3.4.3',
        items: [
          'utils/storage/plan.js + utils/storage.js：setPlanSomeday 标记/移出 someday_at',
          'components/plan/PlanChildPlans.vue：子计划「放入任意时间」入口与状态',
          'pages/plan/detail.vue：toggleChildSomeday 一键放入/恢复'
        ]
      },
      {
        title: '计划执行记录 3.4.3',
        items: [
          'utils/plan-daily.js collectPlanExecEvents：打卡/状态/子项完成事件聚合',
          'pages/plan/records.vue + pages.json：新增执行记录页路由',
          'pages/plan/composables/usePlanAI.js：子计划带时间与描述约束'
        ]
      },
      {
        title: '测试',
        items: [
          'tests/plan-daily.test.js：候选口径/排序轮询/事件聚合/someday 标记共 9 用例',
          'tests/version-history.test.js：老用户增量合并 + 同日期版本排序共 4 用例'
        ]
      }
    ]
  },
  {
    version: '3.4.2',
    date: '2026-09-09',
    title: '3.4.2 计划细节：打卡记录 + AI 子计划时间',
    summary: [
      'B2 打卡记录升级：logPlanCheckIn 支持 note（这次做了什么，同日再打补写覆盖）；新增 getPlanCheckInRecords（倒序最近 N 条，含时刻 HH:mm 与 note）；详情页打卡卡点击展开描述输入，记录区展示最近 5 条明细（pages/plan/detail.vue + detail.scss）',
      'A2 拆解细节增强：create_plan/update_plan 的 subtasks 必填 title/description/est_minutes 并支持 start_time/end_time；数据层 convertSubtasksToChildPlans 透传时间；子计划行展示「开始日期 · 约 X 分钟」与空细节提示',
      'AI 规则同步：CORE_ACTIONS/BEHAVIOR_RULES 约束子计划必须带 description 与 est_minutes，用户给了整体起止时按序排入区间（禁止编造日期）；log_plan_checkin 增加 note 参数并透传'
    ],
    categories: [
      {
        title: 'B2 打卡记录（3.4.2）',
        items: [
          'utils/storage/plan.js：logPlanCheckIn(clientId, note) 记录 {date,at,note}；getPlanCheckInRecords 明细接口；同日幂等+补写描述',
          'pages/plan/detail.vue + detail.scss：打卡卡新增描述输入（可空）与最近记录列表（MM-DD HH:mm + 描述）；今日已打卡可补写',
          'utils/ai/tools/plan.js + prompt-actions.js + store/executors/plan.js：log_plan_checkin 支持 note 并回显'
        ]
      },
      {
        title: 'A2 拆解细节（3.4.2）',
        items: [
          'utils/ai/tools/plan.js：subtasks items required=[title,description,est_minutes]，新增 start_time/end_time；描述注明时间只能来自整体区间或用户原话',
          'utils/storage/plan.js：convertSubtasksToChildPlans 透传 start_time/end_time',
          'components/plan/PlanChildPlans.vue：子计划行显示「开始日期 · 约 X 分钟」；无描述且无孙计划时给出轻提示'
        ]
      },
      {
        title: '测试',
        items: [
          'tests/plan-action-log.test.js：note 存储/同日补写/明细格式/executor note 透传/子计划时间透传'
        ]
      }
    ]
  },
  {
    version: '3.4.1',
    date: '2026-09-09',
    title: '3.4.1 子计划细节 + 计划打卡',
    summary: [
      'A 子计划细节：create_plan/update_plan 的 subtasks 与 create_plan_phases 增加 description/phases 字段（utils/ai/tools/plan.js schema + prompt-actions.js 约束：拆解必须写明「做什么/怎么做/完成标准」，禁止只给标题或数量生成空壳阶段）；子计划卡片新增描述摘要展示（components/plan/PlanChildPlans.vue）',
      'B 计划打卡：utils/storage/plan.js 新增 logPlanCheckIn/getPlanCheckInStats（独立 checkins 轻记录：同日幂等、冷藏/已完成禁打卡、不动 status/plan_count/executions、不刷 updated_at、上限 500 条）；计划详情页新增「今天做了」打卡入口与累计/最近展示（pages/plan/detail.vue + detail.scss）',
      'C AI 打卡通道：log_plan_checkin 工具双注册（CORE_ACTIONS + TOOL_DEFINITIONS/TOOL_LABELS + store ACTION_MAP + executor），BEHAVIOR_RULES 新增「习惯型打卡 vs 一次性完成」判别规则'
    ],
    categories: [
      {
        title: 'A 子计划细节（3.4.1）',
        items: [
          'utils/ai/tools/plan.js：create_plan/update_plan 的 subtasks items 增加 description（做什么/怎么做/完成标准）；create_plan_phases 新增 phases:[{title,description}]（2-6 条），phase_count 降级为未提供 phases 时的兜底',
          'utils/ai/prompt-actions.js：CORE_ACTIONS 计划段同步 phases/description 约束；BEHAVIOR_RULES 拆解规则改为「必须带 description，禁止只给标题」',
          'components/plan/PlanChildPlans.vue：子计划卡片 description 摘要（最多 2 行截断）'
        ]
      },
      {
        title: 'B 计划打卡（3.4.1）',
        items: [
          'utils/storage/plan.js + utils/storage.js：logPlanCheckIn / getPlanCheckInStats（checkins:[{date,at}]，同一自然日幂等，保留最近 500 条）',
          'pages/plan/detail.vue + detail.scss：详情页顶部「打卡」入口（今日已记录置灰），累计天数/最近打卡展示，冷藏与已完成隐藏'
        ]
      },
      {
        title: 'C AI 与注册（3.4.1）',
        items: [
          'utils/ai/tools/plan.js + tools/index.js：log_plan_checkin 工具与 TOOL_LABELS 注册；tools/executor.js 结果格式化',
          'store/executors/plan.js + store/data.js：execLogPlanCheckIn 与 ACTION_MAP 接线（不入撤销栈，不累计 plan_count）',
          'utils/ai/prompt-actions.js：CORE_ACTIONS 增加 log_plan_checkin；BEHAVIOR_RULES 增加打卡判别句'
        ]
      },
      {
        title: '测试',
        items: [
          'tests/plan-action-log.test.js：description 透传（create_plan/create_plan_phases）、打卡同日幂等/跨日累计/不动执行字段/冷藏与已完成拦截/executor 接线',
          'tests/action-schema-consistency.test.js：log_plan_checkin 双注册断言'
        ]
      }
    ]
  },
  {
    version: '3.4.0',
    date: '2026-09-07',
    title: '3.4 慢恢复：能量模式 + 微光本 + 计划冷藏 + 周复盘去评价化',
    summary: [
      'M1 能量模式：utils/energy-context.js 纯本地推断（看最近两条用户消息，含否定处理与积极词抵消），低/极低档时在 buildChatMessages 注入降载指令（回复更短更软、不抛新话题、建议只给 1 分钟选项、可先放一放），并抑制 3.3 逃避点破模板（noNudge）',
      'M2 微光本：新增 siji_glimmers 存储（每日一条「还行的小事」，同日覆盖、允许空）+ create_glimmer/query_glimmers 工具与 ACTION_MAP 接线；功能页 AI 面板新增微光本子页（回看与删除，不打卡不评价）',
      'M3 计划冷藏：详情页新增「先放一放/恢复计划」按钮（frozen_at 标记，不动状态/执行/进度，同步暂停本地提醒并保留配置）；AI 用 update_plan frozen:true/false 触发；冷藏计划不进逃避候选、不注入计划执行上下文、不计入画像「进行中」统计',
      'M4 周复盘去评价化：usePlanAI.generateReview 删除「完成质量评估（优/良/中/差）」与改进建议句式，改为完成件数 + 不带评价的观察 + 结尾「已经很好了」；画像洞察删除「本月还未写记录」缺口提醒',
      'PRODUCT_VISION.md 新增 3.4 三条铁律（静止是合法状态 / 压力来自期待不来自记录 / 弹性默认冷藏），方案文档 docs/思迹3.4升级方案.md 落盘'
    ],
    categories: [
      {
        title: 'M1 能量模式（3.4）',
        items: [
          'utils/energy-context.js（新增）：inferEnergyLevel 关键词档位（极低/低/中/高）+ energyScan 注入文本；低档注入「1 分钟选项/可先放一放」，极低档注入「1-2 句最轻语气、不追问不建议不引导」',
          'utils/ai/chat-helpers.js：buildChatMessages 注入能量段；低/极低时 buildPlanContext 带 noNudge 抑制点破',
          'utils/plan-context.js：buildPlanContext 支持 opts.noNudge（3.4 M1 共用）',
          'tests/energy-context.test.js（新增）：空输入/低档/否定不触发/极低档/积极抵消/历史消息权重'
        ]
      },
      {
        title: 'M2 微光本（3.4）',
        items: [
          'utils/storage/glimmer.js（新增）：siji_glimmers 不分片存储，date 主键同日覆盖，get/save/remove/count/todayStr',
          'store/executors/glimmer.js（新增）+ store/data.js：create_glimmer/query_glimmers/delete_glimmer 进 ACTION_MAP',
          'utils/ai/tools/glimmer.js（新增）+ tools/index.js：TOOL_DEFINITIONS/QUERY_TOOLS/TOOL_LABELS 注册；prompt-actions.js CORE_ACTIONS 加「微光本」段 + BEHAVIOR_RULES 追加主动捡拾规则',
          'pages/settings/sub/glimmer.vue（新增）+ pages/functions/index.vue 入口 + pages.json 注册 + ExecResultCard/MessageBubble 展示适配'
        ]
      },
      {
        title: 'M3 计划冷藏（3.4）',
        items: [
          'utils/storage/plan.js：setPlanFrozen 只标 frozen_at，不动 status/executions/plan_count、不刷 updated_at（冷藏不是规划事件）',
          'store/executors/plan.js：update_plan 支持 frozen 翻译为 frozen_at，且不计入结构性 plan_count；字段标签「冷藏状态」',
          'pages/plan/detail.vue + detail.scss：底部栏「先放一放/恢复计划」按钮，冷藏时隐藏下一步单卡，同步暂停本地提醒（保留配置）；PlanCard 增加「冷藏中」角标与降透明度',
          'utils/plan-context.js：findProcrastinationCandidates 跳过 frozen_at，buildPlanContext 不注入冷藏计划；prompt-builder 画像「进行中」剔除冷藏计划',
          'tests/plan-action-log.test.js：冷藏候选豁免 / 上下文跳过 / executor 冻结不累计 plan_count / 恢复原样'
        ]
      },
      {
        title: 'M4 周复盘去评价化（3.4）',
        items: [
          'pages/plan/composables/usePlanAI.js：generateReview 移除「优/良/中/差」评分与改进建议，改为完成件数 + 观察式描述 + 「已经很好了」收尾',
          'utils/ai/prompt-builder.js：删除「本月还未写记录」缺口提醒（3.4 铁律：未完成信息只有用户主动问才出现）'
        ]
      }
    ]
  },
]
