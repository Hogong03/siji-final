/**
 * 版本日志数据段：4.30.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V430 = [
  {
    version: '4.33.4',
    date: '2026-10-18',
    title: '画像按钮颜色加深、图标放大、间距收紧',
    summary: [
      '按钮图标从低 opacity 灰改为固定深灰 #52525B/#71717A，颜色更清晰',
      '字段行图标 16→20、卡片头 18→22，视觉尺寸再放大',
      '按钮热区从 48rpx 收到 40rpx、padding 10→6rpx、按钮间距 gap 4→2rpx，整体更紧凑',
    ],
    categories: [
      {
        title: 'UI 调整',
        items: [
          'pages/settings/sub/profile.scss：.field-edit/.field-clear/.card-edit-btn/.card-delete/.card-collapse 去掉 opacity 改 color: #52525B/#71717A；min 48rpx→40rpx；padding 10rpx→6rpx；.field-actions gap 4rpx→2rpx',
          'pages/settings/sub/profile.vue：SijiIcon size 16→20（字段行）、18→22（卡片头），加 color 属性固定色',
        ],
      },
    ],
  },
  {
    version: '4.33.3',
    date: '2026-10-18',
    title: '画像页小按钮热区扩大到 48rpx，图标同步放大',
    summary: [
      '字段行铅笔/删除按钮、卡片头部编辑/删除/折叠箭头热区统一扩到 48rpx 最小触控尺寸',
      'chip 删除按钮热区扩到 36rpx',
      '图标尺寸同步放大：字段行 12→16，卡片头部 14/16→18',
    ],
    categories: [
      {
        title: 'UI 调整',
        items: [
          'pages/settings/sub/profile.scss：.field-edit/.field-clear/.card-edit-btn/.card-delete/.card-collapse 统一加 display:flex + min-width/min-height 48rpx + padding 10rpx；.chip-remove 加 min 36rpx',
          'pages/settings/sub/profile.vue：SijiIcon size 从 12→16（字段行）、14/16→18（卡片头部）',
        ],
      },
    ],
  },
  {
    version: '4.33.2',
    date: '2026-10-18',
    title: '画像卡片标题行只读，折叠/展开收敛到右侧箭头',
    summary: [
      '点"我的画像"标题文字不再误触折叠，标题行默认只读',
      '折叠/展开操作收敛到右侧 chevron 箭头按钮，明确可点区域',
      '自定义卡片的标题编辑仍走右侧铅笔按钮，入口不变',
    ],
    categories: [
      {
        title: '交互调整',
        items: [
          'pages/settings/sub/profile.vue：card-header 去掉整行 @tap，card-title-wrap 去掉 @tap.stop="handleTitleTap"，card-collapse 加 @tap.stop="toggleCard(card.id)"',
        ],
      },
    ],
  },
  {
    version: '4.33.1',
    date: '2026-10-18',
    title: '画像字段防误触：已填值默认只读，点正文不弹编辑框',
    summary: [
      '已填值字段点击正文不再触发编辑，避免阅读画像时误触弹输入框',
      '右侧新增小铅笔按钮才触发编辑，删除按钮保留在铅笔旁',
      '空字段（"点击填写"）保持原交互，点击直接进入填写',
    ],
    categories: [
      {
        title: '交互调整',
        items: [
          'pages/settings/sub/profile.vue：三处 field-display 的 @tap 从"整行触发"改为"仅空值触发"（!value && startEditField），有值字段右侧包一层 field-actions，内含 field-edit 铅笔按钮与 field-clear 删除按钮',
          'pages/settings/sub/profile.scss：新增 .field-actions（flex+gap 4rpx）与 .field-edit（padding 8rpx、opacity 0.4），与 .field-clear 同尺寸小图标',
        ],
      },
    ],
  },
  {
    version: '4.33.0',
    date: '2026-10-18',
    title: '删除"基本信息/生活方式"两张固定卡，字段并入"我的画像"',
    summary: [
      '我的信息页从三张固定卡收敛为一张"我的画像"卡：昵称/性别/生日/职业/所在地/简介/预算/作息/爱好/饮食全部归入画像卡，平铺在三层分组下方',
      '一次性迁移：老用户刷新后，basic/lifestyle 两张卡自动消失，已填值合并进 portrait（标量不覆盖、数组去重合并），不丢数据',
      '记忆自动采纳（suggestProfileAdoption）目标从 basic/lifestyle 统一改为 portrait，AI 抽取的事实/偏好直接写画像卡',
      'addArrayItem 字段不是数组时自动初始化为空数组再追加，行为更健壮；画像卡改为不可删除',
    ],
    categories: [
      {
        title: '数据结构',
        items: [
          'utils/profile.js：createEmptyProfile 默认 cards 从 [basic, lifestyle] 改为 []（portrait 由 profile-seed 注入）',
          'utils/profile.js：新增 migrateLegacyCards(data)，把 basic/lifestyle 卡字段 merge 进 portrait（数组用 Set 去重、标量仅空值才写），merge 完 filter 删除这两张卡',
          'utils/profile.js：getProfile 里"确保 basic/lifestyle 存在"的自动补卡逻辑改为调用 migrateLegacyCards；deleteCard 守卫从 basic/lifestyle 改为 portrait',
          'utils/profile.js：addArrayItem 在 card.fields[field] 不是数组时初始化为 [] 再追加',
        ],
      },
      {
        title: '记忆联动',
        items: [
          'utils/memory/profile-link.js：FACT_RULES（9条）与 PREF_RULES（2条）的 cardId/cardTitle 从 basic/生活方式、lifestyle/基本信息统一改为 portrait/我的画像',
        ],
      },
      {
        title: '测试适配',
        items: [
          'tests/memory-profile.test.js：seedProfile helper 改为确保 portrait 卡存在；所有 lifestyle/basic 引用改为 portrait',
          'tests/memory-governance.test.js：seedProfileField helper 从 lifestyle 改为 portrait，不存在则新建',
        ],
      },
    ],
  },
  {
    version: '4.32.0',
    date: '2026-10-18',
    title: '关系图谱入口内联到标题行 + 内置画像字段重构（补"我怎么做"三层）',
    summary: [
      '关系图谱入口从独立卡片移到"个人信息"标题右边，灰色小胶囊"♡ 关系图谱·N人"，节省一屏高度',
      '内置画像卡字段从 9 个扩到 12 个，与三层分组完全对齐：新增"我怎么做"层（行动原则/产品意识/创业潜力）',
      'ensureProfileSeed 的卡写入逻辑从"存在即跳过"改为 merge：老用户刷新后自动补全新字段，已填的自定义值不被覆盖',
      'seed_v 从 1 bump 到 2，记录内容同步刷新；人生关键词扩为"不要后悔；回头看时不觉得白活了"',
    ],
    categories: [
      {
        title: 'UI 调整',
        items: [
          'pages/settings/sub/profile.vue：删除独立 relations-entry 卡，header-title 行内加 rel-link 小胶囊（心形图标 + "关系图谱·N人"），v-if="enabled" 且 @tap.stop 跳关系图谱',
          'pages/settings/sub/profile.scss：新增 .header-title-row（flex+gap 12rpx）与 .rel-link（22rpx 字、#71717A 字、#F4F4F5 底、20rpx 圆角），深色双通道补 .rel-link { background:#3F3F46; color:#A1A1AA }',
        ],
      },
      {
        title: '内置画像重构',
        items: [
          'utils/storage/profile-seed.js：PROFILE_CARD_FIELDS 从 9 字段扩到 12 字段，按三层分组重排；新增行动原则（以成果为单位/不等待动力/做项目接触用户）、产品意识（先调研需求/从会调用 AI 到能做 AI 系统）、创业潜力（技术壁垒→副业→条件成熟再创业，不裸辞）',
          'ensureProfileSeed 卡写入逻辑改为 merge：卡不存在则新建；已存在则遍历 PROFILE_CARD_FIELDS，只补"缺失或空"的字段，用户已填的非空值不覆盖，并更新 card.updatedAt',
          'PROFILE_SEED_VERSION 从 1 bump 到 2，老用户刷新后自动获得新字段且不丢手改内容',
        ],
      },
    ],
  },
  {
    version: '4.31.0',
    date: '2026-10-18',
    title: '我的信息升级：画像三层分组 + 完整度进度条 + 人生六维概览 + JSON 导出',
    summary: [
      '画像卡字段按「我是谁 / 我要去哪 / 我怎么做」三层分组渲染（参考 Replika、Serenity 人生领域划分），不再 12 字段平铺',
      '顶部开关卡显示完整度百分比与细进度条（已完善 X%，已填/总项）',
      '新增人生六维概览条：职业/财务/家庭/感情/成长/健康，已填实色、未填灰点',
      '底部新增「导出画像 JSON」按钮（H5 下载文件，App/MP 复制到剪贴板），解决 localStorage 换机丢失',
    ],
    categories: [
      {
        title: '我的信息页面',
        items: [
          'pages/settings/sub/profile.vue：新增 PROFILE_GROUPS 三层映射、groupCardFields 分组函数、cardGroups 预计算、LIFE_DIMENSIONS 六维 computed、totalFields/fillPercent 完整度、handleExport 导出函数；模板按分组渲染（hasGroups 分支 vs 平铺分支）、顶部进度条、六维概览条、底部导出按钮',
          'pages/settings/sub/profile.scss：新增 .progress-wrap/.progress-bar/.progress-fill、.life-wheel/.lw-title/.lw-dims/.lw-dim/.dot/.lw-label、.field-group/.group-label、.btn-secondary 浅色样式，深色双通道（H5/App html.theme-dark + MP @media）同步补齐',
        ],
      },
    ],
  },
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
