/**
 * 版本日志数据段：4.29.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V429 = [
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
