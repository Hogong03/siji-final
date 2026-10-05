/**
 * 版本日志数据段：4.13.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V413 = [
  {
    version: '4.13.0',
    date: '2026-10-06',
    title: '4.13.0 UI 优化批次 + 字号切换：消息操作收纳长按呼出、深色对比度达标、字号四档切换（气泡/简报/阅读页）、统一空状态与统计 hero',
    summary: [
      '按 docs/UI优化方案.md 全量执行（P0×3 + P1×3 + P2×4），并新增「字号大小切换」功能 —— 设置 → 外观弹层新增字号档位（小/标准/大/特大），对话气泡、简报卡、记录阅读页正文即时缩放',
      'P0-1 消息操作收纳：气泡上常驻的「时间+复制/编辑」按钮行收进长按呼出的 ActionSheet（按角色出牌：AI=复制/重新生成/换一种说法/续写/按章节阅读，用户=复制/编辑），行内只留小时间戳 —— 聊天页最大噪音源清除，长按用 usePressHold（位移容差防误触）',
      'P0-2 热区垫高：对话行「加标签/重命名」小按钮用透明 padding 扩到 ~56rpx 触区（视觉不变）',
      'P0-3 深色对比度：25 个文件 88 处深色块内的 #52525B 文字全部提到 #71717A（含 border-color 误伤防护的精确替换），深色下次级信息可读',
      '字号切换实现：utils/font-scale.js 响应式比例单例（四档 0.9/1.0/1.15/1.3，存 siji_font_scale），气泡文本/Markdown 根节点/简报卡全文字/记录阅读页正文走 fontRpx 内联字号 —— UI 骨架（按钮/导航/图标）字号保持稳定，只缩放阅读内容',
      'P1 一致性：EmptyState 统一空状态组件替换 6 处（agent/记录/账单/计划/搜索×2）；账单统计改 hero 层级（支出大数字 + 三张次级卡）；输入框 focus 只留边框高亮不再跳底色；uni.scss 补 $radius-xs 圆角 token',
      'P2 加分：简报卡新增「今日打卡 n/m」进度行（satisfiedToday 口径，无可打卡计划不显示）；发送后等待期阶段性文案（正在思考… → 正在调用工具…）；App 冷启动深色预挂改为 10 轮×150ms 有界重试',
      '全量测试 93 文件 / 1301 用例全绿；App 端需 HBuilder X 重新编译真机目检（重点：字号切换即时性、长按操作面板、深色对比度）',
    ],
    categories: [
      {
        title: '字号切换（新功能）',
        items: [
          'utils/font-scale.js（新增）：FONT_SCALES 四档 + 响应式 fontScale 单例 + fontRpx(base) 产出内联字号 + initFontScale/getFontScaleId/setFontScaleId；存储键 siji_font_scale',
          '设置 → 外观弹层新增「字号」档位选择（四枚 chip 预览字号随档位放大，选中黑底反白）',
          '缩放面：MessageBubble 用户文本与 AI Markdown 根节点（MarkdownRenderer 新增 baseFontSize prop，段落继承缩放，标题层级不缩）、EnterBriefing 全部文字（7 处 fontRpx 绑定）、pages/diary/read.vue 正文容器',
          '设计边界：只缩放阅读内容，UI 骨架（按钮/导航/tabBar/图标）字号稳定 —— 延伸「UI 退让」哲学，避免骨架抖动',
        ],
      },
      {
        title: '消息与交互（P0-1/P0-2）',
        items: [
          'components/chat/MessageBubble.vue：meta 行只留时间戳；新增 usePressHold 长按气泡 → uni.showActionSheet 操作面板（按 message.role 与状态出牌：复制/重新生成/换一种说法/继续写完（_truncated）/按章节阅读（长文）/编辑），tap 后走既有事件通道',
          'components/chat/ConversationListItem.vue：加标签/重命名小按钮 padding 12rpx + 负 margin 垫高热区（视觉不变）',
        ],
      },
      {
        title: '深色与一致性（P0-3/P1）',
        items: [
          '深色对比度：25 文件 88 处深色块 color: #52525B → #71717A（括号深度追踪精确替换，border-color/background 用途未误伤；浅色块 59 处未动）',
          'components/common/EmptyState.vue（新增）：图标+标题+副文案+主按钮，双主题内建；替换 agent/记录/账单/计划/搜索 6 处空状态',
          'pages/bill/stats.vue：overview 改 hero 层级（支出 56rpx 大数字 + 收入/结余/日均次级三列），月报长图同款排版效率',
          'components/chat/InputArea.vue：input-wrap focus-within 删 background 切换（只留边框高亮）',
          'uni.scss：补 $radius-xs 4rpx（$radius-sm/md/lg/xl 既有），圆角 token 族齐',
        ],
      },
      {
        title: '体验加分（P2）',
        items: [
          '简报卡「今日打卡 n/m」进度行：useEnterSummary 新增 collectCheckinToday（isRecurring 过滤 + satisfiedToday 判定，接入 buildPlanExtras 两条路径都生效），enter-dialogue 产出 briefing.checkin，EnterBriefing 渲染进度条（total=0 不显示）',
          '等待阶段性文案：useChatEngine loading 消息带 _stageText（正在思考… → onStatus 工具回调后 正在调用工具…），MessageBubble streaming 态显示 bubble-stage 小字；重试路径清空防叠加',
          'utils/theme.js initTheme：冷启动 10 轮×150ms 有界重试 applyTheme，首页 WebView 出现即挂类，深色闪现窗口压到最小',
        ],
      },
    ],
  },
]
