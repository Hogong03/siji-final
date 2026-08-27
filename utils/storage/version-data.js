/**
 * 版本历史默认数据（内置版本日志）
 *
 * 纯数据文件，从 version-history.js 拆出
 */

export function getDefaultHistory() {
  return [
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
    {
      version: '2.2.4',
      date: '2026-08-25',
      title: '开发者反馈自由选择模式',
      summary: [
        '开发者反馈新增「自由选择」模式：可手动勾选任意会话与消息',
      ],
      categories: [
        {
          title: '开发者反馈自由选择模式',
          items: [
            '新增「自由选择」模式：默认勾选当前会话，支持按会话全选/取消、展开逐条勾选消息',
            '导出范围实时统计（会话数/消息数），导出内容仅包含勾选的消息',
            '修复展开会话无法显示消息列表的问题',
          ]
        }
      ]
    },
    {
      version: '2.2.3',
      date: '2026-08-25',
      title: '开发者反馈自动选择 + Agent 工具循环停止信号修复',
      summary: [
        '开发者反馈默认自动选择问题会话：异常消息多的会话优先，仅导出问题前后上下文',
        '修复 Agent 工具循环报错：stopSignal / stopCheckId 未声明导致的 ReferenceError'
      ],
      categories: [
        {
          title: '开发者反馈自动选择',
          items: [
            '新增「自动选择（推荐）」模式：自动挑出含失败/报错/AI 走神/乱文等异常消息的会话（最多 3 个）',
            '关键消息裁剪：异常消息 + 前后各 2 条上下文，无异常会话时退回当前会话',
            '页面显示自动选中摘要（会话数/异常消息数），可随时切回「当前会话 / 全部会话」手动模式',
            '新增 selectIssueConversations / selectKeyMessages / getMessageIssue 纯函数，5 条单测覆盖'
          ]
        },
        {
          title: 'Bug 修复',
          items: [
            'agent-loop.js callWithRetry 补全 stopSignal（取自 cfg）与 stopCheckId 声明',
            '工具循环内 uni.request 完成回调正常清理轮询，不再中断执行'
          ]
        }
      ]
    },
    {
      version: '2.2.2',
      date: '2026-08-25',
      title: 'Agent 工具循环停止信号修复',
      summary: [
        '修复 Agent 工具循环报错：stopSignal / stopCheckId 未声明导致的 ReferenceError',
        '聊天请求失败时不再抛异常，重试与「停止」按钮恢复正常'
      ],
      categories: [
        {
          title: 'Bug 修复',
          items: [
            'agent-loop.js callWithRetry 补全 stopSignal（取自 cfg）与 stopCheckId 声明',
            '工具循环内 uni.request 完成回调正常清理轮询，不再中断执行',
            '148 测试全过，语法检查通过'
          ]
        }
      ]
    },
    {
      version: '2.2.1',
      date: '2026-08-24',
      title: '计划管理重构 + 开发者反馈 + 聊天与导出修复',
      summary: [
        '计划重构：创建计划直接包含子计划，移除子任务层级，详情页直接查看完整情况',
        '开发者反馈：设置页新增导出聊天记录（Markdown/JSON），一键交给开发者定位问题',
        '聊天修复：版本更新跳转 / 真机图片崩溃 / 执行结果乱文 / 图片识别引导',
        '记录增强：标题独立编辑 + 可选分页（10/20/50）',
        '个人画像：卡片默认折叠，关系图谱入口调整'
      ],
      categories: [
        {
          title: '计划功能',
          items: [
            '计划创建直接包含子计划，不再有子任务层级，点击子计划查看完整情况',
            '计划详情无修改直接退出，不再误弹「放弃编辑」',
            '日期字段清洗：deadline/start_time 等只保留 YYYY-MM-DD，杜绝「5天」脏数据',
            '「帮我定/制定/安排/规划」指令进入 Agent 工具循环，计划创建更可靠',
            'Prompt 规范：create_plan subtasks 至少 1 条，禁止空壳计划'
          ]
        },
        {
          title: '开发者反馈',
          items: [
            '设置页新增「开发者反馈」入口：选择会话范围/格式/是否含 AI 执行动作',
            '导出支持复制与存文件（App 存 _doc/feedback/，H5 下载）',
            '导出元数据修复：时间/应用版本/平台/设备/AI 模型完整填充',
            '导出去重：aiReply 与内容相同时不再重复输出'
          ]
        },
        {
          title: '聊天修复',
          items: [
            '版本更新弹窗「查看」正确跳转版本历史页',
            '真机预览图片崩溃修复（_doc 转本地文件 URL、base64 转存）',
            'AI 回复混入「[执行结果:」乱文修复：兜底前先剔除回声段',
            '提到识别图片但未附图时本地引导，不发无意义请求',
            '计划详情页时间轴功能移除'
          ]
        },
        {
          title: '记录与布局',
          items: [
            '记录标题独立输入框，保存与脏检查拆分',
            '记录列表可选分页并持久化（10/20/50 条/页）',
            '14 处滚动容器 box-sizing 修复，390px 视口无横向溢出'
          ]
        },
        {
          title: '个人画像',
          items: [
            '画像卡片默认折叠，点卡片头部展开/收起',
            '关系图谱入口移至开关下方，删除冗余提示文案'
          ]
        }
      ]
    },
    {
      version: '2.2.0',
      date: '2026-08-20',
      title: 'AI 纠错 + 反馈管理 + 标签分类体系 + 记录类型选择器 + 样式重构',
      summary: [
        'AI 纠错主动权：用户指出错误或 AI 识别矛盾时，先 query 再 update 直接修正本地数据',
        '体验反馈 CRUD：AI 可在对话中创建/修改/删除/查询反馈',
        '标签分类体系：6 预定义种类（生活/工作/心情/学习/社交/其他），按种类分组管理',
        '记录 5 种类型：随手记/日记/灵感/待办/闪念，各有独立视觉与行为',
        '样式重构：零阴影清零 + 四级灰阶色值体系 + var() 消除 + 深色模式补全'
      ],
      categories: [
        {
          title: 'AI 纠错与反馈管理',
          items: [
            '核心铁律第 8 条：用户指出数据有误或 AI 识别矛盾时，必须先 query 确认再 update_* 直接修正，禁止只说"建议手动修改"',
            '核心铁律第 9 条：用户提到标签分类/归类时，调用 add_tag/update_tag_category/query_tags 直接操作',
            'BEHAVIOR_RULES 增至 7 条（纠错 + 标签管理）',
            'Agent-loop 指令增强：纠错/标签/反馈全覆盖',
            '新建 store/executors/feedback.js：create/update/delete/query/stats 五个 executor',
            'tools.js 新增 8 个工具：feedback CRUD(5) + 标签管理(4)，QUERY_TOOLS 增 3 个只读工具',
            'store/data.js ACTION_MAP 注册 5 个 feedback action',
            '体验反馈存储 key siji_feedback，不分片'
          ]
        },
        {
          title: '标签分类体系',
          items: [
            '6 预定义种类（kind=system 不可删）：生活/工作/心情/学习/社交/其他',
            '自定义种类（kind=user 可增删）：存储 key siji_tag_categories',
            '每个标签增加 categoryId 字段，默认 other',
            'getTagsByCategory() 按种类分组返回标签映射',
            'updateTagCategory() 修改标签所属种类',
            'addCustomCategory/removeCustomCategory 自定义种类 CRUD',
            'storage.js 导出新 API'
          ]
        },
        {
          title: '记录类型选择器',
          items: [
            'detail.vue 重写为 5 类型：随手记（✏️ 默认）、日记（📖 自动日期+天气+AI 情绪）、灵感（💡 黄色左边框+自动 #灵感 标签）、待办（☑️ 行解析+自动 □ 前缀）、闪念（⚡ 极简只留 textarea）',
            '新建直接进随手记模式，类型选择器改为手动「切换」按钮触发',
            '类型条与标签区域可收起/展开（▲/▼ 图标）',
            '筛选面板统一右侧按钮控制收展，左侧类型仅展示',
            '展开后分三段独立分行：类型/分类/标签，每段有小标题',
            '字体缩小保持一行：筛选栏 24rpx、chips 20rpx、gap 6rpx',
            '标签删除改为 @tap 直接点击删除，chip 右侧加 ✕ 小按钮',
            '闪念模式 Bug 修复：面板整体只受 showMetaPanel 控制，分类/标签段各自 v-if="!isFlashMode"'
          ]
        },
        {
          title: '样式重构',
          items: [
            '零阴影清理：uni.scss 中 $shadow-sm/md/lg/ai/$glass-shadow 全置 none，15 文件 26 处硬编码阴影批量清除',
            '四级灰阶色值体系：页面 #F4F4F5 → 卡片/输入区 #FFFFFF → 次级 #F4F4F5 → 边框/focus #E4E4E7',
            '全局 41 文件 111 处 #D4D4D8 全部替换为零残留',
            'var() 消除：Canvas 2D 不解析 CSS 变量，chart-renderer.js 等 5 文件 21 处硬编码',
            'MarkdownRenderer 深色模式补全：标题/段落/代码/引用/表格/列表全覆盖',
            'InputArea 样式整改：零阴影+快捷面板白底+图片预览层次区分',
            'MessageBubble/ExecResultCard/chat.scss 深色模式补全'
          ]
        },
        {
          title: 'Agent 系统优化（v2.1.0 延续）',
          items: [
            '内置 Agent 技能定制化：siji(7 技能) / workplace_advisor(5) / relationship_advisor(5) / career_coach(5)',
            'skills.js 新增 BUILTIN_AGENT_SKILLS 结构，prompt-builder.js 支持 opts 参数',
            'v2.1.0 十一项优化全部落地（写入确认/触发收窄/动态截断/按需注入/并行执行/技能精简/渲染统一/进度反馈等）',
            '新建对话去强制命名弹窗，默认名自动生成'
          ]
        }
      ]
    },
    {
      version: '2.1.0',
      date: '2026-08-16',
      title: 'Agent 系统优化 — 写入确认+触发收窄+动态截断+并行执行+技能精简',
      summary: [
        'P0: 写入确认（金额≥500）/ 触发收窄（多词组合匹配）/ 动态截断（按工具查表）',
        'P1: 上下文按需注入 / 并行工具执行 / 技能 prompt 精简 / 渲染统一',
        'P2: token 估算 / undo_last 暴露 / 进度反馈 / MAX_ROUNDS 降级'
      ],
      categories: [
        {
          title: 'P0 核心优化',
          items: [
            '写入确认：create_bill 金额≥500 时 Agent 退出循环等待用户确认',
            '触发收窄：looksDataQuery/isCommandMessage 改多词组合匹配，避免单字误触发',
            '动态截断：TOOL_RESULT_TRUNCATE_MAP 按工具查表——query_bill:1500、query_diary:2000、query_stat:800、query_combined:2500'
          ]
        },
        {
          title: 'P1 性能与体验',
          items: [
            '上下文按需注入：CONTEXT_KEYWORDS 正则条件注入 relations/decisions，省 30-50% token',
            '并行工具执行：查询类 Promise.all 并行（3s→~1s），写入类串行',
            '技能 prompt 精简：7 技能 systemPromptSection 压缩到 1 句',
            '渲染统一：renderAgentResults 合并到 autoExecuteAndDisplay，加 source 参数'
          ]
        },
        {
          title: 'P2 增强',
          items: [
            'token 估算：estimateTokens() CJK 2 token / ASCII 0.25 token',
            'undo_last 暴露：toolInstruction 补充 undo_last Agent 工具说明',
            '进度反馈：runAgentLoop/runAgentChat 签名加 onStatus 参数，工具执行前回调 + UI statusHint',
            'MAX_ROUNDS 降级确认：兜底已存在（MAX_ROUNDS=5 退出时降级处理）'
          ]
        },
        {
          title: '不执行项（P3）',
          items: [
            '双路径合并：需厂商稳定性验证，暂不执行',
            '自定义技能编辑：需新页面，暂不执行',
            '记忆差异化：需架构变更，暂不执行'
          ]
        }
      ]
    },
    {
      version: '2.0.0',
      date: '2026-08-05',
      title: 'Agentic Loop 智能体 + 计划全面升级 + 阶段化计划',
      summary: [
        'AI 升级为智能 Agent：可多次调用工具、基于本地数据库结果继续推理',
        '计划功能全面优化：列表/详情/统计/模板/回收站/看板/AI 增强',
        '阶段化计划：大目标拆为 2-6 阶段，含里程碑+时间窗口',
        '死代码清理 + 代码拆分（reminder/chat/bill/version-history）'
      ],
      categories: [
        {
          title: 'Agentic Loop（工具循环）',
          items: [
            'AI 从单轮返回 action 升级为可多次调用工具、基于结果继续推理',
            '新建 tools.js：24 个 OpenAI 兼容 function schema（记录/账单/计划/画像/关系/决策）',
            '新建 agent-loop.js：工具循环引擎（maxRounds=5 防死循环，结果截断 2000 字符）',
            '查询结果格式化为自然语言回传 AI（query_bill→"共15笔¥3,240，餐饮¥1,240"）',
            '四家厂商（DeepSeek/智谱/通义/Moonshot）均启用 supportsToolCalling',
            '向后兼容：旧 JSON action 格式仍可执行，不支持 function calling 的厂商走原路径',
            '安全边界：破坏性工具（undo/delete）不自动执行，转人工确认'
          ]
        },
        {
          title: '计划功能全面优化',
          items: [
            '列表页：搜索+状态/优先级/标签三维 AND 筛选+左滑手势+看板视图',
            '详情页：父计划关联+优先级/状态选择+重复提醒+AI 工具栏（排期/复盘/下一步）',
            '回收站：搜索+恢复+彻底删除+全部恢复',
            '统计页：11 个卡片（总览/优先级/状态/趋势/速度/子任务/完成率/标签/过期/热力图）',
            '模板：搜索+分类筛选+编辑/删除/另存为+AI 定制',
            '看板视图：待开始/进行中/已完成三列跨列切换',
            '日期快捷选择：今天/明天/本周末/下周一/一周后/一月后'
          ]
        },
        {
          title: '阶段化计划',
          items: [
            'plan 新增 phases 数组（id/title/description/start_date/end_date/milestones/subtasks）',
            '新建 usePlanPhases.js：阶段 CRUD + AI 深度拆解（2-6 阶段，每阶段含子任务+里程碑+时间窗口）',
            '详情页阶段化 UI：可折叠阶段区块+里程碑+日期选择器+AI 阶段化拆解按钮',
            '有 phases 时隐藏普通子任务区块（互斥）',
            '统计页 subtaskStats 兼容阶段化子任务聚合',
            'prompt-builder CORE_ACTIONS 新增 create_plan_phases / update_plan_phase',
            '向后兼容：旧计划无 phases 不受影响'
          ]
        },
        {
          title: '代码拆分与清理',
          items: [
            'reminder.js 351→55行 + 4 子模块（settings/triggered/notifier/scheduler）',
            'store/chat.js 339→170行 + 2 子模块（persist.js + restore.js）',
            'bill/index.vue 441→190行 + 2 composable（useBillList + useBillSwipe）',
            'version-history.js 319→86行 + version-data.js（纯数据）',
            '死代码清理：14 个文件移至 .trash/（8 旧账单组件+PlanQuickActions+PlanCard.scss+VirtualList+api-key-store.js+2 py 脚本）',
            'SijiIcon 补 more/chat 图标'
          ]
        }
      ]
    },
    {
      version: '1.3.0',
      date: '2026-08-04',
      title: '记录4.0 + 记账5.0 + 计划UI + 体验优化',
      summary: [
        '记录4.0：分类/全局搜索/日历/图片/回收站 + 列表工具栏统一',
        '记账5.0：布局重构/跨月搜索/回收站/年度统计/分类预算',
        '计划UI升级 + 版本历史列表+详情子页面'
      ],
      categories: [
        {
          title: '记录功能 4.0',
          items: [
            '分类系统：树状两级分类，筛选面板集成',
            '全局搜索：全部时间选项，跨月搜索所有记录',
            '日历视图：热力图展示每日记录密度',
            '图片附件：压缩→base64→存储→渲染→预览全链路',
            '回收站：软删除+恢复+彻底删除+搜索+时间筛选',
            'AI 润色：一键优化文字表达',
            'AI 提取待办：从记录内容提取待办事项',
            'AI 情绪分析：分析记录中的情绪倾向',
            '列表工具栏统一：搜索框+时间折叠+筛选+回收站一行',
            '四维AND筛选：搜索+时间+分类+标签同时生效',
            '搜索状态回显条：激活条件可单独清除',
            '去掉VirtualList改普通scroll-view（月度数据量不需要）',
            '统计卡片：记录数、活跃天数、总字数'
          ]
        },
        {
          title: '记账功能 5.0',
          items: [
            '布局重构：6层合并3层（概览+工具栏+列表）',
            '跨月搜索：全部时间选项，四维AND筛选',
            '账单回收站：软删除+恢复+彻底删除',
            '年度统计：12月趋势、Top5消费排行、消费洞察',
            '分类预算：按分类设预算，超支红色预警',
            '定期账单模板：周期账单到期提醒',
            '编辑页优化：键盘收紧、分类5列、快捷备注横滑',
            '概览卡片：支出/收入/结余+预算进度+统计入口'
          ]
        },
        {
          title: '计划功能',
          items: [
            'UI 升级：按钮颜色统一黑白灰，状态标签可见性修复',
            '保存后放弃编辑弹窗修复（saved标志位）',
            'CSS 变量清零，全量硬编码+深色模式适配',
            '激活态统一黑白反色填充，不再用var(--color-ai)'
          ]
        },
        {
          title: '聊天与AI',
          items: [
            'AI 聊天复制功能恢复：显式复制按钮替代长按',
            'AI 记录增强：润色、提取待办、情绪分析',
            'GuideModal 路由修复：/pages/settings/about → /pages/settings/sub/about'
          ]
        },
        {
          title: '设置与体验',
          items: [
            '体验反馈页面：提交按钮固定底部，适配安全区',
            '版本历史功能上线：列表页（摘要）+详情子页面（分类折叠）',
            '首次使用引导 OnboardingGuide（4步全屏向导）'
          ]
        }
      ]
    },
    {
      version: '1.2.1',
      date: '2026-08-04',
      title: '记录列表搜索+时间折叠+回收站对齐',
      summary: [
        '记录列表工具栏一行：搜索框+时间折叠+筛选+回收站',
        '四维AND筛选统一（搜索+时间+分类+标签）',
        '回收站增加搜索+时间筛选，与列表页一致'
      ],
      categories: [
        {
          title: '记录列表',
          items: [
            '工具栏一行：搜索框(flex:1)+时间按钮(月份▼)+⚙筛选+🗑回收站',
            '搜索+时间+分类+标签四维AND同时生效',
            '搜索状态回显条：激活条件可单独清除+一键清除',
            '时间折叠：搜索框下方折叠按钮，选完自动收起',
            '去掉VirtualList改普通scroll-view+v-for',
            '卡片间距收紧：margin-bottom 10rpx、padding 20rpx 24rpx'
          ]
        },
        {
          title: '回收站',
          items: [
            '增加搜索框+时间折叠chips',
            '全部时间模式：遍历所有分片合并',
            '搜索状态条+完整日期显示'
          ]
        },
        {
          title: '导航栏',
          items: [
            '自定义导航栏实验→改回原生导航栏（4分钟反复）',
            '教训：原生导航栏更简单可靠，非强定制不值得'
          ]
        }
      ]
    },
    {
      version: '1.2.0',
      date: '2026-08-03',
      title: '记录 3.0 全量升级',
      summary: [
        '记录列表/详情页拆分重构，新增即搜、统计、时间线视图',
        'AI 摘要、关联推荐、关联账单、语音按钮',
        '聊天页首次进入空白修复'
      ],
      categories: [
        {
          title: '记录列表重构',
          items: [
            'list.vue 339→117行，拆分到 useDiaryList.js',
            'detail.vue 441→235行，拆分到 useTagPicker.js + useDiaryRelations.js',
            '新增即搜功能：输入关键词实时过滤',
            '统计卡片：记录数、活跃天数、总字数',
            '标签统计：按标签聚合查看',
            '时间线视图：按日期分组展示'
          ]
        },
        {
          title: 'AI 能力增强',
          items: [
            'AI 摘要：一键生成记录摘要',
            '关联推荐：智能推荐相关记录',
            '关联账单：记录与账单关联展示',
            'summarize_diaries executor',
            'query_combined executor'
          ]
        },
        {
          title: '其他',
          items: [
            '语音按钮（仅录制，识别待接入）',
            '模板入口：快速套用记录模板',
            '聊天页首次进入空白修复（onShow 守卫+滚动重试）'
          ]
        }
      ]
    },
    {
      version: '1.1.0',
      date: '2026-07-31',
      title: '品牌定制 + 引导系统 + 图片链路',
      summary: [
        'Agent 系统新增预设角色',
        '首次使用引导 OnboardingGuide',
        '图片功能全链路 + 流式打字机优化'
      ],
      categories: [
        {
          title: 'Agent 系统',
          items: [
            '新增预设角色',
            'Agent 绑定人设不绑定模型'
          ]
        },
        {
          title: '引导与体验',
          items: [
            '首次使用引导 OnboardingGuide（4步全屏向导）',
            'storage 标记 siji_onboarding_done 避免重复展示',
            '修复引导页崩溃：删除 JS 内 isDark/onThemeChange'
          ]
        },
        {
          title: '图片与流式',
          items: [
            '图片压缩：≤1MB/≤1024px/质量80渐进降质至40',
            'base64 传递→异步写文件系统',
            'App: _doc/siji_images/，MP: USER_DATA_PATH，H5: Blob 下载',
            '流式打字机：displayQueue + requestAnimationFrame 逐帧渲染',
            '等待回复 loading 动画修复'
          ]
        },
        {
          title: '样式与适配',
          items: [
            '全项目 CSS 变量穿透修复（22个 fixed 组件硬编码）',
            '深色模式 full 适配',
            'linear-gradient 清零',
            '全项目 var(--) 残留清零'
          ]
        }
      ]
    },
    {
      version: '1.0.0',
      date: '2026-07-14',
      title: '思迹初版上线',
      summary: [
        'AI 对话核心引擎（多厂商支持）',
        '记录、记账、计划三大功能模块',
        '纯黑白极简设计语言'
      ],
      categories: [
        {
          title: 'AI 对话引擎',
          items: [
            '多厂商支持：DeepSeek/智谱/通义/Moonshot',
            'Agent prompt 引导层策略',
            '三层空回复兜底（response_format→重试→前端正则截断）',
            'API Key 加密存储（XOR+Base64）',
            '多厂商注册表 + supportsJsonFormat 标记',
            '旧版模型名自动迁移表'
          ]
        },
        {
          title: '功能模块',
          items: [
            '记录：创建/编辑/删除/搜索/标签',
            '记账：收支记录/分类统计/月度概览/预算',
            '计划：优先级/状态/子任务/标签/截止日期'
          ]
        },
        {
          title: '设计语言',
          items: [
            '纯黑白（#000000 / Zinc 灰阶）',
            '零渐变、零模糊、零阴影',
            'SijiIcon 组件 + SijiChart 图表'
          ]
        }
      ]
    }
  ]
}
