/**
 * test: 应用建议引擎（4.35.0）
 *
 * 覆盖 utils/advice-context.js + utils/advice-rules.js + utils/advice.js：
 *  - 上下文字段：时段边界、数据指纹、环境短码、签名随三层变化
 *  - 规则表：优先级（环境层在前）、条数上限、空态兜底、聚焦句
 *  - 门控：开关关掉 / 新的一天 / 同签名不重弹 / 间隔不足 / 一天上限 / 变化后放行
 *  - 取数：注入 deps 时不碰真实存储，计数口径正确
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { resetStorage } from './setup.js'
import './setup.js'
import {
  timeBucket, bucketLabel, isWeekend, ymdOf,
  dataFingerprint, envKey, buildAdviceSignature
} from '../utils/advice-context.js'
import {
  collectAdvice, pickAdviceFocus, ADVICE_LIMIT, PROFILE_REMIND_BELOW, BUDGET_WARN_PCT
} from '../utils/advice-rules.js'
import {
  buildAdvice, collectSnapshot, decideAutoShow, markAdviceShown, readAdviceState,
  MAX_AUTO_PER_DAY, MIN_GAP_MS, ADVICE_STATE_KEY
} from '../utils/advice.js'

// 固定「现在」：2026-10-18（周日）20:00 —— evening 档
const NOW = new Date(2026, 9, 18, 20, 0, 0).getTime()

beforeEach(() => {
  resetStorage()
})

/** 造一条计划（collectPlanAlerts 认的字段） */
function plan(over = {}) {
  return Object.assign({
    client_id: 'p' + Math.random().toString(36).slice(2, 8),
    title: '计划',
    status: 1,
    is_deleted: 0
  }, over)
}

/** 一份「有内容」的 snapshot 基线 */
function snap(over = {}) {
  const base = {
    bucket: 'evening',
    bucketLabel: '晚上',
    weekend: true,
    env: { aiReady: true, firstRun: false, offline: false, dark: false },
    plans: {
      total: 3, active: 2, hasActive: true,
      overdue: 0, overdueTopName: '', overdueMaxDays: 0,
      dueToday: 0, soonCount: 0, soonMinDays: 0, checkedToday: true
    },
    diary: { today: true, week: 4 },
    bill: { month: 5, monthTotal: 320, budgetPct: 40, lastDays: 1 },
    relation: { total: 3, stale: 0, staleName: '', staleMaxDays: 0 },
    profile: { pct: 80 },
    empty: false
  }
  const out = Object.assign({}, base, over)
  if (over.plans) out.plans = Object.assign({}, base.plans, over.plans)
  if (over.env) out.env = Object.assign({}, base.env, over.env)
  if (over.bill) out.bill = Object.assign({}, base.bill, over.bill)
  if (over.diary) out.diary = Object.assign({}, base.diary, over.diary)
  if (over.relation) out.relation = Object.assign({}, base.relation, over.relation)
  if (over.profile) out.profile = Object.assign({}, base.profile, over.profile)
  return out
}

describe('advice-context：时段', () => {
  it('六档边界正确（8 点上班、11 点半吃饭、18 点下班、23 点该睡）', () => {
    const at = (h) => new Date(2026, 9, 18, h, 0, 0).getTime()
    expect(timeBucket(at(4))).toBe('night')
    expect(timeBucket(at(5))).toBe('dawn')
    expect(timeBucket(at(7))).toBe('dawn')
    expect(timeBucket(at(8))).toBe('morning')
    expect(timeBucket(at(10))).toBe('morning')
    expect(timeBucket(at(11))).toBe('noon')
    expect(timeBucket(at(13))).toBe('noon')
    expect(timeBucket(at(14))).toBe('afternoon')
    expect(timeBucket(at(17))).toBe('afternoon')
    expect(timeBucket(at(18))).toBe('evening')
    expect(timeBucket(at(22))).toBe('evening')
    expect(timeBucket(at(23))).toBe('night')
  })

  it('时段中文名；非法值回落「现在」', () => {
    expect(bucketLabel('morning')).toBe('上午')
    expect(bucketLabel('night')).toBe('深夜')
    expect(bucketLabel('不存在')).toBe('现在')
    expect(bucketLabel(undefined)).toBe('现在')
  })

  it('周末判定与本地日期', () => {
    expect(isWeekend(new Date(2026, 9, 18).getTime())).toBe(true) // 周日
    expect(isWeekend(new Date(2026, 9, 17).getTime())).toBe(true) // 周六
    expect(isWeekend(new Date(2026, 9, 19).getTime())).toBe(false) // 周一
    expect(ymdOf(new Date(2026, 9, 8, 9, 0).getTime())).toBe('2026-10-08')
  })
})

