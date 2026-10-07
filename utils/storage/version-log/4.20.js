/**
 * 版本日志数据段：4.20.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V420 = [
  {
    version: '4.20.0',
    date: '2026-10-07',
    title: 'AI 主动洞察：周播报从「三个数字」升级为归因分析 + 连续消费模式 + 可执行建议',
    summary: [
      '每周首次打开 App（沿用周一为周界的一周一次门控），进入消息自动带上上周完整洞察：总花费、最大分类的金额/占比/环比、连续消费模式（如外卖连着 5 天每天超 20 元）、打卡次数、记录篇数与一句可执行的追问',
      '统计窗口修正：旧周播报算「本周至今」（周一打开几乎为空），4.20.0 对齐「周一早上播刚结束的那一周」—— 统计周=上周，对比周=上上周',
      '新增 utils/weekly-insights.js 洞察层：分类级环比（buildCategoryTrends）、连续同分类消费识别（findSpendingStreak，连续 ≥3 天且日均 ≥20 元）、上周打卡统计（含子计划）、跨月记录计数、建议规则引擎（连续模式优先，其次分类环比涨超 30% 且占比过半）',
      '建议落地为对话：洞察正文尾部带「要不要看看XX都花在哪了？」，简报卡 chips 出「看看花在哪」预置按钮（预填追问，AI 走 query_bill 接得住）；指标格新增「上周支出」',
      '能力开关沿用 week_bill（设置 → AI 配置可关）；数据全部本地计算，不打 API',
    ],
    categories: [
      {
        title: '周洞察（4.20.0）',
        items: [
          '新增 utils/weekly-insights.js（纯函数 + 读取聚合，约 230 行）：分层复用 bill-weekly 的区间汇总/周界/门控，不重复实现',
          'composables/useEnterSummary.js：weekBill 数据源从 buildWeeklyBillAnnouncement 换为 buildWeeklyInsightAnnouncement（markWeeklyBillAnnounced 门控职责不变）',
          'utils/enter-dialogue.js：buildEnterButtons 新增 insight 预置按钮（prefill 追问）；buildBriefingMetrics 新增「上周支出」格',
          'EnterBriefing.vue 零改动 —— 全部走数据驱动的 metrics/chips/content 通道',
          'tests/weekly-insights.test.js 15 例：环比/连续段断天/阈值/打卡口径/跨月计数/建议优先级/门控幂等，夹具日期现算',
        ],
      },
    ],
  },
]
