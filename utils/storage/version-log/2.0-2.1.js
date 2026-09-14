/**
 * 版本日志数据段：2.1.0 - 2.0.0（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V20_21 = [
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
]
