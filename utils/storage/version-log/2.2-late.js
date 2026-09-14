/**
 * 版本日志数据段：2.2.13 - 2.2.5（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V22_LATE = [
  {
    version: '2.2.13',
    date: '2026-08-27',
    title: '修复 Agent 启动崩溃：PRESET_AGENTS 数组未闭合',
    summary: [
      '修复 store/agent.js 缺少数组闭合括号导致的模块加载 SyntaxError（Unexpected token export）',
      '聊天与 Agent 功能恢复正常：此前 App.vue 异步加载聊天组件即报错，H5 控制台 agent.js:106 语法错误'
    ],
    categories: [
      {
        title: 'Bug 修复',
        items: [
          'store/agent.js：PRESET_AGENTS 数组末尾补上缺失的 ]，export 语句此前位于数组字面量内',
          '影响范围：H5 / App / 小程序三端启动时加载 store/agent.js 即崩溃'
        ]
      }
    ]
  },
  {
    version: '2.2.12',
    date: '2026-08-27',
    title: 'AI 长期记忆进化与语义检索增强',
    summary: [
      '新增月度记忆卡：每次 AI 总结对话时把关键信息沉淀到当月卡片，回答时注入最近 3 个月历史记忆',
      '记录查询支持同义词匹配：说"焦虑"能查到"压力/失眠"相关记录',
      'AI 上下文注入近 3 月消费/记录趋势，能回答"上个月怎么了"类问题'
    ],
    categories: [
      {
        title: '长期记忆进化',
        items: [
          'utils/memory.js 新增月度记忆卡：siji_monthly_memory 存储，按月份去重合并，最多保留 12 个月',
          '对话自动摘要（aiSummarizeConversation）成功时同步写入当月卡片，形成"记忆进化"闭环',
          'buildMemoryContext 注入最近 3 个月历史月度记忆，让 AI 记得数月前的重要事件'
        ]
      },
      {
        title: '语义检索增强',
        items: [
          '新增 utils/search-synonyms.js 同义词表：焦虑/开心/疲惫/生气/工作/健康/饮食/旅行/学习/感情 10 组',
          'query_diary / query_combined 按扩展词过滤，命中主题词或同义词都能查到',
          'AI 上下文新增【近3月】趋势：各月支出与记录数，辅助回答跨月回顾类问题'
        ]
      }
    ]
  },
  {
    version: '2.2.11',
    date: '2026-08-27',
    title: 'Agent 体系重构：删除求职教练、模板精简、内置增强',
    summary: [
      '删除内置求职教练 Agent，情景模拟「规划推演」改用思迹助手',
      'Agent 推荐模板重新设计：5 个模板人设精简为可直接执行的核心规则',
      '内置 Agent 增强：新增图标，强化数据洞察能力'
    ],
    categories: [
      {
        title: 'Agent 管理',
        items: [
          '删除 career_coach（求职教练）：store/agent.js、utils/ai/skills.js、simulation.js、AgentAvatar.vue 同步清理',
          '情景模拟 planning 模式改绑 siji（思迹助手），不再依赖已删除 Agent',
          '模板抽为共享模块 utils/agent-templates.js，agent.vue 与 agent_add.vue 共用一份定义，消除双份重复',
          '模板人设重写：心理咨询师/健身教练/财务顾问/学习伙伴/极简助手，每条规则可直接执行',
          '内置 Agent（思迹助手/职场参谋/情感顾问）新增 icon，列表与详情展示更完整',
          '职场参谋/情感顾问强化数据洞察：结合账单、记录、画像给出有据可依的建议'
        ]
      }
    ]
  },
  {
    version: '2.2.10',
    date: '2026-08-27',
    title: '内置 Agent 只读详情',
    summary: [
      '内置 Agent（思迹助手/职场参谋/情感顾问/求职教练）支持查看完整详情',
      '内置 Agent 只读保护：详情页不可编辑，store 层禁止修改内置 Agent'
    ],
    categories: [
      {
        title: 'Agent 管理',
        items: [
          '列表页内置 Agent 增加「详情」入口，可查看头像/名称/描述/技能/系统提示词',
          '详情页只读：输入控件改为文本展示，底部仅保留「返回」',
          'store 层 updateAgent 增加 builtin 保护，防止绕过 UI 修改内置 Agent'
        ]
      }
    ]
  },
  {
    version: '2.2.9',
    date: '2026-08-26',
    title: '记录指令兜底修复（明确指令必落库/纯指令不建垃圾）',
    summary: [
      '修复：说"帮我写一篇日记昨天去打球了很开兴"时 AI 只聊天不建记录；"帮我记录一下"被建成空正文垃圾日记',
      '兜底触发条件放宽：明确记录指令（帮我写日记/帮我记录）即使 AI 未声称已操作也会执行；纯指令无内容不再建记录'
    ],
    categories: [
      {
        title: '记录兜底修复',
        items: [
          '记录兜底：用户消息含"帮我写日记/帮我记录/写一篇记录"等明确指令时，即使 AI 只聊天未执行也会提取内容并创建记录',
          '纯指令拦截："帮我记录一下""写一篇记录"等无实质内容的消息不再创建空正文垃圾日记',
          '画像兜底：含"帮我记录一下"且提到"我的爱好/我的MBTI"等画像信息时，即使 AI 未声称已操作也会提取并更新画像',
          '重复粘贴容错："我的爱好式大浴帽球我的爱好式大浴帽球"重复文本只取第一段',
          'Prompt 强化：明确指令必须调用工具执行，禁止只聊天；写日记 few-shot 示例'
        ]
      }
    ]
  },
  {
    version: '2.2.8',
    date: '2026-08-26',
    title: '话语拆解与纠错修复（爱好记录不落库）',
    summary: [
      '修复：说"我的爱好式篮球帮我记录一下"（含错别字）时 AI 只口头确认不落库的问题',
      'Agent 模式新增前端兜底：模型声称已操作但未执行时自动提取并落库；兜底识别容错"式/为"等错别字'
    ],
    categories: [
      {
        title: 'AI 兜底增强',
        items: [
          'Agent 模式（模型支持工具调用）下，回复声称"已记录/已更新"但无写入执行时，自动走前端兜底提取并执行',
          '兜底提取的爱好正则容错：支持"爱好式/爱好为"（错别字/口语），并自动剔除"帮我记录一下"等指令后缀',
          '行为规则：一句话含多个意图时拆解为多个 action 一次执行；"我的…(是/为/式)…帮我记录"句式必须落库，禁止只口头确认'
        ]
      }
    ]
  },
  {
    version: '2.2.7',
    date: '2026-08-26',
    title: 'AI 自定义属性修复（MBTI/星座/血型可落库）',
    summary: [
      '修复：向 AI 告知自定义属性（如"我的 MBTI 为 ENFJ"）时只口头回复不落库，后续"改为 INFP"也无效的问题',
      'AI 会把用户主动告知的新属性（MBTI/星座/血型/偏好等）写入画像，自动归入「更多信息」分组'
    ],
    categories: [
      {
        title: 'AI 画像修复',
        items: [
          'smart_update_profile 支持任意自定义属性：field 可为未知属性名，card 可为新分组名（自动创建分组）',
          'update_profile 新增 custom:[{label,value}] 字段：label=属性名、value=属性值',
          '规则强化：只更新用户本次提到的字段，画像中的旧字段未提及禁止重复上报',
          '兜底提取的 MBTI/星座/血型与 AI 写入统一归入 custom_ai 分组，避免卡片分裂'
        ]
      }
    ]
  },
  {
    version: '2.2.6',
    date: '2026-08-25',
    title: '计划管理与计划变更修复',
    summary: [
      '计划列表只显示主计划，子计划收纳到主计划详情中展示，不再平铺满列表',
      '计划详情时间板块合并缩小：预计开始时间与截止时间合并为单个时间安排，快捷按钮精简',
      '计划变更：强化规则，用户补充/修改已有计划时必须 update_plan，禁止新建同名计划'
    ],
    categories: [
      {
        title: '计划管理',
        items: [
          '列表页默认只显示主计划（parent_id 为空），子计划在主计划详情中以子计划分组展示',
          '统计口径改为主计划：总数/进行中/已完成/过期均不再计入子计划，子计划进度通过主计划卡片进度条展示'
        ]
      },
      {
        title: '计划变更修复',
        items: [
          'create_plan 仅用于全新计划；对已有计划的补充/修改必须用 update_plan，不知道 ID 先 query_plan 按标题查找',
          '规则：用户提出计划变更时禁止新建同名计划'
        ]
      },
      {
        title: '界面优化',
        items: [
          '计划详情时间板块缩小：两个 section 合并为一个时间安排，快捷按钮从 11 个精简至 6 个'
        ]
      }
    ]
  },
  {
    version: '2.2.5',
    date: '2026-08-25',
    title: '记录与计划 AI 行为修复（反馈链路驱动）',
    summary: [
      '记录：修复 AI 创建日记时正文为空、改标题/类型无效、改类型误创建新记录的问题',
      '计划：制定计划时时间必填、不虚构用户没说的细节（如天数）'
    ],
    categories: [
      {
        title: '记录修复',
        items: [
          'AI 创建日记误把正文放进标题时，自动兜底保存为正文',
          'update_diary 新增支持修改标题和记录类型（note|diary|idea|todo|flash）',
          '语义规则：改内容/标题/类型必须用 update_*，禁止 create_* 新建记录；执行结果如实复述'
        ]
      },
      {
        title: '计划修复',
        items: [
          'create_plan 新增 start_time/end_time，用户提到时间时必填（从原话计算日期）',
          '规则：时间/天数只能来自用户原话，未提及的细节禁止编造；子任务统一改称子计划'
        ]
      }
    ]
  },
]
