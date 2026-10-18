/**
 * advice-rules.js — 建议规则表（纯函数）
 *
 * 输入一份已归一的 snapshot，输出按优先级排好的建议条目。
 *   { key, tone, title, desc, action }
 *   tone   'urgent' 红（过期 / 额度告急）| 'nudge' 黑（该做点什么）| 'info' 灰（只是状态）
 *   action { type: 'nav', url } | { type: 'guide' } | { type: 'prefill', text } | null
 *
 * 规则原则（沿用项目铁律，别破坏）：
 *   - 一次最多 4 条，第一条就是「现在最该做的一件事」
 *   - 只陈述事实 + 给出口；不催、不评价、不问心情、不制造「应该做点什么」的氛围
 *   - 没数据不硬凑：真的什么都没有时给两个起点入口，不编造内容
 *
 * 纯函数、不依赖 uni，可直接单测。
 */

/** 建议条数上限 */
export const ADVICE_LIMIT = 4

/** 画像完整度低于这个值才提醒 */
export const PROFILE_REMIND_BELOW = 60

/** 账单预算用到这个比例才提醒 */
export const BUDGET_WARN_PCT = 90

/** 多少天没记账算「断了」 */
export const BILL_STALE_DAYS = 3

/**
 * 规则表（顺序即优先级）
 * 环境层排最前 —— 能力都不具备时，其它建议都是空谈
 */
const RULES = [
  // ─── 运行环境层 ───
  (s) => (!s.env.aiReady ? {
    key: 'env-ai',
    tone: 'urgent',
    title: '还没连接 AI',
    desc: '填一个厂商 Key，对话、语音记账、自动归类这些能力才会打开',
    action: { type: 'nav', url: '/pages/settings/sub/key-guide' }
  } : null),

  (s) => (!s.env.aiReady || !s.env.firstRun ? null : {
    key: 'env-guide',
    tone: 'nudge',
    title: '先花一分钟走一遍引导',
    desc: '三步说清怎么记、怎么看、怎么让 AI 替你干活',
    action: { type: 'guide' }
  }),

  (s) => (!s.env.offline ? null : {
    key: 'env-offline',
    tone: 'info',
    title: '现在处于离线状态',
    desc: '记账、记录、计划、看历史都照常；需要用网的 AI 功能要等网络回来',
    action: null
  }),

  // ─── 数据层：计划 ───
  (s) => (s.plans.overdue > 0 ? {
    key: 'plan-overdue',
    tone: 'urgent',
    title: s.plans.overdue + ' 项计划已过期',
    desc: (s.plans.overdueTopName
      ? '最久的「' + s.plans.overdueTopName + '」已经 ' + s.plans.overdueMaxDays + ' 天'
      : '截止日已经过了') + ' —— 顺延、改期或收尾，选一个',
    action: { type: 'nav', url: '/pages/plan/index' }
  } : null),

  (s) => (s.plans.dueToday > 0 ? {
    key: 'plan-today',
    tone: 'nudge',
    title: '今天有 ' + s.plans.dueToday + ' 项到期',
    desc: '做完顺手打个卡，进度条会往前走一格',
    action: { type: 'nav', url: '/pages/plan/index' }
  } : null),

  (s) => (s.plans.hasActive && !s.plans.checkedToday && (s.bucket === 'evening' || s.bucket === 'night') ? {
    key: 'plan-checkin',
    tone: 'nudge',
    title: '今天还没打卡',
    desc: '有 ' + s.plans.active + ' 项在办，打完卡今天的连续性就保住了',
    action: { type: 'nav', url: '/pages/plan/index' }
  } : null),

  (s) => (s.plans.soonCount > 0 ? {
    key: 'plan-soon',
    tone: 'info',
    title: s.plans.soonCount + ' 项计划快到期',
    desc: '最近的还有 ' + s.plans.soonMinDays + ' 天，提前排一下能少赶一次',
    action: { type: 'nav', url: '/pages/plan/index' }
  } : null),

  // ─── 数据层：账单 ───
  (s) => (s.bill.budgetPct >= BUDGET_WARN_PCT ? {
    key: 'bill-budget',
    tone: 'urgent',
    title: '本月已用 ' + s.bill.budgetPct + '% 预算',
    desc: '还差 ' + Math.max(0, 100 - s.bill.budgetPct) + '% 就到线，后面几天收着点',
    action: { type: 'nav', url: '/pages/bill/index' }
  } : null),

  (s) => (s.empty || s.bill.month > 0 ? null : {
    key: 'bill-none',
    tone: 'nudge',
    title: '这个月还没记过一笔',
    desc: '记一笔就知道钱去哪了，一句话也行',
    action: { type: 'prefill', text: '记一笔' }
  }),

  (s) => (s.bill.month > 0 && s.bill.lastDays >= BILL_STALE_DAYS ? {
    key: 'bill-stale',
    tone: 'nudge',
    title: '已经 ' + s.bill.lastDays + ' 天没记账了',
    desc: '补记也行，凭记忆写个大概就够用',
    action: { type: 'prefill', text: '记一笔' }
  } : null),

  // ─── 数据层：记录 ───
  (s) => (s.empty || s.diary.today || (s.bucket !== 'evening' && s.bucket !== 'night') ? null : {
    key: 'diary-today',
    tone: 'nudge',
    title: '今天还没记录',
    desc: '一句话就够，明天回看时这行字比你以为的有用',
    action: { type: 'prefill', text: '记录一下今天' }
  }),

  // ─── 数据层：人脉 ───
  (s) => (s.relation.stale > 0 ? {
    key: 'relation-stale',
    tone: 'info',
    title: s.relation.stale + ' 个人很久没联系了',
    desc: s.relation.staleName
      ? '「' + s.relation.staleName + '」已经 ' + s.relation.staleMaxDays + ' 天'
      : '最久的已经超过一个月',
    action: { type: 'nav', url: '/pages/settings/sub/relation-graph' }
  } : null),

  // ─── 数据层：画像 ───
  // pct < 0 表示结构拿不到（取数失败），跳过而不误报「完整度 -1%」
  (s) => (s.profile.pct < 0 || s.profile.pct >= PROFILE_REMIND_BELOW ? null : {
    key: 'profile-pct',
    tone: 'info',
    title: '画像完整度 ' + s.profile.pct + '%',
    desc: '补上职业、习惯、偏好这几项，AI 回答会更贴你的实际情况',
    action: { type: 'nav', url: '/pages/settings/sub/profile' }
  }),

  // ─── 时段兜底（有数据但今天没有任何待办时；fallback 标记见 collectAdvice）───
  (s) => (!s.empty && (s.bucket === 'dawn' || s.bucket === 'morning') ? {
    key: 'time-morning',
    tone: 'nudge',
    fallback: true,
    title: '早上好，先定下今天的三件事',
    desc: '想清楚再动手，比边做边改省一半时间',
    action: { type: 'prefill', text: '今天我要做' }
  } : null),

  (s) => (!s.empty && (s.bucket === 'evening' || s.bucket === 'night') ? {
    key: 'time-evening',
    tone: 'nudge',
    fallback: true,
    title: '今天过得怎么样',
    desc: '顺手记一笔，攒下来的就是你的时间线',
    action: { type: 'prefill', text: '今天' }
  } : null),

  // ─── 全空兜底 ───
  (s) => (!s.empty ? null : {
    key: 'start-empty',
    tone: 'nudge',
    fallback: true,
    title: '从第一条开始',
    desc: '记一件事、记一笔账，或者直接跟 AI 说句话都行',
    action: { type: 'prefill', text: '记录一下' }
  })
]

