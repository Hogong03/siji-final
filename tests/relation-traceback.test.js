/**
 * test: 关系事件回溯（4.40.0）
 *
 * 目标：用户问「为什么我最近觉得和小王疏远了」时，系统先摆事实与用户自己的感受，
 * 原因只能作为推测提出。三层必须分离且可断言：
 *   【事实】 = 用户记录过的互动（时间/场景/做了什么/结果）
 *   【你的感受】 = 用户自己写下的情绪（不是 AI 判断的）
 *   【表达规则】 = 原因只能推测并标注，禁止断言对方态度
 *
 * 数据全部复用现有 siji_interactions，不新增存储字段。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import './setup.js'
import { resetStorage } from './setup.js'
import { setActivePinia, createPinia } from 'pinia'
import { useDataStore } from '../store/data.js'
import { createRelation, logInteraction } from '../utils/relations.js'
import {
  classifyEmotion,
  getRelationTimeline,
  summarizeEmotionShift,
  detectTracebackIntent,
  buildTracebackContext
} from '../utils/relation-traceback.js'
import { buildChatMessages } from '../utils/ai/chat-helpers.js'
import { BEHAVIOR_RULES } from '../utils/ai/prompt-actions.js'

const DAY = 86400000
let store
let now

beforeEach(() => {
  resetStorage()
  setActivePinia(createPinia())
  store = useDataStore()
  now = Date.now()
})

function addPerson(name, extra = {}) {
  return createRelation({ name, role: extra.role || '朋友' }, { trustScore: true })
}

/** 记录一次互动，daysAgo 天前 */
function addInteraction(rel, daysAgo, { scene = '日常', content = '', result = '', emotion = '' } = {}) {
  return logInteraction({
    relation_id: rel.id,
    relation_name: rel.name,
    scene, content, result, emotion,
    date: now - daysAgo * DAY
  })
}

describe('情绪极性归类', () => {
  it('正面 / 负面 / 中性 / 空', () => {
    expect(classifyEmotion('开心')).toBe('positive')
    expect(classifyEmotion('烦躁')).toBe('negative')
    expect(classifyEmotion('一般')).toBe('neutral')
    expect(classifyEmotion('')).toBe('unknown')
    expect(classifyEmotion(null)).toBe('unknown')
  })

  it('否定式正面算负面（「不太开心」不能当正面）', () => {
    expect(classifyEmotion('不太开心')).toBe('negative')
    expect(classifyEmotion('不开心')).toBe('negative')
  })
})

describe('按人回溯时间线', () => {
  it('只取该人物的互动，按时间倒序，带 days_ago', () => {
    const a = addPerson('阿伟')
    const b = addPerson('小明')
    addInteraction(a, 3, { scene: '午餐', content: '一起吃饭', result: '聊得还行', emotion: '开心' })
    addInteraction(a, 10, { scene: '微信', content: '问他借书', result: '没回', emotion: '失望' })
    addInteraction(b, 1, { content: '不该出现' })

    const line = getRelationTimeline(a.id, { now })
    expect(line.length).toBe(2)
    expect(line[0].content).toBe('一起吃饭')      // 最近的在最前
    expect(line[0].days_ago).toBe(3)
    expect(line[1].days_ago).toBe(10)
    expect(line.map(i => i.content)).not.toContain('不该出现')
    expect(line[0].polarity).toBe('positive')
    expect(line[1].polarity).toBe('negative')
  })

  it('时间窗外的记录不计入', () => {
    const a = addPerson('阿伟')
    addInteraction(a, 5, { content: '近期' })
    addInteraction(a, 200, { content: '很久以前' })
    const line = getRelationTimeline(a.id, { sinceDays: 90, now })
    expect(line.map(i => i.content)).toEqual(['近期'])
  })

  it('limit 生效', () => {
    const a = addPerson('阿伟')
    for (let i = 0; i < 6; i++) addInteraction(a, i + 1, { content: `第${i}条` })
    expect(getRelationTimeline(a.id, { limit: 3, now }).length).toBe(3)
  })

  it('无 relationId 或无人互动时返回空数组', () => {
    expect(getRelationTimeline('', { now })).toEqual([])
    const a = addPerson('阿伟')
    expect(getRelationTimeline(a.id, { now })).toEqual([])
  })
})

describe('情绪走向', () => {
  it('近期负面占比明显升高 → down', () => {
    const a = addPerson('阿伟')
    // 新的 2 条负面，旧的 2 条正面（时间线新→旧）
    addInteraction(a, 1, { emotion: '烦躁' })
    addInteraction(a, 2, { emotion: '失望' })
    addInteraction(a, 20, { emotion: '开心' })
    addInteraction(a, 25, { emotion: '愉快' })
    const shift = summarizeEmotionShift(getRelationTimeline(a.id, { now }))
    expect(shift.trend).toBe('down')
    expect(shift.negative).toBe(2)
    expect(shift.positive).toBe(2)
  })

  it('样本不足（带情绪 < 4 条）→ unknown，不硬给走向', () => {
    const a = addPerson('阿伟')
    addInteraction(a, 1, { emotion: '烦躁' })
    addInteraction(a, 3, { emotion: '开心' })
    expect(summarizeEmotionShift(getRelationTimeline(a.id, { now })).trend).toBe('unknown')
  })

  it('没记录情绪 → sample 为 0', () => {
    const a = addPerson('阿伟')
    addInteraction(a, 1, { content: '只记了事，没记情绪' })
    const shift = summarizeEmotionShift(getRelationTimeline(a.id, { now }))
    expect(shift.sample).toBe(0)
    expect(shift.unknown).toBe(1)
  })
})

