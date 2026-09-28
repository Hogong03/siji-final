/**
 * 版本日志数据段：2.3.21 - 2.3.10（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V23_LATE = [
  {
    version: '2.3.21',
    date: '2026-09-03',
    title: '备份适配微信：保存文件为主推，复制拆成生活/AI/聊天三分份并加体积护栏',
    summary: [
      'pages/settings/sub/data.vue：备份入口改为「保存为文件（推荐）/分份复制」；分份复制把备份拆为生活数据/AI 记忆/聊天记录三段，逐份写入剪贴板（微信粘贴超长文本会崩溃）',
      'utils/storage/export.js：exportBackup/exportBackupJson 支持 section=life|ai|chat 分域导出，meta 记录 section',
      '恢复页自动识别分域备份并合并写入（不清除其他部分），全量备份仍为覆盖式恢复',
      '复制前按 UTF-8 字节估算体积，超限（聊天 300KB、其余 800KB）拦截并提示改用保存文件'
    ],
    categories: [
      {
        title: '备份与恢复',
        items: [
          '问题：备份全部数据复制后粘贴到微信「文件传输助手」导致微信崩溃、粘贴失败——根因是单次剪贴板文本过大（聊天记录是主要体积来源）',
          '导出拆域：siji_conversations 等聊天键归 chat；记忆/画像/Agent 归 ai；记录/账单/计划/关系等归 life；三份数据互斥、可拼回全量',
          '文件备份保持全量（无剪贴板限制）；复制路径一次只写一份，提示用户到微信粘贴后返回再复制下一份',
          '分域恢复：粘贴内容带 meta.section 时自动合并写入对应部分，不再清空其他数据；多份分域备份逐份粘贴即可完整恢复',
          'tests/backup.test.js：新增 3 条分域用例（chat 隔离、三份互斥可拼回、分域 JSON 可解析）'
        ]
      }
    ]
  },
  {
    version: '2.3.20',
    date: '2026-09-03',
    title: 'W1 数据安全：全量备份（复制/落盘）+ 粘贴恢复，告别"假导出"',
    summary: [
      'utils/storage/export.js：新增 exportBackup/exportBackupJson/parseBackup/importBackup，全量快照所有业务存储键（含记忆/画像/对话/关系/Agent），排除 API Key/索引/锁等敏感与可重建数据',
      'utils/backup-file.js：跨端保存备份文件（App 写 _doc/backup/、H5 浏览器下载、小程序提示复制）',
      'pages/settings/sub/data.vue：数据管理改为「备份全部数据」（复制文本/保存文件）+「恢复备份」（粘贴校验→确认覆盖→写回），CSV 报表改为复制输出'
    ],
    categories: [
      {
        title: '全量备份与恢复',
        items: [
          '用户诉求（W1）：自用阶段数据安全第一——原"导出"只把 JSON 塞回本地 storage，用户拿不到文件，且只有记录/账单/计划三样，且无导入',
          'exportBackup：遍历 storage 快照全部业务 key（diary_*/bill_*/plan_all/siji_*）；黑名单排除 siji_provider_keys/siji_api_key/siji_index/siji_pin*/siji_export_*/离线队列等；meta 记录版本与备份格式号',
          'parseBackup：三项校验（空内容/JSON 解析失败/非思迹备份/缺 storage），UI 先校验再弹覆盖确认',
          'importBackup：逐 key 写回（isBackupKey 白名单前缀防恶意 key 注入），返回写入/跳过统计',
          '备份文件跨端：App 写 _doc/backup/siji-backup-*.json（可配合复制双保险）；H5 Blob 下载；小程序提示走复制',
          '恢复流程：粘贴 → 校验 → 确认（提示将清空当前数据）→ clearStorageSync → 写回 → 提示重启 App 并重配 AI Key',
          'tests/backup.test.js：新增 5 条用例（导出范围/排除项/非法备份拒绝/恶意 key 注入隔离/JSON 字符串导入）'
        ]
      }
    ]
  },
  {
    version: '2.3.19',
    date: '2026-09-03',
    title: '图标资源改名 -v2 修复 App 端同名缓存不刷新，新增图片改名规范',
    summary: [
      'static/tab 6 个 + static/icons provider 5 个 + agent 10 个共 21 张图片全部追加 -v2 后缀并同步更新全部引用',
      '存量 Agent 旧 icon 路径兼容：utils/agent-templates.js 新增 normalizeAgentIcon()，渲染与编辑回填时自动映射旧路径',
      'AGENTS.md 新增「图片资源」约定：以后每次更换图片必须同时改名并更新引用'
    ],
    categories: [
      {
        title: '图片资源改名',
        items: [
          '用户诉求（2026-09-03）：更新后的图片在 App 端未生效（同名缓存），更换图片名字并形成改名习惯',
          'tabBar：chat/functions/settings（含 active 态）6 张 → -v2，pages.json 引用同步更新',
          '厂商 logo：provider-ds/oa/ms/zg/qw 5 张 → -v2，6 处动态拼接（UnifiedSwitcher/ProviderSwitcher/ModelSwitcher/chat 页/settings 页/ai 设置页）同步更新',
          'Agent 头像：agent-siji/workplace/relationship/career/psychologist/fitness/finance/study/minimal/custom 10 张 → -v2，store/agent.js 与 utils/agent-templates.js 默认值更新',
          '存量兼容：AGENT_ICON_V2 映射表 + normalizeAgentIcon()，老用户 storage 中的旧路径自动归一化，AgentAvatar 与 agent_add 编辑回填均走归一化',
          'AGENTS.md：新增「图片资源」小节——换图必须改名（-v2/-v3 后缀）、全局更新引用、rg 检查无旧名残留'
        ]
      }
    ]
  },
  {
    version: '2.3.18',
    date: '2026-09-01',
    title: '整合智能映射：已知事实按内容归入对应分组，分组不存在自动新建',
    summary: [
      'utils/memory.js：新增 8 条已知事实映射规则（生日/性别/职业/所在地/昵称/预算/作息），识别后自动归入基本信息或生活方式分组',
      '整合写入升级：分组已存在直接填入（数组追加、标量覆盖），不存在时按预览中的分组名自动新建',
      '整合预览：每条可编辑分组/字段名/内容，目标字段已有值时提示「已存在：X，将更新」'
    ],
    categories: [
      {
        title: '整合智能映射',
        items: [
          '用户诉求（2026-09-01）：对全部已知事实重新整合存入我的信息，分组存在则填入或修改，不存在则新建分组',
          'FACT_RULES 规则表：生日→basic.birthday、性别→basic.gender、在X工作→basic.occupation、住在X→basic.location、我叫X→basic.nickname、月预算→lifestyle.budget、作息/每天X点睡→lifestyle.sleepTime',
          'adoptMemoryToProfile：支持 cardTitle 参数，按 cardId → cardTitle → 新建 三级定位分组；新分组自动创建并写入',
          'integrateMemoriesToProfile：items 增加 cardId/cardTitle 透传，单条与批量共用同一套分组定位逻辑',
          'pages/settings/sub/memory.vue：整合预览新增「分组」输入框（预填建议分组），字段已有值时显示琥珀色「已存在：X，将更新」提示',
          'tests/memory-profile.test.js：新增 5 条用例（事实映射、自动建分组、数组追加、标量覆盖、批量混合场景）'
        ]
      }
    ]
  },
  {
    version: '2.3.17',
    date: '2026-09-01',
    title: '记忆批量整合到画像：全部/自由选择，预览可编辑后确认写入',
    summary: [
      'pages/settings/sub/memory.vue：新增「整合到画像」，支持全部整合与勾选整合，预览弹窗可编辑字段名与内容，确认后写入我的信息',
      'utils/memory.js：新增 getUnadoptedMemories / integrateMemoriesToProfile，批量写入画像并标记已采纳',
      '记忆列表：已整合记忆显示「已整合」标签，选择模式下勾选圆框交互'
    ],
    categories: [
      {
        title: '记忆整合功能',
        items: [
          '用户诉求（2026-09-01）：记忆管理页支持全部整合或自由选择整合，把记忆汇总编入我的信息',
          '入口：记忆管理页底部新增「整合到画像」按钮，点击弹出全部整合/选择整合；无未采纳记忆时提示',
          '自由选择：进入勾选模式，点记忆左侧圆框多选，底部显示「整合所选 (N)」，可取消选择',
          '整合预览：列出每条记忆与建议映射（喜欢/爱好→hobbies，不吃/讨厌→dietary，其余默认「备注」），字段名与内容均可编辑',
          '确认整合：逐条写入 lifestyle 分组并标记 adoptedToProfile，toast 告知成功/跳过数量；已整合记忆不再出现在可整合列表',
          'tests/memory-profile.test.js：新增 4 条批量整合回归用例'
        ]
      }
    ]
  },
  {
    version: '2.3.16',
    date: '2026-09-01',
    title: '记忆与画像联动：偏好一键采纳进画像，结构化去重替代关键词误伤',
    summary: [
      'pages/settings/sub/profile.vue：新增「AI 学到的偏好」区块，preference 记忆可一键采纳写入画像，采纳后不再重复注入记忆',
      'utils/memory.js：画像去重升级为字段值结构化匹配 + 通用词噪声过滤，修复画像含「喜欢」即误过滤全部相关记忆的问题',
      'store/executors/profile.js：AI 通过 smart_update_profile 写入画像后自动标记同内容记忆为已采纳，消除同一偏好双份存在'
    ],
    categories: [
      {
        title: '记忆与画像联动',
        items: [
          '用户诉求（2026-09-01）：记忆管理与我的信息是否可整合；结论：保持双库 + 强化联动（方案 A）',
          '画像页新增「AI 学到的偏好」只读预览（最多 5 条）：采纳按钮自动识别句式（喜欢/爱好→hobbies，不吃/讨厌→dietary），无法识别时弹窗手动输入字段名写入 lifestyle 分组',
          'adoptedToProfile 标记：采纳或 AI 写画像后标记记忆，buildMemoryContext 不再注入，从源头消除同一偏好的重复上下文',
          'buildMemoryContext 去重升级：逐卡片字段值包含匹配，过滤「喜欢/爱好/讨厌」等噪声词，不再用整段画像文本正则提取 ≥2 字片段（原逻辑误伤率高）',
          'pages/functions/index.vue：记忆管理入口常显，记忆关闭后仍可进入重新开启'
        ]
      }
    ]
  },
  {
    version: '2.3.15',
    date: '2026-09-01',
    title: '修复放弃编辑重复弹窗：navigateBack 二次触发 onBackPress 死循环',
    summary: [
      'pages/diary/detail.vue：新增 leaveConfirmed 标志，放弃/保存/删除后放行返回，不再重复弹出「放弃编辑？」',
      'pages/bill/edit.vue：同类修复，确认放弃后置标志再返回'
    ],
    categories: [
      {
        title: '返回拦截修复',
        items: [
          '用户诉求（2026-09-01）：新建记录写了内容退出，点击「放弃」后重复跳出放弃选项',
          '根因：uni.navigateBack() 会再次触发 onBackPress（from=navigateBack），此时 isDirty 仍为 true → 弹窗再次弹出且 return true 阻止返回，形成死循环',
          'pages/diary/detail.vue：goBack() 统一置 leaveConfirmed = true，onBackPress 首行放行；覆盖保存成功、删除、类型选择器返回所有返回路径',
          'pages/bill/edit.vue：确认放弃时置 leaveConfirmed = true 再 safeNavigateBack()，避免同类循环',
          'pages/plan/detail.vue 已有 saved 标志，不受影响'
        ]
      }
    ]
  },
  {
    version: '2.3.14',
    date: '2026-09-01',
    title: '记录自动标题生成 + 长文显示防溢出',
    summary: [
      'store/executors/diary.js：create_diary 自动提炼简短标题（AI 传占位词/标题=正文/单行长文时），update_diary 只改正文且旧标题无意义时同步提炼',
      '聊天执行结果卡片与记录列表：预览文本压平换行 + 固定两行高度截断，App 端 -webkit-line-clamp 失效时不再撑爆屏幕'
    ],
    categories: [
      {
        title: '记录标题生成',
        items: [
          '用户诉求（2026-09-01）：AI 写的记录不自动生成标题；记录内容太长超出屏幕显示范围',
          'store/executors/diary.js：新增 autoDiaryTitle()——多行正文取首行作标题（首行过长提炼）；单行短句（≤10 字）直用；单行长文去开头修饰词取第一分句（≤20 字）',
          'AI 传 title 时校验：标题≠正文、非"记录/日记/心情"等占位词、≤30 字才直接采用，否则自动提炼，避免"标题=正文开头 50 字"',
          'update_diary：只改 content 且旧标题为空/占位词/与旧正文重复时，自动提炼新标题并写回',
          'tests/executors.test.js：新增 3 条回归用例（单行长文提炼、占位标题提炼、更新时标题同步）'
        ]
      },
      {
        title: '长文显示防溢出',
        items: [
          'components/chat/ExecResultCard.vue + .scss：记录预览压平换行并截断 50 字，样式由 -webkit-line-clamp 改为 max-height + overflow:hidden（跨端可靠，App 端不再被长文撑爆）',
          'pages/diary/list.vue + list.scss：列表/日历/搜索结果三处预览统一压平换行，卡片预览固定两行高度 + word-break',
          'query_diary 结果列表 qi-preview：压平换行 + 两行高度限制'
        ]
      }
    ]
  },
  {
    version: '2.3.13',
    date: '2026-08-30',
    title: '执行结果卡片去编辑化：标题不可就地编辑，跳转按钮与标题同行',
    summary: [
      'components/chat/ExecResultCard.vue：移除标题/金额就地编辑（双击卡片、头部 ✎ 按钮、编辑表单全部下线），卡片只保留跳转入口',
      '跳转按钮「查看 →」与标题同行并置右（bill/diary/plan 标题行内嵌；query/profile 等类型保留头部图标 + 跳转按钮）',
      'components/chat/MessageBubble.vue / pages/chat/index.vue / composables/useMessageEdit.js：删除 isEditing 透传与编辑保存逻辑，标签编辑与同步功能保持不变'
    ],
    categories: [
      {
        title: '执行结果卡片优化',
        items: [
          '用户诉求：AI 执行结果卡片不能在输入框编辑标题，只保留跳转按钮，按钮与标题平级且位于卡片最右侧',
          'ExecResultCard.vue：props 去掉 isEditing，emits 去掉 start-edit/save-edit/cancel-edit；删除 onCardTap 双击编辑、initEditForm/localForm/watch、edit-card 编辑表单区块',
          'bill 卡片：金额 + 分类标签 + 「查看 →」同行；diary 卡片：标题 + 「查看 →」同行（标题超长省略）；plan 卡片：优先级点 + 标题 + 「查看 →」同行',
          'query_*/profile/relation/decision 等无标题卡片：保留原类型图标头部，仅去掉 ✎ 编辑按钮，跳转按钮移至头部最右侧',
          'MessageBubble.vue：合并 isEditing 双分支为单分支渲染；index.vue 移除 start-edit/save-edit/cancel-edit 事件绑定；useMessageEdit.js 只保留 handleUpdateTags/syncAllMessageTags',
          '标签功能（tag-section / 标签面板）不受影响，仍可编辑 diary/plan 标签'
        ]
      }
    ]
  },

  {
    version: '2.3.12',
    date: '2026-08-30',
    title: '修复对话标签修改报错：store/index.js 补全标签方法映射',
    summary: [
      'store/index.js：补全 addTagToConversation / removeTagFromConversation / setConversationTags 三个方法映射（chat.js 已实现并导出，聚合入口漏映射导致 useConversationManager 调用时报 addTagToConversation is not a function）',
      'store/aiConfig.js：条件编译块内两个同名 const decoded 拆分为 decodedH5/decodedNative，修复 vitest 直接加载源码时的重复声明（三端编译行为不变）'
    ],
    categories: [
      {
        title: '对话标签修复',
        items: [
          '复现路径（H5 控制台报错）：对话管理 → 为对话添加标签 → 点击确定（新建标签弹窗确认）→ TypeError: store.addTagToConversation is not a function @ useConversationManager.js:164',
          'store/index.js：renameConversation 之后补 addTagToConversation / removeTagFromConversation / setConversationTags（均透传 chat store），新建标签与选择已有标签两条路径恢复可用',
          'store/aiConfig.js：旧格式 API Key 迁移逻辑中 #ifdef H5 / #ifndef H5 两个分支的 const decoded 重名，改为 decodedH5 / decodedNative 后统一取值，vitest 可直接加载',
          'tests/bugfix-regression.test.js：新增会话标签映射回归用例，全量 237 用例通过'
        ]
      }
    ]
  },
  {
    version: '2.3.11',
    date: '2026-08-30',
    title: '修复记录标题与内容相同：create_diary 自动提取简短标题',
    summary: [
      'store/executors/diary.js：AI 把同一句话同时写入 title 和 content 时（title===content），自动从正文提取简短标题（去开头修饰词 → 取第一分句 → ≤20 字）',
      'prompt 已禁止模型传 title（正文放 content、首行作标题），本次为 executor 层防御性兜底，历史误数据不受影响'
    ],
    categories: [
      {
        title: '记录标题修复',
        items: [
          '复现场景（开发者反馈 2026-08-30）：用户说"记录"，AI 生成 create_diary 时 title 与 content 均为"今天打算在家打王者荣耀，目标是用上官婉儿冲击金标。"，导致标题=正文、等于没有标题',
          'store/executors/diary.js：新增 deriveShortTitle()，去除"今天/打算/在家/我"等开头修饰词后取第一分句为标题（示例：→"打王者荣耀"），content 保持完整原文',
          '仅当 title===content 时触发；AI 传独立 title、多行正文首行作标题、content 为空 title 兜底三种既有行为不变',
          'tests/executors.test.js：新增回归用例，全量 236 用例通过'
        ]
      }
    ]
  },
  {
    version: '2.3.10',
    date: '2026-08-30',
    title: '图片识别清晰度优化：压缩参数 1024px/80 提升到 1568px/90',
    summary: [
      'utils/image.js：MAX_SIZE 1024 → 1568、QUALITY 80 → 90，聊天截图等小字图片识别清晰度显著提升（开发者反馈：AI 回复"图太糊了，完全认不出字来"）',
      'H5 端 1MB 渐进降质兜底保持不变（90→40 逐级降），App/小程序 uni.compressImage 同步使用新参数'
    ],
    categories: [
      {
        title: '识别清晰度优化',
        items: [
          '复现路径：iOS 发聊天截图 → 压缩到 1024px/80 → DeepSeek V4 Flash Vision(实验) 识别 → "图太糊了，完全认不出字来"',
          'utils/image.js：MAX_SIZE 1024 → 1568（最长边），小字截图保留更多细节',
          'utils/image.js：QUALITY 80 → 90，降低 JPEG 伪影对文字笔画的影响',
          'buildVisionMessage 的 detail 判断（>1024 传 high）随新尺寸自动生效，无需改动',
          '文件大小约束不变：H5 端仍以 1MB 为上限渐进降质，App/小程序无二次降质'
        ]
      }
    ]
  },
]
