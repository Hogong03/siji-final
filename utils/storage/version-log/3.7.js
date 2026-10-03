/**
 * 版本日志数据段：3.7 线整合条目（3.7.0~3.7.9 发布前合并为一条）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V37 = [
  {
    version: '3.7.9',
    date: '2026-09-17',
    title: '3.7.9（整合 3.7.0~3.7.9，发布前合并）：AI 效果自检上线并修三个安全真 Bug，Android 选文件五连修终成正果',
    summary: [
      '3.7.0 AI 效果自检：23 条真实语料（utils/ai/eval/cases.js，日期现算不写死）真请求模型看「选了什么工具、顺序对不对」，出通过率；cfg.dryRun 干跑不落库；页面 pages/settings/sub/ai-eval.vue 逐条可展开、temperature 0 批次可比',
      '3.7.1~3.7.4 自检口径三轮校准：干跑只拦写操作与联网（查询真跑）、mergeExecutedTools 合并 tool_calls 与 JSON action 两条路径、新增兜底档（靠正则救回不算通过）；语料改 {plan}/{billAmount} 占位符绑真实数据，缺前置判 SKIP 不进通过率分母；报告头部带 EVAL_PROTOCOL_VERSION 与应用版本自证口径',
      '安全真 Bug 三连修复：口头声称「记好了」被两套正则漏接致静默丢数据（基础集补 11 说法 + 记账兜底认「记一笔」并按原话补日期）；模型幻觉动作类型（isKnownActionType 白名单 + TOOL_NAMES，未知类型落回兜底）；确认闸门被绕过 —— _agentMode 无条件 true，记一笔房租 1500 直接落库（只有真跑过工具才认 agent 模式，confirm-gate.js 收敛一份判定）',
      '3.7.3 拍平模型嵌套的 multi：normalizeActions 展开 payload 数组/payload.actions/payload.items 三种形态，isKnownActionType 不再认 multi（容器标记不是可执行动作）',
      '3.7.5~3.7.9 Android 选文件：plus.android 调系统选择器 ACTION_GET_CONTENT（零插件零权限）→ content:// 拷进沙盒 _doc/upload/ → 真机四层排坑（Uri 不能 String() 字符串化、三级开流、类与实例都要 importClass、流对象方法也要走 invokeSafe），iOS 仍只能提示（截图/粘贴/原生插件）'
    ],
    categories: [
      {
        title: 'AI 效果自检（3.7.0）',
        items: [
          '动因：旧回归集只能断言「提示词里写了这句话」，证明不了模型照做 —— docs/思迹产品规划问答纪要_20260906.md 结论「先建纠错回归集」，本次落成可跑分；语料覆盖计划变更先查后改、错别字容忍、一句话两个意图、大额记账确认、网址粘中文只读网址、闲聊零写操作',
          'utils/ai/eval/cases.js：23 条真实语料（历史反馈原话），断言语义 tools/toolsAny/forbid/order/args/confirm/replyIncludes；dayStr(offset) 现算相对日期，写死日期会在特定日子假失败',
          'utils/ai/eval/runner.js：judgeCase/runCase/runCases/summarizeResults/formatFailureReport 纯函数编排（单条抛错记 error 不打断整批）；agent-loop 新增 cfg.dryRun 占位执行不落库、不发网络请求，store 传 null 不炸',
          'pages/settings/sub/ai-eval.vue + pages.json 注册：环境行/进度条/通过率大数字/逐条展开/一键复制失败明细；一整套 23 条约 23 次请求（DeepSeek V4 Flash 下约 ¥0.1），演示模式只记录工具选择不校验落库'
        ]
      },
      {
        title: '自检口径与数据前置（3.7.1~3.7.4）',
        items: [
          '3.7.1：dryRun 收窄为只拦写操作 + NETWORK_TOOLS（查询真跑 —— 模型拿不到真实数据只能照占位瞎答）；mergeExecutedTools 合并原生 tool_calls 与老 JSON action 成一条工具序列；新增兜底档（~）—— 模型没调工具没回 JSON 只口头答应时，前端兜底救回单独计数，不算通过',
          '3.7.2：语料改绑真实数据 —— {plan}/{billAmount} 占位符 + needs 声明前置，buildEvalContext 取第一条进行中计划与最近一笔支出（收入不算、已完成不算），缺前置判 SKIP 不进通过率分母，自检口径从此不绑定具体计划名',
          '3.7.4：起因是复跑贴回来的结果其实是旧代码跑的看不出来 —— EVAL_PROTOCOL_VERSION 在度量语义变化时 +1，报告头部与页面图例都显示「自检口径 · 应用版本 · 模型」，不传 meta 打「（未知）」；顺带修正语料条数笔误（实际 23 条，此前文档写 22）'
        ]
      },
      {
        title: '安全真 Bug（3.7.1~3.7.3）',
        items: [
          '静默丢数据：Agent 路径兜底闸门只认收窄集正则（已记…/记下了/记了一笔），认不出模型最常说的「记好了/记下来了/记下来啦」—— 记录与账单一分没写用户却被告知记好了；constants.js 基础集补 11 个说法，Agent 闸门与 JSON 路径对齐，_opClaimWithoutAction 从 agent-loop 透传',
          '记账兜底认不出「记一笔昨天的午饭 25」（原话没有花销动词兜底不进来）：fallback.js billKeywords 补「记一笔/记个账/记账」等、金额「元/块」后缀优先、按原话今天/昨天/前天补 bill_date',
          '幻觉动作类型（实测 type: batch 想表达复合意图）：store/data.js 新增 isKnownActionType（ACTION_MAP 是唯一事实来源），autoExecutor 的 keepKnownActions 先过白名单再执行，未知类型落回「声称操作但无 action」兜底；executor.js 加 TOOL_NAMES 白名单，不存在的工具名明确回传让模型自纠，不再静默失败',
          '确认闸门被绕过：runAgentChat 无条件标 _agentMode，useChatEngine 的 JSON 路径确认判定「非 agent 模式才判」被整个跳过 —— 记一笔房租 1500 直接落库、delete_feedback 绕开确认；修为只有真跑过工具才认 agent 模式（_jsonFallback），确认判定抽成 utils/ai/confirm-gate.js（聊天页与自检共用一份，避免两处逻辑越走越远）',
          '嵌套 multi 拍平：模型实测返回 actions: [{ type: multi, payload: [...] }]，直接执行只拿到拦截提示、用户看到「都记好了」但一个都没落库；response-parser.normalizeActions 展开 payload 数组/payload.actions/payload.items，展不出真实动作当没有动作；store.isKnownActionType 对 multi 返回 false'
        ]
      },
      {
        title: 'Android 选文件（3.7.5~3.7.9，真机四层排坑）',
        items: [
          '3.7.5 起点：plus.android 调系统文件选择器（ACTION_GET_CONTENT + CATEGORY_OPENABLE），零原生插件零存储权限；选完 content:// 拷进沙盒 _doc/upload/（FileChannel.transferFrom 整块搬，不把字节数组搬进 JS），文件名消毒 + 时间戳前缀防覆盖，超 5MB 在选择阶段就拦；iOS 的 UIDocumentPickerViewController 需要 delegate、plus.ios 桥不动，提示改为截图识别/粘贴文字/装原生插件',
          '3.7.6：toNativePath 去 file:// 前缀（FileOutputStream 只认裸路径）；拷贝三级兜底 —— 字节数组流拷贝 → FileChannel.transferFrom → 文本直读 inlineText（文本类拷贝彻底失败也保住正文）；resolveLocalFileSystemURL 验真实字节数，0 字节当失败；失败原因按阶段给（open-input/stream-fail:x/channel-fail:x）',
          '3.7.7 真因：String(data.getData()) 拿到的不是可用 URI，喂回 openInputStream 必失败 —— Uri 当 Java 对象一路传下去，getData 为空退 ClipData.getItemAt(0).getUri；开流三级 openInputStream → openFileDescriptor+FileInputStream(fd) → openAssetFileDescriptor，每条策略各开一次流（复用被读掉一半的流是隐患）',
          '3.7.8：resolver 三级全败真因是 plus.android 没导入类 —— 未导入时对象方法直接调用会抛；invokeSafe（直接调 → plus.android.invoke 二级兜底）+ importSafe 显式导入 ContentResolver/Uri 类名与实例；plus.io 能直接解析 content://，文本类在全败时由它直读（stage = plusio-text-only）；失败文案带「试过哪三级 + URI 原文」，报错本身就是证据',
          '3.7.9：流对象自己的方法同样要导入才能调 —— read/write/flush/close/readLine/available/transferFrom 全走 invokeSafe，每个实例（输入流/输出流/reader/channel）用前 importInstance；getChannel 缺失退 java.nio.channels.Channels.newChannel(流) 再 transferFrom（输入输出两侧都试）',
          '沉淀为 AGENTS.md 四条铁律：Uri 当 Java 对象传 / 每个对象的方法都要导入才调得动（流对象与 channel 不例外）/ 开流三级 / 拷贝三级，全败时文本类退 plus.io 直读；tests/file-pick-android.test.js 从 12 例滚到 29 例，假 plus 开关集中一处按策略分支断言'
        ]
      }
    ]
  },
]
