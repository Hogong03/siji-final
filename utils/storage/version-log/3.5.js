/**
 * 版本日志数据段：3.5.10 - 3.5.4（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V35 = [
  {
    version: '3.5.10',
    date: '2026-09-13',
    title: '3.5.10 介绍网站新增 44 秒介绍片：滚到就静音播，滚走就暂停',
    summary: [
      '介绍网站新增「介绍片」区块（#demo）与导航入口，首屏主按钮改为直达：「看 44 秒介绍片」',
      '成片 1920×1080 / 30fps / 44.0 秒 / 无音轨 / 1.10 MB，全程纯黑白 Zinc，零渐变零阴影，与 App 同一套设计语言',
      '滚动进入视口（可见过半）自动静音播放，滚出立即暂停；系统开启「减弱动态效果」时完全不自动播，交还手动控制',
      '封面帧先出图、视频只预加载元数据，播放走原生 video 标签，不引入任何播放器库',
      '介绍片与站点同在 site/ 目录，与 HBuilder X 打包的 App 产物互不影响，App 包体内不含视频',
    ],
    categories: [
      {
        title: '介绍片 3.5.10',
        items: [
          'site/assets/siji-intro.mp4（新增 1,153,386 字节）：h264 / yuv420p / 1920×1080 / 30fps / 1320 帧 / 44.000 秒，无音轨',
          'site/assets/siji-intro-poster.jpg（新增 93,385 字节）：成片封面帧，由 video 的 poster 属性直接引用',
          'site/index.html：导航新增「介绍片」链接，首屏主按钮跳转 #demo，在「设计原则」前插入 #demo 区块（video + 降级链接 + 说明文字），首屏与页脚版本号同步 3.5.10',
          'site/styles.css（新增 5 条规则）：.demo / .demo__video（宽度 100%、16:9、纯黑底、1px 边框、卡片圆角）/ .demo__cap',
          'site/main.js（新增）：IntersectionObserver 阈值 0.55，进入视口 play()、离开视口 pause()，play() 返回的 Promise 异常静默吞掉，浏览器拦截自动播放时不报错',
          'site/video/render.mjs + site/video/encode.mjs（新增）：CDP 逐帧截屏 + ffmpeg libx264 编码的两段式管线，--out 指定输出，随时可增量重渲染',
        ],
      },
      {
        title: '文案与合规 3.5.10',
        items: [
          '介绍片文案只讲可验证的产品行为：说话点确认才落库、不打卡不连击不评分、静止是合法状态',
          '画面与文案均不含健康隐私描述，页脚「不做医疗诊断」的免责声明保持原样',
          '画面素材全部自绘，无第三方图片与字体，字体走系统默认栈',
        ],
      },
    ],
  },
  {
    version: '3.5.9',
    date: '2026-09-13',
    title: '3.5.9 新增思迹介绍网站：site/ 纯静态四件套，零依赖双击即开',
    summary: [
      '新增 site/ 介绍网站（index.html + styles.css + main.js + assets/app-icon.png），纯静态零依赖零构建，双击 site/index.html 即可打开，也能原样丢给任意静态托管',
      '视觉沿用 App 的整套设计语言：Zinc 灰阶与纯黑白、零渐变零阴影，prefers-color-scheme 自动深色，prefers-reduced-motion 关掉动画，960px / 640px 两级断点',
      '首屏对话演示按「用户说话 → AI 落库 → 给出下一步 → 加入计划」逐条播放，播完停顿再重放，切到后台暂停，进入视口才启动',
      '文案全部取自仓库真实内容（PRODUCT_VISION 的设计原则与「只做两件事」，版本日志里的 3.5.6 / 3.5.4 / 3.5.0 条目），不编造功能；页脚保留不做医疗诊断的免责声明',
      '窄屏 390px 实测：导航不再隐藏，改为可横向滑动的链接条；补全 og:title / og:image / twitter:card / theme-color 分享信息',
    ],
    categories: [
      {
        title: '介绍网站 3.5.9',
        items: [
          'site/index.html（新增 236 行）：hero / 设计原则 / 能做什么（六卡）/ AI 的角色 / 隐私 / 最近更新六个区块，含顶部导航与页脚',
          'site/styles.css（新增 193 行）：与 App 同套灰阶与圆角，深色模式走 prefers-color-scheme，640px 断点下导航可横滑、卡片单列',
          'site/main.js（新增 80 行）：导航滚动态、入场淡入、首屏对话演示循环播放，页面切后台暂停',
          'site/assets/app-icon.png（新增）：取自 unpackage 缓存里的 xxxhdpi 图标，同时作为 favicon 与导航 logo',
          '站点不在 pages.json 路由内，与 HBuilder X 打包互不影响；manifest 3.5.9 / 3509',
        ],
      },
    ],
  },
  {
    version: '3.5.8',
    date: '2026-09-13',
    title: '3.5.8 红线收尾：版本日志数据分段 + 计划详情测试拆成表单/动作两条线',
    summary: [
      '版本日志不再单文件堆 2065 行：utils/storage/version-data.js 收敛成 34 行聚合入口，61 条历史记录按大版本切成 utils/storage/version-log/ 下 10 个纯数据段，最长段 283 行',
      '新增版本记录的落点改为最新段 utils/storage/version-log/3.5.js 顶部，聚合入口与 getDefaultHistory() 调用签名不变（版本历史页与老用户增量合并零改动）',
      'tests/plan-detail-split.test.js（357 行）拆为表单线与动作线两个文件，共用装置抽到 tests/helpers/plan-detail.js，22 例用例一条不少',
      '顺手清掉测试里未使用的 getChildPlans import；全量 npx vitest run：45 文件 530 用例全绿（用例数与拆分前一致）'
    ],
    categories: [
      {
        title: '版本数据分段 3.5.8',
        items: [
          'utils/storage/version-data.js：2065 → 34 行，只剩分段 import 与 getDefaultHistory() 拼接',
          'utils/storage/version-log/（新增 10 个纯数据段）：3.5.js（3.5.7 - 3.5.4，168 行）/ 3.5-early.js / 3.4.js / 3.0-3.3.js / 2.3-late.js / 2.3-early.js / 2.2-late.js / 2.2-early.js / 2.0-2.1.js / 1.x.js',
          '搬运用脚本按行切片并逐段校验首尾括号，61 条记录原样保留（3.5.7 仍在最前，1.0.0 仍在最后）',
          'utils/storage/version-history.js：注释标注数据段位置，代码零改动'
        ]
      },
      {
        title: '测试拆分 3.5.8',
        items: [
          'tests/plan-detail-form.test.js（新增 135 行，9 例）：utils/plan-child 子计划落库 + usePlanForm 快照/换入/迁移/落库/冷藏',
          'tests/plan-detail-actions.test.js（新增 188 行，13 例）：usePlanChildActions 进度与侧写 + usePlanNextStep 下一步单卡',
          'tests/helpers/plan-detail.js（新增 69 行）：存储重置、uni mock 记录、makePlan/makeRecurChild、mountForm/mountChildren',
          '删掉原文件 tests/plan-detail-split.test.js（357 行）与其中未使用的 getChildPlans import',
          'manifest 3.5.8 / 3508'
        ]
      }
    ]
  },
  {
    version: '3.5.7',
    date: '2026-09-13',
    title: '3.5.7 计划详情拆分 + 补记回溯上限：detail.vue 940 行拆成 4 个组合式函数 + 3 个分块组件',
    summary: [
      '计划详情页拆到底：detail.vue 从 940 行降到 292 行，脚本只剩组合与生命周期；表单落库、打卡日历、子计划动作、下一步单卡各自独立成组合式函数（pages/plan/composables/usePlanForm.js + usePlanChildActions.js + usePlanNextStep.js）',
      '视图分块：行动区 / 字段区 / AI 区拆成 components/plan/PlanActionSection.vue + PlanFieldsSection.vue + PlanAiTools.vue，样式跟着组件走，公共分块样式抽到 plan-section.scss',
      '补记有上限了：MAX_BACKFILL_DAYS = 30，超过 30 天的历史日不再出现补记入口，热力图右下角小点也不再亮（utils/plan-recur.js isBackfillable）',
      '子计划落库与表单选项抽成纯函数：utils/plan-child.js（buildChildPlanForm / saveChildPlans 递归写孙计划）、utils/plan-options.js（优先级 / 状态 / 循环 / 提醒 / 重复选项）',
      '新增 tests/plan-detail-split.test.js（22 例）钉住拆分后的行为；全量 npx vitest run：44 文件 530 用例全绿',
    ],
    categories: [
      {
        title: '拆分 3.5.7',
        items: [
          'pages/plan/detail.vue：940 到 292 行，只保留组合 + 生命周期（onLoad / onShow / onBackPress）+ 跳转',
          'pages/plan/composables/usePlanForm.js（新增）：表单状态、选项、退出快照、存量计划换入、旧数据迁移、整体落库、冷藏与删除',
          'pages/plan/composables/usePlanChildActions.js（新增）：子计划进度与自动收尾、列表刷新、任意时间 / 打卡 / 循环设置',
          'pages/plan/composables/usePlanNextStep.js（新增）：执行日志、下一步候选、一键完成（循环子计划走打卡不置完成）',
          'components/plan/PlanActionSection.vue / PlanFieldsSection.vue / PlanAiTools.vue（新增）+ 各自 scss：模板分块，props 与 emits 显式传递，不直接改父级对象',
          'components/plan/plan-section.scss（新增）：.section / .section-label 分块公共样式（含深色）',
          'utils/plan-child.js（新增）：buildChildPlanForm / saveChildPlans（递归写孙计划、落库前剔除 _subCount 展示字段）',
          'utils/plan-options.js（新增）：优先级 / 状态 / 循环 / 提醒 / 重复选项常量，页面与分块组件共用',
          'pages/plan/detail.scss：630 到 71 行，只剩页面骨架与底部操作栏',
        ]
      },
      {
        title: '补记上限与测试 3.5.7',
        items: [
          'utils/plan-recur.js：新增 MAX_BACKFILL_DAYS = 30，isBackfillable 增加回溯窗口判断，backfillCandidates 只吐窗口内的日子',
          'tests/plan-recur.test.js：新增回溯上限边界用例（第 30 天可补、第 31 天不给补）',
          'tests/plan-detail-split.test.js（新增 22 例）：子计划落库 / 快照忽略 _subCount / 存量换入 / 旧数据迁移 / 落库字段 / 循环收尾 / 冷藏 / 子计划动作 / 下一步单卡',
          'manifest 3.5.7 / 3507',
        ]
      }
    ]
  },
  {
    version: '3.5.6',
    date: '2026-09-11',
    title: '3.5.6 打卡缺口补齐：补记可撤销 + 连续按天/周分流 + 热度口径统一 + 日历可翻月',
    summary: [
      '补记可撤销：新增 removePlanCheckIn(clientId, date)，打卡明细长按某条、日历选中日点「撤销这天」都能撤掉那天的打卡，累计与连续一起回退，误触不再等于永久脏数据（utils/storage/plan.js + pages/plan/detail.vue）',
      '连续口径按循环类型分流：「每周 N 次」的任务改成连续达标周数（该周打卡天数 >= 每周目标），里程碑 2/4/8/12/26/52 周；每日任务仍是 3/7/14/30/60/100 天。上一版每周任务按天算连续，里程碑永远触发不了（utils/plan-recur.js weeklyStreakOf + utils/checkin-feedback.js）',
      '热度口径统一：新增 utils/plan-heatmap.js countsOf(plan) 作为唯一口径（打卡 + 完成日志），记录页热力图与详情页日历都从这里取数，同一个日子在两页不再出现两种深浅',
      '长按不再盲试：热力格右下角给「可补记」小点，未来日期置灰且不可点不可补，长按抬手后的那次 tap 被 400ms 抑制窗丢掉（上一版会把刚展开的当天明细又翻掉）；补记候选改带祖先路径（主计划 / 阶段 / 子计划），同名子计划分得清（components/plan/PlanHeatmap.vue + utils/plan-recur.js planPathLabel）',
      '详情页日历可翻月（不允许翻到未来），跨月回到 App 自动拨回当前月；记录页改成按「事件归属日」过滤与分组同一口径，跨周补记不再冒进本周列表；打卡后主动失效 AI 提示缓存'
    ],
    categories: [
      {
        title: '撤销与口径 3.5.6',
        items: [
          'utils/storage/plan.js：removePlanCheckIn（按天删除打卡，非法日期/没打卡过返回 null）+ utils/storage.js 导出',
          'utils/plan-heatmap.js：countsOf（单计划热度唯一口径）、collectDayCounts 改为逐计划相加、monthGrid 增加 isFuture',
          'utils/plan-recur.js：weeklyStreakOf（连续达标周数）、planPathLabel / planDepthOf（祖先路径与层级）、backfillCandidates 带 label 与稳定排序、streakMilestoneOf(after, before, kind)',
          'utils/checkin-feedback.js（新增）：streakOfPlanRecord / streakKindOf / checkinFeedback，按类型给「连续 N 天」或「连续 N 周达标」'
        ]
      },
      {
        title: '页面与组件 3.5.6',
        items: [
          'pages/plan/composables/usePlanCheckin.js（新增）：打卡统计、明细、补记、撤销、本月日历整套状态与动作，不依赖组件实例可直接跑测试',
          'pages/plan/detail.vue：改用 usePlanCheckin（-136 行），打卡明细长按撤销、日历选中日撤销、日历翻月；表头补 TODO 标注剩余待拆项',
          'components/plan/PlanHeatmap.vue：backfillMap 小点、未来日期置灰、长按后 400ms 抑制 tap、提示文案改为「长按带点的日子」',
          'pages/plan/records.vue：传 backfillMap、区间改按事件归属日过滤（跨周补记不串周）、候选清单用祖先路径、事件上限 500→2000（避免热力图有颜色点开却为空）',
          'pages/plan/index.vue：今日行动条打卡改用共享 checkinFeedback',
          '代码卫生：本轮触及的 6 个 .vue/.scss 行尾统一为 CRLF（补丁脚本曾写入 LF 造成混合），usePlanCheckin 去掉只写不读的 selfExecLogs（页面自有 planExecLogs 聚合自身与子计划日志），AGENTS.md 修正测试命令说明（必须带 --maxWorkers=2 跑）'
        ]
      },
      {
        title: '测试 3.5.6',
        items: [
          'tests/plan-checkin.test.js（新增 22 例）：removePlanCheckIn 边界、composable 返回值完备性、打卡/撤销/补记守卫、weekly 与 daily 里程碑文案、补记候选路径标签',
          'tests/plan-heatmap.test.js：countsOf 4 例 + monthGrid isFuture 1 例',
          '全量 npx vitest run：43 文件 507 用例全绿',
          'manifest 3.5.6 / 3506'
        ]
      }
    ]
  },
  {
    version: '3.5.5',
    date: '2026-09-10',
    title: '3.5.5 打卡复盘三件套：任意历史日补记 + 计划详情本月打卡日历 + 连续达标轻量肯定',
    summary: [
      '任意历史日补记：记录页热力月视图长按某天 → 列出这天可补的循环任务（在跑 + 落在有效窗口内 + 这天没打卡），选一个即补记那天；没有可补任务时只回一句「这天没有可补记的循环任务」（utils/plan-recur.js isBackfillable / backfillCandidates + pages/plan/records.vue onBackfillDay）',
      '计划详情新增「本月打卡」日历：扁平化复用热力月视图组件，只统计本计划自身的打卡与完成，点某天看当天次数与描述，长按某天可补记（pages/plan/detail.vue onCalBackfill + components/plan/PlanHeatmap.vue flat/hideNav + detail.scss）',
      '连续达标轻量肯定：打卡跨过 3/7/14/30/60/100 天时给一句「连续 N 天，稳」toast，不弹窗、无音效、不打断；未跨过时保持原来的「已打卡」（utils/plan-recur.js streakMilestoneOf + 详情页三条打卡路径与列表页今日行动条）',
      '补记按补记的那天归位：记录页明细与分组改为优先用 checkins.date，补记昨天不再挂到今天（pages/plan/records.vue eventDayKey）',
      '修复未接线的打卡入口：记录页 toggleDay/dayEvents/selectedDate 与详情页 submitBackfill 此前只有模板引用没有实现，点热力格或补记按钮会直接报错，本轮补齐；搜索结果页把 v-if 写在 v-for 的同一元素上，分组标题一渲染就报错，改成只遍历非空分组（pages/search/result.vue）'
    ],
    categories: [
      {
        title: '任意历史日补记 3.5.5',
        items: [
          'utils/plan-recur.js：isBackfillable（在跑循环 + 早于今天 + 落在自身与祖先窗口内 + 当天未打卡）、backfillCandidates（返回 client_id/title/recur_type，排除已删除，标题兜底「未命名计划」）、backfillTargetOf 改为复用 isBackfillable',
          'pages/plan/records.vue：onBackfillDay 长按热力格选任务、applyBackfill 落库并刷新、eventDayKey 让补记按补记日归位、selectedDate/dayEvents/selectedLabel/toggleDay 补齐',
          'pages/plan/detail.vue：onCalBackfill 长按日历某天（仅循环任务、窗口内且未打卡），确认后补记并回写打卡统计与补记入口',
          'components/plan/PlanHeatmap.vue：backfill-day 事件、长按提示行'
        ]
      },
      {
        title: '计划详情本月打卡日历 3.5.5',
        items: [
          'pages/plan/detail.vue：calCounts（自身打卡 + 完成日志）/calWeeks/calTotals/calDayText/toggleCalDay、showCalendar（循环任务或已有打卡才显示）',
          'components/plan/PlanHeatmap.vue：flat 属性（去卡片底、嵌进详情 section）、hideNav 时隐藏翻月与提示行',
          'pages/plan/detail.scss：cal-section / cal-day-text / cal-hint 样式（含深色）'
        ]
      },
      {
        title: '连续达标轻量肯定 3.5.5',
        items: [
          'utils/plan-recur.js：streakMilestoneOf（里程碑 3/7/14/30/60/100，只在本轮跨过时返回该天数，持平或下降返回 0）',
          'pages/plan/detail.vue：checkinFeedback 统一反馈、reloadCheckins 统一回写、streakOfPlan 取打卡前连续天数；覆盖 submitCheckIn / submitBackfill / checkinChild / completeNextStep',
          'pages/plan/index.vue：今日行动条 quickCheckIn 与 checkinWithNote 同步轻量肯定'
        ]
      },
      {
        title: '测试 3.5.5',
        items: [
          'tests/plan-recur.test.js：isBackfillable 6 例（今天/未来不给补、历史日可补、非循环/完成/冷藏/任意时间不给补、窗口外不给补、已打卡与非法日期不给补、祖先窗口收缩）+ backfillCandidates 3 例 + streakMilestoneOf 4 例',
          'tests/sfc-bindings.test.js：扫描 pages 与 components 全部 SFC，compileScript(inlineTemplate) 后凡是落成 _ctx.x 的标识符即报错，专门拦「模板引用了不存在的变量」这类点一下就崩的问题',
          '全量 npx vitest run：42 文件 480 用例全绿',
          'manifest 3.5.5 / 3505'
        ]
      }
    ]
  },
  {
    version: '3.5.4',
    date: '2026-09-10',
    title: '3.5.4 打卡回看与温和补记：热力格点开当天明细 + 总览本周打卡 + 补记昨天',
    summary: [
      '热力格点开当天：记录页点击某天热力格 → 下方展开该天明细（打卡/完成 + 时刻 + 描述，可点进计划详情），再点一次收起，换月自动清空选择（components/plan/PlanHeatmap.vue select-day + pages/plan/records.vue toggleDay）',
      '计划总览新增「本周打卡 N 次」：周一起算、只算 checkins（完成日志不计），主计划与子计划一起统计，超过一天时补「（N 天）」（utils/plan-heatmap.js weekCheckinSummary + pages/plan/composables/usePlanList.js stats）',
      '温和补记昨天：循环任务漏了昨天且昨天落在有效窗口内时，详情页打卡卡出现「补记 M-D（昨天漏了）」，点一次即落库并为昨天记一天，不追问、不连续催（utils/plan-recur.js backfillTargetOf + pages/plan/detail.vue submitBackfill）',
      '打卡接口支持指定日期：logPlanCheckIn(clientId, note, dateStr) 第三参数可传 YYYY-MM-DD，只接受今天与过去，非法或未来日期自动回落到今天，仍按天幂等',
      '口径与守卫：昨天已打卡、非循环任务、已完成、冷藏、窗口在昨天前结束或今天才开始的循环任务都不提供补记入口'
    ],
    categories: [
      {
        title: '打卡回看 3.5.4',
        items: [
          'components/plan/PlanHeatmap.vue：selectedDate 属性、select-day 事件、选中态描边与提示行',
          'pages/plan/records.vue：selectedDate 状态、dayEvents 明细、toggleDay 切换、翻月清空'
        ]
      },
      {
        title: '本周打卡与补记 3.5.4',
        items: [
          'utils/plan-heatmap.js：weekCheckinSummary（本周次数与天数）',
          'utils/plan-recur.js：backfillTargetOf（漏昨天才给补）',
          'utils/storage/plan.js：logPlanCheckIn 支持第三个参数 dateStr（过去日期补记，未来/非法回落今天）',
          'pages/plan/components/PlanOverview.vue + pages/plan/composables/usePlanList.js：总览「本周打卡」展示',
          'pages/plan/detail.vue + detail.scss：补记入口与样式（含深色）'
        ]
      },
      {
        title: '测试 3.5.4',
        items: [
          'tests/plan-recur.test.js：backfillTargetOf 4 例（窗口内可补、已打卡/非循环/完成/冷藏不给补、窗口结束或今天开始不给补、祖先窗口覆盖）',
          'tests/plan-heatmap.test.js：weekCheckinSummary 2 例（唯一周口径/子计划计入/删除排除、完成日志不计数）',
          'tests/plan-action-log.test.js：带日期补记 1 例（指定过去日期落库、未来与非法回落今天）',
          'manifest 3.5.4 / 3504'
        ]
      }
    ]
  },
]