describe('advice-context：签名（环境变化就重出）', () => {
  it('数据指纹：计数变了就变，计数没变就稳', () => {
    const a = { planOverdue: 1, billMonth: 3, profilePct: 80 }
    const b = { planOverdue: 2, billMonth: 3, profilePct: 80 }
    expect(dataFingerprint(a)).toBe(dataFingerprint(a))
    expect(dataFingerprint(a)).not.toBe(dataFingerprint(b))
  })

  it('环境短码反映四个开关', () => {
    expect(envKey({ aiReady: true, firstRun: false, offline: false, dark: false })).toBe('aFOK')
    expect(envKey({ aiReady: false, firstRun: true, offline: true, dark: true })).toBe('Afok')
  })

  it('三层任一变化 → 签名变化', () => {
    const base = { ymd: '2026-10-18', bucket: 'evening', env: { aiReady: true }, data: { billMonth: 1 } }
    const sig = buildAdviceSignature(base)
    expect(buildAdviceSignature(base)).toBe(sig)
    // 换日
    expect(buildAdviceSignature(Object.assign({}, base, { ymd: '2026-10-19' }))).not.toBe(sig)
    // 换时段
    expect(buildAdviceSignature(Object.assign({}, base, { bucket: 'night' }))).not.toBe(sig)
    // 换环境
    expect(buildAdviceSignature(Object.assign({}, base, { env: { aiReady: false } }))).not.toBe(sig)
    // 换数据
    expect(buildAdviceSignature(Object.assign({}, base, { data: { billMonth: 2 } }))).not.toBe(sig)
  })
})

describe('advice-rules：规则表', () => {
  it('没配 Key 时第一条就是「还没连接 AI」（环境层最优先）', () => {
    const items = collectAdvice(snap({ env: { aiReady: false } }))
    expect(items[0].key).toBe('env-ai')
    expect(items[0].tone).toBe('urgent')
    expect(items[0].action.type).toBe('nav')
  })

  it('计划过期 → plan-overdue 且带最久天数', () => {
    const items = collectAdvice(snap({ plans: { overdue: 2, overdueTopName: '体检预约', overdueMaxDays: 6 } }))
    const it0 = items.find((i) => i.key === 'plan-overdue')
    expect(it0).toBeTruthy()
    expect(it0.title).toBe('2 项计划已过期')
    expect(it0.desc).toContain('体检预约')
    expect(it0.desc).toContain('6 天')
  })

  it('预算用到 90% → 红条提醒；没用满不提醒', () => {
    expect(collectAdvice(snap({ bill: { budgetPct: BUDGET_WARN_PCT } })).some((i) => i.key === 'bill-budget')).toBe(true)
    expect(collectAdvice(snap({ bill: { budgetPct: BUDGET_WARN_PCT - 1 } })).some((i) => i.key === 'bill-budget')).toBe(false)
  })

  it('记录：只在 evening / night 且今天没记时提；白天不提', () => {
    expect(collectAdvice(snap({ diary: { today: false } })).some((i) => i.key === 'diary-today')).toBe(true)
    expect(collectAdvice(snap({ bucket: 'morning', diary: { today: false } })).some((i) => i.key === 'diary-today')).toBe(false)
    expect(collectAdvice(snap({ diary: { today: true } })).some((i) => i.key === 'diary-today')).toBe(false)
  })

  it('画像完整度够高就不提；拿不到（-1）也不误报 0%', () => {
    expect(collectAdvice(snap({ profile: { pct: PROFILE_REMIND_BELOW } })).some((i) => i.key === 'profile-pct')).toBe(false)
    expect(collectAdvice(snap({ profile: { pct: PROFILE_REMIND_BELOW - 1 } })).some((i) => i.key === 'profile-pct')).toBe(true)
    expect(collectAdvice(snap({ profile: { pct: -1 } })).some((i) => i.key === 'profile-pct')).toBe(false)
  })

  it('条数上限不超过 ADVICE_LIMIT', () => {
    const loaded = snap({
      env: { aiReady: false, offline: true, firstRun: true },
      plans: { overdue: 1, dueToday: 1, soonCount: 2, soonMinDays: 1, hasActive: true, checkedToday: false },
      bill: { month: 3, budgetPct: 95, lastDays: 5 },
      diary: { today: false },
      relation: { stale: 2, staleName: '老王', staleMaxDays: 40 },
      profile: { pct: 20 }
    })
    const items = collectAdvice(loaded)
    expect(items.length).toBe(ADVICE_LIMIT)
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length) // 不重复
  })

  it('全空 → 只给「从第一条开始」，不再叠加「还没记过一笔」这类重复项', () => {
    const items = collectAdvice(snap({
      empty: true,
      plans: { total: 0, active: 0, hasActive: false },
      bill: { month: 0, budgetPct: 0, lastDays: -1 },
      diary: { today: false, week: 0 },
      relation: { total: 0, stale: 0 },
      profile: { pct: -1 }
    }))
    expect(items.length).toBe(1)
    expect(items[0].key).toBe('start-empty')
    expect(items.some((i) => i.key === 'bill-none')).toBe(false)
  })

  it('兜底项只在没有可行动项时出场（同一件事不说两遍）', () => {
    // 晚上且今天没记录 → 出 diary-today，兜底的 time-evening 让位
    const evening = collectAdvice(snap({ diary: { today: false } }))
    expect(evening.some((i) => i.key === 'diary-today')).toBe(true)
    expect(evening.some((i) => i.key === 'time-evening')).toBe(false)
    // 晚上且今天记过了、也没有别的待办 → time-evening 才出场
    const calm = collectAdvice(snap({ diary: { today: true } }))
    expect(calm.some((i) => i.key === 'time-evening')).toBe(true)
  })

  it('聚焦句取第一条非 info；全是 info 时返回空串', () => {
    expect(pickAdviceFocus([{ tone: 'info', title: 'A' }, { tone: 'nudge', title: 'B' }])).toBe('B')
    expect(pickAdviceFocus([{ tone: 'info', title: 'A' }])).toBe('')
    expect(pickAdviceFocus([])).toBe('')
  })
})

