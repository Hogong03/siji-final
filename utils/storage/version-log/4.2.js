/**
 * 版本日志数据段：4.2.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V42 = [
  {
    version: '4.2.1',
    date: '2026-09-17',
    title: '4.2.1 记录筛选面板改成底部弹出（原来被导航栏盖住）',
    summary: [
      '问题：点筛选按钮后，面板从页面顶部滑出（position: fixed; top: 0），H5 与自定义导航栏下被导航栏压住，面板标题行点不到',
      '修法：改成底部弹出（bottom: 0 + translateY(100%) → 显形 translateY(0)），顶部圆角与安全区留白一并调整；手机上一只手也够得到',
      '层级同步抬高：遮罩 200 → 999、面板 201 → 1000，压在工具栏（101）与右下角新建按钮（100）之上',
      '同类问题扫过全项目：只有这一处是「顶部滑出」的面板（chat.scss 里那处 translateY(-100%) 是横幅入场动画，不受影响）'
    ],
    categories: [
      {
        title: '筛选面板（4.2.1）',
        items: [
          'pages/diary/list.scss：.filter-panel 的 top: 0 → left/right/bottom: 0；圆角 0 0 24rpx → 24rpx 24rpx 0；transform: translateY(-100%) → translateY(100%)；padding-bottom 加 24rpx 基础值 + 安全区；z-index 201 → 1000，.filter-overlay 200 → 999'
        ]
      }
    ]
  },
  {
    version: '4.2.0',
    date: '2026-09-17',
    title: '4.2.0 记录模块收敛：类型 5→3、分类并入标签、筛选 4→2、加「翻一翻」回顾',
    summary: [
      '类型 5 种收敛到 3 种（记录 / 日记 / 待办）：灵感与闪念跟随手记的行为差异为零，只有情绪色彩不同 —— 记的时候不该先做一次分类；语义由自动标签保住（#灵感 / #闪念），存量记录一次性迁移（旧值补同名标签，不丢信息）',
      '分类维度从 3 套（类型 × 分类 × 标签）压到 1 套：分类并入标签，工作 / 生活 / 健康 / 思考 这些分类值直接变成同名标签；类型不再算分类（它只决定编辑器形态）。存量分类值一次性转标签，字段清空',
      '筛选入口 4 → 2：时间范围从 13 个 chip 收敛到「全部 / 本月 / 上月」，标签做成一排快捷 chips（按使用频次取前 8 个，点一下就筛）；搜索框支持一句话筛选（「上周的工作记录」自动落时间范围 + 关键词）',
      '新增「翻一翻」回顾卡（每天一次）：从 7 天前 / 30 天前 / 去年今日三个窗口各挑一条旧记录推到眼前，点开直接进阅读页 —— 记录写完不看等于没记，这是市面方案里最值钱的机制',
      'AI 补三件：记完自动打 1-3 个标签（优先复用已有标签，选不出就不打，防标签爆炸）、列表副标题改成「第一句」（比正文截断有信息量）',
      '方案依据：docs/记录方案对比.html（flomo 的零摩擦记录 + 每日回顾、PARA 的「不再纠结放哪个类目」、子弹笔记的迁移、Day One 的时间线）'
    ],
    categories: [
      {
        title: '记录模块收敛（4.2.0）',
        items: [
          'utils/storage/diary.js：RECORD_TYPE_KEYS（note/diary/todo）、LEGACY_TYPE_MAP（idea/flash→note）、LEGACY_TYPE_TAGS（补同名标签）；migrateRecordTypes() 与 migrateDiaryCategories() 两个幂等迁移（跳过已删除记录）；getDiariesBetween(from,to) 跨月取记录（回顾与筛选的数据源）；candidateDiaryKeys 复用「近 13 个月 + 存储清单」的扫描口径',
          'App.vue：appReady 里在 ensureCet6Tips() 之后跑两个迁移，失败只告警不影响启动',
          'pages/diary/detail.vue：RECORD_TYPES 三选一（记录/日记/待办）；删除「分类」选择区块、分类加载、闪念模式（isFlashMode 及其模板条件、样式）',
          'store/executors/diary.js：类型推断改为 diary/todo/note 三档；白名单校验用 RECORD_TYPE_KEYS（旧值不再写进存储）；创建记录时 tags 为空则调用 suggestTags 自动打标签',
          'utils/diary-tags.js（新增，纯函数）：suggestTags 两条规则 —— 先复用标签库里已有的名字（最长优先），再落到 9 组内置关键词表；上限 AUTO_TAG_LIMIT=3，都不命中就返回空',
          'utils/diary-query.js（新增，纯函数）：parseDiaryQuery（一句话 → 时间范围 + 关键词，去分类词与疑问短语）、rangeToTimestamps（本周从周一起算、上月为完整自然月）、firstSentence（列表副标题取第一句）',
          'utils/record-review.js（新增，纯函数）：pickReviewRecords 三个时间窗各挑一条，长度打分优先（30-160 字最舒服），跳过已删除',
          'composables/useDiaryList.js：months 收敛到 3 项（全部/本月/上月）；删除 filterCategory / categories / loadCategories / toggleCategory；新增 quickTags（前 8）、reviewRecords + loadReview + dismissReview（每天一次的标志位）、applyQuery（一句话筛选落地）',
          'pages/diary/list.vue + list.scss：工具栏下加快捷标签条与「翻一翻」回顾卡（点击进阅读页）、副标题改 firstSentence、搜索框 placeholder 与 @confirm 走 applyQuery；激活筛选 chip 显示关键词',
          'utils/ai/tools/diary.js + utils/ai/prompt-actions.js：record_type 的 enum 与描述收敛到三选一（想法/灵感/闪念都归 note），并说明标签由系统自动打'
        ]
      },
      {
        title: '测试（4.2.0）',
        items: [
          'tests/diary-refactor.test.js（新增 18 例）：类型迁移（思想/闪念→note + 补标签、幂等、已删除不动）、分类迁移（转标签、不重复、幂等）、自动打标签（复用已有标签 / 内置词表 / 上限 3 / 不命中不打 / 不重复）、一句话筛选（四种说法 + 时间换算 + 未知范围）、副标题取第一句、回顾挑选（三窗口各一条 / 少给不硬凑 / 跳过已删除 / 短内容降权）、跨月取记录',
          'tests/executors.test.js 与 tests/bugfix-regression.test.js：按新白名单更新（idea 不再合法、旧类型值落到 note、想法自动带「灵感」标签、todo 推断保留）',
          '全量：76 文件 / 1111 用例全绿（npx vitest run --maxWorkers=2，exit 0）'
        ]
      }
    ]
  }
]
