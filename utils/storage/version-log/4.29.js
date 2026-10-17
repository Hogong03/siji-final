/**
 * 版本日志数据段：4.29.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V429 = [
  {
    version: '4.29.4',
    date: '2026-10-17',
    title: '修简报卡 dateLine 空实现（Vue 每渲染一次告警）+ 补上守卫测试的 options API 盲区',
    summary: [
      '用户贴出运行时告警：`Property "dateLine" was accessed during render but is not defined on instance` —— `components/chat/EnterBriefing.vue` 模板第 6 行一直有 `{{ dateLine }}`，但组件 computed 里只有 briefing/greetLine/checkinPercent，数据层的 _briefing payload 也没有这个字段，**两侧都没实现**',
      '修法：`utils/enter-dialogue.js` 新增 `buildBriefingDateLine(now)`（形如「10月17日 周六」），由 `buildBriefing` 写进 payload；组件补 dateLine computed 读它。**在数据层按建卡时刻生成、不在组件里取「今天」** —— 简报卡随消息落盘，老卡片必须显示它自己那天的日期',
      '老卡片（已落盘、payload 无 dateLine）自动不渲染该行（模板加 v-if），零迁移',
      '**真正的根因是守卫测试有盲区**：`tests/sfc-bindings.test.js` 里 `if (!descriptor.scriptSetup) return` —— 只查 `<script setup>`，options API 组件被整体跳过，所以这类「模板写了、实现漏了」的 bug 在 options API 组件上从 3.5.5 起就无人看守（4.13.1 的 fontRpx 是同一族）',
      '守卫补 options API 通道：用 @babel/parser 解析 `export default {}` 真正收集 props/computed/methods/data/inject/setup 的键名，与 compileTemplate 产出的 _ctx.x 比对。**首版用「名字在 script 里出现过」的文本启发式，被自己写的注释骗过、实测抓不到 bug，已废弃改为解析真实键名**（改名验证：报 `未定义：dateLine`，恢复后全绿）',
    ],
    categories: [
      {
        title: '简报卡 dateLine（4.29.4）',
        items: [
          'utils/enter-dialogue.js：新增 WEEKDAY_CN + `buildBriefingDateLine(now)`；`buildBriefing` 返回值新增 `dateLine` 字段（放在 greeting 之后）',
          'components/chat/EnterBriefing.vue：新增 `dateLine` computed（读 `this.briefing.dateLine`，缺省空串）；模板日期行加 `v-if="dateLine"`，老卡片不渲染空行',
          'tests/enter-dialogue.test.js：新增日期行用例（buildBriefingDateLine 两种日期 + buildBriefing 透出 dateLine）',
        ],
      },
      {
        title: '守卫测试补 options API 盲区（4.29.4）',
        items: [
          'tests/sfc-bindings.test.js：新增 `collectOptionsNames()`（@babel/parser 解析 export default，收集 props/computed/methods/data/inject/setup 返回对象的键名，注释与字符串里的同名文字不算）与 `keysOfReturns()`',
          '新增第二条用例「options API 组件的模板标识符必须在选项里真的定义过」：options API 组件用 compileTemplate 不带 bindingMetadata 编译，未解析标识符落成 _ctx.x，与上面收集到的键名 + ALLOWED 比对，差集即漏实现',
          '验证方式：临时把 EnterBriefing 的 dateLine computed 改名 → 守卫报 `components/chat/EnterBriefing.vue 未定义：dateLine`；恢复后 3 例全绿（证明守卫不是空测试）',
        ],
      },
    ],
  },
  {
    version: '4.29.3',
    date: '2026-10-17',
    title: '三处实测修复：应用外通知全哑（推送 API 误用）+ 应用内提醒改 toast + 新建计划可加子计划',
    summary: [
      '应用外通知一直收不到的两个真因：① `plus.runtime.getProperty` 回调给的是 WidgetInfo，官方字段只有 appid/version/name/description/author/email/features，**没有 manifest** —— probePushModule 读 info.manifest 恒 undefined → 判定「未声明 Push」→ 本地推送被整体跳过（4.27.1 的探测守卫本身写错了）；② notifier 调的 `plus.push.createPushMessage` 这个 API 根本不存在（官方只有 createMessage），调用即抛错被 catch 吞掉',
      '定时推送没生效：`createMessage(content, payload, option)` 三参数签名被写错 —— options 塞进了第 2 个 payload 槽、且 delay 用毫秒（官方单位是**秒**）→ 通知正文显示一坨 JSON 且 delay 落空（等于注册时立即弹，到点反而不提醒）',
      'Android 13+ 通知权限从来没申请过：`Build.VERSION` 是嵌套类，`importClass("android.os.Build")` 取不到 SDK_INT → sdk=0 提前 return；改用 `android.os.Build$VERSION` + `plus.os.version` 兜底，读不到时按「需要」处理',
      '应用内提醒从 ActionSheet 弹窗改 toast 轻提示（不打断当前操作）；随之取消「立即打卡 / 推迟 / 查看」三个选择动作，触发即按当天已处理落账 —— 否则同一提醒会按轮询周期反复弹 toast',
      '开场简报卡在用户说出第一句话后消失（原来只清欢迎语，简报卡永远赖在消息列表第一条）；新建计划时也能加子计划（原来 `can-add="!isNew"` 把按钮藏了，现在先把父计划落库拿到 client_id 再挂子计划）',
    ],
    categories: [
      {
        title: '应用外通知修复（4.29.3，真机根因）',
        items: [
          'utils/reminder/push-schedule.js：`manifestHasPush(manifestText)` → `widgetHasPush(info)` —— 改读 WidgetInfo.features（manifest 里 5+ 模块声明的键名列表）；features 缺失时不拦（宁可多发一次也不静默不发，旧写法就是恒判「未声明」导致推送全哑）',
          'push-schedule.js：`probePushModule` 先看 plus.push.createMessage 是否为函数（模块没打进包直接停用，不碰就不会弹基座提示），再用 widgetHasPush 判定',
          'push-schedule.js：`plus.push.createMessage(内容, payloadJSON, { title, delay: 秒, sound, cover })` —— 修正参数错位与 delay 单位（旧代码 delay 传毫秒，1000ms 会被当 1000 秒）',
          'utils/reminder/notifier.js：`plus.push.createPushMessage`（不存在的 API）→ `plus.push.createMessage(body, payload, { title, sound, cover })`',
          'utils/reminder/notifier.js：新增纯函数 `needsNotifyPermission(sdkInt, osVersion)`；`ensureNotifyPermission` 改用 `plus.android.importClass("android.os.Build$VERSION")` 读 SDK_INT，失败回落 plus.os.version，都读不到按需要申请（低版本申请是空操作）',
          'tests/reminder-push-schedule.test.js：manifestHasPush 用例改为 widgetHasPush（含 features 缺失不拦）+ 新增 needsNotifyPermission 三例（SDK_INT / 版本字符串 / 都读不到）',
        ],
      },
      {
        title: '应用内提醒改 toast（4.29.3）',
        items: [
          'utils/reminder/notifier.js：`showReminderActions`（uni.showActionSheet 五项）→ `showReminderToast`（uni.showToast，3 秒自动消失，文案「计划提醒：{标题}」/「计划已过期：{标题}」）',
          'triggerReminder：toast 后直接调 handlers.onDone()（markTriggered + clearSnooze）—— toast 没有可选项，弹完即已告知，当天不再响；震动保留',
          'snooze 机制保留（scheduler 的到期重响分支与触发异常兜底仍会写推迟表），但应用内不再有「推迟」入口',
          'tests/reminder-snooze.test.js：集成段按新语义重写（触发即 toast + 当天落账 / 到期推迟条目走 snooze 分支重响 / 免打扰时段不弹且不落账 / 计划删除后清条目），并同步文件头语义说明',
          'tests/chat-opener-plan-time.test.js：三处提醒触发计数从 mock showActionSheet 改为 mock showToast',
        ],
      },
      {
        title: '开场简报卡让位 + 新建计划加子计划（4.29.3）',
        items: [
          'utils/enter-dialogue.js：新增纯函数 `isOpenerMessage(message)`（欢迎语 /_isEnterSummary /_isOpener 三者任一即开场占位）',
          'composables/useChatEngine.js：用户发消息前清掉**全部开场占位**（原来只清 _isWelcome，简报卡会永远留在消息列表第一条）',
          'pages/plan/detail.vue：`goAddChildPlan` 在新建态先 `persistForm()` 落库父计划拿到 client_id，再切 `isNew=false` + 写 `planId`（避免返回后再保存生成第二条父计划）后跳子计划页；`PlanChildPlans` 的 `can-add` 由 `!isNew` 改恒 true',
          'tests/enter-dialogue.test.js：新增 isOpenerMessage 两例（三种标记 + 真实简报卡产物判定为开场；普通对话消息与脏值不误判）',
        ],
      },
    ],
  },
  {
    version: '4.29.2',
    date: '2026-10-17',
    title: '文档与验收基线对齐实测：AGENTS 概况/速查表补齐，真机清单补 4.13~4.29 覆盖缺口',
    summary: [
      '代码审读发现文档滞后于代码：AGENTS.md 头部版本仍是 4.27.0（实际 4.29.1）、代码量写「~196 文件 / ~34,000 行」（实测 533 文件 / 89,192 行）、内部三处测试数字互相矛盾（头部 106 / 目录结构 86 / 注意事项 89 文件）、版本日志分段名停在 4.12.js（实际 4.29.js）',
      '真机验证清单停在 4.17.0，4.18~4.29 共 12 个小版本线的新增能力一条验收项都没有 —— 补 8 个小节：应用外提醒 / 字号切换 / AI 功能面板 / 对话管理 / 成果引擎与记录沉淀 / 人生周报与焦点 / 内置画像 / 长文时序回归组',
      '速查表补 6 行 4.22~4.29 新落地但查不到的子系统：输入区 AI 功能面板、对话管理、消息操作（重试/编辑/虚拟列表）、计划速览与热力图、回收站、AI 结果卡',
      '清掉仓库里被跟踪的临时文件 test-log-20261007.md（发布规矩第 5 条），归档到 .trash/ 后移出版本库',
      '本轮零代码改动（仅文档与两处文件头注释），全量 106 文件 / 1412 用例仍全绿',
    ],
    categories: [
      {
        title: '文档基线对齐（4.29.2）',
        items: [
          'AGENTS.md：概况表版本 4.27.0→4.29.1、代码量改实测值（533 文件 / 89,192 行并按目录拆解）、测试行补 node 20 前置（系统默认 node 16 会报 node:util styleText 缺失）',
          'AGENTS.md：目录结构段 tests 86 文件 1213 用例→106 文件 1412 用例；版本分段「最新段 4.12.js」→「4.29.js 共 40 段」（发布规矩处同步）；语料 30 条→实测 34 条；module-exports 静态核对 318→352 个源文件；Git 状态 d122845→7e80cae',
          'AGENTS.md 速查表新增 6 行：改输入区 / AI 功能面板（AiToolPanel + onToolPick）、改对话管理（ConversationPanel 四件套 + conversation-search/chat-search/conv-tags）、改聊天页消息操作（useRetryBar/useMessageEdit/useVirtualMessages/useStreamRenderer/useScrollControl）、改计划速览面板与热力图（PlanDailyStrip/PlanWeekStrip/PlanTimeStrip + plan-heatmap）、改回收站（diary/bill/plan 三个 trash.vue）、改周报卡片渲染（AiResultCard 与 ExecResultCard 职责区分）',
          'docs/真机验证清单.md：新增 2.13 应用外提醒（含 4.29.1 push 模块探测回归点）／2.14 字号切换／2.15 AI 功能面板／2.16 对话管理／2.17 成果引擎与记录沉淀／2.18 人生周报与本周焦点／2.19 内置画像与教练模式／2.20 长文与时序回归组；验证记录登记 4.29.1 一行（标待执行）',
          'utils/storage/version-data.js 与 utils/storage/version-history.js 的文件头注释：最新段 4.17.js / 3.5.js 统一改为 4.29.js',
          '仓库卫生：test-log-20261007.md（4972 字节，4.14.2 时期 H5 测试日志）归档到 .trash/ 并 git rm --cached，不再进仓库',
        ],
      },
    ],
  },
  {
    version: '4.29.1',
    date: '2026-10-15',
    title: '真机修复「打包时未添加 push 模块」弹窗：manifest 补 Push 声明 + 运行时探测守卫',
    summary: [
      '真机实测：4.22.0 起本地推送预注册每次启动/回前台调 plus.push，打包时 manifest 未声明 Push 模块 → 基座弹「打包时未添加 push 模块」系统弹窗（同步 alert，JS try-catch 拦不住），必现',
      '根治：manifest.json 的 app-plus.modules 补声明 "Push": {} —— 重新云打包后本地推送（4.22.0 预注册）与提醒即时通知真正可用',
      '旧包立即不弹：运行时用 plus.runtime.getProperty 读包内 manifest 探测是否声明 Push（manifestHasPush 纯函数 + probePushModule 结果缓存），未声明则完全跳过 plus.push 调用；注册（push-schedule）与即时通知（notifier）两处共用探测',
    ],
    categories: [
      {
        title: 'push 模块修复（4.29.1）',
        items: [
          'manifest.json：app-plus.modules 补 "Push": {}（需重新云打包生效）',
          'utils/reminder/push-schedule.js：manifestHasPush + probePushModule 探测守卫；registerPlanPushes 改为探测通过才执行（返回 Promise，调用方零改动）',
          'utils/reminder/notifier.js：triggerReminder 的即时通知走同一探测（动态 import）',
          'tests/reminder-push-schedule.test.js：补 manifestHasPush 断言 + registerPlanPushes 异步化（8 例）；全量 106 文件 / 1412 用例全绿',
        ],
      },
    ],
  },
  {
    version: '4.29.0',
    date: '2026-10-12',
    title: '输入区功能按钮收纳进「+」AI 功能面板（图片/文件/语音/更多，底部弹出）',
    summary: [
      '输入行左侧的图片识别 / 语音转文字 / 文件读取三个圆钮，收进一个「+」号触发的底部 AI 功能面板，输入行收敛为「+ ｜ 输入框 ｜ 发送」，与 ChatGPT / 豆包输入区交互一致',
      '面板 4 列网格：图片识别、文件读取、语音转文字、更多能力（直达 AI 配置）；图片/语音受能力开关门控，关闭时对应项不显示，文件/更多始终显示；以后新增能力只往面板加，输入行不再变长',
      '面板只负责展示与 emit，选图/读文件/录音逻辑仍在 InputArea，动作经 onToolPick 分发；底部弹出复用项目既有规范（固定底部、圆角、safe-area、遮罩点击关闭），含 H5/App 与小程序深色双路径',
    ],
    categories: [
      {
        title: 'AI 功能面板（4.29.0）',
        items: [
          '新增 components/chat/AiToolPanel.vue：props show/visionOn/voiceOn，emit close/pick；遮罩 + 底部 sheet（标题「AI 工具」）+ 4 项网格（图标圆角块 + 文字标签）；static/icons 无 mic 图标，语音项用 CSS 线框麦克风；底部弹出复用 plan-sheet 规范（z-index 1000、圆角 24rpx、safe-area、chatRiseIn）',
          '深色双路径：H5/App 走 scoped 内 html.theme-dark 直写（sheet #27272A、图标块 #3F3F46、标签 #A1A1AA、麦克风 #F4F4F5），小程序走 #ifdef MP-WEIXIN 内 @media，两段值一致（theme-mode 守卫）',
          'InputArea.vue：三个 side-btn 替换为单个「+」（SijiIcon add）；新增 showAiTool 状态与 onToolPick(action)（image→pickImage、file→pickFile、voice→toggleVoice、more→navigateTo AI 配置）；末尾挂载 AiToolPanel；清理麦克风视觉相关死样式（浅色 + 两段深色，录音/转写 JS 逻辑保留）',
          'tests/ai-tool-panel.test.js 8 例：四动作项齐全、vision/voice 门控、遮罩关闭、事件声明、深色双路径、输入行只留 +、面板挂载接线、onToolPick 分发；全量 106 文件 / 1411 用例全绿',
        ],
      },
    ],
  },
]