describe('advice：门控', () => {
  const sig = 'sig-A'

  it('开关关掉 → 永不自动弹', () => {
    expect(decideAutoShow({ now: NOW, signature: sig, state: { day: '', count: 0, lastTs: 0, sig: '' }, flagOn: false }))
      .toEqual({ show: false, reason: 'flag-off' })
  })

  it('新的一天 → 放行', () => {
    const r = decideAutoShow({ now: NOW, signature: sig, state: { day: '2026-10-17', count: 5, lastTs: NOW - 1000, sig: 'old' }, flagOn: true })
    expect(r).toEqual({ show: true, reason: 'new-day' })
  })

  it('同一天同签名 → 不重弹', () => {
    const r = decideAutoShow({ now: NOW, signature: sig, state: { day: ymdOf(NOW), count: 1, lastTs: NOW - MIN_GAP_MS - 1, sig } })
    expect(r).toEqual({ show: false, reason: 'same-signature' })
  })

  it('签名变了但间隔不足 → 不弹；间隔够了 → 放行', () => {
    const day = ymdOf(NOW)
    const soon = decideAutoShow({ now: NOW, signature: 'sig-B', state: { day, count: 1, lastTs: NOW - 1000, sig } })
    expect(soon).toEqual({ show: false, reason: 'too-soon' })
    const later = decideAutoShow({ now: NOW, signature: 'sig-B', state: { day, count: 1, lastTs: NOW - MIN_GAP_MS - 1, sig } })
    expect(later).toEqual({ show: true, reason: 'changed' })
  })

  it('一天上限封顶', () => {
    const day = ymdOf(NOW)
    const r = decideAutoShow({ now: NOW, signature: 'sig-C', state: { day, count: MAX_AUTO_PER_DAY, lastTs: NOW - MIN_GAP_MS - 1, sig } })
    expect(r).toEqual({ show: false, reason: 'capped' })
  })

  it('markAdviceShown 按天计数，跨天重置', () => {
    markAdviceShown(NOW, 'sig-1')
    expect(readAdviceState().count).toBe(1)
    markAdviceShown(NOW + 1000, 'sig-2')
    expect(readAdviceState().count).toBe(2)
    markAdviceShown(NOW + 24 * 3600 * 1000, 'sig-3')
    const st = readAdviceState()
    expect(st.count).toBe(1)
    expect(st.sig).toBe('sig-3')
  })

  it('存储坏了不抛错，回落默认状态', () => {
    uni.setStorageSync(ADVICE_STATE_KEY, '{{{ 不是 JSON')
    expect(() => readAdviceState()).not.toThrow()
    expect(readAdviceState()).toEqual({ day: '', count: 0, lastTs: 0, sig: '' })
  })
})

