/**
 * 版本日志数据段：4.10.x（已整合）
 *
 * 由 4.10.0~4.10.7 共 8 条整合为单条（发布前合并降噪，应用尚未发布），
 * 各小版本的明细按主题归并进 categories；原逐版本条目已删。
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V410 = [
  {
    version: '4.10.7',
    date: '2026-10-03',
    title: '4.10.7（整合 4.10.0~4.10.7，发布前合并）：AI 能力拆分 + 深色模式修复链 + 外观弹层重做 + AI 零工具纠偏轮与自检收尾',
    summary: [
      'AI 能力拆分（4.10.0）：11 项可选能力按 5 组开关（utils/ai/features.js 单一事实源），设置页新增「AI 能力」分组卡，注入五处收口（工具过滤/执行器拦截/摘要段/extSection/进入消息），关掉即省 token，安全底座不可关',
      '深色模式三连修（4.10.1~4.10.3）：P0 全页不可见的根因是 :global(html.theme-dark){嵌套} 被 scoped 编译器剥掉子选择器（85 文件 96 处改回 html 前缀直写）；uni.setTabBarStyle 在 H5 是静默 no-op，tabbar 内联只能 DOM 清理；manifest 摘除 app-plus/h5 的 darkmode 框架跟随 + App.vue 补浅色 tabbar 镜像',
      '外观选择改自定义底部弹层（4.10.4）：原生 ActionSheet 不随主题变色，重做为底部弹层（深 #27272A / 浅 #FFFFFF）+ monitor/sun/moon 配套图标；排坑：手写 PNG 编码先验标准向量（crc32 漏 LSB 分支导致全 chunk CRC 恒为同一常量）',
      'AI 零工具纠偏轮（4.10.5）：GLM-5.3 Flash 对三类短消息（不点名打卡/口头问花费/一句多意图）不调工具直接闲聊 —— 提示词补 3 规则 + agent 循环 STRONG_ACTION_RE 命中且零工具时追问一轮（只纠一次，丢弃的首轮回复不推流）；自检口径 bump v5',
      '自检收尾（4.10.6~4.10.7）：work-checkout 语料改绑 checkinPlan 前置 + 缺前置弹窗一键建（测试账单/上班模板）+ 语料网络错误重试一次 + {plan} 排除打卡种子计划 + 账单前置跨近 3 个月合并（query_bill 默认只查当月的坑）；自检实测 28/29（97%），纠偏轮验证生效',
      '测试 90 文件 / 1250 用例全绿（新增 ai-features / agent-nudge / theme-mode 重写守卫）',
    ],
    categories: [
      {
        title: 'AI 能力拆分（4.10.0）',
        items: [
          'utils/ai/features.js（新增）：AI_FEATURES 11 项清单 + FEATURE_GROUPS 5 组 + TOOL_FEATURE_MAP（工具名→能力 id）+ isFeatureOn/setFeatureOn/isFeatureActive（开关 + Key 资源可用性双裁决）；存储键 siji_ai_features，已登记进备份 AI_KEYS',
          'delegate 模式：联网搜索/读网址的开关与 Key 裁决由 search-config/read-config 承担，注册表只转发；legacy 模式：长期记忆开关写穿旧键 siji_memory_enabled（读取侧兼容旧值）',
          '注入收口：agent-transport 的 buildToolList 按 TOOL_FEATURE_MAP 通查过滤；executeTool 对已关能力直接拒绝（模型幻觉调用不落库）；动静摘要/能量感知段、extSection 人脉/演练段、进入消息的下一步与周播报、图片按钮显隐全部接开关',
          '默认全开 —— 升级用户零感知；pages/settings/sub/ai.vue 新增「AI 能力」分组卡（每行能力名 + 说明 + 开关）；tests/ai-features.test.js 10 例',
        ],
      },
      {
        title: '深色模式修复链（4.10.1~4.10.3）',
        items: [
          'P0 根因链（4.10.1）：scoped 组件里裸 .theme-dark 会被 scoper 注入 data-v（挂在 html 永远命不中）→ 4.8.4 改用 :global(html.theme-dark){嵌套子选择器} → uni scoped 编译器对这种形态剥掉全部子选择器，96 处深色块塌缩成裸 html.theme-dark{} 只改 html 自身 → 深色下白底白字整页不可见。修复：85 文件 96 处全部改回 html.theme-dark 元素前缀直写（探针实证 html 开头的选择器 scoper 不注入 data-v）',
          '守卫重写：tests/theme-mode.test.js 不变量改为「html.theme-dark { 一比一配对 + 禁止 :global(html.theme-dark) + 禁止裸 .theme-dark」，三种形态的实证结论写进守卫注释',
          'tabBar 内联卡死（4.10.2）：uni.setTabBarStyle 在 H5 实测是静默 no-op（参数隔离实验连 #FF0000 单参调用都无效），历史内联深色永远压住 CSS —— utils/theme.js 的 applyClass 挂类后直接清 .uni-tabbar 的内联 background-color/backdrop-filter',
          '功能页滑块（4.10.2）：深色下滑块白底而激活文字同为 #FAFAFA，「AI 面板」白字压白滑块 —— functions.scss 两个深色块的 .seg-item.active .seg-text 改 #18181B',
          '浅色点 tab 变深（4.10.3）：manifest 的 darkmode:true（app-plus/h5）让框架跟随系统抢写 theme.json 深色 tabbar 内联，与手动类驱动切换打架 —— 摘除（保留 mp-weixin）+ App.vue 补浅色 tabbar 镜像 !important 规则（html:not(.theme-dark) 系列）',
        ],
      },
      {
        title: '外观弹层重做（4.10.4）',
        items: [
          'pages/settings/index.vue：uni.showActionSheet 替换为 .theme-sheet 自定义底部弹层（三行选项 monitor/sun/moon + 名称/说明/激活对勾，点击蒙层关闭）；样式浅深两套：浅 #FFFFFF + 边框 #E4E4E7，深 html.theme-dark #27272A / 文字 #FAFAFA',
          'components/common/SijiIcon.vue：KNOWN 集合新增 monitor；scripts/gen-monitor-icon.cjs（入库）：Canvas 原语手绘 96×96 RGBA PNG（Lucide monitor 几何 ×4 缩放描边 8px），产出 monitor-v2{,-dark}.png',
          '排坑记录：首版 PNG 三个 chunk 的 CRC 全是同一常量 0x492f023f —— 先冤枉环境（仓库改写），同进程写读对照实验洗清后定位到脚本 crc32 漏写 (c & 1) 分支（无条件异或是收缩映射必收敛到不动点）；教训：手写二进制编码先跑标准向量（IEND CRC 恒为 0xae426082）。另：uni-app 的 <image> 在 H5 编译为 uni-image 自定义元素，调试加载状态要查内层 img.complete/naturalWidth',
        ],
      },
      {
        title: 'AI 零工具纠偏轮（4.10.5）',
        items: [
          '排查定案：闲聊闸门（DATA_HINT_RE 本就命中这些词）与传输层（buildToolList 无条件全量注入）都不是根因 —— 工具一直在模型手上，是 GLM-5.3 Flash 对三类短消息选择直接聊天；提示词早已写明规则仍失效 → 纯提示词不可靠，加确定性兜底',
          'utils/ai/prompt-actions.js：AGENT_TOOL_INSTRUCTION 补 3 规则 —— 花费查询先 query_bill/query_stat、不点名打卡走 query_plan → log_plan_checkin、禁止零工具口头声称完成',
          'utils/ai/agent-loop.js：导出 STRONG_ACTION_RE（打个?卡/记一笔/记一下/记账/花了多少/查一下/改一下/撤销等指令式动词）与 AGENT_NUDGE_TEXT；零工具直接回复且原话命中强指令 → 追问一轮「请先调工具」再继续正常循环；只纠一次；被丢弃的首轮回复不推流（上层 onChunk 累加消费，先推再纠会重复气泡）；回复已带可执行 JSON action 的豁免；cfg.nudge=false 可关',
          '排坑：STRONG_ACTION_RE 首版写「打卡」抓不到「打个卡」（中间隔着"个"），测试先行抓到，改成 打个?卡 —— 中文正则要拿真实原话当测试向量',
          '自检口径 bump v5（EVAL_PROTOCOL_VERSION 4→5，纠偏改变工具序列产出，v4 报告与 v5 不可直接比）；tests/agent-nudge.test.js 8 例',
        ],
      },
      {
        title: '自检收尾（4.10.6~4.10.7）',
        items: [
          'work-checkout-chain 的 needs 从 plan 改绑新前置 checkinPlan（4.10.6）—— 打卡子计划平铺存储（带 parent_id），query_plan 的 items 里看不到，自检页从 getPlanList 直读 childPlans；缺前置弹窗一键按「上班」模板建计划（getPlanTemplates 找 tpl_work → createPlanFromTemplate）',
          'bill-correction 连续三轮跳过的真因（4.10.7）：query_bill 默认只查当月，用户历史账单在往月 —— 自检页账单前置改为跨近 3 个月合并去重；缺前置弹窗一键建 ¥42 测试账单（真实写入需确认，可删）',
          '{plan} 占位符排除打卡命中项（4.10.7）—— 4.10.6 补建的「上班」成了最新计划占掉 {plan}，语料变成「给上班加每天读 20 页」语义拧巴；只剩打卡计划可挑时 plan 槽位宁可空',
          'runCase 对语料网络错误重试一次（800ms）（4.10.6）—— 29 条连发的单条网络错误不再留假失败；v5 实测轨迹：26/29 → 27/29 → 28/29（97%），纠偏轮与前置修复逐轮验证生效',
          '教训沉淀：语料引用的数据必须真实存在（3.7.2 / 4.10.6 两次同一坑），判失败前先分清「模型不行」还是「数据没有」；自检的前置检测要用与模型相同的口径看待数据（工具的默认参数如当月限定、top-5 截断都会让「库里有数据」变成「检测不到」）',
        ],
      },
    ],
  },
]
