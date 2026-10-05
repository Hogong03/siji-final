/**
 * test: 进入总结写成对话消息（3.5.19）
 *
 * 覆盖 utils/enter-dialogue.js：正文行、开场白、消息组装、去重签名与落盘判定、预置按钮（3.5.21）。
 */
import { describe, it, expect } from 'vitest'
import './setup.js'
import {
  ENTER_SUMMARY_FLAG, ENTER_LINE_LIMIT, buildEnterOpener, buildEnterLines,
  buildEnterSummaryMessage, enterSummaryRoute, enterSummarySignature,
  shouldAppendEnterSummary, isEnterSummaryMessage, buildEnterButtons,
  buildPlanAlertLines, buildNextStepLine, buildWorkLine, buildGreeting,
  buildBriefing, buildBriefingPrimary, isBriefingV2, buildBriefingGreeting, BRIEFING_VERSION
} from '../utils/enter-dialogue.js'

const NOW = new Date(2026, 8, 15, 15, 30, 0).getTime()

function at(hour, minute = 0) {
  return new Date(2026, 8, 15, hour, minute, 0).getTime()
}

function summary(over) {
  return Object.assign({
    source: 'cold',
    awayMs: 8 * 60 * 60 * 1000,
    eventsTotal: 2,
    diaryCount: 3,
    streak: 5,
    events: [
      { kind: 'checkin', at: Date.now() - 60 * 1000, title: '六级备考', note: '' },
      { kind: 'done', at: Date.now() - 120 * 1000, title: '晨跑', note: '' }
    ],
    moodDip: false,
    weekBill: null
  }, over)
}

describe('buildEnterLines：摘要正文', () => {
  it('计划事件带类型、标题与时刻', () => {
    const lines = buildEnterLines(summary({ diaryCount: 0, streak: 0 }))
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('打卡 计划「六级备考」')
    expect(lines[0]).toMatch(/今天 \d{2}:\d{2}/)
    expect(lines[1]).toContain('完成 计划「晨跑」')
  })

  it('事件超过上限时归入「还有 N 项进展」', () => {
    const events = []
    for (let i = 0; i < 6; i++) events.push({ kind: 'checkin', at: Date.now(), title: 'P' + i })
    const lines = buildEnterLines(summary({ events: events, eventsTotal: 6 }))
    const detail = lines.filter(l => l.includes('计划「'))
    expect(detail).toHaveLength(ENTER_LINE_LIMIT)
    expect(lines.some(l => l === '还有 3 项进展')).toBe(true)
  })

  it('打卡备注拼在标题后面', () => {
    const lines = buildEnterLines(summary({
      events: [{ kind: 'checkin', at: Date.now(), title: '六级备考', note: '背了 50 个词' }],
      eventsTotal: 1
    }))
    expect(lines[0]).toContain('：背了 50 个词')
  })

  it('记录数 / 连续打卡 / 账单 / 低落各不相同', () => {
    const lines = buildEnterLines(summary({
      events: [], eventsTotal: 0, diaryCount: 4, streak: 3, moodDip: true,
      weekBill: { text: '本周支出 320 元，主要花在餐饮' }
    }))
    expect(lines).toContain('新增记录 4 条')
    expect(lines).toContain('已连续打卡 3 天')
    expect(lines).toContain('本周支出 320 元，主要花在餐饮')
    expect(lines).toContain('这两天记录里写着低落，今天慢一点也算数')
  })

  it('连续打卡 1 天不报，记录 0 条不报', () => {
    const lines = buildEnterLines(summary({
      events: [], eventsTotal: 0, diaryCount: 0, streak: 1
    }))
    expect(lines).toEqual([])
  })

  it('空输入安全', () => {
    expect(buildEnterLines(null)).toEqual([])
    expect(buildEnterLines(undefined)).toEqual([])
    expect(buildEnterLines({})).toEqual([])
  })
})