describe('回溯意图识别', () => {
  it('关系变化类提问命中', () => {
    expect(detectTracebackIntent('为什么我最近觉得和小王疏远了')).toBe(true)
    expect(detectTracebackIntent('他最近对我变冷淡了')).toBe(true)
    expect(detectTracebackIntent('我们的关系是不是变差了')).toBe(true)
  })

  it('普通互动记录不命中', () => {
    expect(detectTracebackIntent('今天和阿伟吃了午饭')).toBe(false)
    expect(detectTracebackIntent('帮我记一笔账，25 块')).toBe(false)
  })
})

describe('回溯上下文：三层分离', () => {
  it('有互动有情绪 → 事实/感受/表达规则三段齐全', () => {
    const a = addPerson('阿伟')
    addInteraction(a, 2, { scene: '午餐', content: '和阿伟吃了午饭', result: '聊得还行', emotion: '开心' })
    addInteraction(a, 9, { scene: '微信', content: '问他借书', result: '没回', emotion: '失望' })

    const ctx = buildTracebackContext('为什么我最近觉得和阿伟疏远了', { now })
    expect(ctx).toContain('关系回溯（阿伟')
    expect(ctx).toContain('【事实】')
    expect(ctx).toContain('2 天前 · 午餐：和阿伟吃了午饭')
    expect(ctx).toContain('结果：聊得还行')
    expect(ctx).toContain('【你的感受】')
    expect(ctx).toContain('【表达规则】')
    expect(ctx).toContain('推测')
    expect(ctx).toContain('禁止断言对方的态度或想法')
  })

  it('没有互动记录 → 如实说明「没有记录」，并明确不能当关系变差的证据', () => {
    const a = addPerson('阿伟')
    const ctx = buildTracebackContext('为什么阿伟最近不理我了', { now })
    expect(ctx).toContain('【事实】')
    expect(ctx).toContain('没有记录到')
    expect(ctx).toContain('不能')       // 不能证明关系变差
    expect(ctx).not.toContain('结果：')
  })

  it('没记录情绪 → 不替用户编造感受', () => {
    const a = addPerson('阿伟')
    addInteraction(a, 1, { content: '见过一面' })
    const ctx = buildTracebackContext('为什么我和阿伟疏远了', { now })
    expect(ctx).toContain('没有记录过情绪')
    expect(ctx).toContain('不要替用户编造感受')
  })

  it('没提到任何已收录人物 → 不注入（不猜是谁）', () => {
    const a = addPerson('阿伟')
    addInteraction(a, 1, { content: 'x' })
    expect(buildTracebackContext('为什么我最近总觉得很疏远', { now })).toBe('')
  })

  it('多个人被提到时取最近有互动的那个', () => {
    const a = addPerson('阿伟')
    const b = addPerson('小明')
    addInteraction(a, 30, { content: '很久以前和阿伟' })
    addInteraction(b, 1, { content: '昨天和小明' })
    const ctx = buildTracebackContext('为什么我和阿伟、小明都疏远了', { now })
    expect(ctx).toContain('关系回溯（小明')
  })

  it('事实里不含 intimacy 分数（分数不能当关系变化的证据）', () => {
    const a = addPerson('阿伟')
    addInteraction(a, 1, { content: '吃饭' })
    const ctx = buildTracebackContext('为什么我和阿伟疏远了', { now })
    expect(ctx).not.toContain('亲密度')
  })
})

describe('注入链路：只在关系变化提问时进 prompt', () => {
  it('命中意图 → system 含回溯三段', () => {
    const a = addPerson('阿伟')
    addInteraction(a, 2, { scene: '午餐', content: '和阿伟吃了午饭', emotion: '烦躁' })
    const system = buildChatMessages('为什么我最近觉得和阿伟疏远了', [], {})[0].content
    expect(system).toContain('关系回溯（阿伟')
    expect(system).toContain('【表达规则】')
  })

  it('普通消息 → 不注入回溯', () => {
    const a = addPerson('阿伟')
    addInteraction(a, 2, { content: '和阿伟吃了午饭' })
    const system = buildChatMessages('今天和阿伟吃了午饭', [], {})[0].content
    expect(system).not.toContain('【表达规则】')
  })

  it('行为准则里有「先事实后推测」这条规则', () => {
    const rule = BEHAVIOR_RULES.find(r => r.includes('先摆【事实】'))
    expect(rule).toBeTruthy()
    expect(rule).toContain('推测')
    expect(rule).toContain('禁止断言')
  })
})

describe('query_interaction：事实与感受分开标注', () => {
  it('返回内容带「结果」与「用户当时的情绪」', () => {
    const a = addPerson('阿伟')
    addInteraction(a, 1, { scene: '午餐', content: '一起吃饭', result: '聊得还行', emotion: '开心' })
    const r = store.executeAction({ type: 'query_interaction', payload: { relation_id: a.id } })
    expect(r.success).toBe(true)
    expect(r.message).toContain('共 1 条互动记录')
    expect(r.message).toContain('结果：聊得还行')
    expect(r.message).toContain('用户当时的情绪：开心')
    expect(r.detail.count).toBe(1)
    expect(r.detail.items[0].content).toBe('一起吃饭')
  })
})
