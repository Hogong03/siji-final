/**
 * 版本日志数据段：3.5.3 - 3.5.0（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V35_EARLY = [
  {
    version: '3.5.3',
    date: '2026-09-10',
    title: '3.5.3 打卡可视：热力月视图 + 阶段页周历 + 总结显示连续天数',
    summary: [
      '打卡热力月视图：计划记录页顶部新增月历热力（周一为列首，0/1/2/3+ 四档强度），支持翻月且不允许翻到未来月份，底部显示「本月 x 天 · y 次」；新增 utils/plan-heatmap.js 纯逻辑 + components/plan/PlanHeatmap.vue',
      '阶段页周历：子计划卡对「每周 N 次」任务内联展示本周七天格子（compact 模式复用 PlanWeekStrip），不必进入子计划详情即可看出哪几天做了',
      '进入总结显示连续天数：冷启动卡片新增「已连续打卡 N 天」（N>=2 时显示），口径为所有计划打卡日期并集从今天或昨天向前连续计数（utils/enter-summary.js calcGlobalStreak）',
      '连续打卡逻辑抽公共纯函数：utils/plan-recur.js 新增 calcStreakFromDates（单计划 calcCheckinStreak 与全局连续天数共用），去掉重复实现',
      '热力图口径：计划 checkins（按天一条）与 executions 里 action=done 的执行日志按日期归并计数，已删除计划排除'
    ],
    categories: [
      {
        title: '热力月视图 3.5.3',
        items: [
          'utils/plan-heatmap.js（新增）：levelOf 强度分级、collectDayCounts 次数表、monthGrid 周一起 7 列网格（首尾补空）、monthTotals 合计、shiftMonth 翻月、canGoNext 未来月份限制',
          'components/plan/PlanHeatmap.vue（新增）：月标题 + 上月/下月、星期表头、热力格（今日描边）、图例与合计，深色模式覆盖',
          'pages/plan/records.vue：loadEvents 同步构建 dayCounts，记录列表上方渲染热力图卡片'
        ]
      },
      {
        title: '周历与连续天数 3.5.3',
        items: [
          'components/plan/PlanWeekStrip.vue：新增 compact 模式（隐藏标题行，供子计划卡内联使用）',
          'components/plan/PlanChildPlans.vue：每周循环子计划卡内展示本周七天格子',
          'utils/plan-recur.js：calcCheckinStreak 重构为 calcStreakFromDates + 单计划包装',
          'utils/enter-summary.js + composables/useEnterSummary.js + pages/chat/index.vue：总结卡片新增「连续」行（kind-streak 样式，含深色）'
        ]
      },
      {
        title: '测试 3.5.3',
        items: [
          'tests/plan-heatmap.test.js（新增 8 例）：强度分级、次数表（含 done 归日与删除排除）、2026-09 网格布局与今日标记、2026-02 首行补空、合计、跨年翻月、未来月份限制',
          'tests/enter-summary.test.js：新增 calcGlobalStreak 4 例（并集连续、今天未打卡从昨天数、断档与删除排除、buildEnterSummary 带 streak）',
          'manifest 3.5.3 / 3503'
        ]
      }
    ]
  },
  {
    version: '3.5.2',
    date: '2026-09-10',
    title: '3.5.2 循环任务三件套：长按补写打卡、周任务周历、内联循环设置',
    summary: [
      '长按补写描述：今日行动条长按循环任务（或长按打卡按钮）展开行内输入，写下这次做了什么再打卡；描述为空时等价普通打卡（components/plan/PlanDailyStrip.vue + pages/plan/index.vue checkinWithNote）',
      '周任务周历：循环任务为「每周 N 次」时，详情页打卡卡显示本周七天格子（已打卡 / 今天 / 未来）与本周 x/N，一眼看出哪几天做了（新增 components/plan/PlanWeekStrip.vue + utils/plan-recur.js weekDayCells）',
      '内联循环设置：子计划卡新增「循环设置」入口，可就地把一条子计划改为每天 / 每周 N 次或取消循环，不必进入子计划详情（components/plan/PlanChildPlans.vue + pages/plan/detail.vue updateChildRecur）',
      '统一字段清洗：新增 utils/plan-recur.js normalizeRecur 与 utils/storage/plan.js setPlanRecur，循环类型只收 daily/weekly、每周次数收敛 1-30，改动只碰循环字段与 updated_at，不动状态、执行日志与打卡记录',
      '版本历史测试改为免维护断言：以 getDefaultHistory 与 manifest.versionName 为基准，去掉逐次发版都要改的硬编码版本号'
    ],
    categories: [
      {
        title: '打卡体验 3.5.2',
        items: [
          'components/plan/PlanDailyStrip.vue：长按行 / 长按打卡按钮展开行内描述输入（textarea + 取消/记录），emit checkin-note',
          'pages/plan/index.vue：checkinWithNote 处理（logPlanCheckIn 带 note）并刷新今日行动条',
          'pages/plan/detail.vue：refreshChildren 抽取，打卡 / 循环设置 / 任意时间三处共用（避免编辑快照不同步误弹放弃编辑）'
        ]
      },
      {
        title: '周历与循环设置 3.5.2',
        items: [
          'components/plan/PlanWeekStrip.vue（新增）：本周七天格子 + 本周 x/N，深色模式覆盖',
          'utils/plan-recur.js：weekDayCells（周一起 7 格，含 done/isToday/isFuture）、normalizeRecur',
          'components/plan/PlanChildPlans.vue：子计划卡「循环设置」内联面板（不循环/每天/每周 N 次），emit update-child-recur',
          'utils/storage/plan.js + utils/storage.js：setPlanRecur 落库'
        ]
      },
      {
        title: '测试 3.5.2',
        items: [
          'tests/plan-recur.test.js：normalizeRecur 1 例、weekDayCells 2 例、setPlanRecur 2 例',
          'tests/version-history.test.js：断言改为基准驱动（不再硬编码版本号）',
          'manifest 3.5.2 / 3502'
        ]
      }
    ]
  },
  {
    version: '3.5.1',
    date: '2026-09-10',
    title: '3.5.1 循环任务收尾闭环：级联收尾 + 阶段页直接打卡',
    summary: [
      '级联收尾：直接子计划全部结束时，阶段与主计划在读取计划列表时自动收尾（utils/plan-recur.js collectCascadeCompletions，多层级联、固定点迭代）；子计划冷藏 / 任意时间时视为未结束，不触发父级收尾',
      '阶段页直接打卡：子计划卡对循环任务显示「打卡 / 已打卡」与「本周 x/N」入口，点击即可打卡，不必逐个进入子计划详情（components/plan/PlanChildPlans.vue + pages/plan/detail.vue checkinChild）',
      '循环摘要可见：子计划区标题栏新增「循环 N 项 · 今日 x/N」，一次性子计划进度与循环任务分开显示，不再出现「2/2 完成但仍有循环在跑」的困惑',
      '清理详情页自动收尾判断中的死代码（allRecur 空操作守卫），并注明阶段收尾由存储层级联完成，行为可测',
      'tests/plan-recur.test.js 新增 7 例：级联候选（层级升序、冷藏/任意时间阻断、已删除子计划不参与）与存储读取端到端（叶子收尾→阶段→主计划，且只写一次）'
    ],
    categories: [
      {
        title: '级联收尾 3.5.1',
        items: [
          'utils/plan-recur.js：新增 collectCascadeCompletions（固定点迭代，返回收尾候选 client_id 层级升序）',
          'utils/storage/plan.js：finalizeExpiredRecurring → reconcilePlanStatus，循环项过期收尾后执行父级级联收尾，仍只写一次'
        ]
      },
      {
        title: '阶段页打卡 3.5.1',
        items: [
          'components/plan/PlanChildPlans.vue：循环子计划新增打卡按钮（今日已打卡 / 本周 x/N / 本周已达标）、循环摘要行、checkin-child 事件',
          'pages/plan/detail.vue：新增 checkinChild 处理（logPlanCheckIn 后刷新子计划并同步编辑快照），子计划区透传 recur-summary'
        ]
      },
      {
        title: '测试 3.5.1',
        items: [
          'tests/plan-recur.test.js：级联候选 5 例 + 存储级联 2 例（含「阶段内仍有未完成一次性子计划时保持进行中」）',
          'manifest 3.5.1 / 3501'
        ]
      }
    ]
  },
  {
    version: '3.5.0',
    date: '2026-09-09',
    title: '3.5.0 循环任务：每日/每周固定动作打卡闭环 + 六级备考内置模板',
    summary: [
      '内置「六级备考」模板（tpl_cet6）：唤醒 30 天 → 强化 40 天 → 冲刺 22 天三阶段，阶段内每天/每周动作带做法描述与时长；模板引擎 createPlanFromTemplate 升级为两层递归，支持 est_minutes、循环字段与相对日期偏移（创建日=第 0 天，阶段起止自动换算）',
      '循环任务模型：计划字段 recur_type(daily/weekly) + recur_count；循环任务打卡计当天/本周、不置完成；到所属阶段截止日读取时自动收尾，阶段手动完成时循环子计划一并收尾',
      '今日行动条升级：从「只取主计划直接子计划」下沉到阶段容器内叶子，循环任务按窗口（最晚开始/最早结束，含祖先）过滤，daily 当日已打卡、weekly 本周达标即退出今日条；支持一键快捷打卡',
      '打卡统计升级：连续天数(streak)与本周次数(weeklyDone)入 getPlanCheckInStats，计划详情摘要显示「累计/连续/本周 x/N」',
      '提醒循环真实生效：重复提醒按 每天/每周(固定星期)/工作日 逐日触发（去重键 planId|YYYY-MM-DD，窗口到计划截止日）；冷藏、任意时间、已完成计划自动跳过；AI 建计划 schema 与提示词支持循环字段并禁止逐日拆碎'
    ],
    categories: [
      {
        title: '循环任务 3.5.0',
        items: [
          'utils/plan-recur.js：类型/次数/连续天数/本周计数/祖先窗口/自动收尾纯逻辑',
          'utils/storage/plan.js：getPlanList 读取时自动收尾过期循环项，getPlanCheckInStats 增 streak 与 weeklyDone',
          'pages/plan/detail.vue：新增「循环任务」区（不循环/每天/每周 N 次 + 提示），下一步单卡对循环子计划改为今日打卡'
        ]
      },
      {
        title: '今日行动条 3.5.0',
        items: [
          'utils/plan-daily.js：collectDailySuggestions 下沉到叶子并支持两层结构（主计划→阶段→每日项）',
          'components/plan/PlanDailyStrip.vue：循环徽标/本周进度/打卡按钮，pages/plan/index.vue 快捷打卡后即时刷新',
          'components/plan/PlanChildPlans.vue：循环子计划显示「循环」状态与本周进度'
        ]
      },
      {
        title: '提醒与模板 3.5.0',
        items: [
          'utils/reminder/scheduler.js：computeReminderFire 支持 daily/weekly/weekdays 重复与截止窗口',
          'utils/reminder/triggered.js：触发键改为支持 planId|date 按天防重',
          'ensureDefaultTemplates 新增六级备考模板；store/data.js 模板创建递归两层'
        ]
      },
      {
        title: 'AI 与测试 3.5.0',
        items: [
          'utils/ai/tools/plan.js + prompt-actions.js：recur_type/recur_count 入 schema，循环任务禁止逐日拆碎',
          'tests/plan-recur.test.js、tests/reminder-repeat.test.js 新增；tests/plan-daily.test.js 按新语义更新',
          'manifest 3.5.0 / 3500'
        ]
      }
    ]
  },
]
