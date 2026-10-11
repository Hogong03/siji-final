/**
 * 版本日志数据段：4.27.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V427 = [
  {
    version: '4.27.0',
    date: '2026-10-12',
    title: '人生周报多维度 + 本周焦点契约 + 画像/教练模式（个人成长改革后半）',
    summary: [
      '周洞察升级为「人生周报」：账单归因之外新增三个维度 —— 成果（本周记了几条成果/微光、连续天数）、身体（运动标签记录次数，价值排序第一位）、上周焦点对照（承诺的可见性就是约束力）',
      '本周焦点契约：周一简报给「定本周焦点」按钮（一周一个，对抗摊大饼）；定下后每天进入消息顶部可见「本周焦点：X」；AI 收下走 set_week_focus 存储，下周周报自动对照「上周焦点推进得怎么样」',
      '画像/教练模式内嵌行为准则：① 用户是危机驱动爆发型 —— 任务拆 15 分钟最小步骤并写明完成标准，没动力时不灌鸡汤直接给最小行动；② 技术问题默认教练模式（业务目的→调用链位置→数据流→关键原理→小练习），明确要代码才纯交付 —— AI 是杠杆不是拐杖',
      '存储与注册：siji_week_focus 单条周级覆盖（weekKey 与提醒/周报同口径）；set_week_focus/get_week_focus 入 ACTION_MAP（isKnownActionType 自动覆盖）与 CORE_ACTIONS',
    ],
    categories: [
      {
        title: '人生周报（4.27.0）',
        items: [
          'utils/weekly-insights.js：新增 countSportDiaries（运动标签口径：健康/运动/篮球/健身/跑步/锻炼）；聚合采集 glimmerStat / sportCount / weekFocus（上周焦点 = weekKey 落在上周区间才对照）；正文新增成果、运动、焦点对照三段；有成果或运动也出周报（不只盯着钱）',
        ],
      },
      {
        title: '本周焦点契约（4.27.0）',
        items: [
          '新增 utils/week-focus.js（focusWeekKeyOf/setWeekFocus/getWeekFocus，siji_week_focus 单条覆盖）与 store/executors/week-focus.js（set/get 执行器）',
          'store/data.js：ACTION_MAP 注册 set_week_focus / get_week_focus；utils/ai/prompt-actions.js CORE_ACTIONS 同步',
          'composables/useEnterSummary.js：computeSummary / snapshotEnterContext 带 weekFocus；utils/enter-dialogue.js：buildEnterButtons 本周未定给「定本周焦点」按钮（prefill）、buildEnterLines 已定出「本周焦点：X」正文行',
        ],
      },
      {
        title: '画像 / 教练模式（4.27.0）',
        items: [
          'utils/ai/prompt-actions.js：BEHAVIOR_RULES 新增三条 —— 最小行动原则（15 分钟拆步+完成标准，没动力不灌鸡汤）、技术问题教练模式（五段讲解结构，明确要代码才纯交付）、焦点契约行为（set_week_focus 路由与周内提醒）',
          'tests/week-focus.test.js 6 例：运动标签口径、成果/运动/焦点对照正文、聚合门控（只有成果/运动也出周报）、焦点读写与周切换失活、briefing 按钮/正文行条件',
          '全量 104 文件 / 1396 用例全绿',
        ],
      },
    ],
  },
]
