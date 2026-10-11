/**
 * 版本日志数据段：4.25.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V425 = [
  {
    version: '4.25.0',
    date: '2026-10-12',
    title: '成果引擎 + 学习路线模板：把「以成果为单位」产品化（个人成长执行系统的第一批落地）',
    summary: [
      '微光本升级成果引擎：新增 kind 维度（win=今日成果 / moment=还行的小事，老数据自动归一 moment），AI 收集时自动区分——用户报「完成了/看懂了/写懂了 X」记为成果，晒太阳散步仍是微光',
      '成果连续天数（streak）进每日简报指标格（≥2 天亮「成果连续 N 天」）；今天没记不算断档，从昨天往回数——一天没结束就不算失败',
      '晚间收尾问询：21 点后今天还没记成果，进入消息轻轻问一句「今天还没记成果——哪怕一句看懂了一个接口也算」，并给「记成果」预置按钮直达 AI 收集（对抗"知道该做但觉得不着急"的机制化）',
      '内置学习模板「全栈转AI工程师（6个月）」：四阶段（前端调用链 → Java 后端 → 全栈项目 → AI 应用）+ 每阶段两个周检查点（每周产出可验证成果），一键创建为分阶段计划——画像药方的结构化落地',
      'AI 路由升级：create_glimmer schema 加 kind 参数，BEHAVIOR_RULES 与 CORE_ACTIONS 同步成果语义；create_plan_phases 补「学习/成长路线」四阶段结构与内置模板指引',
    ],
    categories: [
      {
        title: '成果引擎（4.25.0）',
        items: [
          'utils/storage/glimmer.js：saveGlimmer 加 kind（win/moment）；新增 getGlimmerStats 纯函数（todayCount / streakDays / weekCount / needWinPrompt=21点后未记）',
          'store/executors/glimmer.js：kind 透传，成果与微光的确认文案区分（已记进成果本 / 已收进微光本）',
          'utils/ai/tools/glimmer.js：create_glimmer schema 加 kind 枚举，描述覆盖成果与小事双入口',
          'composables/useEnterSummary.js：computeSummary / snapshotEnterContext 带入 glimmerStat',
          'utils/enter-dialogue.js：buildBriefingMetrics 成果连续格；buildEnterButtons 晚间「记成果」按钮；buildEnterLines 晚间收尾问询正文行（带连续天数时不评价）',
        ],
      },
      {
        title: '学习路线模板（4.25.0）',
        items: [
          'utils/storage/plan.js：DEFAULT_TEMPLATES 新增 tpl_learning「全栈转AI工程师（6个月）」——四阶段子计划（start/end_offset_days 0-30/31-60/61-120/121-180）各挂两个 weekly recur 周检查点，deadline_offset_days 180',
          'utils/ai/prompt-actions.js：create_plan_phases 补学习路线四阶段结构指引与内置模板提示；create_glimmer 行升级 kind 双入口',
        ],
      },
      {
        title: '测试',
        items: [
          '新增 tests/glimmer-wins.test.js 8 例：kind 落库与同日覆盖、streak 断档语义（今天没记从昨天数）、needWinPrompt 三态、briefing 成果格/按钮/正文行条件、tpl_learning 补发幂等与四阶段展开',
          '全量 102 文件 / 1384 用例全绿（含 action-schema-consistency / module-exports / eval 三件套）',
        ],
      },
    ],
  },
]
