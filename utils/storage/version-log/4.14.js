/**
 * 版本日志数据段：4.14.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V414 = [
  {
    version: '4.14.0',
    date: '2026-10-06',
    title: '4.14.0 UI 第二批（启动页深色/输入字号联动/心情上卡片/时间戳去重/触觉反馈）+ 修 App 端通知栏提醒排查盲区',
    summary: [
      '按 docs/UI优化方案二.md 执行五项 + 排查「App 端计划到期不再出现在手机通知栏」',
      'P0-1 启动页深色适配：splash 背景固定 #E4E4E7 的问题修复（深色用户每次启动先看一屏亮白）—— 深色下启动页 #18181B + logo 反白，配合 4.13.0 的冷启动预挂首帧即深色',
      'P0-2 输入框文字随字号档位：大字号用户「打字时小、发送后大」的割裂修复（textarea 内联 fontRpx(30)）',
      'P1 触觉反馈三处：打卡成功（checkinFeedback 入口，覆盖 AI/手动/弹窗直达全路径）、长按气泡呼出操作面板、删除对话确认前 —— 轻震 light；H5 静默失败无成本',
      'P1 记录列表卡片显示心情：闲置的 mood 字段（4.11.0）上卡片 —— 标题行小表情（😞😕😐🙂😄 对应 1~5 档），三个视图（列表/分页/时间线）全覆盖，无心情不占位',
      'P1 连续消息时间戳去重：与上一条可见消息同一分钟不再重复显示时间行（新增 prevTime prop 通道，与 prev-role 同构）',
      '通知栏排查：代码链路自 4.5.0 后未变（触发 → ActionSheet + plus.push 系统通知）；最常见原因是 Android 13+ 通知权限被拒或国产 ROM 独立通知开关关闭 —— 推送创建失败不再静默（warn 日志含原因）+ 提醒设置区新增权限引导条（App 端，点击重新发起授权；被永久拒绝时去系统设置 → 应用 → 思迹 → 通知开启）',
      '全量测试 94 文件 / 1305 用例全绿；通知栏与触觉反馈需真机验证（HBuilder X 重新编译）',
    ],
    categories: [
      {
        title: 'UI 第二批（4.14.0）',
        items: [
          'pages/splash/index.vue：html.theme-dark 嵌套 + MP @media 双路深色块（背景/logo/副标）',
          'components/chat/InputArea.vue：textarea 内联 fontSize: fontRpx(30)，随字号档位缩放',
          'utils/checkin-feedback.js：打卡成功 uni.vibrateShort light（fail 静默）',
          'composables/useConversationManager.js：删除确认弹窗前轻震',
          'components/chat/MessageBubble.vue：showActions 呼出前轻震',
          'pages/diary/list.vue：MOOD_FACES 映射 + moodFace() + 三个视图卡片标题行心情表情 + .card-mood 样式（list.scss）',
          'components/chat/MessageBubble.vue + pages/chat/index.vue：prevTime prop 通道（与 prev-role 同构）+ meta 行 v-if="showTime" 同分钟去重',
        ],
      },
      {
        title: '通知栏排查（4.14.0）',
        items: [
          'utils/reminder/notifier.js：plus.push 创建失败/被拒时 warn 日志（此前静默 catch）—— Android 13+ 通知权限被拒时这里是第一现场',
          'components/plan/PlanReminderSection.vue：App 端通知权限引导条（点击调 ensureNotifyPermission 重新授权 + 引导去系统设置），#ifdef APP-PLUS',
          '架构说明：提醒轮询是应用内定时器，App 进程被系统杀死后到点不会主动弹通知（无原生推送服务）——回前台后由轮询补弹；「到点准时通知栏推送」需要常驻进程或原生推送服务，属后续原生插件范畴',
        ],
      },
    ],
  },
]
