/**
 * 版本日志数据段：4.29.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V429 = [
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
