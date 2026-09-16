/**
 * 版本日志数据段：3.7.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V37 = [
  {
    version: '3.7.0',
    date: '2026-09-16',
    title: '3.7.0 AI 效果自检：22 条真实语料跑一遍，改提示词第一次有数字对照',
    summary: [
      '设置 → AI 效果自检：把历史反馈里的 22 条真实语料逐条真请求一遍模型，看它「选了什么工具、顺序对不对」，出通过率 —— 过去六轮都在加提示词规则（BEHAVIOR_RULES 7 条 → 10 条铁律 + 纠错主动权），但旧回归集只能断言「提示词里写了这句话」，证明不了模型照做，你的体感一直没变',
      '干跑模式（不污染数据）：新增 cfg.dryRun —— 只记录要调什么工具、什么参数，不落库、不发网络请求（web_search / read_url 也换占位结果）；默认设置下写操作还要过确认闸门，自检不可能写进真实数据',
      '22 条语料覆盖你排在前面的痛点：计划变更不许新建（先查后改）、自定义属性新增与修改、错别字容忍、口头时间从原话算（昨天/前天）、一句话两个意图拆开、大额记账走确认、记错了先查后改、网址后面粘中文只读网址（3.6.2 回归点）、闲聊一个写操作都不许调',
      '逐条可展开：原话 / 期望 / 实际工具链 / 未通过原因 / AI 回复节选；一键复制失败明细，直接发给我定位；同一批语料用 temperature 0 跑，批次之间可比',
      '工程：utils/ai/eval/cases.js（语料，纯数据，日期现算不写死）+ utils/ai/eval/runner.js（判定与编排，纯函数，不碰 store）+ pages/settings/sub/ai-eval.vue；新增 25 例测试（含干跑不写数据、确认闸门、脚本化回复跑完整套语料的对照用例）'
    ],
    categories: [
      {
        title: 'AI 效果自检（3.7.0）',
        items: [
          '动因：用户排序里「话语拆解与纠错」一直排第一，3.0 / 3.1 多次加固（BEHAVIOR_RULES / 纠错主动权 / vision-bridge）后仍排第一，说明效果未达预期；docs/思迹产品规划问答纪要_20260906.md 的结论是「下一步不是继续加规则，而是先建纠错回归集」——本次把它落成可跑分的东西',
          '旧口径的短板：tests/correction-regression.test.js 是静态回归（assert BEHAVIOR_RULES / CORE_ACTIONS 包含某句提示词），只能证明规则写了，证明不了模型照做；改动提示词后没有任何数字能说明变好还是变坏',
          'utils/ai/eval/cases.js（新增）：EVAL_CASES 22 条真实语料（来自历史开发者反馈的原话），断言语义 —— tools 必须全出现 / toolsAny 至少一个 / forbid 一个都不许 / order 先查后改 / args 参数校验（含网址不得带中文、bill_date 必须等于昨天与前天）/ confirm 是否走闸门 / replyIncludes 与 replyExcludes；dayStr(offset) 现算相对日期，不写死日期（写死会在特定日子假失败）',
          'utils/ai/eval/runner.js（新增，纯函数）：judgeCase 逐条判定并给出人话原因；runCase 单条（模型抛错记成 error，不打断整批）；runCases 顺序跑 + 进度回调 + stopRef 停止标志；summarizeResults 出通过率与耗时；formatFailureReport 生成可复制的失败明细',
          'utils/ai/agent-loop.js：新增 dryRunResult 与 cfg.dryRun —— 查询分支（web_search / read_url 不联网）与写入分支（executeTool 不执行）两处都换成占位结果，工具名与参数照常记进 toolCalls；store 传 null 也不炸（自检不需要 store）',
          'pages/settings/sub/ai-eval.vue + ai-eval.scss（新增）：环境行（当前模型 / Key 状态）、开始与停止、进度条、通过率大数字、结果列表（✓/× + 标题 + 实际工具链）、点击展开详情、复制失败明细；纯黑白灰阶，深色模式覆盖',
          'pages.json 注册 ai-eval（BOM 与 CRLF 保持不变）；pages/settings/index.vue 在「关于」卡加入口（图标用已有的 stats，不用映射表里没有的名字）',
          '代价与边界：一整套 22 条约 22 次请求（DeepSeek V4 Flash 下约 ¥0.1）；语料不含隐私内容；演示模式只记录工具选择，不校验落库结果（落库由 tests/executors.test.js 那层负责）'
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