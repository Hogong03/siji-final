/**
 * 版本日志数据段：4.3.x（新版本在前）
 *
 * 发布前合并：4.3.0 / 4.3.1 两条补丁记录合并为一条 4.3.1（应用未发布，合并降噪；
 * title 注明整合范围，明细按主题归并，原文的文件名/技术结论/排坑记录保留）。
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V43 = [
  {
    version: '4.3.1',
    date: '2026-09-18',
    title: '4.3.1（整合 4.3.0~4.3.1，发布前合并）：长文能力（四家声明输出上限 + 长文例外 + 按章节阅读）+ 输出截断不再静默（finish_reason 全采 + 继续写完）',
    summary: [
      '输出上限显式声明：请求体以前不带 max_tokens，同一句「写长文」在不同厂商下长短不一、短的写到一半停住；现在四家按厂商声明写入（DeepSeek/通义/Moonshot 8192、智谱 4096），四条请求路径全覆盖（H5 SSE / App 分块流 / Agent 工具轮 / 最终轮）',
      '长文例外写进提示词：用户明确要「写文章/攻略/方案/总结」时不受「闲聊 1-3 句」约束，一次写完整篇（## 分小节，800-3000 字），写完必须 create_diary 存成记录并告知阅读入口',
      '长回复给阅读入口：AI 气泡正文 ≥800 字多一个「按章节阅读」—— 已存过记录的直接进阅读页，没存过的先落一条记录再进，不用自己复制粘贴',
      '截断不再静默：以前没人读厂商回的 finish_reason，撞上限写一半停住时界面跟正常短回复一模一样；现在四条路径全采 finish_reason，等于 length 就打 _truncated 标记（唯一判据，不按字数猜），气泡给「继续写完」一键续写，标记随会话落盘',
      '自检加长文语料（long-form-article）：要 1000 字文章并要求落库，判定落库正文 ≥600 字 —— 同时是各家输出上限的真机实测手段'
    ],
    categories: [
      {
        title: '输出上限（4.3.0）',
        items: [
          'utils/ai/providers.js：新增 PROVIDER_MAX_TOKENS（deepseek 8192 / zhipu 4096 / qwen 8192 / moonshot 8192）与 getMaxTokens(providerId)（未声明回落 4096）；chat-sse.js / chat-chunked.js / agent-transport.js（工具轮+最终流式两处）请求体都带 max_tokens',
          '取值口径写进注释：保守安全值（不低于各家公开默认上限），真正能出多少字以真机自检的长文语料为准 —— 别把声明值当实测结论'
        ]
      },
      {
        title: '长文例外与阅读入口（4.3.0）',
        items: [
          'utils/ai/prompt-actions.js：BEHAVIOR_RULES 新增长文规则（一次写完整篇 / 800-3000 字 / 写完必须 create_diary 整篇放 content 首行当标题 / 禁止只回一段摘要就说写完）；CORE_ACTIONS 的 create_diary 点明长文也走它；prompt-builder.js 核心铁律 1 加「日常闲聊适用」括注',
          'components/chat/MessageBubble.vue：正文（去空白后）≥800 字（LONG_TEXT_MIN）渲染「按章节阅读」（.bubble-action-strong 黑描边胶囊 + 深色反相）；pages/chat/index.vue handleReadLong —— 带执行结果直接进 /pages/diary/read（clientId+月份分片），没存过先按同一套 create_diary 落一条再进，落库失败提示可先复制'
        ]
      },
      {
        title: '截断采集与续写（4.3.1）',
        items: [
          'utils/ai/response-parser.js 新增 markReplyTruncated(result, finishReason) —— 只认 length，返回原对象便于链式调用；chat-sse.js（H5 SSE）、chat-chunked.js（App 分块流，含 Agent raw content 模式）、chat-request.js 两处（正常+400 降级重试）、agent-transport.js 四处（工具轮/最终流式两处/非流式兜底/App 分支）解析时记录 finish_reason；agent-loop.js 两处返回值透传 truncated（正常最终回复 + 轮次耗尽兜底）',
          'composables/useChatEngine.js：拿到结果后把 _truncated 写到最后一条消息上；MessageBubble.vue 新增 isTruncated（只认 assistant + _truncated）与 continue-write 事件 —— 气泡下方「已达输出上限，回复被截断」+ 描边胶囊「继续写完」；pages/chat/index.vue handleContinueWrite 发「从被截断的地方接着写、不要重复已写内容」',
          'store/chat/persist.js：_truncated 进落盘白名单 —— 重启后那条回复仍带续写入口，线索不因重进对话丢失'
        ]
      },
      {
        title: '语料与测试',
        items: [
          'utils/ai/eval/cases.js 新增 long-form-article（1000 字文章 + 必须落库，判定 content 去空白后 ≥600 字），语料 23→24 条',
          'tests/long-form.test.js（新增）：输出上限（四家声明 + 四条路径带 max_tokens）、长文规则、长文入口接线；tests/reply-truncated.test.js（新增）：判据纯函数 + 四路径采集点 + 气泡入口 + 落盘白名单；全量 77 文件 / 1119 用例全绿'
        ]
      }
    ]
  }
]
