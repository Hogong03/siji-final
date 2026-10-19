/**
 * test: 关系回溯触发范围评估（4.41.0）
 *
 * 跑 utils/ai/eval/traceback-corpus.js 的语料，产出四类指标：
 *   召回率 / 注入层误触发率 / 人物匹配准确率 / 行为安全性
 *
 * 断言分三层，避免把「现状」当成「正确」：
 *   1. 硬不变量 —— 现在就必须成立（无人名指向不注入、无记录不编造、明确说法全中、人物不配错）
 *   2. 基线快照 —— 用实测值当下限，后续改动若恶化会立刻红
 *   3. 已知缺口 —— 用 it.fails 明确标注（这三个是**当前缺陷**，下一步修；修好后 it.fails 会报错提醒移除）
 *
 * 生成报告：$env:TRACEBACK_EVAL_REPORT=1; npx vitest run tests/relation-traceback-trigger.test.js
 * 调试单例：$env:TRACEBACK_EVAL_DEBUG="empty-history"; npx vitest run tests/relation-traceback-trigger.test.js
 *
 * 口径说明（评估模型容易搞错的地方）：
 *   生产有两道门 —— 先 detectTracebackIntent（是不是在问关系变化），再由
 *   buildTracebackContext 的人物门（有没有提到已收录的人）。本评估把
 *   contextBuilt（人物门）与 injected（两道门都过 = 生产真实行为）分开记录，
 *   否则会把「能构建」误判成「已注入」。
 */
import { describe, it, expect } from 'vitest'
import './setup.js'
import { resetStorage } from './setup.js'
import { TRACEBACK_CORPUS } from '../utils/ai/eval/traceback-corpus.js'
import { buildChatMessages } from '../utils/ai/chat-helpers.js'
import {
  runTracebackCase,
  analyzeTracebackCase,
  summarizeTracebackMetrics,
  buildTracebackReport,
  formatMetricLine
} from '../utils/ai/eval/traceback-eval.js'

/** 固定「现在」，让 days_ago 与时间窗判定可复现 */
const NOW = new Date('2026-10-19T15:00:00+08:00').getTime()

/** 逐例重置存储 → 播种 → 观测（顺序敏感：存储是全局单例） */
function runAll() {
  const rows = []
  TRACEBACK_CORPUS.forEach(caze => {
    resetStorage()
    rows.push(analyzeTracebackCase(caze, runTracebackCase(caze, { now: NOW })))
  })
  return rows
}

const ROWS = runAll()
const M = summarizeTracebackMetrics(ROWS)
const rowById = (id) => ROWS.find(r => r.id === id)

if (process.env.TRACEBACK_EVAL_REPORT) {
  // eslint-disable-next-line no-console
  console.log('\n' + buildTracebackReport(ROWS) + '\n')
}

// 把可复现报告落盘（幂等）：$env:TRACEBACK_EVAL_OUT="docs/关系回溯触发评估.md"; npx vitest run tests/relation-traceback-trigger.test.js
// 生成部分在 ANALYSIS_MARKER 之前；标记之后是人工维护的分析段，重新生成时**原样保留**，避免冲掉结论。
const ANALYSIS_MARKER = '<!-- 人工分析（生成器保留此标记之后的内容） -->'
if (process.env.TRACEBACK_EVAL_OUT) {
  const { writeFileSync, readFileSync, existsSync } = await import('node:fs')
  const out = process.env.TRACEBACK_EVAL_OUT
  let tail = ''
  if (existsSync(out)) {
    const old = readFileSync(out, 'utf8')
    const at = old.indexOf(ANALYSIS_MARKER)
    if (at >= 0) tail = old.slice(at + ANALYSIS_MARKER.length)
  }
  writeFileSync(out, buildTracebackReport(ROWS) + '\n' + ANALYSIS_MARKER + '\n' + tail, 'utf8')
}

if (process.env.TRACEBACK_EVAL_DEBUG) {
  const ids = process.env.TRACEBACK_EVAL_DEBUG.split(',')
  // eslint-disable-next-line no-console
  console.log('\n[DEBUG ROWS]\n' + JSON.stringify(ROWS.filter(r => ids.includes(r.id)), null, 2))
  resetStorage()
  const dbg = runTracebackCase(TRACEBACK_CORPUS.find(c => c.id === ids[0]), { now: NOW })
  // eslint-disable-next-line no-console
  console.log('\n[DEBUG CTX]\n' + dbg.ctx + '\n')
}

describe('硬不变量（现在就必须成立）', () => {
  it('没人名指向 / 人物未收录 → 绝不注入任何人的互动记录', () => {
    const mustNotInject = [
      'doubt-no-person',        // "他是不是不想理我了"：有意图但没点名
      'generic-why-cold',       // 泛化讨论
      'generic-colleague-cold',
      'generic-movie',
      'unknown-person',         // 老李不在库里
      'unknown-person-cold'
    ]
    mustNotInject.forEach(id => {
      expect(rowById(id).injected, `${id} 不该注入`).toBe(false)
    })
  })

  it('无互动记录时如实说明，不编造（安全断言全过）', () => {
    expect(M.safetyOk).toBe(true)
    expect(M.safetyFailIds).toEqual([])
  })

  it('明确关系变化的 6 种说法全部触发并关联正确人物', () => {
    const explicit = ROWS.filter(r => r.category === 'explicit_change')
    expect(explicit.length).toBe(6)
    explicit.forEach(r => {
      expect(r.injected, `${r.id} 应注入`).toBe(true)
      expect(r.person, `${r.id} 应关联到人物`).toBe('阿伟')
    })
  })

  it('一般情绪倾诉在意图层就不命中（第一道门挡住）', () => {
    expect(rowById('mood-bad').intent).toBe(false)
    expect(rowById('mood-tired').intent).toBe(false)
  })

  it('注入即关联正确人物（人物匹配准确率 100%）', () => {
    expect(M.personAccuracy).toBe(1)
    expect(M.personWrongIds).toEqual([])
  })

  it('报告可复现：同一份语料生成同一份正文', () => {
    expect(buildTracebackReport(ROWS)).toBe(buildTracebackReport(runAll()))
    expect(buildTracebackReport(ROWS)).toContain('召回率')
  })

  it('指标口径可用（七行都能打印）', () => {
    const lines = ['recall', 'falseInjection', 'person', 'safety', 'multi', 'optional', 'blocked']
      .map(k => formatMetricLine(M, k))
    expect(lines.every(l => l.length > 0)).toBe(true)
  })
})

