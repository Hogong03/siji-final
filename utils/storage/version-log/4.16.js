/**
 * 版本日志数据段：4.16.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 * 注：4.15.x 版本线由并行会话在途开发（TC-028/TC-004 修复），本段 4.16.0 一并吸收其
 * 未提交改动（全量测试绿），版本历史以其实际落地内容为准。
 */

export const V416 = [
  {
    version: '4.16.1',
    date: '2026-10-07',
    title: '功能图标统一重画（plan/bill/diary/edit/calendar）+ 版本历史图标去重 + 功能页图标调大',
    summary: [
      'plan 旧版与 calendar 都是日历图形几乎重复；bill 用 $ 符号不贴合中文场景；diary 与 edit 笔形重复',
      '统一重画为 2px 线性风格：plan→清单待办、bill→钱包、diary→打开的书、edit→笔在方框上、calendar→日历格子；SijiIcon 加 v3 映射，PIL 紧裁剪去四周留白',
      '设置页版本历史图标从 info 改为 clock（与关于思迹的 info 区分）；功能页入口图标 size 从 md 提到 xl',
    ],
    categories: [
      {
        title: '图标优化（4.16.1）',
        items: [
          'static/icons/：新增 plan-v3 / bill-v3 / diary-v3 / edit-v3 / calendar-v3 及对应 -dark.png',
          'components/common/SijiIcon.vue：V3 集合映射，这 5 个图标走 v3 版本路径',
          'pages/settings/index.vue：版本历史图标 info→clock',
          'pages/functions/index.vue：入口卡片图标 size md→xl',
        ],
      },
    ],
  },
  {
    version: '4.16.0',
    date: '2026-10-07',
    title: '4.16.0 测试缺陷收口（TC-004/TC-028）+ UI 第二轮批次：自报信息实时落库、eval 多轮用例、跨月查询、内置徽标、诊断包、简报卡分层升级',
    summary: [
      '实测手册 v4.14.2 两轮暴露的 5 个缺陷全部收口（TC-004 上下文丢失、TC-028 查询口径与误写、内置内容混淆、诊断闭环缺失、多轮回归无法自动化），含并行会话在途的 4.15.x 修复一并落地',
      'TC-004 三层修复：① 提示词补「自报信息必须落库 / 回答前先查画像与历史」两条规则；② 确定性兜底 —— utils/profile-autocapture.js 正则实时提取自报姓名（我叫/叫我/我的名字是 + 2~8 字，疑问句与占位符拒收），AI 回复落定后模型没落库就静默补写 nickname；③ eval 体系支持多轮用例（turns 数组逐轮调用、前文作 history、合并判定）—— TC-004 原话直接进了自检语料',
      'TC-028 两层修复：① 执行器分类查询逐层放宽（精确→互相包含→备注→索引兜底，4.15.x 在途）+ start_date/end_date 跨月日期范围聚合（月份分片自动遍历，最多 36 个月）；② 提示词补「查询为空禁止把提问原话存成记录」；自检语料补两条（多轮自报追问 / 今天吃饭花了多少禁止误写）',
      'UI 第二轮：简报卡分层视觉升级（日期副行/指标药丸 chip/通栏主按钮+箭头）；记录与 Agent 卡片按压态补齐；内置种子记录加「内置」徽标（列表三视图/阅读页/搜索结果）；数据页新增「导出诊断包」（版本/平台/错误队列/存储水位/设置摘要，剪贴板一键导出，隐私红线：不含 Key 与内容）',
      '全量测试 97 文件 / 1338 用例全绿；吸收并行会话 4.15.x 在途改动（bill 查询口径分层放宽、chatHistoryBuilder 上下文重建、trim-history 测试等）',
    ],
    categories: [
      {
        title: 'TC-004 自报信息与上下文（4.16.0）',
        items: [
          'utils/ai/prompt-actions.js：AGENT_TOOL_INSTRUCTION 补两条规则 —— 自报信息必须 smart_update_profile 落库；回答「我叫什么」前先 get_profile 再查历史，禁止直接说「没告诉过你」',
          'utils/profile-autocapture.js（新增）：extractSelfName/shouldAutoCapture 纯函数（我叫/叫我/我的名字是 + 2~8 字；疑问句、占位符、助词拒收；「测试员」负向前瞻豁免）；composables/useChatEngine.js 回复落定后模型没落库就静默补写 nickname（防重复：检查 agent 与 JSON 两路的 smart_update_profile）',
          'utils/ai/eval/runner.js：runCase 支持 turns 多轮用例 —— 逐轮调用 runner、前文作 history 传入、合并全部轮次工具序列判定；网络抖动整段重试一次',
          'utils/ai/eval/cases.js：新增 profile-recall-multiturn（多轮：我叫测试员 → 我叫什么，期望先落库后查询）与 food-query-today（今天吃饭花了多少，禁止 create_diary）两条语料；pages/settings/sub/ai-eval.vue 的 runner 接受 history 参数',
        ],
      },
      {
        title: 'TC-028 查询口径（4.16.0，含 4.15.x 在途）',
        items: [
          'store/executors/bill.js（4.15.x 在途 + 本段补全）：分类查询逐层放宽（精确→互相包含→备注→索引兜底）；新增 start_date/end_date 日期范围 —— 自动遍历范围内月份分片聚合（上限 36 个月）、按范围收紧、消息带范围标注',
          'utils/ai/tools/bill.js：query_bill schema 新增 start_date/end_date 参数，描述同步',
          'utils/ai/prompt-actions.js：查询为空禁止误写规则（见上）',
          'utils/ai/eval/cases.js：food-query-today 语料（toolsAny query_bill/query_stat + forbid create_diary）',
        ],
      },
      {
        title: 'UI 第二轮（4.16.0）',
        items: [
          'components/chat/EnterBriefing.vue：分层视觉升级 —— 问候下加日期副行（X 月 X 日 周X HH:MM）、指标格改药丸 chip、主按钮通栏化 + 箭头，深色块同步',
          'pages/diary/list.vue + list.scss：三视图卡片加心情小表情（mood 1~5 → 😞😕😐🙂😄）与「内置」徽标；按压态补齐（浅 #F4F4F5 / 深 #3F3F46）',
          'pages/settings/sub/agent.scss：Agent 卡按压态补齐（浅 opacity 0.85 / 深 #3F3F46）',
          'utils/seed-records.js（新增）：isSeedRecord 前缀判定（tip_cet6_/mat_cet6_）+ pages/diary/read.vue、pages/search/result.vue 内置徽标',
          'utils/diag-bundle.js（新增）：collectDiagBundle/buildDiagText 诊断包（版本/平台/错误队列 50 条/存储水位/会话数量/设置摘要）—— pages/settings/sub/data.vue 新增「导出诊断包」剪贴板导出；隐私红线：不含 API Key、对话正文、记录与画像内容（测试断言锁死）',
        ],
      },
    ],
  },
]