/**
 * 生成建议列表
 * @param {Object} snapshot 归一后的上下文（见 advice.js 的 normalize）
 * @param {{ limit?: number }} [opts]
 * @returns {Array<{key,tone,title,desc,action}>}
 */
export function collectAdvice(snapshot, opts = {}) {
  const s = snapshot || {}
  const limit = Number.isFinite(opts.limit) ? Math.max(1, Math.floor(opts.limit)) : ADVICE_LIMIT
  const out = []
  const seen = {}
  for (const rule of RULES) {
    if (out.length >= limit) break
    let item = null
    try {
      item = rule(s)
    } catch (e) {
      item = null // 单条规则出错不影响其余建议
    }
    if (!item || !item.key || seen[item.key]) continue
    if (item.fallback) {
      // 兜底只在「一条可行动项都没有」时出场，且最多一条
      // （否则会出现「今天还没记录」+「今天过得怎么样」同一件事说两遍）
      if (out.some((i) => i.tone !== 'info')) continue
      if (out.some((i) => i.fallback)) continue
    }
    seen[item.key] = 1
    out.push(item)
  }
  return out
}

/**
 * 聚焦句：第一条非 info 的建议就是「现在最该做的一件事」；
 * 全是 info（只有环境/状态）时返回空串，面板就不显示聚焦区。
 */
export function pickAdviceFocus(items) {
  const list = Array.isArray(items) ? items : []
  for (const it of list) {
    if (it && it.tone !== 'info') return it.title
  }
  return ''
}