describe('基线快照（实测值，防止后续悄悄恶化）', () => {
  it('召回率不低于 9/13（明确类 6/6 全中）', () => {
    expect(M.needInjection).toBe(13)
    expect(M.recall).toBeGreaterThanOrEqual(9 / 13)
    expect(rowById('explicit-away').injected).toBe(true)
    expect(rowById('self-still-triggers-after-fix').injected).toBe(true)
  })

  it('注入层误触发率保持 0/14', () => {
    expect(M.forbidInjection).toBe(14)
    expect(M.falseInjectionRate).toBe(0)
  })

  it('历史询问不强制注入（可走 query_interaction 兜底）', () => {
    expect(M.optionalCount).toBe(2)
  })

  it('第一道门拦下了含蓄说法与历史询问（说明放宽意图门有空间）', () => {
    ;['implicit-weird', 'implicit-not-like-before', 'implicit-no-topic', 'history-how-was-it', 'history-when']
      .forEach(id => expect(rowById(id).blockedByIntent, `${id} 应被意图门拦下`).toBe(true))
  })

  it('第二道门拦下两类：没人名指向 + 第三人关系归属', () => {
    expect(M.blockedByPersonIds.sort()).toEqual([
      'doubt-no-person',
      'generic-why-cold', 'generic-colleague-cold', 'generic-movie',
      'third-party-relationship', 'third-party-say-another-person',
      'unknown-person-cold'
    ].sort())
  })

  it('本轮修复没有改变基线以外的行为：含蓄说法仍未触发（缺口 1 待修）', () => {
    expect(rowById('implicit-baseline-unchanged').intent).toBe(false)
    expect(rowById('implicit-baseline-unchanged').injected).toBe(false)
  })
})

describe('缺口 3 已修复：第三人关系不再错误归属', () => {
  const THIRD_PARTY_IDS = [
    'third-party-relationship',        // 阿伟说他跟女朋友关系变差了
    'third-party-i-think',             // 我觉得阿伟最近跟女朋友闹矛盾了
    'third-party-family',              // 阿伟说他最近和家里人不太和睦
    'third-party-reported-quarrel',    // 阿伟跟我说，他最近不太想理女朋友
    'third-party-say-another-person'   // 阿伟说他跟小王关系变差了
  ]

  it('5 种第三人说法全部不注入回溯', () => {
    THIRD_PARTY_IDS.forEach(id => {
      expect(rowById(id).injected, `${id} 不该注入`).toBe(false)
    })
  })

  it('挡住它们的是人物门（归属判定），不是碰巧没命中意图', () => {
    // 至少 first 与 fifth 的意图是命中的 —— 只有归属规则能挡住
    expect(rowById('third-party-relationship').intent).toBe(true)
    expect(rowById('third-party-say-another-person').intent).toBe(true)
    expect(rowById('third-party-relationship').contextBuilt).toBe(false)
    expect(rowById('third-party-say-another-person').contextBuilt).toBe(false)
  })

  it('用户自己的关系不受影响（对照组）', () => {
    expect(rowById('self-still-triggers-after-fix').injected).toBe(true)
    expect(rowById('explicit-cold').injected).toBe(true)      // 阿伟最近对我很冷淡
    expect(rowById('doubt-with-person').injected).toBe(true)  // 小王是不是讨厌我了
  })

  it('第三人关系消息的其他上下文照常处理（只跳回溯，不屏蔽整条消息）', () => {
    const system = buildChatMessages('阿伟说他跟女朋友关系变差了', [], {})[0].content
    expect(system).toContain('关系图谱')      // 正常的关系卡片上下文仍在
    expect(system).toContain('阿伟')
    expect(system).not.toContain('关系回溯')  // 只有回溯被跳过
  })
})

describe('已知缺口（本轮只修了缺口 3；下面这些仍是当前缺陷，修好后 these tests 会失败并提醒移除）', () => {
  it.fails('缺口 1：含蓄说法「阿伟最近有点怪怪的」当前不触发回溯（漏触发）', () => {
    expect(rowById('implicit-weird').injected).toBe(true)
  })

  it.fails('缺口 1b：「感觉和阿伟不如以前了」当前不触发（漏触发）', () => {
    expect(rowById('implicit-not-like-before').injected).toBe(true)
  })

  it.fails('缺口 2：多人场景当前静默只选一个人（且按最近互动挑）', () => {
    expect(rowById('multi-explicit').multiPerson).toBe('multi')
  })

  it('缺口记录已写进报告（多人类与漏触发清单可直接查）', () => {
    expect(M.multiSilentPickIds).toContain('multi-explicit')
    expect(M.missedIds).toContain('implicit-weird')
    // 缺口 3 已修复：误触发清单现在应为空
    expect(M.falseInjectionIds).toEqual([])
  })
})
