/**
 * 版本日志数据段：3.6.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V36 = [
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