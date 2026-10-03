/**
 * 版本日志数据段：4.2.x（新版本在前）
 *
 * 发布前合并：4.2.0 / 4.2.1 两条补丁记录合并为一条 4.2.1（应用未发布，合并降噪；
 * title 注明整合范围，明细按主题归并，原文的文件名/技术结论/排坑记录保留）。
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V42 = [
  {
    version: '4.2.1',
    date: '2026-09-17',
    title: '4.2.1（整合 4.2.0~4.2.1，发布前合并）：记录模块收敛（类型 5→3、分类并入标签、筛选 4→2、翻一翻回顾）+ 筛选面板改底部弹出',
    summary: [
      '类型 5 种收敛到 3 种（记录/日记/待办）：灵感与闪念跟随手记的行为差异为零，语义由自动标签保住（#灵感/#闪念）；存量记录一次性迁移（旧值补同名标签，不丢信息）',
      '分类维度 3 套（类型×分类×标签）压到 1 套：分类并入标签（工作/生活/健康/思考 变同名标签，类型只决定编辑器形态）；存量分类值一次性转标签、字段清空',
      '筛选入口 4→2：时间 13 个 chip 收敛到「全部/本月/上月」，标签做快捷 chips（按使用频次取前 8）；搜索框一句话筛选（「上周的工作记录」自动落时间范围+关键词）',
      '新增「翻一翻」回顾卡（每天一次）：从 7 天前/30 天前/去年今日三个窗口各挑一条旧记录，点开直接进阅读页；AI 补三件：记完自动打 1-3 个标签（防标签爆炸）、列表副标题改「第一句」',
      '修筛选面板被导航栏盖住：从顶部滑出（fixed top:0）改底部弹出（bottom:0 + translateY(100%)→0），遮罩 200→999、面板 201→1000；同类问题扫全项目仅此一处（chat.scss 的 translateY(-100%) 是横幅入场动画，不受影响）',
      '方案依据：docs/记录方案对比.html（flomo 零摩擦记录 + 每日回顾、PARA「不再纠结放哪个类目」、子弹笔记的迁移、Day One 的时间线）'
    ],
    categories: [
      {
        title: '记录模块收敛（4.2.0）',
        items: [
          'utils/storage/diary.js：RECORD_TYPE_KEYS（note/diary/todo）、LEGACY_TYPE_MAP（idea/flash→note）、LEGACY_TYPE_TAGS（补同名标签）；migrateRecordTypes() 与 migrateDiaryCategories() 幂等迁移（跳过已删除记录）；getDiariesBetween 跨月取记录（回顾与筛选的数据源）',
          'pages/diary/detail.vue：RECORD_TYPES 三选一，删「分类」区块与闪念模式；store/executors/diary.js：类型推断改三档、白名单校验用 RECORD_TYPE_KEYS，创建时 tags 为空调 suggestTags 自动打标签',
          'utils/diary-tags.js（新增）：suggestTags 先复用标签库已有名字（最长优先）再落 9 组内置关键词表，上限 AUTO_TAG_LIMIT=3、不命中不打；utils/diary-query.js（新增）：parseDiaryQuery 一句话筛选 + rangeToTimestamps（本周周一起算、上月完整自然月）+ firstSentence（副标题取第一句）',
          'utils/record-review.js（新增）：pickReviewRecords 三个时间窗各挑一条，长度打分优先（30-160 字最舒服），跳过已删除；composables/useDiaryList.js：months 收敛 3 项、删 filterCategory 一套、新增 quickTags/reviewRecords/loadReview/dismissReview/applyQuery',
          'pages/diary/list.vue + list.scss：工具栏下加快捷标签条与「翻一翻」回顾卡，副标题改 firstSentence，搜索 @confirm 走 applyQuery；utils/ai/tools/diary.js + prompt-actions.js：record_type enum 收敛三选一并说明标签由系统自动打',
          'App.vue：appReady 里在 ensureCet6Tips() 之后跑两个迁移，失败只告警不影响启动'
        ]
      },
      {
        title: '筛选面板底部弹出（4.2.1）',
        items: [
          'pages/diary/list.scss：.filter-panel top:0 → left/right/bottom:0，圆角 0 0 24rpx → 24rpx 24rpx 0，translateY(-100%) → translateY(100%)，padding-bottom 加基础值+安全区；z-index 201→1000、遮罩 200→999'
        ]
      },
      {
        title: '测试（4.2.0）',
        items: [
          'tests/diary-refactor.test.js（新增 18 例）：类型/分类迁移幂等、自动打标签（复用已有/内置词表/上限 3/不命中不打）、一句话筛选（四种说法+时间换算）、副标题、回顾挑选、跨月取记录；tests/executors.test.js 与 bugfix-regression.test.js 按新白名单更新（idea 不再合法、想法自动带「灵感」标签）',
          '全量 76 文件 / 1111 用例全绿（npx vitest run --maxWorkers=2，exit 0）'
        ]
      }
    ]
  }
]
