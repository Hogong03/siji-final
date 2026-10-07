/**
 * 版本日志数据段：4.18.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V418 = [
  {
    version: '4.18.0',
    date: '2026-10-07',
    title: 'UI 收口批次：功能页去重操作、计划总览降噪、账单卡合并行、记录 chip 选中态回归灰阶、聊天按钮胶囊统一',
    summary: [
      '功能页三个入口右侧的黑色"+"圆按钮删除 —— 与跳转箭头挤一行语义混乱，快速创建各页 FAB 已有（记录/计划/账单），一行只留跳转',
      '计划总览的「紧急/重要/普通」标签行统一灰阶（原红字在浅灰底上过跳），优先级颜色由上方色条表达',
      '账单统计卡无预算时「点击设置月度预算」与「收支统计→」合并成一行两端对齐，卡片下半不再空',
      '记录页标签 chip 选中态从黑底白字改 #F4F4F5 浅灰底黑字（深色模式对应 #3F3F46 底白字），与四级灰阶设计系统一致',
      '聊天空态/消息内按钮 enter-btn 胶囊化（圆角 10→24rpx、内距对齐），与底部建议条 suggestion-chip 视觉语言统一',
    ],
    categories: [
      {
        title: 'UI 收口（4.18.0）',
        items: [
          'pages/functions/index.vue：entry-right 删 entry-new-btn，funcEntries 删 newPage 死数据；functions.scss 删 .entry-new-btn/.entry-new-text 及两处深色行',
          'pages/plan/components/PlanOverview.vue：pb-label 去 p.color 内联着色，统一 #71717A（深色 #A1A1AA），两处深色块同步',
          'pages/bill/index.vue：budget-set-hint 改两端对齐行（左预算入口右收支统计），stats-link 加 v-if 避免重复入口；index.scss 对应样式',
          'pages/diary/list.scss：.quick-tag.active 浅灰底黑字，深色两处块（theme-dark / MP media）同步 #3F3F46',
          'pages/chat/chat.scss：.enter-btn 圆角 24rpx + 内距 24rpx 对齐 suggestion-chip',
        ],
      },
    ],
  },
]
