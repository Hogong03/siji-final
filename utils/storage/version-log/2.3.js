/**
 * 版本日志数据段：2.3（合并段）
 *
 * 由 2.3.0~2.3.21 整合而成（发布前合并），原 2.3-early.js / 2.3-late.js 分段已删。
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V23 = [
  {
    version: '2.3.21',
    date: '2026-09-03',
    title: '2.3.21（整合 2.3.0~2.3.21，发布前合并）：AI 能力升级（语音/联网/结构化记忆/模型换代）、全量备份、记忆画像联动与请求稳定性修复',
    summary: [
      'AI 能力升级：语音输入（智谱 GLM-ASR-2512 转写）、web_search 联网搜索工具、结构化记忆三元组（实体/关系/事件）、四厂商旗舰模型换代（GLM-5.3 / Qwen3.8 / Kimi K3 / V4 Flash Vision）与推理分级，API Key 加密升级 enc2:',
      '请求稳定性：App 分块流式错误透出与重发去重、DeepSeek 流式禁用 response_format 修空回复、闲聊误触发“没能自动记录”的正则收窄',
      '数据安全：全量备份（复制/落盘）+ 粘贴恢复上线，微信适配分份复制拆三段并加体积护栏',
      '记忆与画像联动：偏好一键采纳进画像、批量整合到画像、8 条已知事实智能映射自动归组',
      '体验与修复：图标全换 Lucide 线框 + 厂商最新 logo、输入框精简至 v11、图片识别 1568px/90、记录标题自动提取、执行结果卡片去编辑化',
    ],
    categories: [
      {
        title: 'AI 能力升级',
        items: [
          '语音输入：utils/ai/recorder.js（App/小程序 uni.getRecorderManager、H5 MediaRecorder，自动限时 25s）+ utils/ai/transcribe.js（智谱 GLM-ASR-2512 multipart 直传，≤30s/≤25MB），输入区麦克风按钮转写结果自动填入输入框',
          '联网搜索：utils/ai/tools/web-search.js（智谱 Web Search API，search_pro 引擎，只读），入 TOOL_DEFINITIONS 与 QUERY_TOOLS，agent-loop buildToolList 按厂商门控注入（仅智谱）；providers.js 新增 supportsStructuredOutput / supportsContextCache 能力位，结构化输出按模型级路由',
          '结构化记忆：utils/memory-structured.js 实体（人/组织/地点/事物）+ 关系三元组 + 重要事件（siji_structured_memory，本地规则提取去重），autoExtractMemory 对话后自动提取，buildMemoryContext 注入【人物/关系/重要事件】段，记忆设置页展示结构化计数',
          '模型全线升级：智谱 GLM-5.3/5.3-Flash（1M 上下文、强制思考、Flash 原生多模态）、通义 qwen3.8-flash/3.7-plus/3.8-max + qwen3.5-omni-plus、Moonshot Kimi K3（2.8T 参数、1M 上下文、视觉；移除月底下线的 kimi-k2.5）、DeepSeek V4 Flash Vision(实验)；store/aiConfig.js 旧模型 ID 自动迁移，历史设置无缝切换；GLM-5.3/K3 按任务档位注入 thinking + reasoning_effort（chat=low / 工具轮=high / 深度=max，K3 仅顶层 reasoning_effort），agent-loop 回传 reasoning_content；API Key 加密升级 enc2:（每 Key 随机盐 + FNV-1a 链式密钥流 + 8 位校验和防篡改，兼容旧 enc: 与明文）',
        ]
      },
      {
        title: '请求稳定性修复',
        items: [
          '错误透出：chat-chunked 非 200 响应解析 error.message 直接显示（如 HTTP 400: Model Not Exist），不再显示“刚才走神了”假象；useChatEngine 空回复分支优先展示 _error；重试策略 isRetryableError——HTTP 4xx（除 429）不重试直接透出，429/5xx/网络错误/空回复自动退避重试（tests/chat-error.test.js 10 用例）',
          'App 分块流式修复：400 且启用 JSON 模式时自动去掉 response_format 重试一次，对齐非流式路径；computeChunkDelta 累积/增量双模式 + SSE 行级去重（lastSseLine），修复 App 端 AI 回复整段重复两次（tests/chat-error.test.js 另增 4 用例）',
          'DeepSeek 流式禁用 response_format（providers.js 新增 streamNoResponseFormat 标记与 supportsStreamStructuredOutput 能力位，chat-stream.js/chat-chunked.js 接入），修复关系模拟/规划推演反复空回复，空回复自动走 retryStreamWithBackoff；constants.js 删除 OP_CLAIM_RE_EXT、新增严格 OP_REQUEST_RE（帮我+操作动词/操作动词+对象），闲聊“帮你细细分析”不再误触发“没能自动记录”提示（tests/bugfix-regression.test.js 增 2 用例）',
        ]
      },
      {
        title: '输入框与图标',
        items: [
          '图标体系替换：static/icons 与 static/tab 全部 83 个 PNG 换 Lucide 线框图标（v1.35.0，MIT），tabBar 6 个 81×81 双态（#A1A1AA/#000000）、UI 图标 48×48 纯黑、Agent 头像 64×64；5 家厂商 logo 更新为最新官方图标（OpenAI 花朵标/DeepSeek 蓝色方块/Kimi 渐变圆/智谱星形标/通义方块）',
          '输入框简化 v10→v11：删除快捷指令面板（+ 按钮与 4 项指令）与语音功能（recorder.js/transcribe.js 依赖与录音样式移除），输入行仅剩 图片/输入框/发送（停止），组件 311→219 行；对外接口 reset/setText/getImage/resetImage 不变，父组件零改动',
        ]
      },
      {
        title: '图片识别',
        items: [
          '识别清晰度优化：utils/image.js MAX_SIZE 1024→1568（最长边）、QUALITY 80→90，聊天截图等小字识别显著提升；H5 端 1MB 渐进降质兜底不变，App/小程序 uni.compressImage 同步新参数，buildVisionMessage 的 detail 判断随新尺寸自动生效',
          '修复 H5 发送图片识别弹浏览器下载框：saveImageToLocal H5 分支删除 atob/Blob/createObjectURL/<a download> 整段下载代码，直接以 base64 data URL 作为 localPath；App（_doc/siji_images/）与小程序（wx.env.USER_DATA_PATH）写文件逻辑不变',
        ]
      },
      {
        title: '备份与数据安全',
        items: [
          '全量备份与恢复：utils/storage/export.js 新增 exportBackup/exportBackupJson/parseBackup/importBackup，快照全部业务存储键（含记忆/画像/对话/关系/Agent，黑名单排除 API Key/索引/锁等敏感与可重建数据）；parseBackup 三项校验（空内容/JSON 解析失败/非思迹备份），importBackup 逐 key 写回 + isBackupKey 白名单防恶意 key 注入；恢复流程粘贴→校验→确认覆盖→写回；utils/backup-file.js 跨端保存（App 写 _doc/backup/、H5 下载、小程序提示复制）（tests/backup.test.js 增 5+3 用例）',
          '微信适配：分份复制把备份拆为生活数据/AI 记忆/聊天记录三段，逐份写剪贴板（单次超长粘贴致微信崩溃）；exportBackup 支持 section=life|ai|chat 分域导出（三份互斥可拼回全量），恢复自动识别分域合并写入、不清空其他部分；复制前按 UTF-8 字节估算体积，超限拦截（聊天 300KB、其余 800KB）',
        ]
      },
      {
        title: '记忆与画像联动',
        items: [
          '记忆与画像联动（结论：保持双库 + 强化联动）：画像页新增「AI 学到的偏好」一键采纳（喜欢/爱好→hobbies、不吃/讨厌→dietary，无法识别弹窗手动输入字段写入 lifestyle），adoptedToProfile 标记后 buildMemoryContext 不再注入，smart_update_profile 写画像自动标记同内容记忆；去重升级为逐卡片字段值结构化匹配 + 通用词噪声过滤，修复画像含「喜欢」即误过滤全部相关记忆的问题；functions 页记忆管理入口常显',
          '批量整合到画像：记忆管理页「整合到画像」支持全部整合与勾选整合，整合预览可编辑分组/字段名/内容（字段已有值提示「已存在：X，将更新」）；8 条已知事实映射规则（生日/性别/职业/所在地/昵称/月预算/作息），adoptMemoryToProfile 按 cardId→cardTitle→新建 三级定位分组，分组不存在自动新建（tests/memory-profile.test.js 增 4+5 用例）',
        ]
      },
      {
        title: '记录与执行卡片',
        items: [
          '记录标题自动提取：create_diary 在 title===content/占位词/单行长文时自动提炼简短标题（去“今天/打算/我”等开头修饰词取第一分句，≤20 字），update_diary 只改正文且旧标题无意义时同步提炼；prompt 已禁止模型传 title，本次为 executor 层防御性兜底（tests/executors.test.js 增回归用例）',
          '执行结果卡片去编辑化与长文防溢出：ExecResultCard 移除标题/金额就地编辑（双击/✎/编辑表单全部下线），「查看 →」跳转按钮与标题同行置右（标签编辑保留）；卡片与记录列表预览压平换行 + max-height/overflow 截断（弃用 App 端失效的 -webkit-line-clamp），长文不再撑爆屏幕',
        ]
      },
      {
        title: 'Bug 修复',
        items: [
          '修复对话标签修改报错：store/index.js 补全 addTagToConversation/removeTagFromConversation/setConversationTags 三个方法映射（chat.js 已实现、聚合入口漏映射致 useConversationManager 调用报 not a function）；store/aiConfig.js 条件编译内同名 const decoded 拆分为 decodedH5/decodedNative，修复 vitest 直接加载源码时重复声明',
          '修复放弃编辑重复弹窗：pages/diary/detail.vue 与 pages/bill/edit.vue 新增 leaveConfirmed 标志——uni.navigateBack() 会再次触发 onBackPress 且 isDirty 仍为 true，形成弹窗死循环；goBack/safeNavigateBack 统一先置标志再返回',
          '图片资源改名 -v2 修复 App 端同名缓存不刷新：static/tab 6 张 + provider logo 5 张 + Agent 头像 10 张共 21 张追加 -v2 后缀并全局更新引用（pages.json/6 处动态拼接/store/agent.js）；utils/agent-templates.js 新增 AGENT_ICON_V2 映射与 normalizeAgentIcon()，存量旧路径渲染与编辑回填自动归一化',
        ]
      },
    ]
  },
]
