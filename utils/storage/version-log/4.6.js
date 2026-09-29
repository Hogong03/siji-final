/**
 * 版本日志数据段：4.6.0（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V46 = [
  {
    version: '4.6.0',
    date: '2026-09-29',
    title: '4.6.0 UI 体系统一：图标全部换成 Lucide 线框 PNG、清理死代码、触控热区达标、页面底色统一',
    summary: [
      '图标体系统一：SijiIcon 从 Unicode 字符（☰⚙✎⚒，跨平台字形不一致、部分字符在手机上变彩色 emoji、多个语义映射到同一字符）改为 Lucide 线框 PNG，40 个图标各出浅色黑 / 深色白两套（96×96 高清），三端渲染一致；微光 sun 用琥珀色',
      '清理 App.vue 死代码：删除几十个未被引用的 CSS 变量（玻璃拟态 / 彩色遗留）与 .glass-card、.tap-feedback、.text-*、.font-*、.mt/mb-* 等全局死类，保留基础排版与子页面入场动画',
      '页面底色统一：全局 page 背景与 8 个卡片范式页面（functions / ai / about / agent / agent-add / data / memory / privacy）统一为 #F4F4F5（深色 #18181B），原 #FAFAFA、#E4E4E7 清零',
      '触控热区达标：InputArea 图片/文件/发送键用热区包裹层扩到 88rpx（视觉圆点不变），弹窗关闭、导航圆按钮、回到底部、新建入口、工具栏按钮统一扩到 72rpx（≈36px），消除 24px 及以下的难点目标',
      'DESIGN_SYSTEM.md 同步：阴影章节改为「零阴影」（层级靠底色 + 边框），图标章节更新为 40 个图标、语义色调、PNG 资源规格与改名防缓存规则；测试 84 文件 / 1203 用例全绿',
    ],
    categories: [
      {
        title: '图标体系统一（P0）',
        items: [
          'static/icons/：新增 40 个 {name}-v2.png（浅色 #18181B）与 40 个 {name}-v2-dark.png（深色 #FFFFFF），96×96 RGBA、视觉区 72×72、stroke-width 2；微光 sun 另出 sun-amber.png / sun-amber-dark.png',
          'static/icons/：删除 62 个旧 48px 无版本 PNG（Unicode 时代的死资源）',
          'components/common/SijiIcon.vue：重写为 v4，双 image（light/dark）+ @media prefers-color-scheme 显隐；color 语义分组 primary/secondary/white/amber，未知 name 兜底 info',
        ],
      },
      {
        title: '死代码清理与底色统一（P0/P2）',
        items: [
          'App.vue：删除全部 CSS 变量与 .glass-card/.tap-feedback/.fade-in-up/.text-*/.font-*/.mt-*/.mb-* 等零引用全局类；全局 page 背景改 #F4F4F5（深色 #18181B）',
          'pages/functions/functions.scss、pages/settings/sub/ai.scss、about.scss、agent.scss、agent_add.scss、data.vue、memory.scss、privacy.vue：卡片范式页面背景统一 #F4F4F5',
        ],
      },
      {
        title: '触控热区扩大（P1）',
        items: [
          'components/chat/InputArea.vue：v13，图片/文件/发送/停止热区 88rpx（视觉圆点 48/72rpx），删除预览键热区 64rpx',
          'components/chat/modal-mixins.scss、components/chat/GuideModal.vue：modal-close 用 padding 20rpx + 负 margin 扩热区',
          'pages/chat/chat-mixins.scss：circular-btn 默认尺寸 56→72rpx（nav-menu-btn / nav-guide-btn）',
          'pages/chat/chat.scss：back-to-bottom 56→72rpx；resume-close 用 padding 扩热区到 72rpx',
          'pages/diary/list.scss、pages/functions/functions.scss、pages/diary/detail.scss、pages/plan/index.vue：review-close 扩热区，entry-new-btn / ta-btn / tool-btn 视觉圆 56→72rpx',
        ],
      },
      {
        title: '文档同步（P2）',
        items: [
          'DESIGN_SYSTEM.md：第六章阴影改「零阴影」+ 层级底色表；第九章图标系统改 40 个图标、语义色调、PNG 资源规格、改名防缓存；顶部图标概述与 --bg-page 底色同步',
        ],
      },
    ],
  },
]
