/**
 * 版本日志数据段：4.3.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V43 = [
  {
    version: '4.3.0',
    date: '2026-09-18',
    title: '4.3.0 长文能力：四家厂商声明输出上限 + 长文例外一次写全篇 + 长回复给「按章节阅读」',
    summary: [
      '输出上限显式声明：请求体以前不带 max_tokens，同一句「写一篇长文」在不同厂商下长短不一、短的会写到一半停住；现在四家都按厂商声明写入（DeepSeek / 通义 / Moonshot 8192，智谱 4096），四条请求路径全部覆盖（H5 SSE / App 分块流 / Agent 工具轮 / Agent 最终轮）',
      '长文例外写进提示词：用户明确要「写篇文章 / 写攻略 / 写方案 / 写总结」时不受「闲聊 1-3 句」约束，一次写完整篇（## 分小节，800-3000 字），写完必须 create_diary 存成记录并告知阅读入口；核心铁律的简洁约束标了「日常闲聊适用」，不再反过来压长文',
      '长回复给阅读入口：AI 气泡正文 ≥800 字时多一个「按章节阅读」——已经存过记录的直接进阅读页（目录尺版式），没存过的先落一条记录再进，不用自己复制粘贴',
      '自检加一条长文语料（long-form-article）：要一篇 1000 字文章并要求落库，判定落库正文 ≥600 字 —— 它同时是各家输出上限的真机实测手段，上限值要不要调大看这条',
      '样式补漏：「按章节阅读」加了比其余文字按钮重一档的描边胶囊（深色模式跟随反相）'
    ],
    categories: [
      {
        title: '输出上限（4.3.0）',
        items: [
          'utils/ai/providers.js：新增 PROVIDER_MAX_TOKENS（deepseek 8192 / zhipu 4096 / qwen 8192 / moonshot 8192）与 getMaxTokens(providerId)（未声明回落 4096）；buildProviderRequest 带上 max_tokens',
          'utils/ai/chat-sse.js（H5 SSE）、utils/ai/chat-chunked.js（App 分块流）、utils/ai/agent-transport.js（工具轮 + 最终流式，两处）的请求体都带上 max_tokens，取值统一走 getMaxTokens',
          '取值口径写进注释：这是保守的安全值（不低于各家公开的默认上限），真正能出多少字以真机自检的长文语料为准 —— 别把声明值当实测结论'
        ]
      },
      {
        title: '长文例外（4.3.0）',
        items: [
          'utils/ai/prompt-actions.js：BEHAVIOR_RULES 新增长文规则 —— 一次写完整篇、markdown 二级标题分小节、800-3000 字、写完必须 create_diary（整篇放 content、首行当标题）、回一句「已存成记录，点下面的查看能按章节读」、禁止只回一段摘要就说写完',
          'utils/ai/prompt-actions.js：CORE_ACTIONS 的 create_diary 点明「长文（攻略/方案/文章/长总结）也走这个工具」',
          'utils/ai/prompt-builder.js：核心铁律第 1 条「闲聊 1-3 句」加括注「（日常闲聊适用；用户明确要长文时见行为准则里的长文例外）」'
        ]
      },
      {
        title: '长文阅读入口（4.3.0）',
        items: [
          'components/chat/MessageBubble.vue：AI 气泡正文（去空白后）≥800 字（LONG_TEXT_MIN）时渲染「按章节阅读」，新增 read-long 事件',
          'pages/chat/index.vue：handleReadLong —— 消息带 create_diary 的执行结果就直接进 /pages/diary/read（clientId + 月份分片）；没存过就先按同一套 create_diary 执行器落一条再进；落库失败提示可先复制',
          'components/chat/MessageBubble.scss：新增 .bubble-action-strong（黑描边胶囊 + 反相按压）+ 深色模式覆盖'
        ]
      },
      {
        title: '自检语料与测试（4.3.0）',
        items: [
          'utils/ai/eval/cases.js：新增 long-form-article（要 1000 字文章 + 必须落库，判定 create_diary 的 content 去空白后 ≥600 字）；语料 23 → 24 条',
          'tests/long-form.test.js（新增）：输出上限（四家都声明 + 四条请求路径都带 max_tokens）、长文规则（提示词里的长文例外与适用范围）、长文入口（组件阈值与事件接线 + 聊天页两个分支）',
          '全量：77 文件 / 1119 用例全绿（npx vitest run --maxWorkers=2，exit 0）'
        ]
      }
    ]
  }
]
