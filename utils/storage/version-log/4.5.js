/**
 * 版本日志数据段：4.5.x（新版本在前）
 *
 * 发布前合并：4.5.0 / 4.5.1 两条补丁记录合并为一条 4.5.1（应用未发布，合并降噪；
 * title 注明整合范围，明细按主题归并，原文的文件名/技术结论/排坑记录保留）。
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V45 = [
  {
    version: '4.5.1',
    date: '2026-09-28',
    title: '4.5.1（整合 4.5.0~4.5.1，发布前合并）：上班打卡（到点提醒可推迟/弹窗直达）+ 进入对话收敛单消息 + Agent 头像黑圆底白线框统一',
    summary: [
      '上班模板入库：根计划带「上班打卡/下班打卡」两个每日循环子计划（08:30/18:00 每日提醒，模板体系新增 reminder 字段创建时一并落位）；提醒弹窗升级 ActionSheet：立即打卡直达落库 / 推迟 5/15/30 分钟 / 查看计划，直接关掉=按默认档推迟，推迟期间不写 triggered 到点重响、可连续推',
      '修掉 repeatType 不落盘缺口：设置页采集了循环类型但存储丢掉，daily/weekly/weekdays 循环提醒实际从未生效；提醒编辑区新增「弹出后默认推迟」全局档位',
      '进入对话收敛成一条单消息：问候 + 进展总结 + 计划过时/快到期点破（新增 plan-alerts）+ 上班卡未打提醒 + 下一步建议；聊天页「下一步」单卡取消（并入消息，每天一次语义保留），新对话不再回落欢迎语',
      '10 个 Agent 头像全部重绘：黑圆底 + 白色 Lucide 线框（128×128，原 64×64 透明底黑线框），与纯黑主色、用户气泡（黑底白字）统一；存量数据经 AGENT_ICON_V3 映射链式归一自动升级；修 AgentSwitcher 头像未走 normalizeAgentIcon',
      '测试 84 文件 / 1203 用例全绿（新增 plan-alerts / reminder-snooze / work-template 三个文件）；holidays 测试修日期漂移（中秋过后期望值动态推导，不再硬编码 9/25）'
    ],
    categories: [
      {
        title: '上班打卡（4.5.0）',
        items: [
          'utils/storage/plan.js：tpl_work 模板 —— 根计划「上班」+ 上班打卡（08:30）/ 下班打卡（18:00）两个 daily 子计划，tags: [工作]（进入消息按这个口径识别）；ensureDefaultTemplates 增量补发；createPlanFromTemplate 支持模板 plan_data/子任务 reminder 字段逐个 setPlanReminder，子计划 tags 从 spec 透传（原来写死空数组）',
          'utils/reminder/notifier.js：triggerReminder 前台弹窗改 uni.showActionSheet（三端一致）——「立即打卡」直接 logPlanCheckIn 落库 + checkinFeedback 里程碑回执；后台 plus.push / H5 Notification / 小程序订阅消息行为不变（通知点击只拉起 App，进入后由 60s 轮询补弹）'
        ]
      },
      {
        title: '提醒推迟 / snooze（4.5.0）',
        items: [
          'utils/reminder/snooze.js（新增）：siji_reminder_snoozed 推迟表 {fireKey: {planId, fireAt}}；推迟中的提醒不写 triggered（到点重响），打卡/查看才 markTriggered + clearSnooze，可连续推迟',
          'utils/reminder/scheduler.js：checkAllReminders 拆两条触发路径（snooze 到期重响 ∪ 常规命中），同 fireKey 只走一条；触发后不再立即 markTriggered，经回调落账（onDone/onSnooze）；弹窗打开期间 openSheets 防重',
          'utils/reminder/settings.js：修 repeatType 不落盘（UI 采集了但 setPlanReminder 丢掉，循环提醒存不进去）；新增 snoozeMin 全局默认档（只认 5/15/30，非法回落 5）；utils/reminder.js 聚合出口补 snooze/snoozeMin/SNOOZE_OPTIONS；PlanReminderSection.vue 新增「弹出后默认推迟」三档选择（全局设置，不走表单 proxy）'
        ]
      },
      {
        title: '进入对话单消息（4.5.0）',
        items: [
          'utils/plan-alerts.js（新增）：collectPlanAlerts 纯函数 —— 过时（截止已过未完成）/ 快到期（3 天内）两组警示，只报顶层、循环/已完成/冷藏/顺延不参与',
          'utils/enter-dialogue.js：buildEnterSummaryMessage 恒产出（问候+进展+状态+上班卡+下一步+通用按钮，空内容也出问候开场）；新增 buildPlanAlertLines / buildWorkLine / buildNextStepLine / buildGreeting；按钮新增 checkin（直达打卡）与 next（预置「开始做X」）',
          'composables/useEnterSummary.js：computeSummary 挂计划状态包，新增 snapshotEnterContext（无窗口语义的当下快照，中对话新建用）；useChatSession.js：appendEnterSummary 恒产出 + 落对话时 markNextStepShown 占当天名额；useConversationManager.js 空会话种子消息走 seedOpener；pages/chat/index.vue 删「下一步」单卡（模板/样式/offerNextStep），handleEnterButton 支持 checkin 分支，开场兜底改 appendEnterSummary(null)'
        ]
      },
      {
        title: 'Agent 头像（4.5.1）',
        items: [
          'static/icons/：新增 agent-{siji,career,workplace,finance,study,fitness,psychologist,relationship,minimal,custom}-v3.png（10 个，128×128 RGBA 黑圆底白色线框，Lucide 开源图标：机器人/上升趋势/公文包/钱包/毕业帽/哑铃/大脑/心形握手/四芒星/扳手）；旧 v2 文件保留兼容存量数据',
          'utils/agent-templates.js：新增 AGENT_ICON_V3 映射（v2→v3），normalizeAgentIcon 链式归一（无版本→v2→v3）—— 已持久化旧路径渲染时自动升级，无需重建；store/agent.js、utils/ai/tools/agent.js（AGENT_ICON_OPTIONS 与 buildAgentPayload 默认 icon）、pages/settings/sub/agent_add.vue 默认 icon 改 v3；components/chat/AgentSwitcher.vue 头像 src 统一走 normalizeAgentIcon（原来直接用原始路径），AgentAvatar.vue 与 AgentSwitcher.vue 深色模式黑圆头像加 #3F3F46 细边框保留轮廓'
        ]
      },
      {
        title: '测试与工程（4.5.0）',
        items: [
          '新增 tests/plan-alerts.test.js（口径与排除项）、tests/reminder-snooze.test.js（推迟重响/直达打卡/关掉=默认档推迟/计划删除清表 + repeatType 落盘）、tests/work-template.test.js（模板幂等/提醒落位/坏数据不炸）；chat-session / enter-dialogue 测试更新到恒产出语义，setup.js 补 showActionSheet mock',
          'tests/holidays.test.js 修日期漂移：「中秋国庆」用例期望值改 inferHolidayFromText 动态推导（2026-09-25 中秋已过，旧断言每天必挂）；全量 NODE_OPTIONS=--max-old-space-size=4096 + vitest run --maxWorkers=2：84 文件 / 1203 用例全绿'
        ]
      }
    ]
  }
]