describe('advice：取数与组装（注入 deps，不碰真实存储）', () => {
  /** 注入一整套假数据 */
  function deps(over = {}) {
    const plans = over.plans || []
    const bills = over.bills || []
    return {
      plans: () => plans,
      bills: () => bills,
      budget: () => (over.budget == null ? 0 : over.budget),
      diaries: () => (over.diaries || []),
      relations: () => (over.relations || []),
      interactions: () => (over.interactions || []),
      profile: () => (over.profile || { cards: [] })
    }
  }

  it('过期计划被算进 overdue，并带最久者名字', () => {
    const s = collectSnapshot(NOW, {}, deps({
      plans: [
        plan({ title: '体检预约', due_date: '2026-10-12' }), // 逾期 6 天
        plan({ title: '交房租', due_date: '2026-10-16' })    // 逾期 2 天
      ]
    }))
    expect(s.plans.overdue).toBe(2)
    expect(s.plans.overdueTopName).toBe('体检预约')
    expect(s.plans.overdueMaxDays).toBe(6)
  })

  it('预算比例按 实付 / budget 计算（budget 为 0 时不计算）', () => {
    const bills = [{ amount: 90, date: '2026-10-18' }, { amount: 30, date: '2026-10-17' }]
    const withBudget = collectSnapshot(NOW, {}, deps({ bills, budget: 200 }))
    expect(withBudget.bill.month).toBe(2)
    expect(withBudget.bill.monthTotal).toBe(120)
    expect(withBudget.bill.budgetPct).toBe(60)
    const noBudget = collectSnapshot(NOW, {}, deps({ bills, budget: 0 }))
    expect(noBudget.bill.budgetPct).toBe(0)
  })

  it('记账断档天数：拿最近一笔算（无账单为 -1）', () => {
    const s = collectSnapshot(NOW, {}, deps({ bills: [{ amount: 1, date: '2026-10-15' }] }))
    expect(s.bill.lastDays).toBe(3)
    const none = collectSnapshot(NOW, {}, deps({ bills: [] }))
    expect(none.bill.lastDays).toBe(-1)
  })

  it('久未联系：超过 30 天没互动才计入（无时间线索的不判定）', () => {
    const s = collectSnapshot(NOW, {}, deps({
      relations: [{ id: 'r1', name: '老王' }, { id: 'r2', name: '小李' }],
      interactions: [
        { relation_id: 'r1', date: '2026-08-01' }, // 78 天前
        { relation_id: 'r2', date: '2026-10-17' }  // 1 天前
      ]
    }))
    expect(s.relation.stale).toBe(1)
    expect(s.relation.staleName).toBe('老王')
  })

  it('画像完整度按 已填 / 总字段 计算；结构拿不到返回 -1', () => {
    const s = collectSnapshot(NOW, {}, deps({
      profile: { cards: [{ fields: { a: 'x', b: '', c: ['1'] } }] } // 2/3
    }))
    expect(s.profile.pct).toBe(67)
    const broken = collectSnapshot(NOW, {}, { profile: () => { throw new Error('boom') } })
    expect(broken.profile.pct).toBe(-1)
  })

  it('buildAdvice 产出完整结构（含签名与聚焦句）', () => {
    const a = buildAdvice({
      now: NOW,
      env: { aiReady: true },
      deps: deps({ plans: [plan({ title: '体检预约', due_date: '2026-10-12' })] })
    })
    expect(a.ymd).toBe('2026-10-18')
    expect(a.bucket).toBe('evening')
    expect(a.bucketLabel).toBe('晚上')
    expect(a.greeting).toBe('晚上好')
    expect(a.items.length).toBeGreaterThan(0)
    expect(a.focus).toBeTruthy()
    expect(typeof a.signature).toBe('string')
    expect(a.signature).toContain('2026-10-18')
    expect(a.signature).toContain('evening')
  })

  it('取数失败不抛错（整条链路放弃而不是崩页面）', () => {
    expect(() => buildAdvice({ now: NOW, deps: { plans: () => { throw new Error('boom') } } })).not.toThrow()
  })

  it('时段问候语按时段给', () => {
    const at = (h) => buildAdvice({ now: new Date(2026, 9, 18, h, 0).getTime(), deps: deps({}) }).greeting
    expect(at(7)).toBe('这么早就醒了')
    expect(at(9)).toBe('早上好')
    expect(at(12)).toBe('中午好')
    expect(at(15)).toBe('下午好')
    expect(at(20)).toBe('晚上好')
    expect(at(2)).toBe('夜深了')
  })
})
