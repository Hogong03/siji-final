/**
 * 版本日志数据段：2.3.9 - 2.3.0（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V23_EARLY = [
  {
    version: '2.3.9',
    date: '2026-08-30',
    title: '修复 Web 端发送图片识别时弹出浏览器下载框',
    summary: [
      'utils/image.js：saveImageToLocal 的 H5 分支不再转 Blob + <a download> 触发下载，改为直接以 base64（data URL）作为 localPath，图片识别/发送全程无下载弹框',
      '消息持久化与渲染兼容：localPath 即 data URL，img src 可直接显示；persist.js 容量截断与 dev-feedback 图片脱敏逻辑均不受影响'
    ],
    categories: [
      {
        title: 'H5 图片下载弹框修复',
        items: [
          '复现路径：Web 端（H5）发送带图片的消息 → useChatEngine 调 saveImageAsync → saveImageToLocal H5 分支创建 <a download> 并 click() → 浏览器弹出下载框',
          'utils/image.js：H5 分支删除 atob/Blob/createObjectURL/appendChild/a.click/revokeObjectURL 整段下载代码，resolve(base64) 作为本地路径',
          'App（_doc/siji_images/）与小程序（wx.env.USER_DATA_PATH）写文件逻辑保持不变',
          '效果：Web 端图片识别正常发送与历史消息回显，不再出现下载弹框'
        ]
      }
    ]
  },
  {
    version: '2.3.8',
    date: '2026-08-29',
    title: '修复闲聊误触发「没能自动记录」提示：操作声称/指令检测正则收窄',
    summary: [
      'utils/ai/constants.js：删除 OP_CLAIM_RE_EXT（含裸"帮你"），autoExecutor 改用严格版 OP_CLAIM_RE_FALLBACK，AI 回复"帮你细细分析"等口语不再误判为操作声称',
      'utils/ai/constants.js：新增 OP_REQUEST_RE 严格操作指令正则（帮我+操作动词 / 操作动词+对象），移除裸"记录/记账/计划/决策"名词，用户消息"聊天记录"不再误命中',
      'utils/ai/autoExecutor.js：两处 opClaimed 检测与 reply 修正条件同步收窄，正常对话回复不再被改写追加"没能自动记录，再告诉我一次具体要记什么？"'
    ],
    categories: [
      {
        title: '误触发修复',
        items: [
          '复现场景（开发者反馈 2026-08-29）：用户说明"发5张聊天记录图片"，AI 回复"帮你细细分析你们之间的关系" → 之前被改写为"…没能自动记录"，现已保留原回复',
          'constants.js：OP_CLAIM_RE_EXT / OP_CLAIM_WORDS_EXT 删除（唯一引用方 autoExecutor 已切换），符合死代码红线',
          'constants.js：OP_REQUEST_RE 覆盖"帮我记/记一下/记录一下/写一篇/建一个/创建/修改/更新/删除/撤销"等明确指令，真实记账/记录指令仍触发修正提示',
          'tests/bugfix-regression.test.js：新增 2 个用例（闲聊不误判 + 真指令仍修正），全量 235 用例通过'
        ]
      }
    ]
  },
  {
    version: '2.3.7',
    date: '2026-08-29',
    title: '修复关系模拟等场景 AI 反复空回复：DeepSeek 流式禁用 json_object + 空回复自动重试',
    summary: [
      'utils/ai/providers.js：deepseek 增加 streamNoResponseFormat 标记，新增 supportsStreamStructuredOutput；H5/App 流式路径（chat-stream.js / chat-chunked.js）改用该判断，彻底规避 DeepSeek V4 流式 + response_format 空回复硬约束',
      'utils/ai/chat-stream.js / chat-chunked.js：空回复兜底（_isFallback）也标记 _emptyReply，retryStreamWithBackoff 自动重试接管，用户不再需要反复手动点重试',
      '关系处理模拟 / 规划推演 / 社交模拟场景（useSimulationManager）的空回复问题随之修复'
    ],
    categories: [
      {
        title: '空回复修复',
        items: [
          'providers.js：deepseek 注册表新增 streamNoResponseFormat: true（V4 流式 + json_object 空回复实测硬约束），非流式 json mode 不受影响',
          'providers.js：新增导出 supportsStreamStructuredOutput(providerId, modelId)，流式路径专用能力位',
          'chat-stream.js（H5 SSE）：response_format 判断切换为 supportsStreamStructuredOutput；parseAiResponse 返回 _isFallback 时同步标记 _emptyReply',
          'chat-chunked.js（App 端分块流式）：useFormat 切换为 supportsStreamStructuredOutput；buildResult 中 _isFallback 同步标记 _emptyReply',
          '修复后空回复会走 retryStreamWithBackoff 自动重试（1s/3s 两次），与 utils/ai/chat-request.js 非流式路径行为对齐'
        ]
      }
    ]
  },
  {
    version: '2.3.6',
    date: '2026-08-29',
    title: '输入框 v11：移除语音功能，仅保留图片识别',
    summary: [
      'components/chat/InputArea.vue 升级 v11：删除语音输入能力（录音/转写），输入行仅剩 图片/输入框/发送（停止）',
      '移除 recorder.js / transcribe.js 依赖与 onUnmounted 清理逻辑，组件从 311 行精简至 219 行',
      '图片识别、草稿保存、2000 字限制与对外接口（reset/setText/getImage/resetImage）保持不变'
    ],
    categories: [
      {
        title: '输入框精简',
        items: [
          'InputArea.vue：删除 toggleVoice/stopVoice/voiceState/voiceSeconds 及录音计时器逻辑',
          'InputArea.vue：删除语音按钮与语音相关样式（voice-btn/voice-dot/voicePulse 及深色模式配色）',
          'InputArea.vue：vue import 清理 onUnmounted，移除 recorder.js/transcribe.js 引用',
          '对外接口与事件不变，父组件 pages/chat/index.vue 零改动'
        ]
      }
    ]
  },
  {
    version: '2.3.5',
    date: '2026-08-29',
    title: '聊天输入框简化 v10：删除快捷指令、语音状态内嵌',
    summary: [
      'components/chat/InputArea.vue 重构为 v10 极简版：输入行收敛为 语音/图片/输入框/发送（停止）',
      '删除快捷指令面板（+ 按钮与记账/记录/计划/查询 4 项），AI 意图识别已覆盖该场景',
      '语音交互简化：删除录音/转写独立提示条，状态内嵌按钮（录音中黑底红点+秒数，转写中省略号）',
      '草稿保存改为 300ms 轻量防抖单函数，减少冗余定时器代码'
    ],
    categories: [
      {
        title: '输入框简化',
        items: [
          'InputArea.vue：移除 showShortcuts/shortcuts/applyShortcut 及 shortcut-panel 模板与样式（约 60 行）',
          'InputArea.vue：移除 voice-recording-hint 两条提示条与 voicePulse 缩放动画，录音状态改为按钮内嵌展示',
          'InputArea.vue：onInputDraft 防抖定时器与 saveDraft 合并为单函数（300ms），onInput 直接触发',
          '对外接口不变：reset/setText/getImage/resetImage 与 send/stop/image-selected/image-cleared 事件保持，父组件零改动',
          '深色模式样式同步精简，删除已废弃的 shortcut/提示条配色'
        ]
      }
    ]
  },
  {
    version: '2.3.4',
    date: '2026-08-29',
    title: '图标体系全面替换：Lucide 线框图标 + 厂商最新官方 logo',
    summary: [
      'static/icons 与 static/tab 全部 83 个 PNG 图标替换为 Lucide 线框图标（MIT 协议），风格统一为黑白极简',
      'tabBar 6 个图标重绘为 81×81（普通态 #A1A1AA / 选中态 #000000），UI 图标 48×48 纯黑，Agent 头像 64×64',
      '5 家厂商 logo 更新为最新官方图标：OpenAI 花朵标、DeepSeek 蓝色方块、Kimi 渐变圆、智谱星形标、通义方块'
    ],
    categories: [
      {
        title: '图标替换',
        items: [
          'UI 图标 62 个：ai/bill/diary/plan/chat-bubble 等全部换成 Lucide 24px 线框对应图标（如 chat-bubble→message-circle、plan→calendar-check、stats→bar-chart-3）',
          'tabBar 6 个：chat/functions/settings 普通+选中双态，81×81 PNG',
          'Agent 头像 10 个：64×64 黑色线框（思迹助手→bot、职场参谋→briefcase、情感顾问→heart、心理咨询师→brain 等）',
          '厂商 logo 5 个：128×128 官方最新图标，替换原字母占位图标'
        ]
      },
      {
        title: '来源与授权',
        items: [
          'Lucide v1.35.0（MIT License），官方品牌图标分别抓取自 openai.com 品牌资源 / deepseek.com / kimi.moonshot.cn / zhipuai.cn / tongyi.aliyun.com',
          'icon-new.html 为替换效果总览页（项目根目录，可删除）'
        ]
      }
    ]
  },
  {
    version: '2.3.3',
    date: '2026-08-28',
    title: '修复 AI 回复整段重复：App 分块流式重发去重',
    summary: [
      '修复 App 端 AI 回复整段重复两次的问题（分块回调重发同一段数据被重复解析）',
      '分块增量计算抽取为 computeChunkDelta：累积/增量双模式兼容，相同数据重发返回空增量直接跳过',
      'SSE 行级去重：同一 data 事件被服务端/网络层重发时不再重复累加内容',
      '新增 computeChunkDelta 单元测试（4 用例），覆盖累积/增量/重发/空数据四种场景',
    ],
    categories: [
      {
        title: '重复回复修复',
        items: [
          'chat-chunked：success 回调收到与已处理内容相同的数据时（App 端 enableChunked 重发），不再走增量分支整段重复解析',
          'chat-chunked：SSE 解析增加 lastSseLine 去重，同一事件行重复到达时跳过，避免 fullContent 翻倍',
        ]
      },
      {
        title: '测试与版本',
        items: [
          'tests/chat-error.test.js 新增 computeChunkDelta 用例：累积模式取增量、增量模式直接处理、相同数据重发跳过、空数据跳过',
          'manifest.json 版本提升至 2.3.3（2303），版本历史同步更新'
        ]
      }
    ]
  },
  {
    version: '2.3.2',
    date: '2026-08-28',
    title: 'AI 请求错误透出：App 分块流式不再吞错',
    summary: [
      '修复 App 端对话/图片识别失败被“走神”兜底掩盖的问题，真实 API 错误直接显示给用户',
      'App 分块流式请求遇 HTTP 400 自动去掉 JSON 模式重试一次，对齐非流式路径',
      '参数/权限类错误（4xx）不再无意义自动重试，限流/5xx/网络错误仍自动退避重试',
      '新增错误解析与重试策略单元测试（10 用例），覆盖错误透出与请求次数',
    ],
    categories: [
      {
        title: '错误透出',
        items: [
          'chat-chunked：非 200 响应解析 error.message 后透出（如 HTTP 400: Model Not Exist），不再显示“刚才走神了”假象',
          'chat-chunked：400 且启用 JSON 模式时去掉 response_format 重试一次，规避实验视觉模型等对 JSON 模式的不兼容',
          'useChatEngine：空回复分支优先展示 result._error 真实错误，并保留重试按钮',
        ]
      },
      {
        title: '重试策略',
        items: [
          'streamRetry：isRetryableError 判定——HTTP 4xx（除 429）不重试直接透出，429/5xx/网络错误/空回复自动退避重试',
          '新增 tests/chat-error.test.js：parseApiError、isRetryableError、非可重试错误仅请求一次',
        ]
      }
    ]
  },
  {
    version: '2.3.1',
    date: '2026-08-27',
    title: 'AI 模型全线升级：GLM-5.3 / Qwen3.8 / Kimi K3 最新旗舰',
    summary: [
      '智谱新增 GLM-5.3 / GLM-5.3-Flash：1M 上下文、强制思考；Flash 为原生多模态视觉模型',
      '通义全线换代：qwen3.8-flash / qwen3.7-plus / qwen3.8-max + 多模态 qwen3.5-omni-plus',
      'Moonshot 新增 Kimi K3（2.8T 参数、1M 上下文、视觉、推理强度），移除月底下线的 kimi-k2.5',
      'DeepSeek 新增 V4 Flash Vision(实验) 视觉模型',
      '推理参数适配与旧模型 ID 自动迁移，历史设置无缝切换'
    ],
    categories: [
      {
        title: '模型升级',
        items: [
          '智谱：新增 glm-5.3（最新旗舰·强制思考）、glm-5.3-flash（原生多模态·高性价比），默认排序置顶；glm-4v-flash 视觉由 glm-5.3-flash 替代',
          '通义：qwen-turbo/plus/max/long 全部替换为 qwen3.8-flash / qwen3.7-plus / qwen3.8-max，视觉用 qwen3.5-omni-plus',
          'Moonshot：新增 kimi-k3（2.8T 参数、1M 上下文、原生视觉、Tool Calling）、kimi-k2.7-code-highspeed；移除 8 月 31 日下线的 kimi-k2.5',
          'DeepSeek：新增 deepseek-v4-flash-vision-exp（实验视觉模型），visionModels 同步切换'
        ]
      },
      {
        title: '推理参数适配',
        items: [
          'GLM-5.3 / 5.3-Flash 标记 thinking:forced：所有请求按任务档位注入 thinking.enabled + reasoning_effort（chat=low / 工具轮=high）',
          'Kimi K3 标记 thinking:effort：仅传顶层 reasoning_effort（官方要求禁止 thinking 对象），chat=low / 工具轮=high / 深度=max',
          'agent-loop 多轮工具调用回传 reasoning_content（Kimi K3 官方要求），最终回复轮注入日常档推理强度'
        ]
      },
      {
        title: '兼容迁移',
        items: [
          'store/aiConfig.js 旧模型 ID 映射：qwen-turbo→qwen3.8-flash、qwen-plus→qwen3.7-plus、qwen-max/qwen-long→qwen3.8-max、kimi-k2.5/kimi-latest/moonshot-v1-*→kimi-k3',
          'manifest.json 版本提升至 2.3.1（2301），版本历史同步更新'
        ]
      }
    ]
  },
  {
    version: '2.3.0',
    date: '2026-08-27',
    title: 'AI 升级：语音输入、联网搜索、推理分级、结构化记忆、Key 加密增强',
    summary: [
      '语音输入：录制 ≤25s 语音，智谱 GLM-ASR-2512 转写为文本填入输入框（H5/App/小程序三端）',
      'Agent 引擎：新增 web_search 联网搜索工具（智谱 Web Search API），结构化输出/上下文缓存按模型能力位路由',
      '推理分级：GLM-5.2 支持 thinking + reasoning_effort，日常对话 low、Agent 工具轮 high',
      '结构化记忆：新增实体/关系/事件三元组记忆（siji_structured_memory），对话时自动提取并注入上下文',
      '安全加固：API Key 加密升级为「随机盐 + 链式密钥流 + 完整性校验」（enc2:），兼容读取旧 enc: 格式'
    ],
    categories: [
      {
        title: '语音输入',
        items: [
          'utils/ai/recorder.js：录音模块，App/小程序用 uni.getRecorderManager，H5 用 MediaRecorder，自动限时 25s',
          'utils/ai/transcribe.js：转写模块，智谱 GLM-ASR-2512 multipart 直传（≤30s/≤25MB）；通义 filetrans 需网关暂不可直传',
          'components/chat/InputArea.vue：输入区新增麦克风按钮，录音/识别状态提示，转写结果自动填入输入框'
        ]
      },
      {
        title: 'Agent 引擎',
        items: [
          'utils/ai/tools/web-search.js：web_search 工具（智谱 Web Search API，search_pro 引擎，只读），已入 TOOL_DEFINITIONS 与 QUERY_TOOLS',
          'agent-loop.js：buildToolList 按厂商门控注入 web_search（仅智谱），查询轮独立执行网络搜索并回传结果',
          'providers.js 新增能力位：supportsStructuredOutput / supportsContextCache，结构化输出按模型级 structured 字段路由（glm-5.2 开启）',
          'chat-stream.js / chat-chunked.js / buildProviderRequest 同步接入 D3 路由与 D4 推理分级'
        ]
      },
      {
        title: '记忆升级',
        items: [
          'utils/memory-structured.js：实体（人/组织/地点/事物）+ 关系三元组 + 重要事件，本地规则提取去重',
          'autoExtractMemory 对话后自动执行结构化提取；buildMemoryContext 注入【人物/关系/重要事件】段',
          '记忆设置页统计行展示结构化计数（X实体/Y关系/Z事件），清空记忆时一并清理'
        ]
      },
      {
        title: '工程加固',
        items: [
          'utils/crypto.js：enc2: 新方案（每 Key 随机盐、FNV-1a 链式密钥流、8 位校验和防篡改），decryptKey 兼容 enc: 旧格式与明文',
          'manifest.json 版本提升至 2.3.0（2300），版本历史同步更新'
        ]
      }
    ]
  },
]