describe('buildEnterOpener：开场白', () => {
  it('按时段问候', () => {
    const s = summary({ awayMs: 0 })
    expect(buildEnterOpener(s, at(9))).toContain('早上好')
    expect(buildEnterOpener(s, at(12, 30))).toContain('中午好')
    expect(buildEnterOpener(s, at(15))).toContain('下午好')
    expect(buildEnterOpener(s, at(20))).toContain('晚上好')
    expect(buildEnterOpener(s, at(3))).toContain('夜深了')
  })

  it('冷启动报「距上次小结」，回前台报「你离开的这」', () => {
    expect(buildEnterOpener(summary({ source: 'cold', awayMs: 8 * 60 * 60 * 1000 }), NOW)).toContain('距上次小结 8 小时')
    expect(buildEnterOpener(summary({ source: 'away', awayMs: 30 * 60 * 1000 }), NOW)).toContain('你离开的这 30 分钟')
  })

  it('时长太短（刚刚）不写进文案', () => {
    const cold = buildEnterOpener(summary({ source: 'cold', awayMs: 20 * 1000 }), NOW)
    expect(cold).not.toContain('刚刚')
    expect(cold).toContain('上次小结以来的进展')
    const away = buildEnterOpener(summary({ source: 'away', awayMs: 0 }), NOW)
    expect(away).toContain('你不在的这会儿')
  })
})

describe('buildEnterSummaryMessage：组装成对话消息', () => {
  it('是 AI 消息，带标记与摘要信息', () => {
    const msg = buildEnterSummaryMessage(summary(), NOW)
    expect(msg.role).toBe('assistant')
    expect(msg[ENTER_SUMMARY_FLAG]).toBe(true)
    expect(isEnterSummaryMessage(msg)).toBe(true)
    expect(msg._enterSummaryKind).toBe('cold')
    expect(msg._enterSummaryDigest).toEqual({
      eventsTotal: 2, diaryCount: 3, streak: 5, moodDip: false, weekBill: '', route: '/pages/plan/records',
      alertsTotal: 0, nextStepTitle: '', workPending: false
    })
  })

  it('正文 = 开场白 + 要点 + 收尾，可直接接话', () => {
    const msg = buildEnterSummaryMessage(summary(), NOW)
    const lines = msg.content.split('\n')
    expect(lines[0]).toContain('下午好')
    expect(lines[1]).toBe('')
    expect(lines[2].startsWith('- 打卡 计划「六级备考」')).toBe(true)
    expect(msg.content).toContain('- 新增记录 3 条')
    expect(msg.content).toContain('- 已连续打卡 5 天')
    expect(msg.content.endsWith('要细看哪一项就说，或者直接说你现在想做什么。')).toBe(true)
  })

  it('只有记录时详情去记录列表', () => {
    const msg = buildEnterSummaryMessage(summary({ events: [], eventsTotal: 0, diaryCount: 2 }), NOW)
    expect(msg._enterSummaryDigest.route).toBe('/pages/diary/list')
  })

  it('4.5.0 恒产出：没有进展也出「问候 + 通用按钮」的开场消息', () => {
    const empty = { events: [], eventsTotal: 0, diaryCount: 0 }
    const fromNull = buildEnterSummaryMessage(null, null, NOW)
    const fromEmpty = buildEnterSummaryMessage(empty, null, NOW)
    for (const msg of [fromNull, fromEmpty]) {
      expect(msg[ENTER_SUMMARY_FLAG]).toBe(true)
      expect(msg._enterSummaryKind).toBe('cold')
      expect(msg.content).toContain('下午好')
      expect(msg.content).toContain('今天想从什么开始？')
      expect(msg._enterButtons.map(b => b.key)).toEqual(['note', 'diary-new', 'plan-new'])
    }
    expect(fromNull.content).not.toContain('距上次小结')
  })

  it('enterSummaryRoute：有计划进展去打卡记录', () => {
    expect(enterSummaryRoute({ eventsTotal: 1 })).toBe('/pages/plan/records')
    expect(enterSummaryRoute({ eventsTotal: 0 })).toBe('/pages/diary/list')
    expect(enterSummaryRoute(null)).toBe('/pages/diary/list')
  })

  it('来源是回前台时标记成 away', () => {
    const msg = buildEnterSummaryMessage(summary({ source: 'away' }), NOW)
    expect(msg._enterSummaryKind).toBe('away')
  })
})

