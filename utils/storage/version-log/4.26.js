/**
 * 版本日志数据段：4.26.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V426 = [
  {
    version: '4.26.0',
    date: '2026-10-12',
    title: '长效计划记录沉淀：首次打卡自动写「开始行动」、阶段/根完成自动写「里程碑」进记录流',
    summary: [
      '画像驱动（以成果为单位 + 可见反馈）：长效打卡计划（如 6 个月学习路线）的进展不再只锁在计划详情页 —— 根计划体系下的第一次打卡，记录里自动出现「开始行动：{计划名}」（带目标回顾与下一步指引）',
      '阶段完成或整条路线完成时（status 切到已完成），记录里自动沉淀一条「里程碑：{阶段名} 完成」—— 含完成回顾、阶段子树打卡数据（打卡通常打在每周检查点上，统计按阶段子树算）、整线累计次数与下一阶段指引',
      '收口在 storage 层：savePlan 的完成分支与 logPlanCheckIn 的首次打卡 —— UI 快切、AI update_plan、提醒直达打卡、计划详情按钮全部路径自动生效，调用方零改动',
      '三重防刷屏：只对分阶段结构（根下有子计划）的体系写，普通单发小计划不写；每周检查点等深层子项完成不写；幂等登记表（siji_plan_milestones）保证撤销再完成不重复、跨月不重复',
      '记录带「学习」（根计划标签）+「里程碑」标签 —— 记录页按标签筛即可看到整条学习路线的启动与每个阶段落地的痕迹',
    ],
    categories: [
      {
        title: '计划记录沉淀（4.26.0）',
        items: [
          '新增 utils/storage/plan-milestone.js：buildStartRecord / buildMilestoneRecord 纯组装 + claimMilestoneKey 幂等登记 + countCheckinsUnder 子树统计 + writePlanMilestoneIfNeeded / writePlanStartIfNeeded 入口（层级判定：阶段与根写，检查点不写）',
          'utils/storage/plan.js：savePlan 完成分支挂 writePlanMilestoneIfNeeded；logPlanCheckIn 首次打卡（checkins 0→1）挂 writePlanStartIfNeeded；均 try-catch 失败不影响主流程',
          'utils/ai/prompt-actions.js：BEHAVIOR_RULES 补「分阶段计划完成自动沉淀里程碑，AI 不用重复创建，回复提一句即可」',
          'tests/plan-milestone.test.js 5 例：启动记录（标签/内容/幂等/单发计划不写）、里程碑（阶段完成含子树打卡数、根完成全部完成标题、深层不写、撤销再完成不重复）；全量 103 文件 / 1390 用例全绿',
        ],
      },
    ],
  },
]
