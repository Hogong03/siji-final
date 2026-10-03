/**
 * 版本日志数据段：3.6 线整合条目（3.6.0~3.6.2 发布前合并为一条）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V36 = [
  {
    version: '3.6.2',
    date: '2026-09-15',
    title: '3.6.2（整合 3.6.0~3.6.2，发布前合并）：读网址 + 读文件上线，会话落盘补标记，执行卡只留摘要',
    summary: [
      '读网址：read_url 工具默认直连抓取（免 Key、零成本），直连失败（H5 跨域、403、纯 JS 页面）自动换 Tavily 重试一次；utils/ai/html-text.js 本地 HTML 转文本（小程序也能跑），设置页新增「读网址」卡（开关/后端/独立 Key）',
      '读文件：聊天输入框新增「文件」按钮，txt/md/csv/代码等文本文件三端本地直读零上传，pdf/doc/xlsx/ppt 走文档解析后端（Moonshot）；正文只进本次请求与消息的 fileText 字段，聊天历史只保留最近一条带文件消息的正文',
      '3.6.2 修读网址被粘连中文带偏：normalizeUrl 从第一个 http(s):// 起算、遇中文/空白即截断，截掉的尾巴写进工具结果；直连失败原因按平台给（H5 说跨域，App 说超时/拒绝抓取/证书），不再全报「跨域限制」带偏排查',
      '3.6.2 执行卡只留摘要：utils/ai/exec-payload.js compactExecDetail 统一压缩 agent 路径三处落盘（原来一次搜索 7KB 放大成约 21KB），没有对应页面的类型不再显示「查看 →」死按钮；App 端版本号改读资源包（primeAppVersion），反馈导出不再恒为 v1.0.0',
      '3.6.1 修「回去接着聊」跳到空壳对话：store/chat/persist.js 白名单补齐 _isWelcome/_isEnterSummary/_enterButtons/agentId 落盘；isEmptyConversation 加「没有用户消息也没有 AI 产出」兜底；switchConversation/resumeBack 返回真实切换结果'
    ],
    categories: [
      {
        title: '读网址（3.6.0 建，3.6.2 修）',
        items: [
          'utils/ai/read-adapters.js：后端注册表（direct/tavily，新增后端零改动其余代码）；3.6.2 normalizeUrl 加 URL_STOP_RE —— 从第一个 http(s):// 起算、遇空白/零宽/中日韩文字/全角标点即截断，返回值带 dropped（修「https://www.deepseek.com/阅读这个网址」整串被当路径请求）',
          'utils/ai/html-text.js：HTML 转纯文本纯函数（不碰 DOM），有 article/main 且正文超 200 字只取它，script/style/svg/iframe 整块剥掉，实体解码，超长截断 8000 字',
          'utils/ai/read-config.js：siji_read_enabled/backend/key 裁决 —— 开关关→不可用；直连免 Key→可用；需 Key 后端→独立 Key→复用搜索 Tavily Key→不可用',
          'utils/ai/tools/read-url.js：直连失败且有 Tavily Key 自动重试一次（当前后端就是 tavily 时不再重试，避免同样失败跑两遍）；3.6.2 加 directFailHint(platform) 按平台给失败原因，成功结果经 withUrlMeta 补 url/host，被截断时正文前加说明防止模型以为整串都读过；工具结果截断上限 8000 与抓取口径一致，agent-transport 按 isReadUrlAvailable() 门控注入'
        ]
      },
      {
        title: '读文件（3.6.0）',
        items: [
          'utils/files/ 六件套：file-types（TEXT/DOC/IMAGE 分类、单文件 5MB 上限）+ file-text（去 BOM、NUL 与控制字符 >5% 判二进制挡改后缀的 pdf/图片、按换行截断 8000 字）+ local-io（H5 FileReader / App plus.io / 小程序 wx.getFileSystemManager）+ doc-parse（Moonshot 上传解析，没 Key 直接提示去哪配）+ picker（H5 uni.chooseFile / 小程序 wx.chooseMessageFile / App 当时只能提示）+ index.js readPickedFile 单入口',
          '聊天接线：InputArea.vue 文件按钮与文件条（长文案 showModal、短文案 toast —— App 端 toast 会截断）；useChatEngine handleSend 正文进 plainMessage、元信息进 file/fileText，气泡里用户原话保持原样；useChatActions 重试从 fileText 还原文件；chatHistoryBuilder 只保留窗口内最近一条带文件消息的正文，更早的降级成「已读过文件 xxx」卡片',
          'MessageBubble.vue 用户气泡顶部挂文件卡（正文不进气泡）；设置页新增「读文件」卡（解析后端/解析 Key）；平台差异写进 UI —— App 端 uni.chooseFile 官方不支持，当时给的两条路是截图识别或粘贴文字（3.7.5 起才有 Android 系统选择器）'
        ]
      },
      {
        title: '会话落盘修复（3.6.1）',
        items: [
          '根因：store/chat/persist.js 落盘白名单丢掉了消息上的 _isWelcome/_isEnterSummary/_enterButtons，重启后「只有一句开场白」的空壳被判成聊过的对话，还因 updatedAt 最新被「回去接着聊」选中 —— 跳到壳上画面还是同一句开场白，看着像没跳',
          '修法：persist.js 白名单补齐五个消息标记 + 会话 agentId/agentName（3.1 起的 Agent 绑定以前从没进过存储）；utils/chat-session.js 新增 isBareAssistantMessage 兜底 —— 没有用户消息也没有任何 AI 产出（aiReply/执行结果/动作卡/图片）就是空壳，存量丢标记的壳冷启动照样清；先写用例复现（4 用例全红：四个标记在存储里都是 undefined）定位根因再修，tests/chat-persist.test.js 走 persist → restore → maybeStartFreshSession → resumeBack 全链路',
          'store/chat.js switchConversation 返回布尔（切不过去不动活跃指针）；useChatSession.js resumeBack 返回真实结果不再谎报成功；handleResumeBack 切成功后清 _queuedEnterSummary，不把排队的进入总结补写进旧对话'
        ]
      },
      {
        title: '执行卡与版本号（3.6.2）',
        items: [
          'utils/ai/exec-payload.js（新增）：compactExecDetail —— web_search 只留条数与前 3 条标题链接、read_url 只留 url/host/title/字数/是否截断，其余工具原样返回；autoExecutor agent 路径 actionCard/execResult/execResults 三处统一压缩落盘，原始结果只给模型看不跟会话存；ExecResultCard.vue 搜索/读网页走 toolCardText 一行摘要，useChatNavigation.js 导出 canOpenType，没有可去页面的类型与多步结果行不再渲染「查看 →」死按钮',
          '文案与版本号：开场白半角逗号改全角（「夜深了,我是思迹。」）；utils/version-check.js 新增 primeAppVersion() —— App 端用 plus.runtime.getProperty 读资源包版本并缓存，基座里 plus.runtime.version 是宿主版本，版本历史/反馈导出/更新检查以前全报 v1.0.0；App.vue onLaunch 首行预热'
        ]
      }
    ]
  },
]
