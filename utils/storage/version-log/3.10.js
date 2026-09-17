/**
 * 版本日志数据段：3.10.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V310 = [
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
