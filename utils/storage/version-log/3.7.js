/**
 * 版本日志数据段：3.7.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V37 = [
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