describe('签名与去重判定', () => {
  it('同一批进展签名一致，计数变了签名就变', () => {
    const a = enterSummarySignature(summary())
    const b = enterSummarySignature(summary())
    expect(a).toBe(b)
    expect(enterSummarySignature(summary({ diaryCount: 9 }))).not.toBe(a)
    expect(enterSummarySignature(summary({ source: 'away' }))).not.toBe(a)
  })

  it('没内容的总结没有签名', () => {
    expect(enterSummarySignature(null)).toBe('')
    expect(enterSummarySignature({ events: [], eventsTotal: 0, diaryCount: 0 })).toBe('')
  })

  it('首条要写，重复的不写，新的再写', () => {
    const s = summary()
    const sig = enterSummarySignature(s)
    expect(shouldAppendEnterSummary(s, '')).toBe(true)
    expect(shouldAppendEnterSummary(s, sig)).toBe(false)
    expect(shouldAppendEnterSummary(summary({ diaryCount: 4 }), sig)).toBe(true)
    expect(shouldAppendEnterSummary(null, sig)).toBe(false)
  })
})

/* ==================== 4.5.0：计划状态 / 上班卡 / 下一步 ==================== */

describe('4.5.0 状态行与按钮', () => {
  const alerts = {
    overdue: [
      { clientId: 'p1', name: '搬家', lateDays: 3 },
      { clientId: 'p2', name: '体检', lateDays: 1 },
      { clientId: 'p3', name: '报销', lateDays: 1 }
    ],
    dueSoon: [{ clientId: 'p4', name: '周报', leftDays: 2 }],
    total: 4
  }
  const extras = {
    alerts: alerts,
    workStatus: { kind: 'in', clientId: 'w1', name: '上班打卡' },
    nextStep: { clientId: 'n1', title: '背高频词', minutes: 20 }
  }

  it('状态行：过时点破并给出口，快到期报事实，超出两条的归并', () => {
    const lines = buildPlanAlertLines(alerts)
    expect(lines[0]).toContain('3 个计划过了截止')
    expect(lines[0]).toContain('「搬家」已拖 3 天')
    expect(lines[0]).toContain('还有 1 个')
    expect(lines[1]).toBe('「周报」还有 2 天到期')
  })

  it('今天到期说「今天到期」，下一步行带时长', () => {
    const lines = buildPlanAlertLines({ overdue: [], dueSoon: [{ clientId: 'p4', name: '周报', leftDays: 0 }], total: 1 })
    expect(lines).toEqual(['「周报」今天到期'])
    expect(buildNextStepLine({ title: '背高频词', minutes: 20 })).toBe('下一步可以从「背高频词」开始，约 20 分钟。')
    expect(buildNextStepLine({ title: '背高频词', minutes: 0 })).toBe('下一步可以从「背高频词」开始。')
    expect(buildNextStepLine(null)).toBe('')
  })

  it('上班卡行分上下班口径', () => {
    expect(buildWorkLine({ kind: 'in', clientId: 'w1', name: '上班打卡' })).toContain('还没打上班卡')
    expect(buildWorkLine({ kind: 'out', clientId: 'w1', name: '下班打卡' })).toContain('还没打下班卡')
    expect(buildWorkLine(null)).toBe('')
  })

  it('消息恒产出状态段落：问候 + 状态 + 下一步 + 上班卡', () => {
    const msg = buildEnterSummaryMessage(null, extras, NOW)
    expect(msg.content).toContain('过了截止')
    expect(msg.content).toContain('下一步可以从「背高频词」开始')
    expect(msg.content).toContain('还没打上班卡')
    expect(msg._enterSummaryDigest.alertsTotal).toBe(4)
    expect(msg._enterSummaryDigest.nextStepTitle).toBe('背高频词')
    expect(msg._enterSummaryDigest.workPending).toBe(true)
  })

  it('状态包带来对应按钮：看计划 / 打上班卡（checkin）/ 就做这个（prefill）', () => {
    const keys = buildEnterButtons(null, extras).map(b => b.key)
    expect(keys).toContain('plan')
    expect(keys).toContain('checkin')
    expect(keys).toContain('next')
    const checkin = buildEnterButtons(null, extras).find(b => b.key === 'checkin')
    expect(checkin.action).toBe('checkin')
    expect(checkin.value).toBe('w1')
    const next = buildEnterButtons(null, extras).find(b => b.key === 'next')
    expect(next.action).toBe('prefill')
    expect(next.value).toContain('开始做「背高频词」')
    // 按钮依旧无重复、纯数据
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('签名带计划状态：状态变化会生成新签名，nextStep 不进签名', () => {
    const base = { events: [], eventsTotal: 0, diaryCount: 0, source: 'away', awayMs: 1000 }
    const empty = enterSummarySignature(base, { alerts: { overdue: [], dueSoon: [], total: 0 }, workStatus: null, nextStep: null })
    expect(empty).toBe('')
    const withAlerts = enterSummarySignature(base, extras)
    expect(withAlerts).not.toBe('')
    expect(shouldAppendEnterSummary(base, withAlerts)).toBe(false)
    // nextStep 变化不影响签名（落对话时按天去重由 markNextStepShown 负责）
    const withNext = enterSummarySignature(base, { alerts: extras.alerts, workStatus: extras.workStatus, nextStep: { clientId: 'x' } })
    expect(withNext).toBe(withAlerts)
  })

  it('兼容旧签名：第二参传数字仍当时间用', () => {
    const msg = buildEnterSummaryMessage(summary(), NOW)
    expect(msg.content).toContain('下午好')
  })
})

/* ==================== 3.5.21：消息里的预置按钮 ==================== */

describe('buildEnterButtons：对话里预置的按钮', () => {
  it('有进展才给「查看详情 / 看计划」，路由跟摘要一致', () => {
    const list = buildEnterButtons(summary())
    const keys = list.map(b => b.key)
    expect(keys).toContain('detail')
    expect(keys).toContain('plan')
    expect(list.find(b => b.key === 'detail').action).toBe('navigate')
    expect(list.find(b => b.key === 'detail').value).toBe(enterSummaryRoute(summary()))
    expect(list.find(b => b.key === 'plan').value).toBe('/pages/plan/index')
  })

  it('没有进展就没有详情与看计划，只剩记录与通用按钮', () => {
    const keys = buildEnterButtons(summary({ events: [], eventsTotal: 0 })).map(b => b.key)
    expect(keys).not.toContain('detail')
    expect(keys).not.toContain('plan')
    expect(keys).toContain('diary')
  })

  it('记录 / 账单 / 低落各自带自己的按钮', () => {
    expect(buildEnterButtons(summary({ diaryCount: 0 })).map(b => b.key)).not.toContain('diary')
    expect(buildEnterButtons(summary({ weekBill: { text: '本周花了 120' } })).map(b => b.key)).toContain('bill')
    expect(buildEnterButtons(summary({ moodDip: false })).map(b => b.key)).not.toContain('mood')
    const mood = buildEnterButtons(summary({ moodDip: true })).find(b => b.key === 'mood')
    expect(mood.action).toBe('prefill')
    expect(mood.value).toContain('状态')
  })

  it('通用按钮总在：记一笔 / 写个记录 / 定个计划，都是填话术不是直接发', () => {
    const list = buildEnterButtons(summary({ events: [], eventsTotal: 0, diaryCount: 0 }))
    const quick = list.filter(b => b.action === 'prefill').map(b => b.key)
    expect(quick).toEqual(['note', 'diary-new', 'plan-new'])
    list.forEach(b => {
      expect(typeof b.label).toBe('string')
      expect(b.label.length).toBeGreaterThan(0)
      expect(['navigate', 'prefill']).toContain(b.action)
    })
  })

  it('没有重复按钮，空输入返回空数组', () => {
    const keys = buildEnterButtons(summary()).map(b => b.key)
    expect(new Set(keys).size).toBe(keys.length)
    // 3.10.0：没有摘要（欢迎语开场）时通用三个按钮照给 —— 开场消息与进入总结共用一套操作行
    const generic = ['note', 'diary-new', 'plan-new']
    expect(buildEnterButtons(null).map(b => b.key)).toEqual(generic)
    expect(buildEnterButtons(undefined).map(b => b.key)).toEqual(generic)
  })

  it('按钮是纯数据，能跟着消息一起落盘', () => {
    const msg = buildEnterSummaryMessage(summary(), at(15))
    expect(Array.isArray(msg._enterButtons)).toBe(true)
    expect(msg._enterButtons.length).toBeGreaterThan(3)
    expect(JSON.parse(JSON.stringify(msg))._enterButtons).toEqual(msg._enterButtons)
  })
})

/* ==================== 4.12.0：结构化简报卡 ==================== */
describe('buildBriefing：简报卡 payload', () => {
  it('buildEnterSummaryMessage 挂 v2 标记与 _briefing，content 文本照旧（老版本回落 + AI 历史窗口）', () => {
    const msg = buildEnterSummaryMessage(summary(), null, at(15))
    expect(msg._briefingVersion).toBe(BRIEFING_VERSION)
    expect(msg._briefing && typeof msg._briefing === 'object').toBe(true)
    expect(msg._briefing.version).toBe(BRIEFING_VERSION)
    expect(typeof msg._briefing.greeting).toBe('string')
    expect(msg._briefing.greeting.length).toBeGreaterThan(0)
    expect(typeof msg.content).toBe('string')
    expect(msg.content).toContain('下午好')
  })

  it('指标格：昨日支出/连续打卡/新记录，最多 3 格；全空不渲染', () => {
    const full = buildBriefing(summary({ yesterdayExpense: 42.5, eventsTotal: 2, diaryCount: 3, streak: 5 }), null, at(15))
    expect(full.metrics.map(m => m.key)).toEqual(['expense', 'streak', 'diary'])
    // 连续打卡 1 天不上格（与文案口径一致）
    const low = buildBriefing(summary({ streak: 1, diaryCount: 0, eventsTotal: 0, yesterdayExpense: 0 }), null, at(15))
    expect(low.metrics).toEqual([])
  })

  it('主按钮优先级：上班卡 > 过时计划 > 下一步，一屏只推一件', () => {
    const work = { kind: 'in', name: '上班打卡', clientId: 'p_in' }
    expect(buildBriefingPrimary(summary(), { workStatus: work, alerts: { total: 3, overdue: [], dueSoon: [] }, nextStep: { title: 'x' } }).key).toBe('checkin')
    expect(buildBriefingPrimary(summary(), { alerts: { total: 3, overdue: [], dueSoon: [] }, nextStep: { title: 'x' } }).key).toBe('plan')
    expect(buildBriefingPrimary(summary(), { nextStep: { title: 'x', minutes: 20 } }).key).toBe('next')
    expect(buildBriefingPrimary(summary(), null)).toBe(null)
  })

  it('次级 chips：去掉主按钮那颗、上限 3 个；主按钮的动作用旧按钮语义（checkin/navigate/prefill）', () => {
    const work = { kind: 'in', name: '上班打卡', clientId: 'p_in' }
    const b = buildBriefing(summary(), { workStatus: work, nextStep: { title: '精翻阅读', minutes: 40 } }, at(15))
    expect(b.primary.key).toBe('checkin')
    expect(b.primary.action).toBe('checkin')
    expect(b.chips.some(c => c.key === 'checkin')).toBe(false)
    expect(b.chips.length).toBeLessThanOrEqual(3)
    // 下一步没占主位时保留说明行
    const b2 = buildBriefing(summary(), { nextStep: { title: '精翻阅读', minutes: 40 } }, at(15))
    expect(b2.nextLine).toContain('精翻阅读')
  })

  it('isBriefingV2：新消息为真、旧消息（无 _briefing）为假；hasOpenerActions 语义不变', () => {
    const msg = buildEnterSummaryMessage(summary(), null, at(15))
    expect(isBriefingV2(msg)).toBe(true)
    const legacy = { _isEnterSummary: true, _isOpener: true, _enterButtons: [] }
    legacy[ENTER_SUMMARY_FLAG] = true
    expect(isBriefingV2(legacy)).toBe(false)
    // 页级按钮行仍由 hasOpenerActions 驱动（true），渲染与否由页面按 isBriefingV2 组合判定
    expect(msg._enterButtons.length).toBeGreaterThan(0)
  })

  it('问候池：同一天同句，均为非空字符串', () => {
    const noon1 = new Date(2026, 8, 15, 12, 0, 0).getTime()
    const noon2 = new Date(2026, 8, 16, 12, 0, 0).getTime()
    const a = buildBriefingGreeting(noon1)
    expect(buildBriefingGreeting(noon1)).toBe(a)
    expect(a.length).toBeGreaterThan(0)
    expect(buildBriefingGreeting(noon2).length).toBeGreaterThan(0)
  })

  it('空状态简报：只有问候 + 通用 chips，无主按钮无指标', () => {
    const b = buildBriefing(null, null, at(15))
    expect(b.metrics).toEqual([])
    expect(b.primary).toBe(null)
    expect(b.statusLines).toEqual([])
    expect(b.chips.map(c => c.key)).toEqual(['note', 'diary-new', 'plan-new'])
  })

  it('今日打卡进度：checkinToday（total>0）进 payload，summary 与 extras 包两处都认', () => {
    // computeSummary 把 extras 并进 summary 的路径
    const fromSummary = buildBriefing(summary({ checkinToday: { done: 1, total: 3 } }), null, at(15))
    expect(fromSummary.checkin).toEqual({ done: 1, total: 3 })
    // snapshot 开场（extras 单独传）的路径
    const fromPack = buildBriefing(summary(), { checkinToday: { done: 2, total: 4 } }, at(15))
    expect(fromPack.checkin).toEqual({ done: 2, total: 4 })
    // 落成消息后挂在 _briefing 上
    const msg = buildEnterSummaryMessage(summary({ checkinToday: { done: 3, total: 3 } }), null, at(15))
    expect(msg._briefing.checkin).toEqual({ done: 3, total: 3 })
    // 脏数据收敛：done 不越过 total
    const clamp = buildBriefing(summary({ checkinToday: { done: 9, total: 3 } }), null, at(15))
    expect(clamp.checkin).toEqual({ done: 3, total: 3 })
  })

  it('今日打卡进度：total 为 0 或没带字段都不产出', () => {
    expect(buildBriefing(summary({ checkinToday: { done: 0, total: 0 } }), null, at(15)).checkin).toBe(null)
    // 没有可打卡计划时 useEnterSummary 给 null，简报卡同样不出进度行
    expect(buildBriefing(summary({ checkinToday: null }), null, at(15)).checkin).toBe(null)
    expect(buildBriefing(summary(), null, at(15)).checkin).toBe(null)
    expect(buildBriefing(null, null, at(15)).checkin).toBe(null)
  })
})
