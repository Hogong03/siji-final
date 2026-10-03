/**
 * 版本日志数据段：2.2（合并段）
 *
 * 由 2.2.0~2.2.13 整合而成（发布前合并），原 2.2-early.js / 2.2-late.js 分段已删。
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V22 = [
  {
    version: '2.2.13',
    date: '2026-08-27',
    title: '2.2.13（整合 2.2.0~2.2.13，发布前合并）：AI 纠错与前端兜底、标签分类与记录类型、计划重构、Agent 精简与月度记忆卡',
    summary: [
      'AI 纠错主动权与前端兜底：用户指出错误先 query 再 update 直接修正；声称已操作未执行、明确记录指令、自定义属性（MBTI 等）三路兜底落库',
      '标签分类体系（6 预定义种类）与记录 5 类型选择器上线；计划重构为父子结构，列表只显示主计划，变更已有计划必须 update_plan',
      'Agent 体系精简：删除求职教练、模板抽为共享模块 utils/agent-templates.js、内置 Agent 只读详情；修复 store/agent.js 启动崩溃',
      '月度记忆卡（保留 12 个月）与同义词语义检索上线，AI 上下文注入近 3 月消费/记录趋势',
      '开发者反馈导出（Markdown/JSON）支持自动/自由选择会话范围；样式重构零阴影 + 四级灰阶；修复 Agent 工具循环 ReferenceError',
    ],
    categories: [
      {
        title: 'AI 纠错与前端兜底',
        items: [
          '核心铁律新增纠错与标签条款：用户指出数据有误或 AI 识别矛盾时，必须先 query 确认再 update_* 直接修正，禁止只说“建议手动修改”；提到标签分类/归类时直接调 add_tag/update_tag_category/query_tags 操作（BEHAVIOR_RULES 增至 7 条）',
          'tools.js 新增 feedback CRUD(5) + 标签管理(4) 工具，QUERY_TOOLS 增 3 个只读工具；新建 store/executors/feedback.js（create/update/delete/query/stats 五个 executor），存储 key siji_feedback',
          '前端兜底系列：Agent 模式回复声称“已记录/已更新”但无写入执行时自动提取落库（爱好正则容错“爱好式/爱好为”错别字，一句话多意图拆解为多个 action）；明确记录指令（帮我写日记/帮我记录）即使 AI 只聊天也兜底创建记录，纯指令无内容不再建空正文垃圾日记；smart_update_profile 支持任意自定义属性（MBTI/星座/血型），自动归入「更多信息」分组',
        ]
      },
      {
        title: '记录与标签体系',
        items: [
          '标签分类体系：6 预定义种类（生活/工作/心情/学习/社交/其他，kind=system 不可删）+ 自定义种类（存储 key siji_tag_categories），标签增 categoryId 字段，getTagsByCategory/updateTagCategory 按种类分组管理',
          '记录类型选择器重写为 5 类型：随手记（默认）/日记（自动日期+天气+AI 情绪）/灵感（黄色左边框+自动 #灵感 标签）/待办（行解析+□ 前缀）/闪念（极简 textarea），新建直接进随手记模式；标题独立输入框、列表可选分页 10/20/50 条/页并持久化；AI 误把正文放进标题时自动兜底保存为正文，update_diary 支持修改标题与类型',
        ]
      },
      {
        title: '计划管理',
        items: [
          '计划重构：创建直接包含子计划、移除子任务层级；列表页只显示主计划，子计划在详情分组展示，统计口径不再计入子计划',
          '计划变更规则：对已有计划的补充/修改必须 update_plan（不知道 ID 先 query_plan 按标题查找），禁止新建同名计划；create_plan 时间必填且只来自用户原话，不虚构天数等细节；日期字段清洗只保留 YYYY-MM-DD；详情时间板块合并、快捷按钮从 11 个精简至 6 个',
        ]
      },
      {
        title: 'Agent 体系',
        items: [
          '内置 Agent 技能定制化（siji 7 技能 / workplace_advisor 5 / relationship_advisor 5 / career_coach 5）与 v2.1.0 十一项优化全部落地；只读详情上线（列表页「详情」入口 + store 层 updateAgent builtin 保护）；删除求职教练 career_coach，情景模拟 planning 改绑思迹助手；模板抽为共享模块 utils/agent-templates.js，人设重写为可直接执行的核心规则；内置 Agent 新增 icon，职场参谋/情感顾问强化数据洞察',
          '修复 store/agent.js PRESET_AGENTS 数组未闭合导致的模块加载 SyntaxError（Unexpected token export），三端启动不再崩溃',
        ]
      },
      {
        title: '记忆与语义检索',
        items: [
          '月度记忆卡：每次 AI 总结对话时把关键信息沉淀到当月卡片（siji_monthly_memory，按月去重合并、最多保留 12 个月），buildMemoryContext 注入最近 3 个月历史月度记忆',
          '语义检索：新增 utils/search-synonyms.js 同义词表 10 组（焦虑/开心/疲惫/生气/工作/健康等），query_diary/query_combined 按扩展词过滤；AI 上下文新增【近3月】消费/记录趋势，辅助回答跨月回顾类问题',
        ]
      },
      {
        title: '开发者反馈',
        items: [
          '设置页新增「开发者反馈」：导出聊天记录（Markdown/JSON，可选是否含 AI 执行动作），支持复制与存文件（App 存 _doc/feedback/、H5 下载），导出元数据完整填充并去重；自动选择模式自动挑出含异常消息的会话（最多 3 个，异常消息 + 前后各 2 条上下文，selectIssueConversations/selectKeyMessages 纯函数 5 条单测），自由选择模式手动勾选会话与消息，导出范围实时统计',
        ]
      },
      {
        title: '样式重构',
        items: [
          '零阴影清零（uni.scss $shadow-* 全置 none，15 文件 26 处硬编码阴影清除）；建立四级灰阶色值体系（页面 #F4F4F5 → 卡片 #FFFFFF → 边框/focus #E4E4E7）；41 文件 111 处 #D4D4D8 替换零残留；var() 消除（Canvas 2D 不解析 CSS 变量，chart-renderer.js 等 5 文件 21 处硬编码）；MarkdownRenderer/MessageBubble/ExecResultCard/InputArea 深色模式补全',
        ]
      },
      {
        title: 'Bug 修复',
        items: [
          '修复 agent-loop.js callWithRetry 未声明 stopSignal（取自 cfg）与 stopCheckId 导致的工具循环 ReferenceError；uni.request 完成回调正常清理轮询，重试与「停止」按钮恢复',
          '聊天与界面修复：版本更新弹窗「查看」正确跳转版本历史页、真机预览图片崩溃（_doc 转本地文件 URL、base64 转存）、AI 回复混入「[执行结果:」乱文剔除、提到识别图片未附图本地引导；14 处滚动容器 box-sizing 修复（390px 视口无横向溢出）；画像卡片默认折叠、关系图谱入口移至开关下方',
        ]
      },
    ]
  },
]
