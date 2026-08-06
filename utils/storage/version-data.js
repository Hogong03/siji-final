/**
 * 版本历史默认数据（内置版本日志）
 *
 * 纯数据文件，从 version-history.js 拆出
 */

export function getDefaultHistory() {
  return [
    {
      version: '2.0.0',
      date: '2026-08-05',
      title: 'Agentic Loop 智能体 + 计划全面升级 + 阶段化计划',
      summary: [
        'AI 升级为智能 Agent：可多次调用工具、基于本地数据库结果继续推理',
        '计划功能全面优化：列表/详情/统计/模板/回收站/看板/AI 增强',
        '阶段化计划：大目标拆为 2-6 阶段，含里程碑+时间窗口',
        '死代码清理 + 代码拆分（reminder/chat/bill/version-history）'
      ],
      categories: [
        {
          title: 'Agentic Loop（工具循环）',
          items: [
            'AI 从单轮返回 action 升级为可多次调用工具、基于结果继续推理',
            '新建 tools.js：24 个 OpenAI 兼容 function schema（记录/账单/计划/画像/关系/决策）',
            '新建 agent-loop.js：工具循环引擎（maxRounds=5 防死循环，结果截断 2000 字符）',
            '查询结果格式化为自然语言回传 AI（query_bill→"共15笔¥3,240，餐饮¥1,240"）',
            '四家厂商（DeepSeek/智谱/通义/Moonshot）均启用 supportsToolCalling',
            '向后兼容：旧 JSON action 格式仍可执行，不支持 function calling 的厂商走原路径',
            '安全边界：破坏性工具（undo/delete）不自动执行，转人工确认'
          ]
        },
        {
          title: '计划功能全面优化',
          items: [
            '列表页：搜索+状态/优先级/标签三维 AND 筛选+左滑手势+看板视图',
            '详情页：父计划关联+优先级/状态选择+重复提醒+AI 工具栏（排期/复盘/下一步）',
            '回收站：搜索+恢复+彻底删除+全部恢复',
            '统计页：11 个卡片（总览/优先级/状态/趋势/速度/子任务/完成率/标签/过期/热力图）',
            '模板：搜索+分类筛选+编辑/删除/另存为+AI 定制',
            '看板视图：待开始/进行中/已完成三列跨列切换',
            '日期快捷选择：今天/明天/本周末/下周一/一周后/一月后'
          ]
        },
        {
          title: '阶段化计划',
          items: [
            'plan 新增 phases 数组（id/title/description/start_date/end_date/milestones/subtasks）',
            '新建 usePlanPhases.js：阶段 CRUD + AI 深度拆解（2-6 阶段，每阶段含子任务+里程碑+时间窗口）',
            '详情页阶段化 UI：可折叠阶段区块+里程碑+日期选择器+AI 阶段化拆解按钮',
            '有 phases 时隐藏普通子任务区块（互斥）',
            '统计页 subtaskStats 兼容阶段化子任务聚合',
            'prompt-builder CORE_ACTIONS 新增 create_plan_phases / update_plan_phase',
            '向后兼容：旧计划无 phases 不受影响'
          ]
        },
        {
          title: '代码拆分与清理',
          items: [
            'reminder.js 351→55行 + 4 子模块（settings/triggered/notifier/scheduler）',
            'store/chat.js 339→170行 + 2 子模块（persist.js + restore.js）',
            'bill/index.vue 441→190行 + 2 composable（useBillList + useBillSwipe）',
            'version-history.js 319→86行 + version-data.js（纯数据）',
            '死代码清理：14 个文件移至 .trash/（8 旧账单组件+PlanQuickActions+PlanCard.scss+VirtualList+api-key-store.js+2 py 脚本）',
            'SijiIcon 补 more/chat 图标'
          ]
        }
      ]
    },
    {
      version: '1.3.0',
      date: '2026-08-04',
      title: '记录4.0 + 记账5.0 + 计划UI + 体验优化',
      summary: [
        '记录4.0：分类/全局搜索/日历/图片/回收站 + 列表工具栏统一',
        '记账5.0：布局重构/跨月搜索/回收站/年度统计/分类预算',
        '计划UI升级 + 版本历史列表+详情子页面'
      ],
      categories: [
        {
          title: '记录功能 4.0',
          items: [
            '分类系统：树状两级分类，筛选面板集成',
            '全局搜索：全部时间选项，跨月搜索所有记录',
            '日历视图：热力图展示每日记录密度',
            '图片附件：压缩→base64→存储→渲染→预览全链路',
            '回收站：软删除+恢复+彻底删除+搜索+时间筛选',
            'AI 润色：一键优化文字表达',
            'AI 提取待办：从记录内容提取待办事项',
            'AI 情绪分析：分析记录中的情绪倾向',
            '列表工具栏统一：搜索框+时间折叠+筛选+回收站一行',
            '四维AND筛选：搜索+时间+分类+标签同时生效',
            '搜索状态回显条：激活条件可单独清除',
            '去掉VirtualList改普通scroll-view（月度数据量不需要）',
            '统计卡片：记录数、活跃天数、总字数'
          ]
        },
        {
          title: '记账功能 5.0',
          items: [
            '布局重构：6层合并3层（概览+工具栏+列表）',
            '跨月搜索：全部时间选项，四维AND筛选',
            '账单回收站：软删除+恢复+彻底删除',
            '年度统计：12月趋势、Top5消费排行、消费洞察',
            '分类预算：按分类设预算，超支红色预警',
            '定期账单模板：周期账单到期提醒',
            '编辑页优化：键盘收紧、分类5列、快捷备注横滑',
            '概览卡片：支出/收入/结余+预算进度+统计入口'
          ]
        },
        {
          title: '计划功能',
          items: [
            'UI 升级：按钮颜色统一黑白灰，状态标签可见性修复',
            '保存后放弃编辑弹窗修复（saved标志位）',
            'CSS 变量清零，全量硬编码+深色模式适配',
            '激活态统一黑白反色填充，不再用var(--color-ai)'
          ]
        },
        {
          title: '聊天与AI',
          items: [
            'AI 聊天复制功能恢复：显式复制按钮替代长按',
            'AI 记录增强：润色、提取待办、情绪分析',
            'GuideModal 路由修复：/pages/settings/about → /pages/settings/sub/about'
          ]
        },
        {
          title: '设置与体验',
          items: [
            '体验反馈页面：提交按钮固定底部，适配安全区',
            '版本历史功能上线：列表页（摘要）+详情子页面（分类折叠）',
            '首次使用引导 OnboardingGuide（4步全屏向导）'
          ]
        }
      ]
    },
    {
      version: '1.2.1',
      date: '2026-08-04',
      title: '记录列表搜索+时间折叠+回收站对齐',
      summary: [
        '记录列表工具栏一行：搜索框+时间折叠+筛选+回收站',
        '四维AND筛选统一（搜索+时间+分类+标签）',
        '回收站增加搜索+时间筛选，与列表页一致'
      ],
      categories: [
        {
          title: '记录列表',
          items: [
            '工具栏一行：搜索框(flex:1)+时间按钮(月份▼)+⚙筛选+🗑回收站',
            '搜索+时间+分类+标签四维AND同时生效',
            '搜索状态回显条：激活条件可单独清除+一键清除',
            '时间折叠：搜索框下方折叠按钮，选完自动收起',
            '去掉VirtualList改普通scroll-view+v-for',
            '卡片间距收紧：margin-bottom 10rpx、padding 20rpx 24rpx'
          ]
        },
        {
          title: '回收站',
          items: [
            '增加搜索框+时间折叠chips',
            '全部时间模式：遍历所有分片合并',
            '搜索状态条+完整日期显示'
          ]
        },
        {
          title: '导航栏',
          items: [
            '自定义导航栏实验→改回原生导航栏（4分钟反复）',
            '教训：原生导航栏更简单可靠，非强定制不值得'
          ]
        }
      ]
    },
    {
      version: '1.2.0',
      date: '2026-08-03',
      title: '记录 3.0 全量升级',
      summary: [
        '记录列表/详情页拆分重构，新增即搜、统计、时间线视图',
        'AI 摘要、关联推荐、关联账单、语音按钮',
        '聊天页首次进入空白修复'
      ],
      categories: [
        {
          title: '记录列表重构',
          items: [
            'list.vue 339→117行，拆分到 useDiaryList.js',
            'detail.vue 441→235行，拆分到 useTagPicker.js + useDiaryRelations.js',
            '新增即搜功能：输入关键词实时过滤',
            '统计卡片：记录数、活跃天数、总字数',
            '标签统计：按标签聚合查看',
            '时间线视图：按日期分组展示'
          ]
        },
        {
          title: 'AI 能力增强',
          items: [
            'AI 摘要：一键生成记录摘要',
            '关联推荐：智能推荐相关记录',
            '关联账单：记录与账单关联展示',
            'summarize_diaries executor',
            'query_combined executor'
          ]
        },
        {
          title: '其他',
          items: [
            '语音按钮（仅录制，识别待接入）',
            '模板入口：快速套用记录模板',
            '聊天页首次进入空白修复（onShow 守卫+滚动重试）'
          ]
        }
      ]
    },
    {
      version: '1.1.0',
      date: '2026-07-31',
      title: '品牌定制 + 引导系统 + 图片链路',
      summary: [
        'Agent 系统新增预设角色',
        '首次使用引导 OnboardingGuide',
        '图片功能全链路 + 流式打字机优化'
      ],
      categories: [
        {
          title: 'Agent 系统',
          items: [
            '新增预设角色',
            'Agent 绑定人设不绑定模型'
          ]
        },
        {
          title: '引导与体验',
          items: [
            '首次使用引导 OnboardingGuide（4步全屏向导）',
            'storage 标记 siji_onboarding_done 避免重复展示',
            '修复引导页崩溃：删除 JS 内 isDark/onThemeChange'
          ]
        },
        {
          title: '图片与流式',
          items: [
            '图片压缩：≤1MB/≤1024px/质量80渐进降质至40',
            'base64 传递→异步写文件系统',
            'App: _doc/siji_images/，MP: USER_DATA_PATH，H5: Blob 下载',
            '流式打字机：displayQueue + requestAnimationFrame 逐帧渲染',
            '等待回复 loading 动画修复'
          ]
        },
        {
          title: '样式与适配',
          items: [
            '全项目 CSS 变量穿透修复（22个 fixed 组件硬编码）',
            '深色模式 full 适配',
            'linear-gradient 清零',
            '全项目 var(--) 残留清零'
          ]
        }
      ]
    },
    {
      version: '1.0.0',
      date: '2026-07-14',
      title: '思迹初版上线',
      summary: [
        'AI 对话核心引擎（多厂商支持）',
        '记录、记账、计划三大功能模块',
        '纯黑白极简设计语言'
      ],
      categories: [
        {
          title: 'AI 对话引擎',
          items: [
            '多厂商支持：DeepSeek/智谱/通义/Moonshot',
            'Agent prompt 引导层策略',
            '三层空回复兜底（response_format→重试→前端正则截断）',
            'API Key 加密存储（XOR+Base64）',
            '多厂商注册表 + supportsJsonFormat 标记',
            '旧版模型名自动迁移表'
          ]
        },
        {
          title: '功能模块',
          items: [
            '记录：创建/编辑/删除/搜索/标签',
            '记账：收支记录/分类统计/月度概览/预算',
            '计划：优先级/状态/子任务/标签/截止日期'
          ]
        },
        {
          title: '设计语言',
          items: [
            '纯黑白（#000000 / Zinc 灰阶）',
            '零渐变、零模糊、零阴影',
            'SijiIcon 组件 + SijiChart 图表'
          ]
        }
      ]
    }
  ]
}
