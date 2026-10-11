/**
 * 版本日志数据段：4.23.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V423 = [
  {
    version: '4.23.2',
    date: '2026-10-11',
    title: '免责声明条款更新至与当前功能一致',
    summary: [
      '「最后更新」日期 2026-07-14 → 2026-10-11，条款正文与 4.23.x 功能现状对齐',
      'AI 服务说明补全可选能力的数据流向：联网搜索（搜索词→智谱/Tavily）、读网址（直连或 Tavily 抓取）、图片识别（图片→所选模型）、语音转文字（录音→智谱 ASR）、文档解析（文件→智谱/Moonshot），并注明均可在设置中关闭',
      '修正失实陈述：数据同步功能已移除，删除「错误信息会在网络恢复后批量上传至思迹服务器」一句，改为如实描述（仅本地暂存、手动导出诊断包、可清除）',
      '数据隐私补充：API Key 加密仅存本机、自动备份仅写设备本地目录、导出均为手动触发',
    ],
    categories: [
      {
        title: '条款内容（4.23.2）',
        items: [
          'pages/disclaimer/index.vue：二/三/五三章重写，一/四/六/七保持不变',
          '事实核对依据：utils/ai/features.js 能力注册表（web_search/read_url/vision/voice 均可开关）、utils/ai/search-adapters.js（智谱 web_search + Tavily 端点）、utils/ai/read-adapters.js（Tavily extract）、utils/files/doc-parse.js（智谱/Moonshot 文件上传端点）、utils/storage/backup.js（_doc/siji-backup 本地 3 份）、utils/error-reporter.js（仅 setStorageSync 本地队列，无网络请求）、pages/settings/sub/data.vue（同步已移除，仅导出/索引/清除）',
        ],
      },
    ],
  },
  {
    version: '4.23.1',
    date: '2026-10-11',
    title: '免责声明页 UI 修缮：修 H5 双滚动 + 视觉规范对齐',
    summary: [
      '修 H5 端双滚动：页面高度 100vh 未扣除模拟导航栏 44px，整页可滚出品牌区与按钮区；改 calc(100vh - var(--window-top, 0px)) 并把外层 overflow: scroll 收为 hidden（App/MP 端变量回落 0px，行为不变）',
      '去标题三重堆叠：删页内与导航栏同名的大标题，「最后更新」日期上移进品牌区；品牌字对齐 splash 规格（72rpx/8rpx 字距 + 22rpx/12rpx 副标）',
      '按钮规范对齐：主按钮 #3F3F46 升为纯黑 #000000（对齐锁屏页先例），深色反白 #FAFAFA/#000000；次按钮补 1rpx 边框不再靠圆角猜边界；拒绝弹窗补 confirmColor 黑色',
      '阅读性提升：正文 24→26rpx、行高 1.75，小节标题 26→30rpx，序号条目间距 8→12rpx；桌面 H5 正文与按钮收窄至 640px 居中',
      '细节：show-scrollbar 改真绑定（:show-scrollbar="false"，修微信端 enhanced 滚动条）、品牌/正文/按钮区加 disclaimerIn 入场动画、删 agreed 死变量',
    ],
    categories: [
      {
        title: '布局修复（4.23.1）',
        items: [
          'pages/disclaimer/index.vue：.disclaimer-wrap 高度改 calc(100vh - var(--window-top, 0px))，H5 端扣除模拟导航栏；App-vue/微信小程序端该变量为 0px，计算结果与原先一致',
          '外层 overflow: scroll 改 overflow: hidden，滚轮不再滚走品牌区与底部按钮（对齐 DESIGN_SYSTEM 10.1 页面骨架）',
          'scroll-view 的 show-scrollbar 由字符串字面量 "false" 改真绑定 :show-scrollbar="false"（字符串 truthy 会令微信端 enhanced 模式滚动条常显）',
        ],
      },
      {
        title: '视觉规范（4.23.1）',
        items: [
          '删页内 .disclaimer-title（与原生导航栏标题重复），.disclaimer-date 移入品牌区',
          '品牌区对齐 splash 规格：72rpx/700/字距 8rpx + 副标 22rpx/字距 12rpx',
          '主按钮 #000000（浅色）/ #FAFAFA 底黑字（深色，对齐用户气泡反白逻辑）；次按钮加 1rpx #E4E4E7 边框（深色 #3F3F46）；按钮容器补 box-sizing: border-box',
          '正文 26rpx/1.75、小节标题 30rpx、条目间距 12rpx、节间距 32rpx',
          '桌面 H5（≥768px）正文与按钮区 max-width 640px 居中（rpx 高视口封顶无法表达，H5 条件编译内用 px）',
          '新增 disclaimerIn 入场动画（品牌 0s / 正文 0.08s / 底栏 0.16s 递进，fadeInUp 0.4s）',
          'handleDecline 弹窗补 confirmColor: #000000，不再吃平台默认蓝绿色',
        ],
      },
    ],
  },
  {
    version: '4.23.0',
    date: '2026-10-08',
    title: 'AI 响应提速三件套：工具轮思考档降级 + 思考流实时上屏 + 工具级阶段文案',
    summary: [
      '工具轮思考档从 high 降到 low：工具调用是确定性任务（按 schema 调工具）不需要深思，GLM-5.3 强制思考模型每轮先深思数秒是响应慢的主因，一条多轮工具消息体感快近一半',
      '思考流实时上屏：工具轮流回来的 reasoning_content 原来收集后直接丢弃，现在实时写进气泡折叠块（固定高度内容底部对齐，纯 CSS 跟随），生成完自动隐藏 —— 等待从盯转圈变成看它想什么，感知提速最明显',
      '工具级阶段文案：「正在调用工具…」升级为 TOOL_LABELS 映射的具体动作（正在查账单…/正在写记录…），查询类并行时显示「正在查账单 等 2 项…」；补齐 13 个查询类工具的中文标签',
      '等待不再黑盒：思考块 + 阶段文案 + 打字机三段反馈覆盖全流程；_thinking 不进落盘白名单，刷新后不残留',
    ],
    categories: [
      {
        title: '响应提速（4.23.0）',
        items: [
          'utils/ai/agent-transport.js：buildStreamRoundBody / callWithToolsSSEToolRound 思考档 complex→chat（high→low）；callWithTools 加第 7 参 onThinking 透传到 SSE 工具轮与 App chunked',
          'utils/ai/chat-chunked.js：delta.reasoning_content 处回调 opts.onThinking（思考 delta 同时计入首块判定与 idle 续期）',
          'utils/ai/agent-loop.js：工具轮调用点透传 cfg.onThinking；onStatus 通道既有（工具名数组）不改',
          'utils/ai/tools/index.js：TOOL_LABELS 补 query_diary/query_bill/query_stat/query_plan/query_relation/query_decision/query_combined/get_profile/summarize_diaries/query_feedback/query_feedback_stats/query_tags/web_search 共 13 条',
          'composables/useChatEngine.js：cfg 注入 onThinking（_thinking 累加 + safeUpdate）；onStatus 升级为 TOOL_LABELS 具体动作文案',
          'components/chat/MessageBubble.vue：loading 气泡加 .thinking-box 思考折叠块（浅灰圆角 / 深色 #3F3F46，两套深色块同步）',
          'tests/stream-toolcalls.test.js 补 2 例：工具轮请求体 low 档断言（thinking.enabled + reasoning_effort=low）、onThinking 收到 reasoning 分片；全量 101 文件 / 1375 用例全绿',
        ],
      },
    ],
  },
]
