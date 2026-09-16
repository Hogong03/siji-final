/**
 * 版本日志数据段：3.7.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V37 = [
  {
    version: '3.7.8',
    date: '2026-09-17',
    title: '3.7.8 Android 选文件：类没导入才是真因（invoke 兜底 + plus.io 直读）',
    summary: [
      '真机仍报 open-all-failed：三种开流全在 resolver 这一层失败，原因不是 provider 拒绝，而是 plus.android 没导入类 —— 未导入时对象方法直接调用会抛。现在每个调用都走 invokeSafe：先直接调，抛错就退 plus.android.invoke（该 API 不需要预先导入类）',
      '开流前显式导入 android.content.ContentResolver 与 android.net.Uri（类名导入），并对 uri / resolver 实例各调一次 importClass（实例类导入，两种导入方式在真机上都有人踩过）',
      'plus.io 兜底：Android 上 plus.io 能直接解析 content://（不经 ContentResolver）—— 文本类文件在 resolver 全败时由它读正文，路径置空、正文进 inlineText，用户照样能问文件内容',
      '失败文案带上「试过哪三级 + URI 原文」（如 open-all-failed:openInputStream/openFileDescriptor/openAssetFileDescriptor:content://…）—— 下次再失败，报错本身就是证据，不用来回猜',
      '打不开时的建议更具体：云盘 / 在线文档 / 微信里的文件先在文件管理器里「保存到手机」再从下载目录选，或截图发我识别'
    ],
    categories: [
      {
        title: 'Android 选文件真因（3.7.8）',
        items: [
          'utils/files/android-picker.js：新增 importSafe（importClass 的安全包装）与 invokeSafe（直接调 → plus.android.invoke 二级兜底）；openContentStream 每个调用都走 invokeSafe，并显式导入 ContentResolver / Uri 类与实例；阶段名追加试过的三级与 URI 原文',
          'utils/files/android-picker.js：新增 readUriTextByPlusIo（plus.io.resolveLocalFileSystemURL + FileReader.readAsText 直读 content://）；copyContentUriToSandbox 在开流全败且要文本时走这条路，返回 stage = plusio-text-only',
          'utils/files/android-picker.js：uriDebugText 用 plus.android.invoke(uri, \'toString\') 取 URI 原文（诊断用，不参与逻辑）'
        ]
      },
      {
        title: '测试（3.7.8）',
        items: [
          'tests/file-pick-android.test.js（26 例，本轮 +4）：直接调对象方法一律抛错时 invoke 仍能走通（假 plus 用 Proxy 模拟「没导入类」，并把原对象挂在 __raw 供 invoke 取）；ContentResolver 与 Uri 的类确实被导入；resolver 全败但 plus.io 能解析 content:// 时文本仍读得进来；阶段名带三级清单与 URI 原文',
          '测试文件整份重写：假 plus 的开关集中到一处（openFails / onlyFd / invokeFails / noByteBuffer / channelMoves / verifySize / textLines / plusIoText / clipOnly / fileUrl），后面几版再加开关只动这一处',
          '全量：70 文件 / 1011 用例全绿（npx vitest run --maxWorkers=2，exit 0）'
        ]
      }
    ]
  },
  {
    version: '3.7.7',
    date: '2026-09-17',
    title: '3.7.7 真因：Uri 被字符串化导致 openInputStream 失败（Android 选文件终于能读）',
    summary: [
      '真机报「拷贝失败（open-input）」的真因：`String(data.getData())` 拿到的不是可用 URI，再喂回 openInputStream 必然失败 —— 改为把 Java 的 Uri 对象一路传下去，绝不字符串化；getData 为空时退到 ClipData 取 Uri（少数 provider 把结果放那里）',
      '开流改成三级：openInputStream → openFileDescriptor + FileInputStream(fd)（部分 ROM 只给文件描述符）→ openAssetFileDescriptor().createInputStream()',
      '阶段名拆细并逐级尝试三次开流：get-resolver / open-input / open-descriptor / open-asset / open-all-failed / stream-fail:x / channel-fail:x —— 每条策略各开一次流（上次复用已被读掉一半的流是隐患），结束都安静关闭（输入流与描述符都要关）',
      '打不开时的文案变成可执行的建议：云盘 / 在线文档类的文件先下载到手机再选；不再只说「换一种方式试试」',
      '测试用假 plus 覆盖：Uri 必须以对象传进去（回归点，禁止 String()）、openInputStream 抛异常时退 fd 链仍能拷成功、三级都打不开时二进制文件如实失败并给建议、文本文件在开流失败时也如实失败（不假装读到了）、getData 为空走 ClipData'
    ],
    categories: [
      {
        title: 'Android 选文件真因与修法（3.7.7）',
        items: [
          'utils/files/android-picker.js：新增 pickUriFrom(data)（getData → ClipData.getItemAt(0).getUri）与 openContentStream(uri)（三级开流，返回 input / closer / stage）；closeQuiet 同时关输入流与文件描述符；copyContentUriToSandbox 每条策略各开一次流，stage 记录走到哪一步，并返回 openStage',
          'utils/files/android-picker.js：copyViaStream / copyViaChannel / readUriAsText 签名不变（只吃 input），picker 里去掉 String(uri)；失败文案按 open-failed 前缀分叉'
        ]
      },
      {
        title: '测试（3.7.7）',
        items: [
          'tests/file-pick-android.test.js（22 例，本轮 +5）：Uri 以对象传入（首例断言 openedWith[0] 就是 getData 返回的那个对象）、openInputStream 抛错退 fd 链、三级全败的二进制与文本两条路径如实失败、getData 为空退 ClipData；假 plus 的 verifySize / openFails / onlyFd / clipOnly / textLines 五个开关',
          '全量：70 文件 / 1007 用例全绿（npx vitest run --maxWorkers=2，exit 0）'
        ]
      }
    ]
  },
  {
    version: '3.7.6',
    date: '2026-09-17',
    title: '3.7.6 修 Android 选文件拷贝失败：路径归一 + 三级兜底 + 文本直读保底',
    summary: [
      '真机反馈「文件能看见但提示拷贝失败」：最可能是 plus.io.convertLocalFileSystemURL 给的是 file:// URL，而 FileOutputStream 只认裸路径 —— 新增 toNativePath 统一去前缀（顺带处理 // 开头的情况）',
      '拷贝改成三级兜底：字节数组流拷贝（依赖最少，content:// 的流都支持 read/write）→ FileChannel.transferFrom（Java 侧整块搬）→ 文本直读兜底；content:// 的流在部分机型上 getChannel 不可用，所以不能只靠 transferFrom',
      '拷完验一次：resolveLocalFileSystemURL 读真实字节数，0 字节当失败处理（以前空文件会被当成成功，用户拿到的是「这个文件是空的」）',
      '文本类文件无论如何都附一份 inlineText（Java 侧直接读文本，不需要字节数组）：拷贝彻底失败也能把 txt / md / csv 读进来 —— 用户最常见的需求先保住',
      '失败原因按阶段给（open-input / resolve-path / stream-fail:xxx / channel-fail:xxx）：下次真机再失败，报错本身就指到具体哪一步'
    ],
    categories: [
      {
        title: 'Android 拷贝加固（3.7.6）',
        items: [
          'utils/files/android-picker.js：新增 toNativePath（纯函数，去 file:// 前缀）；newByteBuffer 同时尝试 plus.android.newObject(\'[B\', n) 与 java.lang.reflect.Array.newInstance；copyViaStream / copyViaChannel 两条独立策略 + readUriAsText 文本兜底；copyContentUriToSandbox 返回 { ok, bytes, text, stage }，stage 记录走到哪一步、哪一步失败',
          'utils/files/android-picker.js：verifySandboxFile 用 resolveLocalFileSystemURL + entry.file 读真实大小做校验；pickFileViaAndroid 在 kind === \'text\' 且拷贝失败但有 inlineText 时仍返回 ok（path 置空，交给上层用正文）',
          'utils/files/index.js：readPickedFile 优先用 pick.inlineText（文本类且有内容时直接清洗截断，不碰本地文件读取）'
        ]
      },
      {
        title: '测试（3.7.6）',
        items: [
          'tests/file-pick-android.test.js（17 例，本轮 +5）：toNativePath 四态；file:// URL 下仍能拷成功；文本文件拷贝全败时靠 inlineText 返回 ok 且 readPickedFile 能出正文；二进制拷贝失败如实报错且带 stage；0 字节当失败',
          '假 plus 现在覆盖字节数组策略（input.read + output.write）、channel 策略、文本读取三条路，用例按策略分支断言',
          '全量：70 文件 / 1002 用例全绿（npx vitest run --maxWorkers=2，exit 0）'
        ]
      }
    ]
  },
  {
    version: '3.7.5',
    date: '2026-09-17',
    title: '3.7.5 Android 真机可以选文件了：系统选择器 + 拷进沙盒，零插件零权限',
    summary: [
      'Android 端点「文件」不再只弹一句提示：走 plus.android 调系统自带的文件选择器（ACTION_GET_CONTENT），零原生插件、零存储权限（SAF 只授权用户选中的那一个文件）',
      '选完把 content:// 的内容拷进沙盒 _doc/upload/，之后的读取沿用既有代码 —— plus.io 读文本 / 读 base64 / 文档解析上传全部不用改；拷贝用 FileChannel.transferFrom 在 Java 侧整块搬，不把字节数组搬进 JS',
      'iOS 仍无等价物：UIDocumentPickerViewController 需要 delegate，plus.ios 桥不动 —— 提示改为更准确的说法（截图识别 / 粘贴文字 / 装原生插件），不再说「App 端需插件」让 Android 用户白等',
      '边界写进 UI：单个文件仍限 5MB（超了在选择阶段就拦下，不拷贝）；文件名消毒（路径分隔符 / 非法字符 / 超长截断）+ 时间戳前缀防覆盖',
      '验证状态：编排与分支有单测覆盖（假 plus 跑通「选 → 描述 → 拷贝 → 返回」、取消静默、超限拦下、iOS 提示），**真机行为必须实测** —— onActivityResult 回调与真实拷贝这两处只有真机能证明'
    ],
    categories: [
      {
        title: 'Android 选文件（3.7.5）',
        items: [
          'utils/files/android-picker.js（新增）：pickFileViaAndroid() 覆盖 onActivityResult + startActivityForResult(ACTION_GET_CONTENT + CATEGORY_OPENABLE)，describeUri 读 OpenableColumns 的 _display_name / _size 与 getType，ensureUploadDir 建 _doc/upload，copyContentUriToSandbox 用 FileChannel.transferFrom 整块拷贝（老实现没有 transferFrom 时回落 64KB 缓冲逐块读写）',
          'utils/files/android-picker.js 的纯函数：safeFileName（去掉路径分隔符与控制字符、非法字符换下划线、超长保留后缀）、uploadRelPath（时间戳前缀 + _doc/upload/）、isAndroidRuntime（plus 不可用一律 false，H5 与单测安全）',
          'utils/files/picker.js：App 分支接 Android 选择器（appPickRoute 决策抽成纯函数 —— 条件编译在单测里不生效，H5 分支先返回，决策点只能这样测）；APP_PICK_HINT 改用 android-picker 的文案',
          'utils/files/doc-parse.js：上传时优先 fileRef.absPath —— Android 选来的文件 path 是 _doc 相对路径（给 plus.io 读），绝对路径给 uni.uploadFile 最稳',
          'utils/files/index.js：转出 android-picker 的入口与纯函数，UI 仍只调 pickOneFile / readPickedFile，没有额外分支'
        ]
      },
      {
        title: '测试（3.7.5）',
        items: [
          'tests/file-pick-android.test.js（新增 12 例）：文件名消毒三例（路径穿越 / 非法字符 / 空名与超长）、落地路径时间戳两例、isAndroidRuntime 三态、路由决策（Android → 选择器，其余 → 提示且提示含截图与粘贴两条路）、假 plus 跑通选中流程（返回相对路径 + 绝对路径 + 消毒名 + size/mime，且真的调了 transferFrom）、取消静默、超 5MB 拦下且不拷贝、非 Android 直接返回、取不到输入流返回 false',
          '全量：70 文件 / 997 用例全绿（npx vitest run --maxWorkers=2，exit 0）'
        ]
      }
    ]
  },
  {
    version: '3.7.4',
    date: '2026-09-17',
    title: '3.7.4 自检报告自带口径版本（跑的是哪套代码一眼能认）+ 修正语料条数笔误',
    summary: [
      '起因：3.7.2 与 3.7.3 隔了十分钟，复跑后贴回来的结果其实是 3.7.2 跑的 —— 三处修复都没生效却看不出来（「不是 0 是 0」= 3.7.2 的占位符填 0、工具链里出现 multi = 3.7.2 的白名单认它、没有走确认闸门 = 3.7.2 的页面只从 execResults 取 confirm），白跑一轮',
      '报告头部新增「自检口径」与「应用版本」（外加模型名）：口径版本 EVAL_PROTOCOL_VERSION 在度量语义变化时 +1，以后任何一份报告都能自证是哪套代码跑的',
      '页面图例下方也显示「自检口径 · 应用版本」，截图即可确认；不传 meta 时报告仍打出「应用版本: （未知）」，不再出现无标识的报告',
      '顺带修正文档与版本日志里的条数笔误：语料实际是 23 条（3.7.0 起就写成 22），代码里的注释、测试名、AGENTS / HANDOFF 的速查行一并改准'
    ],
    categories: [
      {
        title: '自检口径自证（3.7.4）',
        items: [
          'utils/ai/eval/runner.js：新增 EVAL_PROTOCOL_VERSION = 4 与 EVAL_PROTOCOL_LABEL（含 v2 / v3 / v4 的口径变更记录）；formatFailureReport(rows, meta) 头部输出「自检口径 / 应用版本 / 模型」',
          'pages/settings/sub/ai-eval.vue：reportMeta 传 { appVersion: getVersion(), model: modelText }；图例下方新增一行「自检口径 {{ protocolLabel }} · 应用 {{ appVersion }}」',
          'tests/ai-eval-fallback.test.js：新增一例断言报告头部含口径与应用版本，且不传 meta 时也有口径行；顺带把语料条数注释改准'
        ]
      },
      {
        title: '测试（3.7.4）',
        items: [
          '全量：69 文件 / 985 用例全绿（npx vitest run --maxWorkers=2，exit 0）'
        ]
      }
    ]
  },
  {
    version: '3.7.3',
    date: '2026-09-17',
    title: '3.7.3 修确认闸门被绕过（大额记账直接落库）+ 拍平模型嵌套的 multi',
    summary: [
      '真 Bug（自检发现）：模型不调工具、直接回 JSON action 时，runAgentChat 无条件把结果标成 _agentMode，而 useChatEngine 的 JSON 路径确认判定是「非 agent 模式才判」—— 于是确认闸门整个被跳过：记一笔房租 1500 会直接落库、delete_feedback 也能绕开确认。现在只有真的跑过工具才认 agent 模式，JSON 回退交给 JSON 路径（先确认、再执行）',
      '确认判定抽成 utils/ai/confirm-gate.js 的 pendingConfirmations / needUserConfirm（纯函数）：聊天页与 AI 效果自检用同一份，避免两处逻辑各写一遍、越走越远 —— 这次的问题正是「自检测的和 App 跑的不是一套」',
      '真 Bug：模型把 multi 当成动作返回（实测 actions: [{ type: multi, payload: [...] }]）—— 直接执行只会拿到「复合意图请用 executeActions」的拦截，用户看到「都记好了」而两个意图一个都没落库；parseAiResponse 现在拍平嵌套 multi（内层数组 / payload.actions / payload.items 三种形态），展不出东西就当没有动作、落回兜底与提示',
      'store.isKnownActionType 不再认 multi：它是复合意图的容器标记，不是可执行动作（executeAction 对它的分支只是兜住误用）',
      '自检细节：数据前置取不到账单时金额用空串（原来填 0，语料显示成「不是 0 是 0」）；自检入口改用 runAgentChat（聊天页走的就是它），并同时统计 agent 循环内的挂起与 JSON 路径的确认判定'
    ],
    categories: [
      {
        title: '确认闸门（3.7.3）',
        items: [
          'utils/ai/agent-loop.js：无工具调用分支新增 _jsonFallback（本次一轮工具都没调过）；runAgentChat 改为 result._agentMode = !result._jsonFallback —— 以前无条件 true，导致上层跳过 JSON 路径的确认与执行',
          'utils/ai/confirm-gate.js（新增，纯函数）：pendingConfirmations(result)（agent 模式返回空；JSON 路径逐条过 needsConfirmation）+ needUserConfirm(result)（含模型自标的 needConfirm）',
          'composables/useChatEngine.js：内联的确认判定换成 pendingConfirmations（行为不变，来源收敛到一处）',
          'pages/settings/sub/ai-eval.vue：入口改用 runAgentChat、confirm 同时看 agent 挂起与 JSON 判定，测的就是真实链路'
        ]
      },
      {
        title: '嵌套 multi 与动作白名单（3.7.3）',
        items: [
          'utils/ai/response-parser.js：新增 normalizeActions 拍平嵌套 multi（payload 为数组 / payload.actions / payload.items 都展开），单动作就是 multi 时同样拍平，展不出真实动作则 action 为 null；actions 数组与单动作两条分支都过这个归一化',
          'store/data.js：isKnownActionType 对 multi 返回 false（容器标记不是动作），undo_last 仍为 true；配合 3.7.2 的 autoExecutor 白名单，multi 混进执行队列时会被挡下并落回兜底'
        ]
      },
      {
        title: '测试（3.7.3）',
        items: [
          'tests/confirm-gate.test.js（新增 11 例）：确认判定五例（写操作默认确认 / 只读与撤销不确认 / agent 模式不重复判 / 复合动作只挂需要确认的 / 模型自标 needConfirm）、runAgentChat 两例（JSON 回退 → _agentMode 假且会弹确认卡；跑过工具 → 仍是 agent 模式且不重复确认）、parseAiResponse 嵌套 multi 四例（数组 / payload.actions / 空 multi / 单动作即 multi）',
          'tests/ai-eval-context.test.js：无账单时金额断言由 0 改为空串',
          '全量：69 文件 / 984 用例全绿（npx vitest run --maxWorkers=2，exit 0）'
        ]
      }
    ]
  },
  {
    version: '3.7.2',
    date: '2026-09-17',
    title: '3.7.2 自检去掉 4 条假失败（语料改绑真实数据）+ 拦住模型幻觉的动作类型',
    summary: [
      '4 条「失败」是语料写死了并不存在的计划名：你库里只有「一年读完12本有意思的书」，没有六级备考计划 / 学英语计划 / 英语听力计划，也没有 ¥35 的午饭账单 —— 模型查完如实说「没找到，要不要新建」，行为正确却被判失败。语料改用 {plan} / {billAmount} 占位符，跑批前从你的真实数据取值（页面显示「数据前置」那一行）',
      '取不到前置就判跳过（–），不算失败、也不进通过率分母 —— 页面图例与汇总行同步；自检口径从此不再绑定某个具体计划名',
      '真 Bug：模型幻觉出不存在的动作类型（这次实测返回 type: batch，它想表达复合意图），以前拿假类型直接 executeAction → 得到「未知操作类型」，上层却当成「执行了但失败」，兜底与提示都接管不了 —— 于是「都记好了」既没落库也没人纠正',
      '修法：store/data.js 新增 isKnownActionType(type)（ACTION_MAP 是唯一事实来源，不在别处再抄一份清单），autoExecutor 的 JSON 路径先过白名单再执行，未知类型落回「声称操作但无 action」交给兜底与提示；executeTool 也补了工具名白名单 —— 调用不存在的工具名会明确回传「不存在名为 X 的工具」，让模型自纠而不是静默失败',
      '自检的合并逻辑与 autoExecutor 用同一套校验（页面把 store.isKnownActionType 传进 mergeExecutedTools），所以自检看到的工具链就是 App 真实会执行的工具链'
    ],
    categories: [
      {
        title: '自检数据前置（3.7.2）',
        items: [
          'utils/ai/eval/cases.js：5 条与真实数据挂钩的语料改成占位符 —— plan-change-content / plan-change-deadline / plan-add-child / plan-checkin 用 {plan}，bill-correction 用 {billAmount} 与 {billAmountPlus}（原金额 +18），并新增 needs 字段声明前置（plan / bill）',
          'utils/ai/eval/runner.js：新增 buildEvalContext({plans,bills})（取第一条进行中计划、第一笔支出账单；收入不算、已完成计划不算）、resolveCase(caze,ctx)（占位符替换 + 缺前置判定，缺值时保留 {plan} 原样），runCase 缺前置直接返回 SKIP 并说明缺什么（不打模型），summarizeResults 增加 skip / scored，通过率按 scored 算，formatFailureReport 单列跳过条数',
          'pages/settings/sub/ai-eval.vue：跑批前用 executeTool 查真实计划与账单填 evalCtx，页面顶部显示「数据前置：计划「X」 · 最近一笔支出 ¥Y」；状态符号补 –（跳过）；汇总行显示「跳过 N」'
        ]
      },
      {
        title: '幻觉动作类型（3.7.2）',
        items: [
          'store/data.js：新增 isKnownActionType(type) —— undo_last / multi 与 ACTION_MAP 里的类型才算合法，其余（含 none）一律假；store/index.js 透传为 data.isKnownActionType',
          'utils/ai/autoExecutor.js：新增 keepKnownActions(store, list)；复合动作先滤掉未知类型（全滤空则按无 action 处理），单动作路径同样校验，未知类型不执行、落回「声称操作但无 action」的兜底与提示链路',
          'utils/ai/tools/executor.js：新增 TOOL_NAMES 白名单（来自 TOOL_DEFINITIONS），调用不存在的工具名直接回传「不存在名为 X 的工具，请从工具列表里选择可用的工具重新调用」—— 以前会一路走到 store.executeAction 才报「未知操作类型」',
          'utils/ai/eval/runner.js：mergeExecutedTools(result, opts) 支持 isKnownType，幻觉类型不计入工具链（与 App 一致）'
        ]
      },
      {
        title: '测试（3.7.2）',
        items: [
          'tests/ai-eval-context.test.js（新增 13 例）：buildEvalContext 取值与边界（已完成计划不算、收入不算、空数据）、resolveCase 占位符替换与缺前置、缺前置判跳过且不打模型、有前置用真实名字跑、跳过不进通过率分母、全部语料里带 needs 的都能取到值；幻觉动作四条（isKnownActionType 判定、未知 action 不落到 executeAction 且兜底救回可救的那半、自检合并同样不认 batch、不存在的工具名明确回传）',
          'tests/ai-eval.test.js：整套语料那条补数据前置（否则带 needs 的用例判跳过）',
          '全量：68 文件 / 973 用例全绿（npx vitest run --maxWorkers=2，exit 0）'
        ]
      }
    ]
  },
  {
    version: '3.7.1',
    date: '2026-09-16',
    title: '3.7.1 自检首跑 16/23：3 条修自检口径、2 条真 Bug（AI 说「记好了」但记录没落库）',
    summary: [
      '自检口径修正一：干跑只拦写操作与联网工具，查询类（query_plan 等只读）照常真跑 —— 3.7.0 把查询也换成占位文本，模型拿不到计划 client_id，只能照着占位瞎答（plan-add-child 与 plan-checkin 两条失败都出在这）',
      '自检口径修正二：工具序列合并两条执行路径（原生 tool_calls + 老 JSON action）—— 3.7.0 只认 tool_calls，把 5 条本来会正常执行的记账 / 记录判成了「没调工具」',
      '自检新增兜底档（页面显示 ~）：模型既没调工具也没回 JSON、只口头答应时，若前端兜底能救回写入则单独计数 —— 它不算通过，因为「靠正则救回来」不等于「AI 会拆解」，这正是你排第一的痛点的量化证据',
      '真 Bug 一：Agent 路径的兜底闸门只认收窄集（已记… / 记下了 / 记了一笔），而实测模型最常说的是「记好了 / 记下来了 / 记下来啦」—— 全部漏过兜底，于是记录与账单一分没写、用户却被告知记好了（静默丢数据）；基础集补 11 个说法，收窄集补 12 个，Agent 闸门与 JSON 路径对齐，并把 response-parser 的 _opClaimWithoutAction 从 agent-loop 透传出来',
      '真 Bug 二：记账兜底认不出「记一笔 / 记账」这类指令（「记一笔昨天的午饭 25」里没有任何花销动词，兜底压根不进来）；补指令词并按原话补日期（昨天 / 前天），模型不调工具时也能把账救回来',
      '剩下的 plan-add-child / plan-checkin 需要你复跑确认：它们依赖你库里真实的计划名与数据，若确实没有「英语听力」这个计划，那条语料的期望就不成立，按你实际的计划名改语料'
    ],
    categories: [
      {
        title: '自检口径修正（3.7.1）',
        items: [
          'utils/ai/agent-loop.js：dryRun 收窄为「只拦写操作 + NETWORK_TOOLS（web_search / read_url）」，查询类走真实 executeTool —— 自检必须让模型看到真实数据，否则测的是它瞎猜的能力',
          'utils/ai/eval/runner.js：新增 mergeExecutedTools(result)，把 tool_calls 与 action / actions 合并成一条工具序列（标 source: tool | json）；runCase 增加 jsonTools 与兜底档判定 detectFallback（闸门与 autoExecutor 一致），formatFailureReport 标出「其中 N 步走 JSON 兜底」',
          'pages/settings/sub/ai-eval.vue：runAgentLoop 传真 store（查询要真跑）；实际工具行标注 JSON 兜底步数；状态符号 ✓ / ~（兜底）/ × / !（出错）并加图例；汇总行单独显示「靠兜底 N」',
          'utils/ai/eval/cases.js 未改：语料本身没问题，问题在度量口径（这是本次最重要的一条结论）'
        ]
      },
      {
        title: '真 Bug：口头声称但没落库（3.7.1）',
        items: [
          '根因：两套声称正则 —— 基础集 OP_CLAIM_RE（response-parser 用，含「记好了」）与收窄集 OP_CLAIM_RE_FALLBACK（兜底闸门用，只含「已记…/帮你记…/记下了/记了一笔」）。JSON 路径的闸门是「收窄集 || parser 标记」，认得出「记好了」；Agent 路径的闸门只有收窄集，认不出 —— 而 Agent 路径是工具调用厂商的默认路径',
          '后果：模型在 5 条语料上没调工具、只回「记好了 / 记下来了 / 记下来啦」，前端兜底不触发 → 记录与账单一分没写，用户看到的是「记好了」（静默数据丢失，比报错更难发现）',
          'utils/ai/constants.js：OP_CLAIM_WORDS 补 11 个说法（记下来了 / 记下来啦 / 记录下来 / 已记下 / 记上了 / 存好了 / 加好了 / 建好了 / 创建好了 / 添加好了 / 保存好了），OP_CLAIM_RE_FALLBACK 同步补齐并含「记好了」',
          'utils/ai/autoExecutor.js：Agent 路径闸门改为「收窄集 || 基础集 || result._opClaimWithoutAction」，与 JSON 路径同一套判断',
          'utils/ai/agent-loop.js：无工具调用分支的返回值补 _opClaimWithoutAction 透传（原来直接丢，Agent 路径拿不到 parser 的标记）',
          'utils/ai/fallback.js：记账分支 billKeywords 补「记一笔 / 记一下账 / 记个账 / 记笔账 / 记账」；金额取「元 / 块」后缀优先、否则最后一个数字；按原话里的今天 / 昨天 / 前天补 bill_date（normalizeDateStr）',
          'utils/ai/eval/runner.js 的 detectFallback 同步成「收窄集 || 基础集」，确保自检度量与实际兜底行为一致'
        ]
      },
      {
        title: '测试（3.7.1）',
        items: [
          'tests/op-claim-guard.test.js（+8 例）：五条实测回复（记好了 / 记下来了 / 记下来啦）必须被两套正则认出；普通闲聊（我记得你说过想去爬山）不许误判；记账兜底四例（昨天 / 前天 / 无日期 / 元后缀优先）与「记录类仍走 create_diary」的对照',
          'tests/ai-eval-fallback.test.js（新增 6 例）：兜底档判定（算 fallback 不算 fail）、没声称操作时仍判 fail、只查回复的用例不打兜底档、真调工具时不会被打成兜底、汇总三档分开计数',
          'tests/ai-eval.test.js：干跑用例改成 3.7.1 口径（查询真跑、写被闸门挡、store 传 null 不炸）+ mergeExecutedTools 五例',
          '全量：67 文件 / 960 用例全绿（npx vitest run --maxWorkers=2，exit 0）'
        ]
      }
    ]
  },
  {
    version: '3.7.0',
    date: '2026-09-16',
    title: '3.7.0 AI 效果自检：23 条真实语料跑一遍，改提示词第一次有数字对照',
    summary: [
      '设置 → AI 效果自检：把历史反馈里的 23 条真实语料逐条真请求一遍模型，看它「选了什么工具、顺序对不对」，出通过率 —— 过去六轮都在加提示词规则（BEHAVIOR_RULES 7 条 → 10 条铁律 + 纠错主动权），但旧回归集只能断言「提示词里写了这句话」，证明不了模型照做，你的体感一直没变',
      '干跑模式（不污染数据）：新增 cfg.dryRun —— 只记录要调什么工具、什么参数，不落库、不发网络请求（web_search / read_url 也换占位结果）；默认设置下写操作还要过确认闸门，自检不可能写进真实数据',
      '23 条语料覆盖你排在前面的痛点：计划变更不许新建（先查后改）、自定义属性新增与修改、错别字容忍、口头时间从原话算（昨天/前天）、一句话两个意图拆开、大额记账走确认、记错了先查后改、网址后面粘中文只读网址（3.6.2 回归点）、闲聊一个写操作都不许调',
      '逐条可展开：原话 / 期望 / 实际工具链 / 未通过原因 / AI 回复节选；一键复制失败明细，直接发给我定位；同一批语料用 temperature 0 跑，批次之间可比',
      '工程：utils/ai/eval/cases.js（语料，纯数据，日期现算不写死）+ utils/ai/eval/runner.js（判定与编排，纯函数，不碰 store）+ pages/settings/sub/ai-eval.vue；新增 25 例测试（含干跑不写数据、确认闸门、脚本化回复跑完整套语料的对照用例）'
    ],
    categories: [
      {
        title: 'AI 效果自检（3.7.0）',
        items: [
          '动因：用户排序里「话语拆解与纠错」一直排第一，3.0 / 3.1 多次加固（BEHAVIOR_RULES / 纠错主动权 / vision-bridge）后仍排第一，说明效果未达预期；docs/思迹产品规划问答纪要_20260906.md 的结论是「下一步不是继续加规则，而是先建纠错回归集」——本次把它落成可跑分的东西',
          '旧口径的短板：tests/correction-regression.test.js 是静态回归（assert BEHAVIOR_RULES / CORE_ACTIONS 包含某句提示词），只能证明规则写了，证明不了模型照做；改动提示词后没有任何数字能说明变好还是变坏',
          'utils/ai/eval/cases.js（新增）：EVAL_CASES 23 条真实语料（来自历史开发者反馈的原话），断言语义 —— tools 必须全出现 / toolsAny 至少一个 / forbid 一个都不许 / order 先查后改 / args 参数校验（含网址不得带中文、bill_date 必须等于昨天与前天）/ confirm 是否走闸门 / replyIncludes 与 replyExcludes；dayStr(offset) 现算相对日期，不写死日期（写死会在特定日子假失败）',
          'utils/ai/eval/runner.js（新增，纯函数）：judgeCase 逐条判定并给出人话原因；runCase 单条（模型抛错记成 error，不打断整批）；runCases 顺序跑 + 进度回调 + stopRef 停止标志；summarizeResults 出通过率与耗时；formatFailureReport 生成可复制的失败明细',
          'utils/ai/agent-loop.js：新增 dryRunResult 与 cfg.dryRun —— 查询分支（web_search / read_url 不联网）与写入分支（executeTool 不执行）两处都换成占位结果，工具名与参数照常记进 toolCalls；store 传 null 也不炸（自检不需要 store）',
          'pages/settings/sub/ai-eval.vue + ai-eval.scss（新增）：环境行（当前模型 / Key 状态）、开始与停止、进度条、通过率大数字、结果列表（✓/× + 标题 + 实际工具链）、点击展开详情、复制失败明细；纯黑白灰阶，深色模式覆盖',
          'pages.json 注册 ai-eval（BOM 与 CRLF 保持不变）；pages/settings/index.vue 在「关于」卡加入口（图标用已有的 stats，不用映射表里没有的名字）',
          '代价与边界：一整套 23 条约 23 次请求（DeepSeek V4 Flash 下约 ¥0.1）；语料不含隐私内容；演示模式只记录工具选择，不校验落库结果（落库由 tests/executors.test.js 那层负责）'
        ]
      },
      {
        title: '测试（3.7.0）',
        items: [
          'tests/ai-eval.test.js（新增 25 例）：语料结构完整性（id 唯一 / 断言字段合法 / 覆盖痛点主题 / 相对日期现算）、judgeCase 各条断言语义（含 args 抛错不挂整批、无 expect 判失败）、runCase 抛错记 error、runCases 顺序与进度与停止标志、summarizeResults 与 formatFailureReport、干跑四条（工具调用照常记录 + executeAction 一次没调 + 默认确认闸门挡住写入 + 关闸门后走 dryRunResult + read_url 不发请求）、脚本化回复跑完整套语料的对照（只读用例通过、要求写工具的用例判失败）',
          '全量：66 文件 / 942 用例全绿（npx vitest run --maxWorkers=2，exit 0）'
        ]
      }
    ]
  }
]