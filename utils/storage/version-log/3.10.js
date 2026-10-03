/**
 * 版本日志数据段：3.10 线整合条目（3.10.0~3.10.2 发布前合并为一条）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V310 = [
  {
    version: '3.10.2',
    date: '2026-09-17',
    title: '3.10.2（整合 3.10.0~3.10.2，发布前合并）：开场对话整合与死按钮修复，计划时间从「改不动/没时间/不显示」三层修通',
    summary: [
      '3.10.0 开场对话整合：开场消息统一「进入总结/欢迎语」两种并共用同一套按钮；修死按钮 —— 快捷按钮原用 $root.$emit（Vue 组件事件）而聊天页用 uni.$on（uni 事件总线）听，改统一走 uni.$emit 并加静态回归测试',
      '3.10.0 计划时间两处「改不动」修复：persistForm 编辑值优先（原来旧值优先导致计划一旦有过时间就改不动）；PlanTimeSection 选择器里 disabled input 换 view（点击被吞弹不出选择器）；计划到点提醒默认开启（带时刻提前 30 分钟、只有日期当天 09:00），安卓 13+ 启动申请通知权限',
      '3.10.1 修「计划没时间」根因：模型不知道中秋国庆是哪天 —— 新增 utils/holidays.js（公历按年推算 + 农历查表，表里没有的年份不注入、宁可不给也不编错），prompt 动态段注入节假日，create_plan/update_plan 没给时间且提到节日时执行器兜底补区间',
      '3.10.2 修「有时间但不显示」：applyStoredItem 回填补回落（开始 estimated_time → start_time，截止 due_date → deadline → end_time），收起行摘要带时刻（09-17 15:00），只有 start_time 的老计划编辑器里也能看到并修改',
      '3.10.0 文件类型放宽：TEXT_EXTS 扩充（svg/rst/adoc/patch 等代码与补丁后缀），SVG 归文本不丢给视觉模型；文件通道选到图片直接压缩走图片识别'
    ],
    categories: [
      {
        title: '开场对话与按钮（3.10.0）',
        items: [
          'utils/enter-dialogue.js：新增 OPENER_FLAG/WELCOME_FLAG/buildWelcomeButtons/buildWelcomeMessage/hasOpenerActions；buildEnterButtons(null) 从「返回空数组」改为「返回通用三个按钮」，欢迎语与进入总结共用同一套操作行',
          '死按钮根因：MessageBubble.vue 快捷按钮用 $root.$emit（Vue 组件事件）发，聊天页却用 uni.$on（uni 事件总线）听，点了没有任何反应 —— 新增 emitWelcomeChip(text) 统一走 uni.$emit；页面操作行渲染条件由 msg._isEnterSummary 改为 hasOpenerActions(msg)，冷启动开场白同样改用 buildWelcomeMessage',
          'store/chat/persist.js：_enterButtons 与 _isOpener 与「进入总结」解耦 —— 任何消息带按钮都落盘（重启后按钮还在）'
        ]
      },
      {
        title: '计划时间与提醒（3.10.0）',
        items: [
          'usePlanForm.js persistForm：start_time/end_time 改「编辑值优先、旧值兜底」（原来反过来，计划一旦有过时间就再也改不动）',
          'PlanTimeSection.vue：日期与时间选择器里的 disabled input 换 view + text（点击不被吞，选择器能弹出来）；placeholder 灰字与取值样式补齐',
          '默认提醒：utils/reminder/scheduler.js computeDefaultFire —— 没手动设提醒的计划按截止/开始时间自动算触发点（带时刻→提前 30 分钟，只有日期→当天 09:00），checkAllReminders 对「没配提醒」启用默认规则、「配置存在但 enabled=false」仍跳过、单条出错 per-plan try/catch；notifier.js ensureNotifyPermission（Android 13+ 请求 POST_NOTIFICATIONS），uni.vibrate 单独 try/catch（没震动权限抛错会把弹窗与推送一起带走）'
        ]
      },
      {
        title: '计划节假日与时间显示（3.10.1~3.10.2）',
        items: [
          'utils/holidays.js（新增，纯函数）：LUNAR_HOLIDAY_TABLE（2026/2027 春节、端午、中秋公历日期）+ solarHolidays 按年推算（元旦/劳动节/国庆）+ upcomingHolidays（120 天窗口，带 daysUntil）+ inferHolidayFromText（认「中秋国庆/十一/五一/过年」简称，同名节日只取最近一次，避免跨年时把今年与明年拼在一起）',
          '提示词层 + 执行器层：prompt-builder 动态段注入 holidayLine（日期行之后）；prompt-actions 铁律「提到节日/假期/周次必须换算成具体日期，表里没有的按原话推断、禁止编日期」；store/executors/plan.js execCreatePlan/execUpdatePlan 加 inferDatesFromText 兜底（只在模型没给任何时间时生效，给了时间完全不动）',
          '3.10.2 真因：「去联通营业厅」计划只有 start_time（提醒认它所以到点会提醒），但详情页回填只读 estimated_time/due_date —— applyStoredItem 开始时间 estimated_time → start_time、截止时间 due_date → deadline → end_time 依次回落',
          'timeSummary 改带时刻的紧凑格式（MM-DD HH:MM，两端不同显示区间，无时刻不凭空补 00:00，完全没有时间仍是「未设置时间」）；update_plan 找不到计划时提示改成可执行的下一步（「如果这是新计划，请改用 create_plan」）；utils/datetime.js 不动 —— 解析层两种精度都吃，不为对齐格式去动跨模块共享函数'
        ]
      },
      {
        title: '文件输入（3.10.0）',
        items: [
          'utils/files/file-types.js：TEXT_EXTS 扩充（mdx/rst/adoc/org/ndjson/svg/plist/ssa/kts/cc/zsh/cmd/patch/diff/http/graphql/proto）；SVG 归文本（mime 虽是 image/svg+xml，内容是 XML，别丢给视觉模型）',
          'InputArea.vue 文件通道选到图片时直接压缩走图片识别（utils/image.js 新增 compressImagePath），不再要求用户再点一次图片按钮'
        ]
      }
    ]
  },
]
