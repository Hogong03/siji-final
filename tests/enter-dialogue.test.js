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
  shouldAppendEnterSummary, isEnterSummaryMessage, buildEnterButtons
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
      eventsTotal: 2, diaryCount: 3, streak: 5, moodDip: false, weekBill: '', route: '/pages/plan/records'
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

  it('没有内容就不发消息', () => {
    expect(buildEnterSummaryMessage(null)).toBe(null)
    expect(buildEnterSummaryMessage({ events: [], eventsTotal: 0, diaryCount: 0 })).toBe(null)
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
