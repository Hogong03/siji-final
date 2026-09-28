/**
 * 版本日志数据段：3.10.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V310 = [
  {
    version: '3.10.2',
    date: '2026-09-17',
    title: '3.10.2 计划有时间但不显示：回填漏了 start_time / end_time',
    summary: [
      '真因：计划「去联通营业厅办理业务」只有 start_time=2026-09-17 15:00（提醒认它，所以到点会提醒），但详情页回填只读 estimated_time / due_date —— AI 建的计划这两个字段常为空，于是编辑器两个时间框都空着、收起行摘要也只看 estimated/due，看着就像「没有时间」',
      '修法一（回填）：applyStoredItem 的开始时间改成「estimated_time 优先，回落到 start_time」，截止时间「due_date → deadline → end_time」依次回落 —— 只有 start_time 的老计划也能在编辑器里看到并修改',
      '修法二（显示）：收起行摘要带上时刻（原来是 09-17，现在是 09-17 15:00；两端都有则显示 09-17 15:00 ~ 09-17 16:00），不再只到「日」',
      '顺手：update_plan 找不到计划时的提示改成可执行的下一步（「如果这是新计划，请改用 create_plan」）—— 反馈里模型直接 update 一个不存在的计划，用户只好补一句「重新制定」'
    ],
    categories: [
      {
        title: '计划时间显示（3.10.2）',
        items: [
          'pages/plan/composables/usePlanForm.js：applyStoredItem 的 dueParts / estParts 增加 end_time / start_time 回落；timeSummary 改为带时刻的紧凑格式（MM-DD HH:MM，同一天两端不同则显示区间，无时刻时不凭空补 00:00，完全没有时间仍是「未设置时间」）',
          'store/executors/plan.js：execUpdatePlan 找不到计划时返回「没找到要修改的计划（id / 标题都不匹配）。如果这是新计划，请改用 create_plan 创建」',
          'utils/datetime.js 未改：combineDateTime 仍返回 YYYY-MM-DD HH:MM，与老数据的 HH:MM:SS 并存 —— 解析层（parseDateTimeToTs / parseDateTime）两种精度都吃，不为对齐格式去动跨模块共享函数'
        ]
      },
      {
        title: '测试（3.10.2）',
        items: [
          'tests/plan-time-display.test.js（新增 8 例）：只有 start_time 的计划两个时间框都能回填、只有 end_time 同样、estimated/due 优先于 start/end（老数据不被覆盖）、摘要带时刻、两端不同显示区间、无时刻不补 00:00、完全没有时间显示「未设置时间」、回填后不改动直接保存时间保持原样、update 找不到计划时的提示含 create_plan',
          'tests/chat-opener-plan-time.test.js：时间断言改为前缀匹配（HH:MM 与 HH:MM:SS 两种精度都通过）',
          '全量：75 文件 / 1081 用例全绿（npx vitest run --maxWorkers=2，exit 0）'
        ]
      }
    ]
  },
  {
    version: '3.10.1',
    date: '2026-09-17',
    title: '3.10.1 计划为什么没时间：模型不知道中秋国庆是哪天（补节假日表 + 执行器兜底）',
    summary: [
      '真因：反馈里的「本地深度游三日（中秋国庆）」计划，deadline / due_date / start_time / end_time 全是空串 —— 用户说了「中秋国庆、玩三天」，但模型不知道 2026 年中秋国庆是哪几天，只能留空；计划没时间，到点提醒也就无从谈起',
      '提示词层：新增 utils/holidays.js（公历节日按年推算 + 农历节日查表，表里没有的年份不注入，宁可不给也不编错）；prompt-builder 动态段注入「接下来的节假日（含日期与距今天数）」；CORE_ACTIONS 与 BEHAVIOR_RULES 补铁律 —— 用户提到节日/假期/周次必须换算成具体日期',
      '执行器层（确定性兜底）：create_plan / update_plan 在「模型没给任何时间、而标题或描述里提到节日」时，自动补上节日区间（中秋国庆 → 2026-09-25 至 2026-10-07）；模型给了时间就完全不动',
      '你上一轮反馈的「时间可以直接编辑了」是 3.10.0 的修复（picker 里 disabled input 换成 view）在生效 —— 但这条计划本身没有时间可编辑，所以看着还是空的'
    ],
    categories: [
      {
        title: '节假日与计划时间（3.10.1）',
        items: [
          'utils/holidays.js（新增，纯函数）：LUNAR_HOLIDAY_TABLE（2026 / 2027 的春节、端午、中秋公历日期）、solarHolidays（元旦 / 劳动节 / 国庆按年推算）、upcomingHolidays（默认 120 天窗口，带 daysUntil 与天数）、holidayPromptLine（喂给模型的一行）、inferHolidayFromText（从标题/描述认节日，支持「十一 / 五一 / 过年」简称；同名节日只取最近一次，避免跨年时把今年与明年拼在一起）',
          'utils/ai/prompt-builder.js：动态段新增 holidayLine 并拼进 system prompt（日期行之后）',
          'utils/ai/prompt-actions.js：create_plan 的时间说明补「中秋/国庆/春节/假期」并注明按节假日表换算；BEHAVIOR_RULES 新增一条「提到节日/假期/周次必须换算成具体日期，表里没有的节日按原话推断、禁止编日期」',
          'store/executors/plan.js：execCreatePlan / execUpdatePlan 增加 inferDatesFromText 兜底（只在完全没有时间时生效）'
        ]
      },
      {
        title: '测试（3.10.1）',
        items: [
          'tests/holidays.test.js（新增 13 例）：2026-09-17 视角下中秋在前国庆在后、公历节日按年推算、窗口过滤、表里没有的年份不编农历节日、提示行含日期与「8 天后」、从文本认节日（中秋国庆连说→9/25 至 10/7、简称十一/五一/过年、没提节日返回 null）、执行器兜底三例（没给时间→补节日区间、给了时间→不覆盖、没提节日→不补）',
          '全量：74 文件 / 1073 用例全绿（npx vitest run --maxWorkers=2，exit 0）'
        ]
      }
    ]
  },
  {
    version: '3.10.0',
    date: '2026-09-17',
    title: '3.10.0 开场对话整合 + 按钮全部可点 + 计划时间可改且到点提醒 + 文件类型放宽',
    summary: [
      '每次进来都是一条新对话，开场消息统一成「进入总结 / 欢迎语」两种，但它们共用同一套按钮（记一笔 / 写个记录 / 定个计划…）与「返回旧对话」入口 —— 新对话与预对话不再割裂',
      '修死按钮：欢迎语上的「记一笔午餐 ¥25」这类快捷按钮原来用 $root.$emit（Vue 组件事件）发，聊天页却用 uni.$on（uni 事件总线）听，点了没有任何反应；现在统一走 uni.$emit，并加了静态回归测试防止再犯',
      '计划时间：修两处「改不动」—— ①保存时旧 start_time/end_time 优先，编辑值被忽略；②时间和日期选择器包着 disabled 的 input，点击被吞、选择器弹不出来（改为 view 显示值）',
      '计划到点提醒默认开启：以前必须先给每条计划手动设提醒才会提醒，AI 建的计划永远静默；现在有截止/开始时间就自动提醒（带时刻→提前 30 分钟；只有日期→当天 09:00），用户明确关掉的仍然不提醒；安卓 13+ 启动时申请通知权限',
      '文件输入：可读类型放宽（svg / rst / adoc / 各种代码与补丁后缀等），选到图片时直接走图片识别通道（不再要求用户再点一次图片按钮）；Android 的「先落到本地再解析」流程在 3.7.9 已补齐（invokeSafe 兜住流对象方法），与 DeepSeek / 豆包的预下载思路一致'
    ],
    categories: [
      {
        title: '开场对话与按钮（3.10.0）',
        items: [
          'utils/enter-dialogue.js：新增 OPENER_FLAG / WELCOME_FLAG / buildWelcomeButtons / buildWelcomeMessage / hasOpenerActions；buildEnterButtons(null) 从「返回空数组」改为「返回通用三个按钮」，让欢迎语与进入总结共用同一套操作行',
          'components/chat/MessageBubble.vue：新增 emitWelcomeChip(text)，快捷按钮改走 uni.$emit（原 $root.$emit 与页面的 uni.$on 不通，是死按钮根因）',
          'pages/chat/index.vue：操作行渲染条件由 msg._isEnterSummary 改为 hasOpenerActions(msg)；开场白改用 buildWelcomeMessage（带按钮）',
          'composables/useChatSession.js：冷启动开场白同样改用 buildWelcomeMessage',
          'store/chat/persist.js：落盘白名单把 _enterButtons 与 _isOpener 与「进入总结」解耦 —— 任何消息带按钮都存下来（重启后按钮还在）'
        ]
      },
      {
        title: '计划时间与提醒（3.10.0）',
        items: [
          'pages/plan/composables/usePlanForm.js：persistForm 的 start_time/end_time 改成「编辑值优先、旧值兜底」（原来反过来，计划一旦有过时间就再也改不动）',
          'components/plan/PlanTimeSection.vue：日期与时间选择器里的 disabled input 换成 view + text（点击不被吞，选择器能弹出来；placeholder 灰字与取值样式补齐）',
          'utils/reminder/scheduler.js：新增 computeDefaultFire（没手动设提醒的计划，按截止/开始时间自动算触发点：带时刻→提前 defaultAdvanceMin；只有日期→当天 09:00）；checkAllReminders 对「没配提醒」的计划启用默认规则，「配置存在但 enabled=false」仍然跳过；单条计划出错不再拖垮整轮（per-plan try/catch）',
          'utils/reminder/notifier.js：新增 ensureNotifyPermission（Android 13+ 请求 POST_NOTIFICATIONS），并把 uni.vibrate 单独 try/catch —— 原来没震动权限时抛错会把弹窗与推送一起带走',
          'utils/reminder.js：startReminderChecker 启动时先申请通知权限'
        ]
      },
      {
        title: '文件输入（3.10.0）',
        items: [
          'utils/files/file-types.js：TEXT_EXTS 扩充（mdx / rst / adoc / org / ndjson / xhtml / svg / plist / ssa / kts / cc / zsh / cmd / patch / diff / http / graphql / proto）；SVG 归为文本（mime 虽是 image/svg+xml，内容是 XML，别丢给视觉模型）',
          'utils/image.js：新增 compressImagePath(path)，供文件通道复用图片压缩管线',
          'components/chat/InputArea.vue：文件通道选到图片时直接压缩并走图片识别（原来只提示「请点图片按钮」）'
        ]
      },
      {
        title: '测试（3.10.0）',
        items: [
          'tests/chat-opener-plan-time.test.js（新增 15 例）：开场消息带按钮且算壳、按钮动作合法（navigate / prefill）、hasOpenerActions 判定、冷启动新对话的开场白带按钮、$root.$emit 静态回归（components 与 pages 里不得再出现）、计划时间编辑值优先与旧值兜底、computeDefaultFire 三种情形、checkAllReminders 对没配提醒的计划会触发 / 用户关掉的不触发 / 已完成与已删除与冷藏的不触发',
          'tests/setup.js：补 uni.vibrate 与 uni.showModal 的 mock（提醒通知会调用它们，缺了会抛错并中断整轮提醒）',
          'tests/file-read.test.js：新增放宽类型与 SVG 归类的用例；tests/enter-dialogue.test.js：更新 buildEnterButtons(null) 的期望为通用三个按钮',
          '全量：74 文件 / 1061 用例全绿（npx vitest run --maxWorkers=2，exit 0）'
        ]
      }
    ]
  }
]
