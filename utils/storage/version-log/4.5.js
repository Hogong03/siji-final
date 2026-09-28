/**
 * 版本日志数据段：4.5.0（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V45 = [
  {
    version: '4.5.1',
    date: '2026-09-28',
    title: '4.5.1 美化全部 Agent 头像：黑圆底 + 白色 Lucide 线框图标，统一品牌视觉',
    summary: [
      '10 个 Agent 头像全部重绘：黑色圆形底 + 白色精致线框图标（128×128 高清，原为 64×64 透明底黑线框），与思迹纯黑主色、用户气泡（黑底白字）统一，浅色页面上更突出、风格一致',
      '图标语义贴合各 Agent 主题：思迹助手=机器人、职业=上升趋势、职场=公文包、财务=钱包、学习=毕业帽、健身=哑铃、心理咨询=大脑、情感=心形握手、极简=四芒星、自定义=扳手（基于 Lucide 开源图标）',
      '存量数据自动归一：agent-templates 新增 AGENT_ICON_V3 映射，normalizeAgentIcon 链式归一（无版本 → v2 → v3），已持久化的旧头像路径渲染时自动升级，无需重建',
      '修 AgentSwitcher 头像未归一化：切换弹窗原来直接用原始 icon 路径，现统一走 normalizeAgentIcon；AgentAvatar 与 AgentSwitcher 深色模式加细边框，黑圆头像在深色背景下保留轮廓',
      '测试 84 文件 / 1203 用例全绿',
    ],
    categories: [
      {
        title: 'Agent 头像美化（4.5.1）',
        items: [
          'static/icons/：新增 agent-{siji,career,workplace,finance,study,fitness,psychologist,relationship,minimal,custom}-v3.png（10 个，128×128 RGBA，黑圆底 + 白色线框）；旧 v2 文件保留以兼容存量数据',
          'utils/agent-templates.js：新增 AGENT_ICON_V3 映射（v2 → v3）；normalizeAgentIcon 改链式归一（先 AGENT_ICON_V2 再 AGENT_ICON_V3）；心理咨询师 / 情感顾问两个模板 icon 改 v3',
          'store/agent.js：内置思迹助手 icon 改 v3',
          'utils/ai/tools/agent.js：AGENT_ICON_OPTIONS 与 buildAgentPayload 默认 icon 改 v3',
          'pages/settings/sub/agent_add.vue：头像选择动态拼接与默认 icon 改 v3',
          'components/common/AgentAvatar.vue：深色模式黑圆头像加 #3F3F46 细边框',
          'components/chat/AgentSwitcher.vue：头像 src 走 normalizeAgentIcon（原来直接用原始路径），深色模式加细边框',
        ],
      },
    ],
  },
  {
    version: '4.5.0',
    date: '2026-09-28',
    title: '4.5.0 上班打卡：到点提醒可推迟、弹窗直达打卡；进入对话收敛成一条单消息（问候+总结+计划点破+下一步）',
    summary: [
      '上班模板入库：一个根计划带「上班打卡 / 下班打卡」两个每日循环子计划，各自带 08:30 / 18:00 的每日提醒（模板体系新增 reminder 字段，创建计划时提醒配置一并落位）',
      '提醒弹窗升级 ActionSheet：立即打卡（直达落库 + 里程碑回执）/ 推迟 5/15/30 分钟 / 查看计划；直接关掉 = 按默认档推迟；推迟期间不当天免打扰，到点重响，可连续推',
      '修掉 repeatType 不落盘的缺口：设置页采集了循环类型但存储丢掉，daily/weekly/weekdays 循环提醒实际从未生效；提醒编辑区新增「弹出后默认推迟」全局档位',
      '进入对话收敛成一条单消息：问候 + 进展总结 + 计划过时/快到期点破（新增 plan-alerts）+ 上班卡未打提醒 + 下一步建议；聊天页「下一步」单卡取消（并入消息，每天一次语义保留），新对话不再回落欢迎语',
      '测试 84 文件 / 1203 用例全绿（新增 plan-alerts / reminder-snooze / work-template 三个文件）；holidays 测试修日期漂移（中秋过后期望值动态推导，不再硬编码 9/25）',
    ],
    categories: [
      {
        title: '上班打卡（4.5.0）',
        items: [
          'utils/storage/plan.js：tpl_work 模板 —— 根计划「上班」+ 上班打卡（08:30）/ 下班打卡（18:00）两个 daily 子计划，tags: [\'工作\']（进入消息按这个口径识别）；ensureDefaultTemplates 增量补发',
          'store/data.js 的 createPlanFromTemplate：支持模板 plan_data / 子任务的 reminder 字段，创建后逐个 setPlanReminder；子计划 tags 从 spec 透传（原来写死空数组）；提醒写失败不影响模板创建',
          'utils/reminder/notifier.js：triggerReminder 前台弹窗改 uni.showActionSheet（三端一致）——「立即打卡」直接 logPlanCheckIn 落库 + checkinFeedback 里程碑回执；后台 plus.push / H5 Notification / 小程序订阅消息行为不变（通知点击只拉起 App，进入后由 60s 轮询补弹）',
        ],
      },
      {
        title: '提醒推迟 / snooze（4.5.0）',
        items: [
          'utils/reminder/snooze.js（新增）：siji_reminder_snoozed 推迟表 {fireKey: {planId, fireAt}}；推迟中的提醒不写 triggered（到点重响），打卡/查看才 markTriggered + clearSnooze，可连续推迟',
          'utils/reminder/scheduler.js：checkAllReminders 拆成两条触发路径（snooze 到期重响 ∪ 常规命中），同 fireKey 只走一条；触发后不再立即 markTriggered，选择经回调落账（onDone / onSnooze）；弹窗打开期间 openSheets 防重',
          'utils/reminder/settings.js：修 repeatType 不落盘（原来 UI 采集了但 setPlanReminder 丢掉，循环提醒实际存不进去）；新增 snoozeMin 全局默认档（只认 5/15/30，非法回落 5）',
          'components/plan/PlanReminderSection.vue：新增「弹出后默认推迟」三档选择（全局设置，不走表单 proxy）',
          'utils/reminder.js：聚合出口补 snooze / snoozeMin / SNOOZE_OPTIONS',
        ],
      },
      {
        title: '进入对话单消息（4.5.0）',
        items: [
          'utils/plan-alerts.js（新增）：collectPlanAlerts 纯函数 —— 过时（截止已过未完成）/ 快到期（3 天内）两组警示，只报顶层、循环/已完成/冷藏/顺延不参与',
          'utils/enter-dialogue.js：buildEnterSummaryMessage 恒产出（问候 + 进展 + 状态 + 上班卡 + 下一步 + 通用按钮，空内容也出问候开场）；新增 buildPlanAlertLines / buildWorkLine / buildNextStepLine / buildGreeting；按钮新增 checkin（直达打卡）与 next（预置「开始做X」）；签名扩计划状态、nextStep 不进签名',
          'composables/useEnterSummary.js：computeSummary 挂载计划状态包（alerts / workStatus / nextStep 候选，只挑不标记）；新增 snapshotEnterContext（无窗口语义的当下快照，中对话新建用）',
          'composables/useChatSession.js：appendEnterSummary 恒产出 + 消息落对话时 markNextStepShown（占用当天名额）；buildOpenerMessage 供会话管理器播种；maybeStartFreshSession 欢迎语回落取消',
          'composables/useConversationManager.js：空会话种子消息走 seedOpener（同一套单消息），没传才回落旧欢迎语',
          'pages/chat/index.vue + useChatEngine.js：删「下一步」单卡（模板/样式/offerNextStep）；handleEnterButton 支持 checkin 分支；开场兜底改 appendEnterSummary(null) 快照',
        ],
      },
      {
        title: '测试与工程（4.5.0）',
        items: [
          '新增 tests/plan-alerts.test.js（口径与排除项）、tests/reminder-snooze.test.js（推迟重响/直达打卡/关掉=默认档推迟/计划删除清表 + repeatType 落盘）、tests/work-template.test.js（模板幂等/提醒落位/坏数据不炸）',
          '更新 chat-session / enter-dialogue 测试到恒产出语义；setup.js 补 showActionSheet mock；chat-opener 三处弹窗计数同步',
          'tests/holidays.test.js：修日期漂移 —— 「中秋国庆」用例期望值改为 inferHolidayFromText 动态推导（2026-09-25 中秋已过，旧断言每天必挂）',
          '全量 NODE_OPTIONS=--max-old-space-size=4096 + vitest run --maxWorkers=2：84 文件 / 1203 用例全绿',
        ],
      },
    ],
  },
]
