/**
 * 版本日志数据段：4.21.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V421 = [
  {
    version: '4.21.0',
    date: '2026-10-08',
    title: '工具轮流式化根治长文超时：模型还在吐字就不掐 + JSON 修复式解析（裸换行容错）',
    summary: [
      '真机实测：GLM-5.3 强制思考下生成七章完整 JSON arguments 超 180s 超时 → 回退 JSON 路径后 content 里的真实换行又导致 JSON.parse 失败，整段 JSON 被当纯文本气泡、记录不落库 —— 两个环节一起根治',
      '工具轮默认改流式：H5 走 fetch SSE、App 走 enableChunked，带 tools 解析 delta.tool_calls 按 index 增量拼装；超时改 idle 续期（首 token 60s / 每 chunk 续 30s / 硬上限 600s）—— 生成再慢只要模型还在吐字就不会被掐，不再有「总时长」焦虑',
      'App 端 chunked 流式同步扩展：请求带 tools/tool_choice，收 reasoning_content 与 tool_calls 分片（思考 delta 也续命），工具轮总超时 120s→600s，返回形状与非流式对齐（message.tool_calls + reasoning_content，Kimi 多轮回传要求不破坏）',
      'JSON 修复式解析兜底：response-parser 新增 tryParseWithControlCharFix —— JSON.parse 失败后把裸换行/tab 转义重试（合法 JSON 不会含裸控制字符，失败分支转义是安全的），超时回退 JSON 路径的更长 content 也能正常落库，不再整段当纯文本气泡',
      '失败降级链完整：流式失败（厂商不支持/网络）自动回退非流式 180s；半截 tool_calls 的非法 arguments 由 executeTool 报错回传，模型下一轮自愈；测试 mock 链（_mockResponder）保持非流式直连，全部既有用例零改动通过',
    ],
    categories: [
      {
        title: '工具轮流式化（4.21.0）',
        items: [
          'utils/ai/agent-transport.js：callWithTools 工具轮改走 callWithToolsStreamRound（H5 fetch SSE / App chunked / 其余降级非流式），新增 callWithToolsSSEToolRound（idle 续期超时 60s/30s/600s，reasoning_content 与 tool_calls 分片收集，半截结果标 truncated）',
          'utils/ai/chat-chunked.js：新增 assembleStreamToolCalls 增量拼装纯函数；chunkedImpl 支持 opts.tools/toolRound/reasoning，首块判定扩展到 reasoning_content 与 tool_calls，工具轮总超时 600s，buildResult 产出 message.tool_calls 形状',
          'utils/ai/response-parser.js：新增 tryParseWithControlCharFix（裸 \\n/\\r/\\t 转义重 parse），parseAiResponse 的失败分支先修复再走贪婪匹配兜底',
          'tests/stream-toolcalls.test.js 10 例：分片乱序/多工具/arguments 累加、裸换行修复、parseAiResponse 端到端（超时回退 JSON 的长 content 正常落出 create_diary）、H5 SSE 端到端拼装与失败降级',
          '全量 100 文件 / 1366 用例全绿',
        ],
      },
    ],
  },
]
