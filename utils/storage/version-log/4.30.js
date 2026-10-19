/**
 * 版本日志数据段：4.30.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V430 = [
  {
    version: '4.37.0',
    date: '2026-10-19',
    title: '人脉互动不再猜人：同名/模糊多候选只返回候选不写入，确认后按 relation_id 落库',
    summary: [
      '旧实现按姓名匹配后直接取 matched[0]：同名两人或模糊命中多人时，一次真实互动会被记到错的人名下，污染后续画像、关系分析与 AI 建议，且用户很难发现',
      '匹配拆三层：findRelationsByExactName（严格相等，同名返回全部）/ findRelationCandidates（**只匹配姓名**，不看 context 与 tags）/ resolveInteractionTarget（只读不写，返回 resolved/ambiguous/none）',
      '执行器歧义时返回 needChoice + 候选（含 id、角色、场景），一条互动都不写；无匹配保持原有「关系卡片不存在」提示；唯一精确/唯一模糊匹配照旧直接写入（兼容旧行为）',
      'agent-loop 把目标解析提到确认卡之前：解析成功则把 relation_id 写回参数（确认卡与最终写入用同一个 ID），歧义与未找到不挂起确认、改为把候选回传模型由用户确认',
      '工具描述与 CORE_ACTIONS 同步加约束「匹配到多人禁止猜第一个」；单字关键词不做模糊候选（噪声保护，避免把场景词/单字当人名）；新增 tests/relation-ambiguity.test.js 18 例，全量 112 文件 / 1521 用例全绿'
    ],
    categories: [
      {
        title: '人脉匹配',
        items: [
          'utils/relations.js：新增 findRelationsByExactName / findRelationCandidates / briefRelation / resolveInteractionTarget；findRelationsByName 保留给 query_relation 关键词检索（姓名+场景+标签）',
          'resolveInteractionTarget 规则：有效 relation_id 优先 → 精确唯一 → 精确同名歧义 → 模糊唯一（兼容） → 模糊多个歧义 → 未找到；ID 失效时退回按姓名解析；软删除由 getAllRelations 过滤，不参与候选',
          'briefRelation 只带 id/name/role/context/tags(≤3)/last_interaction/score，控制回传给模型的体积'
        ]
      },
      {
        title: '写入链路',
        items: [
          'store/executors/relation.js 的 execLogInteraction：歧义 → { success:false, needChoice:true, detail.candidates }，不调用 logInteraction；无匹配 → 保留「关系卡片不存在，请先创建该人脉」文案',
          'utils/ai/tools/executor.js：log_interaction 在确认闸门之前解析目标；歧义/未找到直接 ok:false（不带 confirm，不给确认卡），解析成功则把 relation_id 写进 args，后续确认卡 payload 与写入共用同一 ID',
          'utils/ai/agent-loop.js：pendingCalls 收集阶段先解析 log_interaction 目标，非 resolved 的跳过挂起（落到写入循环由 executeTool 回传候选），resolved 的把 id 写进确认卡参数',
          'utils/ai/tools/relation.js 与 prompt-builder 的 CORE_ACTIONS：description/说明补「匹配到多人禁止猜，先让用户确认再用 id 重调」'
        ]
      },
      {
        title: '测试',
        items: [
          'tests/relation-ambiguity.test.js（新增 18 例）：id 优先 / id 失效不误配 / 精确唯一 / 同名歧义候选齐全 / 模糊唯一兼容 / 模糊多个歧义 / 精确与模糊函数分工 / 场景词标签词不算人名 / 单字不做模糊候选 / 歧义双方零写入 / 无匹配不产生孤立互动 / 软删除不入候选 / 候选选中后按 id 落到正确人名下 / 单人照旧成功 / executeTool 歧义文本带 id 且不给确认卡 / executeTool 成功时 payload 已注入 relation_id',
          '回归：bugfix-regression 的按姓名记录与未知人名错误文案全部保持通过'
        ]
      }
    ]
  },
  {
    version: '4.36.0',
    date: '2026-10-19',
    title: '个人画像真正进入每轮对话：600 字预算摘要 + 字段优先级 + 修掉画像关闭仍过滤记忆的开关不一致',
    summary: [
      '画像卡此前从不进 AI 上下文：buildProfileContext 在 prompt-builder 里只 import 未调用（全仓零调用点），每轮注入的「用户近期数据」只是支出/记录/计划概览，不含画像任何字段',
      '新增 buildProfileContextBrief：只取 portrait 卡的关键字段，最终输出 ≤ 600 字符（标题+正文+尾注一起算），单字段超 60 字截断，白名单 22 个字段按优先级占预算，未登记字段自动兜底排序',
      '冲突语义修正：不再声明「以本摘要为准」，改为「稳定性内容可长期沿用；职业/作息/目标/关系状态等可变信息，若与更近期的记录冲突以更近期的记录为准」',
      'lite 档不按模式名打折：lite 的判据是「无指令动词 + 无金额 + 长度≥4」，恰好覆盖情绪倾诉与自我认知类消息（最需要画像），而它省下的是 CORE_ACTIONS 的 3.5k 字符',
      '修开关不一致：getProfileValues 不看 enabled，导致关掉画像后记忆仍被画像字段静默过滤；现改为关闭时返回空数组（调用方每轮记忆注入 + 月结，均为去重用途）',
      '删死代码：buildProfileContext（全量拼接、无预算）与 prompt-builder 的死导入一并移除；新增 tests/profile-injection.test.js 12 例，全量 111 文件 / 1503 用例全绿'
    ],
    categories: [
      {
        title: '画像注入',
        items: [
          'utils/profileContext.js：删除 buildProfileContext；新增 PROFILE_BRIEF_FIELDS（key/label/order 三列分离，中英键并存）、PROFILE_BRIEF_MAX_CHARS=600、PROFILE_FIELD_MAX_CHARS=60、buildProfileContextBrief(opts)',
          '预算拆分：overhead = 标题 + 尾注 + 两个换行，正文只在剩余预算内按行累加；超预算整行跳过（不半截截断），保证保留字段完整可读；返回 { text, chars, dropped, fields }',
          'utils/ai/chat-helpers.js：在「用户近期数据」之后、记忆上下文之前接入 buildProfileContextBrief()，仅画像 enabled 时注入',
          'utils/ai/prompt-builder.js：移除 buildProfileContext 死导入；utils/profile.js 的 re-export 改为导出新函数与常量'
        ]
      },
      {
        title: '记忆过滤',
        items: [
          'utils/memory/profile-values.js：getProfileValues 增加 enabled 门（false 时返回 []），修「关闭画像仍按画像字段过滤记忆」的语义不一致',
          '影响面已核：调用方只有 memory/context.js（每轮记忆注入）与 memory/monthly.js（月结去重），关闭画像后放开过滤符合预期'
        ]
      },
      {
        title: '测试',
        items: [
          'tests/profile-injection.test.js（新增 12 例）：开关关闭不注入 / 空画像不报错 / 只有非 portrait 卡不注入 / 总长 ≤600 / 多字段裁剪时高优先级字段保留 / 单字段截断带省略号 / maxChars 可注入 / 冲突语义措辞 / lite 与完整档长度一致 / 注入位置在数据概览之后 / 记忆过滤随开关变化',
          '断言对象是 buildChatMessages 的 messages[0].content，防「函数写对但没接上」的回归'
        ]
      }
    ]
  },
  {
    version: '4.35.2',
    date: '2026-10-19',
    title: '后台常驻插件补上原生模块入口：HBuilderX 打包校验拒绝空 plugins，签名全部经基座 dex 实证',
    summary: [
      '4.35.0 的空 plugins 数组被 HBuilderX 打包校验拒绝（「_dp_nativeplugin.android.plugins 节点下存在为空的对象」）；从校验器源码（plugins/uniapp-extension/out/index.js）确认硬性要求：plugins 非空且每条必须有 type(module/component)/name/class',
      '新增 SijiKeepAliveModule：@UniJSMethod 的 start/stop/isRunning，成为 uni.requireNativePlugin 正路入口；JS 侧模块优先、plus.android 反射降级为兜底（双路径打同一个 Service）',
      'DCloud API 签名全部从本机 HBuilderX 标准基座（android_base.apk）的 dex 逐字节实证，不走教程印象：mUniSDKInstance 声明在 WXModule 上且类型是 AbsSDKInstance（不是 UniSDKInstance）、getContext 直接声明在 AbsSDKInstance 接口上',
      '无 uniapp SDK 也能编译：native/keepalive/stubs/ 六个同 FQN stub 只进 classpath 不进 aar；构建脚本新增 stub 编译阶段 + 泄漏闸门（classes 出现 com/siji/keepalive 之外的类即终止）+ 产物复核（模块类与服务类必须在 aar 内）',
      'javap 字节码复核通过（superclass / getfield 描述符 / RUNTIME 注解 / fastjson 方法签名）；AAR 4KB→5.6KB；tests/keepalive.test.js 15→21 例；全量 110 文件 / 1491 用例全绿'
    ],
    categories: [
      {
        title: '原生插件（合法性修复）',
        items: [
          'native/keepalive/src/main/java/com/siji/keepalive/SijiKeepAliveModule.java（新增）：extends UniModule，start(JSONObject,UniJSCallback)/stop(UniJSCallback)/isRunning(UniJSCallback) 三个 @UniJSMethod；mUniSDKInstance.getContext() 拿 Context，new Intent(ctx, Service.class) 显式类引用；异常全部 catch 回传 JS 不崩',
          'native/keepalive/src/main/java/com/siji/keepalive/SijiKeepAliveService.java：补静态 running 标志（onCreate 置 true / onDestroy 置 false）+ isRunning() 供模块查询',
          'nativeplugins/siji-keepalive/package.json：plugins 从 [] 改为 [{type:module, name:siji-keepalive, class:com.siji.keepalive.SijiKeepAliveModule}]，version 1.0.0→1.1.0',
          'nativeplugins/siji-keepalive/android/siji-keepalive.aar：重构建（5.6KB，含模块类+服务类，无 stub 泄漏）'
        ]
      },
      {
        title: 'stub 编译体系（本仓库无 uniapp SDK）',
        items: [
          'native/keepalive/stubs/（新增 6 个文件）：com/taobao/weex/common/WXModule（public AbsSDKInstance mUniSDKInstance）、io/dcloud/feature/uniapp/common/UniModule、io/dcloud/feature/uniapp/AbsSDKInstance（接口，Context getContext()）、annotation/UniJSMethod（RUNTIME retention）、bridge/UniJSCallback（invoke/invokeAndKeepAlive）、com/alibaba/fastjson/JSONObject（无参构造/getString/put）——全部从基座 dex 实证后落 stub',
          'scripts/build-keepalive-aar.ps1：4.35.2 重写 —— stub 编译到独立目录只进 classpath；泄漏闸门（插件 classes 只允许 com/siji/keepalive）；AAR 复核（模块类与服务类必须存在）；BOM 提醒（PS 5.1 无 BOM 按 GBK 读会打断语法）',
          '验证方法（可复现）：解 android_base.apk 的 classes*.dex → node dex-classdef.mjs 解析 class_def/field_ids/method_ids → 对照 javap -v 的描述符'
        ]
      },
      {
        title: 'JS 双路径',
        items: [
          'utils/keepalive.js：新增 MODULE_NAME 与模块探测缓存；startKeepAlive/stopKeepAlive 先走 uni.requireNativePlugin（只在类探测通过后才碰，标准基座零接触），同步抛错落反射兜底；异步回执只记日志不重试（权限拒绝时两条路径同样失败）；原反射实现保留为 startKeepAliveByReflection/stopKeepAliveByReflection',
          'tests/keepalive.test.js：新增「模块路径」组 6 例 —— start/stop 走模块、文案兜底、回调失败不影响返回值、requireNativePlugin 缺失/抛错/缺方法时的兜底行为、syncKeepAlive 三态'
        ]
      }
    ]
  },
  {
    version: '4.35.1',
    date: '2026-10-19',
    title: '打断提醒模块循环依赖：Push 探测抽成叶子模块，动态 import 全部改静态',
    summary: [
      '消掉 HBuilder 构建日志里的两条警告（notifier / push-schedule 既被动态又被静态引用）—— 根因是 notifier → push-schedule → scheduler → notifier 的循环依赖',
      '新增 utils/reminder/push-probe.js（只依赖 logger 的叶子模块）：widgetHasPush + probePushModule 从 push-schedule 搬出，push-schedule 用 re-export 保持旧引用可用',
      'notifier 的 plus.push 探测改静态引用；PlanReminderSection.vue 的 ensureNotifyPermission 从动态 import 改静态（notifier 本就在同一 chunk，动态写法不省分包）',
      '新增 tests/reminder-module-cycle.test.js：依赖图无环 + push-probe 叶子不变量 + 提醒链路无动态 import 三条守卫',
      '逻辑与 4.29.3 真机修复版逐字一致，无用户可见行为变化；全量 110 文件 / 1485 用例全绿'
    ],
    categories: [
      {
        title: '提醒模块依赖整理',
        items: [
          'utils/reminder/push-probe.js（新增）：widgetHasPush / probePushModule / __resetPushProbeCache，只 import logger，探测结果进程内缓存',
          'utils/reminder/push-schedule.js：删掉本地探测实现与 pushModuleAvail 缓存，改为 import + re-export（旧引用 `from push-schedule` 不用改）',
          'utils/reminder/notifier.js：`import(\'@/utils/reminder/push-schedule.js\').then(...)` 改静态 `import { probePushModule } from \'./push-probe.js\'`，触发路径少一层 Promise',
          'components/plan/PlanReminderSection.vue：requestNotify 里的动态 import 改静态 import（顶部 ensureNotifyPermission）',
          'manifest.json：versionName 4.35.1 / versionCode 4351（文件被 HBuilderX 重新格式化为 4 空格 + `"key" : value`，diff 变大但无字段变化）'
        ]
      },
      {
        title: '测试',
        items: [
          'tests/reminder-module-cycle.test.js（新增，5 例）：utils/reminder/ 静态依赖图无环、push-probe 只依赖 logger、notifier 不再依赖 push-schedule/scheduler、push-schedule re-export 仍在、提醒链路无 `import(` 动态导入'
        ]
      }
    ]
  },
  {
    version: '4.35.0',
    date: '2026-10-19',
    title: 'Android 后台常驻：前台服务原生插件 + 提示与提醒页后台运行开关',
    summary: [
      '新增原生插件 nativeplugins/siji-keepalive（4KB AAR）：Android 前台服务 + 常驻通知，退后台/从最近任务划掉后进程不再被立刻回收',
      '构建不依赖 Android Studio / Gradle / uniapp 插件 SDK —— 纯 Java 源码 + android.jar 用 javac 编译，scripts/build-keepalive-aar.ps1 一条命令出 AAR',
      '设置 - 提示与提醒新增「后台运行」组（App 端）：后台常驻开关 + 电池优化放行入口；开关存 siji_keepalive_enabled，默认关',
      '插件没打进包（标准基座/旧包）时静默降级、启动不崩；App.vue 在 appReady 与 onShow 各同步一次服务状态',
      '新增 tests/keepalive.test.js；真机验证项登记进 docs/真机验证清单.md，方案与打包步骤见 docs/后台保活方案.md'
    ],
    categories: [
      {
        title: '后台常驻（原生插件）',
        items: [
          'native/keepalive/src/main/java/com/siji/keepalive/SijiKeepAliveService.java（新增）：前台服务，START_STICKY 自重启、stopWithTask=false 划任务不停、通知渠道 siji_keepalive（IMPORTANCE_LOW、不响不震、点通知回 App）',
          'native/keepalive/src/main/AndroidManifest.xml（新增）：声明 service + FOREGROUND_SERVICE / FOREGROUND_SERVICE_SPECIAL_USE / POST_NOTIFICATIONS，foregroundServiceType=specialUse（dataSync 在 Android 15 有 6 小时/24 小时上限）',
          'nativeplugins/siji-keepalive/package.json（新增）：本地原生插件描述，integrateType=aar、minSdkVersion=21、无 UniModule（plugins 为空数组）',
          'nativeplugins/siji-keepalive/android/siji-keepalive.aar（构建产物，4KB）：classes.jar + AndroidManifest.xml',
          'scripts/build-keepalive-aar.ps1（新增）：定位 android.jar → javac(-source/-target 8) → jar → zip 出 AAR；JDK 8/17 都吃',
          '文档 docs/后台保活方案.md（新增）：可行性边界、构建/打包步骤、Android 14+ 类型选择、Store 审核口径、真机验证清单'
        ]
      },
      {
        title: 'JS 封装与接入',
        items: [
          'utils/keepalive.js（新增）：isKeepAliveOn/setKeepAliveOn（键 siji_keepalive_enabled）、isKeepAliveSupported（plus.android.importClass 探测 + 结果缓存）、startKeepAlive（API 26+ startForegroundService）、stopKeepAlive（stopService）、syncKeepAlive（按开关幂等同步）、openBatteryOptimizationSettings（ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS，兜底应用详情页）',
          'App.vue：appReady 与 onShow 各调一次 syncKeepAlive（try/catch 兜住，插件缺失不影响启动）',
          'manifest.json：app-plus.nativePlugins 注册 siji-keepalive + 补 FOREGROUND_SERVICE / FOREGROUND_SERVICE_SPECIAL_USE 权限 + versionName 4.35.0 / versionCode 4350'
        ]
      },
      {
        title: '设置页',
        items: [
          'pages/settings/sub/notify.vue：新增「后台运行」组（#ifdef APP-PLUS）：后台常驻开关（含 keepAliveSupported 置灰态说明）+ 允许后台运行（电池优化引导）+ 深色配套 .np-row-tap/.np-arrow'
        ]
      },
      {
        title: '测试',
        items: [
          'tests/keepalive.test.js（新增）：开关归一、shouldStartKeepAlive 双条件、buildStartSpec（类名/action/文案兜底）、androidMajorVersion、开关读写、插件缺失时的四条降级路径',
          '真机项：常驻通知是否出现、划掉最近任务后 60s 轮询是否还在跑、特殊 ROM 是否需要电池白名单（docs/真机验证清单.md）'
        ]
      }
    ]
  },
  {
    version: '4.34.0',
    date: '2026-10-18',
    title: '人脉页改版：砍ECharts力导向图，改分组卡片+最近互动',
    summary: [
      '砍掉 relation-graph 页的 ECharts 力导向图（H5下黑块渲染失败）',
      '新设计：顶部概览数字 + 按家人/伴侣/朋友/工作/师长分组卡片',
      '每人显示首字头像+名字+context+tags+上次互动距今几天',
      'role 归一化映射：母亲/父亲自动归入家人，女友归入伴侣等',
      '深色模式适配，零阴影零渐变纯Zinc灰阶'
    ],
    categories: [
      {
        title: '人脉',
        items: [
          'pages/settings/sub/relation-graph.vue 整体重写，删除 RelationGraphECharts 依赖',
          'pages/settings/sub/relation-graph.scss 整体重写',
          '新增顶部概览行：总人数/7天内互动/平均亲密度',
          '新增 role 归一化映射 ROLE_GROUPS，把具体角色归到5大类',
          '人物卡片：80rpx首字头像 + 名字 + context+tags + 距今时间',
          '超30天未联系的人头像变灰、时间文字变红'
        ]
      }
    ]
  },
  {
    version: '4.33.4',
    date: '2026-10-18',
    title: '画像按钮颜色加深、图标放大、间距收紧',
    summary: [
      '按钮图标从低 opacity 灰改为固定深灰 #52525B/#71717A，颜色更清晰',
      '字段行图标 16→20、卡片头 18→22，视觉尺寸再放大',
      '按钮热区从 48rpx 收到 40rpx、padding 10→6rpx、按钮间距 gap 4→2rpx，整体更紧凑',
    ],
    categories: [
      {
        title: 'UI 调整',
        items: [
          'pages/settings/sub/profile.scss：.field-edit/.field-clear/.card-edit-btn/.card-delete/.card-collapse 去掉 opacity 改 color: #52525B/#71717A；min 48rpx→40rpx；padding 10rpx→6rpx；.field-actions gap 4rpx→2rpx',
          'pages/settings/sub/profile.vue：SijiIcon size 16→20（字段行）、18→22（卡片头），加 color 属性固定色',
        ],
      },
    ],
  },
  {
    version: '4.33.3',
    date: '2026-10-18',
    title: '画像页小按钮热区扩大到 48rpx，图标同步放大',
    summary: [
      '字段行铅笔/删除按钮、卡片头部编辑/删除/折叠箭头热区统一扩到 48rpx 最小触控尺寸',
      'chip 删除按钮热区扩到 36rpx',
      '图标尺寸同步放大：字段行 12→16，卡片头部 14/16→18',
    ],
    categories: [
      {
        title: 'UI 调整',
        items: [
          'pages/settings/sub/profile.scss：.field-edit/.field-clear/.card-edit-btn/.card-delete/.card-collapse 统一加 display:flex + min-width/min-height 48rpx + padding 10rpx；.chip-remove 加 min 36rpx',
          'pages/settings/sub/profile.vue：SijiIcon size 从 12→16（字段行）、14/16→18（卡片头部）',
        ],
      },
    ],
  },
  {
    version: '4.33.2',
    date: '2026-10-18',
    title: '画像卡片标题行只读，折叠/展开收敛到右侧箭头',
    summary: [
      '点"我的画像"标题文字不再误触折叠，标题行默认只读',
      '折叠/展开操作收敛到右侧 chevron 箭头按钮，明确可点区域',
      '自定义卡片的标题编辑仍走右侧铅笔按钮，入口不变',
    ],
    categories: [
      {
        title: '交互调整',
        items: [
          'pages/settings/sub/profile.vue：card-header 去掉整行 @tap，card-title-wrap 去掉 @tap.stop="handleTitleTap"，card-collapse 加 @tap.stop="toggleCard(card.id)"',
        ],
      },
    ],
  },
  {
    version: '4.33.1',
    date: '2026-10-18',
    title: '画像字段防误触：已填值默认只读，点正文不弹编辑框',
    summary: [
      '已填值字段点击正文不再触发编辑，避免阅读画像时误触弹输入框',
      '右侧新增小铅笔按钮才触发编辑，删除按钮保留在铅笔旁',
      '空字段（"点击填写"）保持原交互，点击直接进入填写',
    ],
    categories: [
      {
        title: '交互调整',
        items: [
          'pages/settings/sub/profile.vue：三处 field-display 的 @tap 从"整行触发"改为"仅空值触发"（!value && startEditField），有值字段右侧包一层 field-actions，内含 field-edit 铅笔按钮与 field-clear 删除按钮',
          'pages/settings/sub/profile.scss：新增 .field-actions（flex+gap 4rpx）与 .field-edit（padding 8rpx、opacity 0.4），与 .field-clear 同尺寸小图标',
        ],
      },
    ],
  },
  {
    version: '4.33.0',
    date: '2026-10-18',
    title: '删除"基本信息/生活方式"两张固定卡，字段并入"我的画像"',
    summary: [
      '我的信息页从三张固定卡收敛为一张"我的画像"卡：昵称/性别/生日/职业/所在地/简介/预算/作息/爱好/饮食全部归入画像卡，平铺在三层分组下方',
      '一次性迁移：老用户刷新后，basic/lifestyle 两张卡自动消失，已填值合并进 portrait（标量不覆盖、数组去重合并），不丢数据',
      '记忆自动采纳（suggestProfileAdoption）目标从 basic/lifestyle 统一改为 portrait，AI 抽取的事实/偏好直接写画像卡',
      'addArrayItem 字段不是数组时自动初始化为空数组再追加，行为更健壮；画像卡改为不可删除',
    ],
    categories: [
      {
        title: '数据结构',
        items: [
          'utils/profile.js：createEmptyProfile 默认 cards 从 [basic, lifestyle] 改为 []（portrait 由 profile-seed 注入）',
          'utils/profile.js：新增 migrateLegacyCards(data)，把 basic/lifestyle 卡字段 merge 进 portrait（数组用 Set 去重、标量仅空值才写），merge 完 filter 删除这两张卡',
          'utils/profile.js：getProfile 里"确保 basic/lifestyle 存在"的自动补卡逻辑改为调用 migrateLegacyCards；deleteCard 守卫从 basic/lifestyle 改为 portrait',
          'utils/profile.js：addArrayItem 在 card.fields[field] 不是数组时初始化为 [] 再追加',
        ],
      },
      {
        title: '记忆联动',
        items: [
          'utils/memory/profile-link.js：FACT_RULES（9条）与 PREF_RULES（2条）的 cardId/cardTitle 从 basic/生活方式、lifestyle/基本信息统一改为 portrait/我的画像',
        ],
      },
      {
        title: '测试适配',
        items: [
          'tests/memory-profile.test.js：seedProfile helper 改为确保 portrait 卡存在；所有 lifestyle/basic 引用改为 portrait',
          'tests/memory-governance.test.js：seedProfileField helper 从 lifestyle 改为 portrait，不存在则新建',
        ],
      },
    ],
  },
  {
    version: '4.32.0',
    date: '2026-10-18',
    title: '关系图谱入口内联到标题行 + 内置画像字段重构（补"我怎么做"三层）',
    summary: [
      '关系图谱入口从独立卡片移到"个人信息"标题右边，灰色小胶囊"♡ 关系图谱·N人"，节省一屏高度',
      '内置画像卡字段从 9 个扩到 12 个，与三层分组完全对齐：新增"我怎么做"层（行动原则/产品意识/创业潜力）',
      'ensureProfileSeed 的卡写入逻辑从"存在即跳过"改为 merge：老用户刷新后自动补全新字段，已填的自定义值不被覆盖',
      'seed_v 从 1 bump 到 2，记录内容同步刷新；人生关键词扩为"不要后悔；回头看时不觉得白活了"',
    ],
    categories: [
      {
        title: 'UI 调整',
        items: [
          'pages/settings/sub/profile.vue：删除独立 relations-entry 卡，header-title 行内加 rel-link 小胶囊（心形图标 + "关系图谱·N人"），v-if="enabled" 且 @tap.stop 跳关系图谱',
          'pages/settings/sub/profile.scss：新增 .header-title-row（flex+gap 12rpx）与 .rel-link（22rpx 字、#71717A 字、#F4F4F5 底、20rpx 圆角），深色双通道补 .rel-link { background:#3F3F46; color:#A1A1AA }',
        ],
      },
      {
        title: '内置画像重构',
        items: [
          'utils/storage/profile-seed.js：PROFILE_CARD_FIELDS 从 9 字段扩到 12 字段，按三层分组重排；新增行动原则（以成果为单位/不等待动力/做项目接触用户）、产品意识（先调研需求/从会调用 AI 到能做 AI 系统）、创业潜力（技术壁垒→副业→条件成熟再创业，不裸辞）',
          'ensureProfileSeed 卡写入逻辑改为 merge：卡不存在则新建；已存在则遍历 PROFILE_CARD_FIELDS，只补"缺失或空"的字段，用户已填的非空值不覆盖，并更新 card.updatedAt',
          'PROFILE_SEED_VERSION 从 1 bump 到 2，老用户刷新后自动获得新字段且不丢手改内容',
        ],
      },
    ],
  },
  {
    version: '4.31.0',
    date: '2026-10-18',
    title: '我的信息升级：画像三层分组 + 完整度进度条 + 人生六维概览 + JSON 导出',
    summary: [
      '画像卡字段按「我是谁 / 我要去哪 / 我怎么做」三层分组渲染（参考 Replika、Serenity 人生领域划分），不再 12 字段平铺',
      '顶部开关卡显示完整度百分比与细进度条（已完善 X%，已填/总项）',
      '新增人生六维概览条：职业/财务/家庭/感情/成长/健康，已填实色、未填灰点',
      '底部新增「导出画像 JSON」按钮（H5 下载文件，App/MP 复制到剪贴板），解决 localStorage 换机丢失',
    ],
    categories: [
      {
        title: '我的信息页面',
        items: [
          'pages/settings/sub/profile.vue：新增 PROFILE_GROUPS 三层映射、groupCardFields 分组函数、cardGroups 预计算、LIFE_DIMENSIONS 六维 computed、totalFields/fillPercent 完整度、handleExport 导出函数；模板按分组渲染（hasGroups 分支 vs 平铺分支）、顶部进度条、六维概览条、底部导出按钮',
          'pages/settings/sub/profile.scss：新增 .progress-wrap/.progress-bar/.progress-fill、.life-wheel/.lw-title/.lw-dims/.lw-dim/.dot/.lw-label、.field-group/.group-label、.btn-secondary 浅色样式，深色双通道（H5/App html.theme-dark + MP @media）同步补齐',
        ],
      },
    ],
  },
  {
    version: '4.30.0',
    date: '2026-10-18',
    title: '提示体系收敛：删每日小结卡、计划汇总表改版（今日焦点 + 折叠 + 可关）、提示开关落地',
    summary: [
      '删掉聊天页顶部「每日小结」横条 —— 它讲的今日记录/支出/进行中/打卡，在计划汇总表与简报卡里都有更细的版本，留着就是同一件事说两到三遍',
      '计划汇总表改版：新增「今日焦点」置顶（逾期最久 1 条 + 今天/明天/3 天内到期，最多 4 条）；「今天/明天」独立成组并默认展开，其余分组折叠；统计头从 4 格收成 2 个大数字（已过期 / 今天明天）+ 一行小字；删掉优先级色条（与行内圆点信息重复）；新增本周打卡迷你条',
      '简报卡减行：计划状态从三行（1 行过时 + 最多 2 行快到期）合并成一句「计划：N 项已过期 · M 项快到期」，点名与动作交给汇总表与「看计划」按钮；指标格去掉「连续打卡」格',
      '新增「提示与提醒」页（pages/settings/sub/notify）：计划汇总表 / 进入简报卡 / 应用内提醒 / 应用外通知四个开关，全部并入既有 siji_reminder_settings（不新增存储键）；计划汇总表内也给了「不再自动弹出」与「提示设置」直通入口',
      '计划速览面板新增「查看计划汇总」—— 关掉每日自动弹出后，汇总表仍可从聊天页顶部计划按钮打开',
    ],
    categories: [
      {
        title: '计划汇总表改版',
        items: [
          'utils/plan-summary.js：`buildPlanSummary` 返回新增 `focus`（今日焦点）/ `weekBar`（本周打卡条）/ `stats.todayTodo`；`groups` 插入 `today`（已过期 → 今天/明天 → 进行中 → 待开始 → 已完成）；删除 `priorityBar`；新增导出 `FOCUS_LIMIT = 4` 与 `DUE_SOON_DAYS`（复用 utils/plan-alerts.js 同口径）',
          'utils/plan-heatmap.js：新增 `weekCheckinDays(plans, now)` 返回 7 个逐日标记；抽出 `weekCheckinScan` 让 `weekCheckinSummary` 与它共用同一次扫描（口径单一来源，原返回值 `{ times, days }` 不变，旧断言无需改）',
          'components/plan/PlanSummarySheet.vue：今日焦点区（tag + 色点 + 直达详情）/ 两个大数字 + 一行小字 / 分组折叠（默认只展开「已过期」「今天/明天」，其余点开才展开）/ 本周打卡迷你条 / 底部「不再自动弹出」「提示设置」；emit 新增 `disable-auto`、`open-notify`；深色双通道（H5/App `html.theme-dark`，小程序 `#ifdef MP-WEIXIN` 内 @media）',
        ],
      },
      {
        title: '提示收敛',
        items: [
          'pages/chat/index.vue：删除每日小结卡（import / ref / onShow 分支 / 模板 / 样式全清）；`injectEnterSummary` 接 `briefing` 开关；`maybeShowPlanSummary` 接 `summarySheet` 开关（延迟回调里二次确认）；新增 `disablePlanSummaryAuto` / `openNotifySettings` / `openSummaryFromSheet`；计划速览面板加「查看计划汇总」入口',
          'utils/enter-dialogue.js：`buildPlanAlertLines` 由「逐条点名」改为合并成一句（同时删除只服务于它的 `ALERT_LINE_LIMIT`）；`buildBriefingMetrics` 去掉「连续打卡」格',
          'composables/useDailyBrief.js：整文件删除（`siji_daily_brief_day` 不再写入；已有该键的存量数据不影响任何逻辑）',
        ],
      },
      {
        title: '提示开关',
        items: [
          'utils/reminder/settings.js：新增 `PROMPT_FLAG_DEFAULTS`（summarySheet / briefing / reminderToast，默认全开）、`getPromptFlag(key)`、`setPromptFlag(key, on)`；开关并入 `siji_reminder_settings` 的 `prompts` 字段，只认显式 false 为关，存储异常一律回落「开」',
          'utils/reminder/notifier.js：`showReminderToast` 接 `reminderToast` 开关 —— 4.29.3 把应用内提醒改 toast 时漏掉的开关',
          'pages/settings/sub/notify.vue（新增）+ pages.json 注册：分「进入聊天页」「计划到点」两组，含应用外通知总开关（`siji_reminder_settings.enabled`，此前无任何 UI）',
        ],
      },
      {
        title: '测试',
        items: [
          'tests/plan-summary.test.js：新增「今日焦点排序与上限」「今天/明天成组并从进行中待开始移出」「本周打卡条逐日标记与次数的同一口径」「空数据」四例；原优先级色条用例改为只断言统计分布与行内圆点',
          'tests/enter-dialogue.test.js：状态行断面对齐「计划：3 项已过期 · 1 项快到期」；指标格断言改为 `expense / diary / events`',
        ],
      },
    ],
  },
]
