/**
 * 版本日志数据段：4.30.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V430 = [
  {
    version: '4.30.0',
    date: '2026-10-18',
    title: '提示体系收敛：删每日小结卡、计划汇总表改版（今日焦点 + 折叠 + 可关）、提示开关落地',
    summary: [
      '删掉聊天页顶部「每日小结」横条 —— 它讲的今日记录/支出/进行中/打卡，在计划汇总表与简报卡里都有更细的版本，留着就是同一件事说两到三遍',
      '计划汇总表改版：新增「今日焦点」置顶（逾期最久 1 条 + 今天/明天/3 天内到期，最多 4 条）；「今天/明天」独立成组并默认展开，其余分组折叠；统计头从 4 格收成 2 个大数字（已过期 / 今天明天）+ 一行小字；删掉优先级色条（与行内圆点信息重复）；新增本周打卡迷你条',
      '简报卡减行：计划状态从三行（1 行过时 + 最多 2 行快到期）合并成一句「计划：N 项已过期 · M 项快到期」，点名与动作交给汇总表与「看计划」按钮；指标格去掉「连续打卡」格',
      '新增「提示与提醒」页（pages/settings/sub/notify）：计划汇总表 / 进入简报卡 / 应用内提醒 / 应用外通知四个开关，全部并入既有 siji_reminder_settings（不新增存储键）；计划汇总表内也给了「不再自动弹出」与「提示设置」直通入口',
      '计划速览面板新增「查看计划汇总」—— 关掉每日自动弹出后，汇总表仍可从聊天页顶部计划按钮打开',
    ],
    categories: [
      {
        title: '计划汇总表改版',
        items: [
          'utils/plan-summary.js：`buildPlanSummary` 返回新增 `focus`（今日焦点）/ `weekBar`（本周打卡条）/ `stats.todayTodo`；`groups` 插入 `today`（已过期 → 今天/明天 → 进行中 → 待开始 → 已完成）；删除 `priorityBar`；新增导出 `FOCUS_LIMIT = 4` 与 `DUE_SOON_DAYS`（复用 utils/plan-alerts.js 同口径）',
          'utils/plan-heatmap.js：新增 `weekCheckinDays(plans, now)` 返回 7 个逐日标记；抽出 `weekCheckinScan` 让 `weekCheckinSummary` 与它共用同一次扫描（口径单一来源，原返回值 `{ times, days }` 不变，旧断言无需改）',
          'components/plan/PlanSummarySheet.vue：今日焦点区（tag + 色点 + 直达详情）/ 两个大数字 + 一行小字 / 分组折叠（默认只展开「已过期」「今天/明天」，其余点开才展开）/ 本周打卡迷你条 / 底部「不再自动弹出」「提示设置」；emit 新增 `disable-auto`、`open-notify`；深色双通道（H5/App `html.theme-dark`，小程序 `#ifdef MP-WEIXIN` 内 @media）',
        ],
      },
      {
        title: '提示收敛',
        items: [
          'pages/chat/index.vue：删除每日小结卡（import / ref / onShow 分支 / 模板 / 样式全清）；`injectEnterSummary` 接 `briefing` 开关；`maybeShowPlanSummary` 接 `summarySheet` 开关（延迟回调里二次确认）；新增 `disablePlanSummaryAuto` / `openNotifySettings` / `openSummaryFromSheet`；计划速览面板加「查看计划汇总」入口',
          'utils/enter-dialogue.js：`buildPlanAlertLines` 由「逐条点名」改为合并成一句（同时删除只服务于它的 `ALERT_LINE_LIMIT`）；`buildBriefingMetrics` 去掉「连续打卡」格',
          'composables/useDailyBrief.js：整文件删除（`siji_daily_brief_day` 不再写入；已有该键的存量数据不影响任何逻辑）',
        ],
      },
      {
        title: '提示开关',
        items: [
          'utils/reminder/settings.js：新增 `PROMPT_FLAG_DEFAULTS`（summarySheet / briefing / reminderToast，默认全开）、`getPromptFlag(key)`、`setPromptFlag(key, on)`；开关并入 `siji_reminder_settings` 的 `prompts` 字段，只认显式 false 为关，存储异常一律回落「开」',
          'utils/reminder/notifier.js：`showReminderToast` 接 `reminderToast` 开关 —— 4.29.3 把应用内提醒改 toast 时漏掉的开关',
          'pages/settings/sub/notify.vue（新增）+ pages.json 注册：分「进入聊天页」「计划到点」两组，含应用外通知总开关（`siji_reminder_settings.enabled`，此前无任何 UI）',
        ],
      },
      {
        title: '测试',
        items: [
          'tests/plan-summary.test.js：新增「今日焦点排序与上限」「今天/明天成组并从进行中待开始移出」「本周打卡条逐日标记与次数的同一口径」「空数据」四例；原优先级色条用例改为只断言统计分布与行内圆点',
          'tests/enter-dialogue.test.js：状态行断面对齐「计划：3 项已过期 · 1 项快到期」；指标格断言改为 `expense / diary / events`',
        ],
      },
    ],
  },
]
