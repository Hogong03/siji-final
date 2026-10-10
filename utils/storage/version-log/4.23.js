/**
 * 版本日志数据段：4.23.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V423 = [
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
