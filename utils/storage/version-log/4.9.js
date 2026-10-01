/**
 * 版本日志数据段：4.9.x（新版本在前）
 *
 * 纯数据，无逻辑；由 utils/storage/version-data.js 聚合后经 getDefaultHistory() 导出。
 */

export const V49 = [
  {
    version: '4.9.0',
    date: '2026-10-02',
    title: '4.9.0 AI 强化：闲聊 lite 提示词（system 约 -35%）、自检语料 24→30、相对日期统一解析、记忆「可点名」、query 结果 id 前置',
    summary: [
      'lite 接线：无指令动词的闲聊消息改用 LITE_ACTIONS 精简 system prompt（约 3.5k→0.4k 字符），闲聊路径 system 直降约 35% —— lite 机制 3.10.0 就建好了但从未接线；agent 路径显式 lite:false 保完整 schema',
      '自检语料 24→30：微光本 / 人脉新建 / 不点名打卡链（query_plan→log_plan_checkin，锁 4.8.2 先查后改）/ 待办记录 / 收入账单 / 计划冷藏，新能力全部有跑分覆盖',
      '新增 utils/date-parse.js：下周三 / 月底 / 周末 / 下个月等相对日期短语的确定性解析（与 plan-recur 同口径周一起算），模型没给时间且未命中节日时的二级兜底 —— 此类时间此前全靠模型心算无兜底',
      '记忆「可点名」：消息里点名实体（人名等）时，该实体卡片排最前、提及它的事件与关系前置 —— 问「小雅最近怎么样」直接带出小雅的完整卡片',
      'query 结果 id 移到行首：结果超长被截断时尾部 id 先被切掉，行首 id 保得住（先查后改链路的截断免疫）',
      '可持续机制落地：AGENTS.md 新增「改 AI 必跑三件套」「语料随行制」；新增 docs/AI维护清单.md（每年 1 月：节假日表 / 厂商模型复核 / 真实模型自检 / 提示词预算）；AI 强化路线图入 HANDOFF 待办',
      '测试 88 文件 / 1229 用例全绿（新增 date-parse 12 例 + ai-enhance-490 5 例）',
    ],
    categories: [
      {
        title: '提示词瘦身（P0）',
        items: [
          'composables/useChatHelpers（chat-helpers.js）：buildChatMessages 按 isLiteChatMode 自动判 lite（无指令动词的短消息），agent-loop 显式传 lite:false —— LITE_ACTIONS 机制 3.10.0 就存在但生产零接线，本次接通',
          '判定口径：消息含指令动词（帮我/记一下/修改/删除…）或金额 → 完整 schema；纯闲聊 → LITE_ACTIONS（只留 记账/记录/计划/撤销 六个高频 action）',
          '工具 schema 压缩暂缓：plan.js 等文件的描述与 BEHAVIOR_RULES 重复度经核实低于预期，盲压有行为回归风险且无真模型评测护航 —— 按路线图先真机跑基线再动',
        ],
      },
      {
        title: '自检语料扩充（P0）',
        items: [
          'utils/ai/eval/cases.js：glimmer-create（还行的小事→收微光）、relation-create（介绍新人物→create_relation 带姓名断言）、work-checkout-chain（不点名打卡→query_plan 先拿 id，4.8.2 链路回归）、todo-record（待办一句话→record_type:todo 且禁 create_plan）、income-bill（收入语义→type:income 金额 800）、plan-freeze（先放一放→frozen:true 且禁删除）',
          '语料 30 条全部符合结构断言（EXPECT_KEYS），日期现算无写死',
        ],
      },
      {
        title: '时间解析统一（P1）',
        items: [
          'utils/date-parse.js（新增 12 例测试）：单日（今天/明天/后天/大后天）、下周[几]、本周[几]（已过的取下周同一天）、裸周几（未来最近）、周末/下周末、下周/本周、下个月、月底；返回与 inferHolidayFromText 同构 {start,end,name}',
          'store/executors/plan.js：inferDatesFromText 改二级兜底 —— 节日查表优先，未命中落 date-parse',
        ],
      },
      {
        title: '记忆可点名（P1）',
        items: [
          'utils/memory-structured.js：buildStructuredMemoryContext(query) 接收当前消息 —— 命中实体排最前（全量属性）、其关系前置、提及它的事件前置；不点名保持最近顺序（测试双向锁定）',
          'utils/memory/context.js：buildMemoryContext 把 query 透传给结构化记忆',
        ],
      },
      {
        title: '先查后改补强（P1）',
        items: [
          'utils/ai/tools/executor.js：formatBills/formatDiaries/formatPlans/formatCombined 的 [id:...] 从行尾移到行首 —— 截断先切尾部，行首 id 免疫',
        ],
      },
      {
        title: '可持续机制',
        items: [
          'AGENTS.md「AI 相关」：新增改 AI 必跑三件套（schema 一致性 + module-exports + eval 干跑）与语料随行制；修正已删除的 bumpDataVersion 残留规矩（4.8.2 漏改）',
          'docs/AI维护清单.md（新增）：年度体检 —— 节假日表补年、厂商模型与 capability 复核、真实模型自检、提示词/工具预算记录',
          'CODEX_HANDOFF 待办：AI 强化路线图（P0 剩余 = 工具 schema 压缩需真机基线护航；P1-7 语音网关；P2-8 多步规划 / P2-9 视觉写记忆）',
        ],
      },
    ],
  },
]
