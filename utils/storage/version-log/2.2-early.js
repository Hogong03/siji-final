/**
 * 版本日志数据段：2.2.4 - 2.2.0（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V22_EARLY = [
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
]
