/**
 * 版本日志数据段：3.3.0 - 3.0.0（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V30_33 = [
  {
    version: '3.3.0',
    date: '2026-09-06',
    title: '3.3 把想变成 5 分钟的第一步：最小行动闭环 + 温和点破 + 图片识别验证',
    summary: [
      '最小行动闭环：计划/子计划记录新增 est_minutes/done_at/executions（完成即自动入账，最多 50 条）；计划详情页顶部「下一步」单卡一键标记完成；AI 拆解计划强制收敛到 5-15 分钟可执行一步（tools/plan.js schema + BEHAVIOR_RULES），聊天计划卡片新增「下一步」入口直达子计划',
      '计划性逃避温和点破 v1：utils/plan-context.js 按「主计划未完成 + 整树无执行 + AI 规划 >=3 次 + 距上次规划超 3 天」检测候选（D4=A），仅当用户对话点名该计划时注入非评判点破模板（D3=A：只陈述观察 + 可选项，零催促评分）',
      'AI 结构性规划次数 plan_count 由 executor 维护（纯状态切换不计入），供逃避检测与执行摘要使用',
      '图片识别能力验证 C0：新增 docs/思迹图片识别验证_20260906.md 样本集与 DeepSeek V4 Flash Vision / GLM-5.3 Flash 双模型对比表（D5=B），真机跑分后决定 C1 多图合并范围',
      '历史遗留回归确认（D6=A）：Web 端图片下载弹框已于 v2.3.9 修复，本次代码复核无残留下载逻辑'
    ],
    categories: [
      {
        title: 'A 最小行动闭环（3.3）',
        items: [
          'utils/storage/plan.js：savePlan 统一埋点（status 0/1→2 自动写 done_at + executions push，重复保存不重复记，最多 50 条）；convertSubtasksToChildPlans 透传 est_minutes',
          'store/executors/plan.js：子计划记录初始化 est_minutes/executions/plan_count；AI 结构性更新累计 plan_count（纯状态切换不计），execUpdatePlanSubtask 同口径',
          'utils/ai/tools/plan.js + prompt-actions.js：create_plan/update_plan subtasks schema 加 est_minutes 与「>15 分钟必须继续拆出下一级」约束；BEHAVIOR_RULES 追加拆小句与「开始做/执行→update 状态，禁止重新规划/新建」',
          'pages/plan/detail.vue：顶部「下一步」单卡（第一条未完成子计划或叶子计划自身，一键标记完成并整表落库）；handleSave 拆出 persistForm 共用；上次执行时间展示',
          'components/chat/ExecResultCard.vue：计划卡片子计划行可点击直达，追加「下一步 →」行；useChatNavigation.js 新增 open_plan_child 路由',
          'tests/plan-action-log.test.js（14 条）：入账/防重/plan_count/多代聚合/逃避候选规则/点破模板口径；tests/correction-regression.test.js 追加拆小 schema 断言'
        ]
      },
      {
        title: 'B 温和点破 v1（3.3）',
        items: [
          'utils/plan-context.js：collectPlanExecutions 聚合、findProcrastinationCandidates（D4=A 阈值）、buildPlanContext（标题双向命中才注入）',
          'utils/ai/chat-helpers.js：CONTEXT_KEYWORDS 加 plan 关键词，buildChatMessages 按需注入计划执行上下文（agent-loop 与 chat-stream 双路径覆盖）',
          '点破口径：只陈述观察事实 + 可选项（缩小范围/换更小一步/暂停/今天不做也行）；禁止催促、评判或打鸡血文案；无推送、无详情页横幅（D3=A）'
        ]
      },
      {
        title: 'C 图片识别验证与回归（3.3）',
        items: [
          'docs/思迹图片识别验证_20260906.md：7 样本梯度集 + A/B/C 评分 + 双模型结论表（D5=B：DeepSeek V4 Flash Vision / GLM-5.3 Flash）+ C1 分支判定标准',
          'D6=A 回归确认：Web 下载弹框（v2.3.9 已修）无残留下载逻辑；App 图片预览崩溃加固已在 v2.3.x，跑分时顺带复验'
        ]
      }
    ]
  },
  {
    version: '3.2.0',
    date: '2026-09-06',
    title: '3.2 说得准、找得回：纠错回归集 + 记忆治理 + 旧话检索 + 计划时间预览',
    summary: [
      '纠错回归集：tests/correction-regression.test.js 固化 13 条（11 个历史纠错场景静态断言 + 2 条 mock 工具序列用例），agent-loop 增加 AGENT_TOOL_INSTRUCTION 导出与 _mockResponder 测试钩子，提示词补「一句话含多个意图 → 一次发起多个工具调用」「值变更传新值覆盖、禁止新增重复属性」',
      '记忆治理：记忆与画像写入统一归一化去重（全半角/标点/前缀差异同义句不再重复存储）；记忆管理页新增「治理」弹层（重复合并 / 超期隐藏 / other 归类建议）与「全部 / 未整合 / 已整合」视图分段',
      '已整合超期记忆治理口径：超过 90 天的已整合 fact/preference 记忆仅从默认视图隐藏（hidden 标记），可在「已整合」分段查看并恢复，永不自动删除',
      '旧话检索：新增 utils/chat-search.js 与 query_conversations 工具（标题 > 用户消息 > AI 回复加权检索），用户问「上次/是不是说过 XX」时 AI 可直接翻历史会话并给出原文摘录、会话标题与时间',
      '计划时间预览：新增 utils/plan-time.js 纯函数与 PlanTimeStrip 只读刻度条，计划详情页时间区改为折叠形态（默认一条时间刻度预览 + 「编辑时间」展开完整编辑器），收敛时间板块占空间问题'
    ],
    categories: [
      {
        title: 'M1 纠错回归集与话语拆解（3.2）',
        items: [
          'tests/correction-regression.test.js（新增 13 条）：1-11 静态断言 BEHAVIOR_RULES/CORE_ACTIONS/AGENT_TOOL_INSTRUCTION 关键句与 smart_update_profile schema（required=card/field/value、自由文本无枚举白名单、值变更覆盖说明），并校验 8 个关键工具 TOOL_DEFINITIONS 与 CORE_ACTIONS 双注册',
          'mock 工具序列用例（D1 追加）：计划纠错「先 query_plan 确认 → update_plan 修正、全程无 create_plan」；一句话多意图「create_diary + smart_update_profile 同轮全部执行」',
          'utils/ai/agent-loop.js：toolInstruction 提取为模块级 AGENT_TOOL_INSTRUCTION（回归测试可断言）；callWithRetry 增加 cfg._mockResponder 注入钩子（仅测试环境生效）',
          'utils/ai/tools/profile.js：smart_update_profile 描述补「用户表示值有变更（不是 X 是 Y / 改成 Y）→ 传新值覆盖原字段，禁止新增一条内容重复的属性」'
        ]
      },
      {
        title: 'M2 记忆治理（3.2）',
        items: [
          'utils/memory.js：normalizeMemoryText（去空白标点、全半角统一、小写、去「我今天/我想/打算」前缀）；addMemory 去重升级为归一化相等即更新时间戳',
          '治理函数：findDuplicateGroups（归一化相等或一方包含另一方且长者 ≤60 字）、findStaleAdoptedMemories（已整合超 90 天 → 隐藏候选，仅隐藏不删除）、suggestMemoryCategory（other 按句式建议归类）、applyGovernance（merge/hide/delete/recategorize，仅用户确认后执行）、restoreHiddenMemory',
          'utils/profile.js：addArrayItem 增加大小写/全半角归一化去重；buildMonthlyMemoryContext 过滤与画像字段值重复的 ≤20 字短行',
          'pages/settings/sub/memory.vue + memory.scss：「治理」入口与弹层（重复合并/超期隐藏/other 归类逐项勾选）；「全部 / 未整合 / 已整合」视图分段，hidden 记忆只在「已整合」分段出现、可恢复显示',
          'tests/memory-governance.test.js（新增 20 条）+ tests/memory-profile.test.js 补数组去重用例'
        ]
      },
      {
        title: 'M3 旧话检索（3.2）',
        items: [
          'utils/chat-search.js（新增）：searchConversations 内存遍历 siji_conversations，标题命中权重 > 用户消息 > AI 回复，返回摘录（命中前后 20 字）+ 会话标题 + 时间；支持 tag 过滤、limit、无结果空数组',
          'utils/ai/tools/chat.js（新增）+ tools/index.js：query_conversations 双注册（TOOL_DEFINITIONS + QUERY_TOOLS + TOOL_LABELS），schema 必填 keyword、可选 tag；不进入 store/data.js ACTION_MAP（JSON 兜底路径不承担跨会话检索）',
          'utils/ai/tools/executor.js：query_conversations 直调分支（仿 query_tags），结果格式化为「• 9月3日「会话标题」：…摘录…」；agent-loop 截断表新增 1500 上限并补工具指令句',
          'utils/ai/prompt-actions.js：CORE_ACTIONS 新增「会话记忆」段；utils/ai/chat-stream.js looksDataQuery 补「是不是/有没有/可曾说过提过」句式',
          'tests/chat-search.test.js（新增 7 条）+ tests/agent-tools.test.js 补注册断言'
        ]
      },
      {
        title: 'M4 计划时间分布预览（3.2）',
        items: [
          'utils/plan-time.js（新增）：buildTimeStrip 纯函数，主计划与子计划全部有效日期取全局 min/max，不足 2 个有效日期返回 null；跨年/超长跨度线性映射不越界，今天在区间内时输出 today 空心圈节点',
          'components/plan/PlanTimeStrip.vue（新增）：只读刻度条（灰线 + 主计划端点黑点 / 子计划灰点 / 今天空心圈 + 首尾日期小字），无滑动/缩放/点击，低高度展示',
          'pages/plan/detail.vue + detail.scss：时间安排区改折叠形态——默认一行预览条（无日期显示「未设置时间」），点「编辑时间」才展开 PlanTimeSection 完整编辑；深色模式覆盖',
          'tests/plan-time.test.js（新增 12 条）：少于 2 日期返回 null、子计划区间兜底、同日起止边界、跨年 offset、today 进出区间、超长跨度不越界、字段优先级与无效日期'
        ]
      }
    ]
  },
  {
    version: '3.1.0',
    date: '2026-09-06',
    title: '3.1 Agent 升级：技能体系下线 + 开场引导 + 会话 Agent 绑定',
    summary: [
      '技能体系整体下线：删除 utils/ai/skills.js 与 Agent 的 skills 字段（store/agent.js、agent-templates.js、agent 管理/编辑页、create_agent 工具 schema、确认卡技能摘要全部清理），人设即能力；原有 7 段技能引导的等价内容已并入 CORE_ACTIONS/agent-loop 提示词（决策框架、大目标分阶段、总结时机），行为不回退',
      '开场引导 Starter：Agent 新增 starts[]（3 条以内、每条 ≤20 字）；思迹助手内置固定 3 条、心理咨询师/情感顾问模板各预置 3 条；create_agent 支持 AI 生成人设时一次产出 3 条开场引导',
      '聊天页：切换/创建 Agent 后在输入区上方展示开场引导 chips，点击即发送、发送后自动隐藏；Agent 详情页只读展示开场引导（暂不开放编辑）',
      '会话 Agent 绑定：新建会话自动记录创建时的 Agent（agentId/agentName，chat store 与 app store 聚合层注入，无循环依赖）；打开绑定 Agent 与当前不符的历史会话时出现「该会话由 X 进行 · 切换」一次性提示，不自动切换，存量旧会话无提示'
    ],
    categories: [
      {
        title: 'M1 技能体系下线（3.1）',
        items: [
          'utils/ai/skills.js 整文件删除；store/agent.js 删除 BUILTIN_AGENT_SKILLS import、BUILTIN_SIJI.skills、createAgent 的 skills 默认与 getAgentSkills()',
          'store/index.js 删除 getAgentSkills 转发；store/executors/agent.js detail 回传去掉 skills',
          'utils/ai/tools/agent.js：删除 SKILL_REGISTRY/AGENT_SKILL_IDS/skillSchema；create_agent schema 改为 {name,description?,systemPrompt,starts?,icon?}；buildAgentPayload 对存量带 skills 的请求静默忽略',
          'utils/ai/chat-stream.js / chat-helpers.js / prompt-builder.js：删除技能注入链路（cfg.skills/agentId、buildSkillsPrompt），agentMode/lite 分支保留',
          'utils/ai/prompt-actions.js：create_agent 行去掉 skills 白名单说明；决策日志补「机会成本-风险-时机」框架句、create_plan_phases 补大目标引导（prompt-builder.js）',
          'utils/ai/agent-loop.js：toolInstruction 补 summarize_diaries 总结时机引导',
          'UI：pages/settings/sub/agent.vue 与 agent_add.vue/agent.scss/agent_add.scss 删除技能勾选/展示；components/chat/MessageBubble.vue 确认卡摘要改名称+描述',
          '存量兼容：siji_agents 中带 skills 字段的旧 Agent 打开/对话/备份恢复正常（不清洗存储）'
        ]
      },
      {
        title: 'M2 开场引导 Starter（3.1）',
        items: [
          'store/agent.js：BUILTIN_SIJI 内置 starts（记一笔最近的账单/帮我写今天的记录/把我想法拆成下一步）；createAgent 透传 starts（≤3 条）',
          'utils/agent-templates.js：心理咨询师/情感顾问模板预置各 3 条开场引导（示例贴近用途）',
          'utils/ai/tools/agent.js：create_agent 增加 starts 参数（maxItems 3、单项 maxLength 20），要求 AI 一次生成 3 条',
          'pages/chat/index.vue：输入区上方新增 starter chips 行（复用白底黑边圆角视觉），当前会话无用户消息且 Agent 有 starts 时展示，点击 handleSend 直接发送',
          'pages/settings/sub/agent_add.vue：详情/编辑页新增「开场引导」只读展示区（AI 生成不可编辑）'
        ]
      },
      {
        title: 'M3 会话 Agent 绑定（3.1）',
        items: [
          'store/chat.js：createConversation(customTitle, meta) 支持写入 agentId/agentName',
          'store/index.js：聚合层 createConversationWithAgent 注入当前活跃 Agent（避免 chat store 依赖 agent store）；启动自动建会话在 agent 恢复后为空时补绑',
          'pages/chat/index.vue：绑定 Agent ≠ 当前活跃 Agent 时显示「该会话由 X 进行 · 切换」pill，点击切换 Agent；发送消息或切换会话后隐藏（一次性提示，回切再显）'
        ]
      }
    ]
  },
  {
    version: '3.0.0',
    date: '2026-09-04',
    title: '3.0 重构：Agent 精简（模板 2 个）+ AI 对话创建 Agent + 写操作确认 + 版本历史折叠',
    summary: [
      'Agent 系统：移除全部内置场景 Agent（职场参谋/情感顾问），仅保留思迹助手；情感顾问人设合入模板（心理咨询师/情感顾问 2 个），模板点击创建为自定义 Agent',
      '对话直接创建：新增 create_agent 工具（AI 工具注册表 + CORE_ACTIONS 双注册），对思迹助手说「创建一个 XX Agent」即可生成人设并落库，icon/skills 白名单校验、人设限长 4000 字符',
      'Agent 管理页三段布局：思迹助手固定卡 / Agent 模板（点击创建）/ 我的 Agent；旧会话引用已删除 Agent 时自动回退思迹助手',
      '版本历史页：按主版本号分组（v1/v2/v3），组头可折叠，默认只展开最新组，组内超 5 条可展开全部',
      '写操作确认：AI 的记录/账单/计划/画像/Agent 等写入默认先出「确认卡」，用户点确认才落库；设置 → AI 自动执行写操作 可一键开启跳过确认；create_agent 走同一确认链路（store/executors/agent.js）'
    ],
    categories: [
      {
        title: 'Agent 系统重构（3.0 M1）',
        items: [
          'store/agent.js：删除 PRESET_AGENTS（workplace_advisor/relationship_advisor），agents 初始与恢复仅 [思迹助手 + 自定义]',
          'utils/agent-templates.js：PRESET_TEMPLATES 精简为 2 个（心理咨询师/情感顾问），情感顾问人设 = 原内置 systemPrompt + 五段技能细则合并',
          'utils/ai/skills.js：BUILTIN_AGENT_SKILLS 仅保留 siji；SKILL_REGISTRY 技能注册表不变（自定义 Agent 白名单）',
          'utils/ai/tools/agent.js（新增）+ tools/index.js：注册 create_agent 工具（schema 含 icon/skills 枚举白名单）',
          'utils/ai/tools/executor.js：create_agent 执行分支（名称/人设校验、超长拒绝、落库返回 Agent 信息）',
          'utils/ai/prompt-actions.js：CORE_ACTIONS 增加 Agent 段 + BEHAVIOR_RULES 增加「先确认后创建」规则',
          'pages/settings/sub/agent.vue：三段布局（思迹助手/模板/我的 Agent），空态引导对话创建',
          'pages/settings/sub/agent_add.vue：图标选项精简为 情感/心理/自定义',
          '存量兼容：siji_agents 自定义保留；会话历史 Agent 引用按 id 找不到自动回退思迹助手；AGENT_ICON_V2 映射保留'
        ]
      },
      {
        title: '版本历史折叠（3.0 M2）',
        items: [
          'pages/settings/sub/version-history.vue：按主版本号分组为 v1/v2/v3 系列，组头显示版本范围与条数并可折叠',
          '默认只展开最新大版本组；组内超过 5 条先显示最近 5 条，可展开全部',
          '点击小版本卡片仍进入 version-detail 查看完整变更明细'
        ]
      },
      {
        title: '写操作确认与 AI 建 Agent 落库（3.0 M3 核心）',
        items: [
          'utils/ai/tools/index.js：needsConfirmation 增加「写操作默认需确认」规则（读取设置键 siji_auto_write，默认关 = 需确认；开启后仅大额账单仍确认）',
          '执行链前置确认：utils/ai/tools/executor.js 确认闸门提到最前（标签/Agent 工具同样受控）；utils/ai/agent-loop.js 确认文案改用中文工具标签',
          '确认卡内容增强：components/chat/MessageBubble.vue 补充 create_agent / smart_update_profile / log_interaction 等标题与摘要（技能名中文映射）',
          '确认聚合：同一轮多个写操作挂起为一张「N 个操作待确认」卡，确认后批量落库（不再只确认第一个丢弃其余）',
          'JSON 兜底路径同约束：useChatEngine 对非 Agent 模式的写操作同样走 needsConfirmation，不直接落库',
          'store/executors/agent.js（新增）：create_agent 确认后经 data store 分发落库，与 utils/ai/tools/agent.js 的 buildAgentPayload 共用白名单校验（icon/skills/4000 字上限）',
          '设置 → Agent 与模板 入口改名；新增「AI 自动执行写操作」开关（pages/settings/index.vue）',
          '清理残留：情景模拟三模式统一由思迹助手执行（utils/simulation.js），AgentAvatar 色板/关于页说明同步为 心理咨询师+情感顾问 两模板'
        ]
      }
    ]
  },
]
