/**
 * 版本日志数据段：3.4 线整合条目（3.4.0~3.4.5 发布前合并为一条）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V34 = [
  {
    version: '3.4.5',
    date: '2026-09-09',
    title: '3.4.5（整合 3.4.0~3.4.5，发布前合并）：慢恢复三件套 + 计划打卡与今日一页 + 进入总结与聊天优化',
    summary: [
      '3.4.0 慢恢复三件套：能量模式（utils/energy-context.js 低/极低档注入降载指令）、微光本（siji_glimmers 每日一条「还行的小事」）、计划冷藏（frozen_at「先放一放」，不进逃避候选与画像统计）；周复盘删掉优/良/中/差评分改为观察式收尾',
      '3.4.1~3.4.2 计划打卡与拆解细节：logPlanCheckIn（同日幂等、上限 500 条、不刷 updated_at）+ log_plan_checkin 工具双注册；subtasks 必填 title/description/est_minutes 并支持 start_time/end_time，打卡可补写 note',
      '3.4.3 今日一页与任意时间池：PlanDailyStrip 从活跃计划聚合当天候选（utils/plan-daily.js，每计划最多 3 条可直接打卡/开始）；setPlanSomeday 标记「任意时间」；新增计划执行记录页 pages/plan/records.vue',
      '3.4.4 聊天优化：发送中状态行（sendStage + 计时）、轻追问本地兜底 utils/ai/chat-suggestion.js（各厂商 chips 不再随机缺失）、H5 粘贴图片进压缩预览、AI 气泡「重新生成/换一种说法」显式按钮',
      '3.4.5 进入总结：冷启动（App.vue appReady 一次）聚合计划完成 + 打卡 + 跨月新增记录出进展卡，siji_enter_summary_at 基线推进去重，首次升级静默武装不弹历史数据'
    ],
    categories: [
      {
        title: '慢恢复主线（3.4.0）',
        items: [
          'utils/energy-context.js（新增）：inferEnergyLevel 关键词档位推断（看最近两条用户消息，含否定处理与积极词抵消），低/极低档在 buildChatMessages 注入降载指令（回复更短更软、只给 1 分钟选项、可先放一放），并以 noNudge 抑制逃避点破模板',
          '微光本：siji_glimmers 不分片存储（date 主键同日覆盖），create_glimmer/query_glimmers/delete_glimmer 进 ACTION_MAP 与 TOOL_DEFINITIONS，功能页新增微光本子页（回看与删除，不打卡不评价）',
          '计划冷藏：setPlanFrozen 只标 frozen_at，不动 status/executions/plan_count、同步暂停本地提醒；冷藏计划不进逃避候选、不注入执行上下文、不计入画像「进行中」',
          '周复盘去评价化：generateReview 删除「优/良/中/差」评分与改进建议，改为完成件数 + 观察式描述 + 「已经很好了」；画像删除「本月还未写记录」缺口提醒；PRODUCT_VISION.md 新增三条铁律（静止是合法状态 / 压力来自期待不来自记录 / 弹性默认冷藏）'
        ]
      },
      {
        title: '计划打卡与今日一页（3.4.1~3.4.3）',
        items: [
          '计划打卡：utils/storage/plan.js logPlanCheckIn/getPlanCheckInStats（checkins 独立轻记录，同日幂等、冷藏/已完成禁打卡、上限 500 条），3.4.2 补 note 补写与 getPlanCheckInRecords 明细；log_plan_checkin 工具双注册（CORE_ACTIONS + TOOL_DEFINITIONS）',
          '子计划细节：create_plan/update_plan 的 subtasks 必填 title/description/est_minutes 并支持 start_time/end_time；create_plan_phases 新增 phases 数组（拆解必须写明「做什么/怎么做/完成标准」，禁止只给标题或按数量生成空壳阶段）；convertSubtasksToChildPlans 透传时间',
          '今日一页：utils/plan-daily.js collectDailySuggestions 按日期/周几聚合当天候选（排序轮询 + 去重）+ components/plan/PlanDailyStrip.vue 展示 1-3 条并给打卡/开始入口；usePlanAI 同步约束子计划带时间与描述',
          '任意时间池：utils/storage/plan.js setPlanSomeday 标记/移出 someday_at（不设日期不催），详情页 toggleChildSomeday 与子计划卡一键放入/恢复',
          '执行记录页：utils/plan-daily.js collectPlanExecEvents 聚合打卡/状态变更/子项完成事件，pages/plan/records.vue 按天倒序展示最近执行明细'
        ]
      },
      {
        title: '聊天与进入总结（3.4.4~3.4.5）',
        items: [
          '进入总结：composables/useEnterSummary.js 持有模块级 pending（仅冷启动计算一次），siji_enter_summary_at 记录确认基线（首启武装 / 空窗口推进 / 确认后推进）；utils/enter-summary.js 聚合计划完成（executions done）+ 打卡 + 跨月新增记录，事件上限 6 条，formatSummaryTime 输出今天/昨天/日期标签',
          '发送状态行与轻追问：useChatEngine.js sendStage（idle/thinking/streaming）+ 1s 步进计时，finally 统一复位；utils/ai/chat-suggestion.js 纯规则兜底生成 suggestions（账单/记录/计划/个人信息分主题映射，禁评价式催促式伪建议），带 action 的 JSON 不强补',
          'H5 粘贴图片与 AI 气泡操作：InputArea.vue @paste 拦截图片进压缩预览（utils/image.js 新增 compressFileObject），不再触发浏览器下载弹框；MessageBubble.vue 最后一条 AI 回复新增「重新生成/换一种说法」，换说法时禁止再次执行操作'
        ]
      }
    ]
  },
]
