/**
 * 版本日志数据段：3.6.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V36 = [
  {
    version: '3.6.2',
    date: '2026-09-15',
    title: '3.6.2 读网址不再被粘连的中文带偏，失败原因按平台说，搜索卡只留摘要',
    summary: [
      '修「网址后面直接跟中文就读不到」：https://www.deepseek.com/阅读这个网址 以前把「阅读这个网址」当路径一起请求，现在从第一个 http(s):// 起算、遇到中文或空白即截断，并把截掉的尾巴写进工具结果（读了哪个网址、哪段没当网址用，模型看得见）',
      '直连失败的原因按平台给：H5 说浏览器跨域限制，App 端说目标站点超时 / 拒绝抓取 / 证书问题 —— 以前 App 上也报「跨域限制」，AI 会照抄给你，排查被带偏',
      '联网搜索 / 读网页的执行卡只留摘要（已联网搜索 · N 条结果 / 已读取网页 · 域名（N 字））：原始结果不再跟着会话落盘，agent 路径以前把整包结果同时写进 actionCard / execResult / execResults 三处，一次搜索约 7KB 放大成约 21KB，导出的开发者反馈里也整段是网页正文',
      '没有对应页面的类型不再显示「查看 →」死按钮（搜索 / 读网页，以及多步结果里没有路由的行）',
      '修开场白里的半角逗号（「夜深了,我是思迹。」→「夜深了，我是思迹。」）；App 端版本号改读资源包，反馈导出头部不再恒为 v1.0.0'
    ],
    categories: [
      {
        title: '读网址（3.6.2，反馈 2026-09-15）',
        items: [
          '根因：normalizeUrl 只按「空白与尾部标点」清洗，不做中文截断 —— 用户把「阅读这个网址」直接粘在网址后面，整串被当成路径请求（反馈里的原话就是 https://www.deepseek.com/阅读这个网址）',
          'utils/ai/read-adapters.js：新增 URL_STOP_RE（空白 / 零宽 / 中日韩文字 / 全角标点），normalizeUrl 改成「先从第一个 http(s):// 起算（左边粘话也不拼进域名）→ 遇到上述字符即截断 → 去尾部标点」，返回值多一个 dropped（被截掉的尾巴）',
          'utils/ai/read-adapters.js：新增 directFailHint(platform) —— 直连失败的原因纯函数按平台分叉，H5 提跨域、App 不提',
          'utils/ai/tools/read-url.js：currentPlatform()（条件编译 #ifdef H5）接进 requestOnce 的 fail 分支；成功结果经 withUrlMeta 补 url / host，网址被截断时在正文前加一句「网址后面的文字没有当网址用，实际读取：…」，避免模型以为整串都读过'
        ]
      },
      {
        title: '执行卡与落盘（3.6.2）',
        items: [
          'utils/ai/exec-payload.js（新增，纯函数）：compactExecDetail(name, detail) —— web_search 只留条数与前 3 条标题链接、read_url 只留 url / host / title / 字数 / 是否截断，其余工具原样返回；execCardText(detail) 出卡片那一行文案；EXEC_TITLE_LIMIT=3',
          'utils/ai/autoExecutor.js：agent 路径落盘前统一走 compactExecDetail（actionCard / execResult / execResults 三处），原始工具结果仍只给模型看，不跟着会话存',
          'components/chat/ExecResultCard.vue：搜索 / 读网页走 toolCardText 一行摘要（.exec-title），头部与「查看 →」都不显示 —— 以前是个点了没反应的死按钮；多步结果行同理（canOpenRow）',
          'composables/useChatNavigation.js：导出 canOpenType(type)，卡片据此判断有没有可去的页面（ROUTE_MAP 命中才算）'
        ]
      },
      {
        title: '文案与版本号（3.6.2）',
        items: [
          'composables/useWelcomeMessage.js：开场白半角逗号 → 全角（「夜深了,我是思迹。」是导出记录里肉眼可见的文案瑕疵）',
          'utils/version-check.js：新增 primeAppVersion() —— App 端用 plus.runtime.getProperty 读资源包版本并缓存；getCurrentVersion() 优先用它。基座里 plus.runtime.version 给的是宿主 App 的版本，版本历史、反馈导出、更新检查以前全报 v1.0.0',
          'App.vue：onLaunch 首行调 primeAppVersion()'
        ]
      },
      {
        title: '测试（3.6.2）',
        items: [
          'tests/read-url.test.js +7 例：中文粘连截断（用户原话那条）、左边粘话从 http(s):// 起算、半角尾标点、全中文拒绝、directFailHint 按平台、成功结果带 host、截断说明',
          'tests/exec-payload.test.js（新增 8 例）：搜索压缩不残留正文、读网页字段、其它工具原样、卡片文案、agent 路径落盘用的是摘要（含写操作不受影响的对照）',
          'tests/bugfix-regression.test.js +2 例：开场白全角逗号、App 端版本预热在无 plus 环境不抛错',
          '全量：65 文件 / 917 用例全绿（npx vitest run --maxWorkers=2，exit 0）'
        ]
      }
    ]
  },
  {
    version: '3.6.1',
    date: '2026-09-15',
    title: '3.6.1 「回去接着聊」跳到正确的对话：会话落盘不再丢标记',
    summary: [
      '修「回去接着聊 / 返回旧对话」跳转不对：开场白与进入总结的标记以前没跟着会话落盘，重启后只带一句问候的空壳被当成「聊过的对话」，比真正的上一次对话更新，于是被选成跳转目标 —— 跳到壳上，屏幕上还是那句一模一样的开场白，看着像没跳',
      'store/chat/persist.js 白名单补齐：_isWelcome / _isEnterSummary / _enterSummaryKind / _enterButtons / _enterSummaryDigest 跟消息一起落盘；会话的 agentId / agentName 也落盘（重启后「该会话由 X 进行」的提示不再消失）',
      'utils/chat-session.js 判空不再只看标记：整条对话没有一句用户消息、也没有任何 AI 产出（aiReply / 执行结果 / 动作卡 / 图片）就是空壳 —— 存量设备上已经丢掉标记的壳，冷启动照样被清掉',
      'store/chat.js 的 switchConversation 返回是否真的切了；composables/useChatSession.js 的 resumeBack 返回真实结果，切不过去时不再谎报成功',
      'pages/chat/index.vue 的 handleResumeBack：跳回去之后，不再把排队中的这轮进入总结补写到刚回去的旧对话里'
    ],
    categories: [
      {
        title: '根因与修复（3.6.1）',
        items: [
          '根因：store/chat/persist.js 落盘时按白名单挑字段，只留 role / content / aiReply / execResult(s) / actionCard / image —— 消息上的 _isWelcome 与 _isEnterSummary、_enterButtons 全被丢掉。重启后 isEmptyConversation 认不出「只有欢迎语 / 只有进入总结」的壳',
          '后果：壳不再被 pruneEmptyConversations 清掉，还因为 updatedAt 是最近一次冷启动的时间而排在列表最前；pickResumeConversation 取「最近更新」正好取到它 —— 点「回去接着聊」跳到壳上，画面还是同一句开场白；进入总结的壳同理（连预置按钮也没了）',
          'store/chat/persist.js：消息新增 _isWelcome / _isEnterSummary / _enterSummaryKind / _enterButtons / _enterSummaryDigest 落盘；会话新增 agentId / agentName 落盘（3.1 起创建时写入的 Agent 绑定以前从没进过存储）',
          'utils/chat-session.js：新增 isBareAssistantMessage(m) —— role 为 assistant、且没有任何真实产出（aiReply / execResult / execResults / actionCard / image）的裸消息；isEmptyConversation 的 every 判定加上这条兜底，标记与兜底并存',
          'store/chat.js：switchConversation 返回布尔（目标不在列表里返回 false，活跃指针不动）',
          'composables/useChatSession.js：resumeBack 返回 switchConversation 的真实结果，返回值语义从「有目标就 true」改成「真的切过去了才 true」',
          'pages/chat/index.vue：handleResumeBack 在切成功后清掉 _queuedEnterSummary（排队待写的这轮总结属于刚销毁的伪对话，不往旧对话里补写）'
        ]
      },
      {
        title: '测试（3.6.1）',
        items: [
          'tests/chat-persist.test.js（新增 6 例）：欢迎语标记落盘、进入总结标记与预置按钮落盘、Agent 绑定落盘、重启后冷启动「回去接着聊」落在真正聊过的那条上（走 persist → restore → maybeStartFreshSession → resumeBack 全链路）、switchConversation 对不存在的 id 返回 false 且不动活跃指针、目标切不过去时 resumeBack 返回 false 不谎报成功',
          '先写用例复现：4 个用例全红（_isWelcome / _isEnterSummary / _enterButtons / agentId 在存储里是 undefined，重启后壳判空为 false）—— 定位到根因后再改代码，改完转绿',
          '全量：64 文件 / 900 用例全绿（npx vitest run --maxWorkers=2，exit 0）'
        ]
      }
    ]
  },
  {
    version: '3.6.0',
    date: '2026-09-15',
    title: '3.6.0 读网址 + 读文件：AI 能读网页正文，也能读你发来的文件',
    summary: [
      '读网址：把网址直接发给 AI，它会先调 read_url 读正文再回答；默认直连抓取（免 Key、零成本），直连失败（H5 跨域、403、纯 JS 页面）时自动换 Tavily 阅读重试一次，用户不用自己去切后端',
      '读文件：聊天输入框左侧新增「文件」按钮，txt / md / csv / json / 代码 / 字幕这类文本文件本地直读、零配置不上传；pdf / doc / xlsx / ppt 走文档解析后端（当前 Moonshot），上传后取回纯文本',
      '文件正文只进本次请求与消息的 fileText 字段，不塞进气泡里的用户原话；重试会带上原文件，追问也问得上（聊天历史里保留最近一条带文件消息的正文，更早的只留卡片）',
      '设置 → AI 配置新增「读网址」「读文件」两张卡：开关、后端切换、独立 Key 的填写与清除，状态行直说当前是直连还是已配置 Key',
      '平台差异写进 UI：H5 与微信小程序可以选文件（uni.chooseFile / wx.chooseMessageFile），App 端系统文件选择需要原生插件，先走截图识别或粘贴文字'
    ],
    categories: [
      {
        title: '读网址（3.6.0）',
        items: [
          'utils/ai/read-adapters.js：后端注册表（direct / tavily），每个后端只提供元信息 + buildRequest(url, key) + parseResponse(res)，新增后端零改动其余代码；normalizeUrl 补协议、去尾部标点、拒非 http(s)，并挡住「把普通文字硬拼成网址」的输入',
          'utils/ai/html-text.js：HTML 转纯文本（纯函数、不碰 DOM，小程序也能跑）。有 article / main 且正文超过 200 字时只取它，丢掉导航与页脚；script / style / svg / iframe 整块剥掉；命名实体 + 十进制 + 十六进制实体解码；超长截断到 8000 字并在结尾留一句说明',
          'utils/ai/read-config.js：siji_read_enabled / siji_read_backend / siji_read_key，裁决顺序与搜索一致 —— 开关关闭 → 不可用；直连后端免 Key → 可用；需要 Key 的后端 → 独立 Key → 复用搜索的 Tavily Key → 不可用',
          'utils/ai/tools/read-url.js：executeReadUrl 直连优先，直连失败且手上有 Tavily Key 时自动换第三方重试一次（当前后端就是 tavily 时不再重试，避免同样失败跑两遍）；两条都失败时两条原因都带出来',
          '注册与门控：READ_URL_TOOL 进 TOOL_DEFINITIONS 与 QUERY_TOOLS（只读，自动执行，不需要确认），agent-transport.buildToolList 按 isReadUrlAvailable() 过滤，工具结果截断上限 8000（与抓取上限同一口径）',
          'prompt-actions.js 行为规则加一条：用户发来网址或转发文章时先 read_url 读正文再回答，多个网址逐个读'
        ]
      },
      {
        title: '读文件（3.6.0）',
        items: [
          'utils/files/file-types.js：TEXT_EXTS（含代码 / 日志 / 字幕 / 配置）、DOC_EXTS（pdf / doc / docx / xls / xlsx / ppt / pptx / epub）、IMAGE_EXTS；classifyFile(name, mime) 四分类；单个文件 5MB 上限；pickerExtensions() 给 picker 用',
          'utils/files/file-text.js：去 BOM、统一换行、压连续空行、NUL 与控制字符占比 > 5% 判定为二进制（挡住改了后缀的 pdf / 图片）、按换行处截断到 8000 字、buildFileContext / composeFileMessage（文件在前、用户话在后）',
          'utils/files/local-io.js：三端本地读 —— H5 用 FileReader（拿不到 File 对象时回落 fetch blob URL）、App 用 plus.io + plus.io.FileReader、小程序用 wx.getFileSystemManager().readFile；FileReader 吃到非 Blob 时不再把 Promise 打死，会落到下一层平台分支',
          'utils/files/doc-parse.js：文档解析后端注册表（当前 Moonshot 一个）—— 上传 purpose=file-extract → 取 /v1/files/{id}/content → 尽力删远端文件；没 Key 时不发上传请求，直接提示去哪儿配',
          'utils/files/picker.js：三端选文件统一成 { path, name, size, mime, file }；H5 走 uni.chooseFile，微信小程序走 wx.chooseMessageFile，App 端（uni.chooseFile 官方不支持）给出能立刻做的两条路：截图识别或粘贴文字',
          'utils/files/index.js：readPickedFile 一个入口，UI 只管调它 —— 类型判定、大小上限、截断、解析后端都收在里面；fileCardText 出卡片文案'
        ]
      },
      {
        title: '聊天接线与设置页（3.6.0）',
        items: [
          'components/chat/InputArea.vue v12：图片按钮旁新增文件按钮，选中后输入框上方出现文件条（名称 · 大小 · 行数），长文案提示走 showModal、短文案走 toast（App 端 toast 会截断）；只有文件没有文字时默认发「读一下这个文件」',
          'composables/useChatEngine.js：handleSend 从 sendOpts 取文件结果，正文进 plainMessage（本次请求），元信息进消息的 file / fileText 字段，气泡里用户原话保持原样；顺带修掉「图片 + 文字两步组合」按内容比较判断是否已转文本的旧写法，改用显式标志，避免带文件的消息把图片吞掉',
          'composables/useChatActions.js：重试时从消息的 fileText 还原文件，重试等于重新发一次带文件的请求，不再把文件丢掉',
          'utils/ai/chatHistoryBuilder.js：聊天历史里保留窗口内最近一条带文件消息的正文（追问问得上），更早的只留一张「已读过文件 xxx」的卡片，不让历史上下文被文件正文撑爆',
          'components/chat/MessageBubble.vue：用户气泡顶部挂一张文件卡（黑底白字，白色透明度分层），正文不进气泡',
          'pages/settings/sub/ai.vue：新增「读网址」（开关 / 直连与 Tavily 二选一 / 独立 Key）与「读文件」（解析后端 / 解析 Key）两张卡，样式沿用搜索卡那套，纯黑白灰阶；未配置时状态行直说当前读得动什么、读不动什么'
        ]
      }
    ]
  }
]