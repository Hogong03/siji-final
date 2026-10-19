/**
 * test: 关系回溯端到端回归（4.45.0）
 *
 * 目的：触发规则已经四轮打磨，这一轮验证的不是"规则能不能识别"，
 * 而是**接入真实业务链路后**是否稳定：
 *
 *   用户消息 → detectTracebackIntent → selectTracebackPersons → analyzeTracebackOwnership
 *            → buildTracebackContext → buildChatMessages 组装 → （AI 生成回答）
 *
 * 断言对象一律是 **buildChatMessages 产出的 messages[0].content**（真正发给模型的提示词），
 * 而不是中间函数的返回值 —— 中间函数通过不代表链路没遗漏。
 *
 * 数据固定、不调模型：交互时间基于 Date.now() 现算天数，断言只落在稳定子串
 * （互动内容 / 结果 / 情绪 / 段落标题），不依赖"N 天前"这类随时间变化的文案。
 *
 * 回答层（AI 会不会把推测当事实说出口）不在单元测试范围内：
 * 由真实模型语料 utils/ai/eval/cases.js 的 relation-traceback-facts-not-verdicts 与
 * docs/关系回溯观察记录.md 的观察窗口负责；这里只断言提示词确实给了约束。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import './setup.js'
import { resetStorage } from './setup.js'
import { setActivePinia, createPinia } from 'pinia'
import { useDataStore } from '../store/data.js'
import { createRelation, logInteraction } from '../utils/relations.js'
import { buildChatMessages } from '../utils/ai/chat-helpers.js'

const DAY = 86400000
const TRACEBACK_TAG = '关系回溯（'
/**
 * 固定数据里的互动文案必须是**唯一文案**：不能与提示词自带的例句撞车
 * （BEHAVIOR_RULES 里就有「今天和阿伟吃了午饭」这个例子，撞了会误判成链路泄漏）。
 * 下面的 UNIQUE_TEXTS 由「夹具唯一性自检」守住。
 */
const UNIQUE_TEXTS = ['在楼下吃了牛肉面', '他先付的钱', '借我一本人类简史', '还没还给我', '一起过了季度数据']
let store
let now

beforeEach(() => {
  resetStorage()
  setActivePinia(createPinia())
  store = useDataStore()
  now = Date.now()
})

/** 固定数据：阿伟 2 条互动（含结果与情绪）、小王 1 条 */
function seedPeople() {
  const awei = createRelation({ name: '阿伟', role: '朋友' }, { trustScore: true })
  logInteraction({ relation_id: awei.id, relation_name: '阿伟', scene: '午餐', content: '在楼下吃了牛肉面', result: '他先付的钱', emotion: '开心', date: now - 2 * DAY })
  logInteraction({ relation_id: awei.id, relation_name: '阿伟', scene: '微信', content: '借我一本人类简史', result: '还没还给我', emotion: '失望', date: now - 9 * DAY })

  const xiaowang = createRelation({ name: '小王', role: '同事' }, { trustScore: true })
  logInteraction({ relation_id: xiaowang.id, relation_name: '小王', scene: '会议', content: '一起过了季度数据', emotion: '平静', date: now - 1 * DAY })

  return { awei, xiaowang }
}

/** 真实入口：组装发给模型的 system 提示词 */
function promptFor(message) {
  return buildChatMessages(message, [], { provider: 'deepseek' })[0].content
}

describe('夹具自检：要断言的文案不会出现在无关提示词里', () => {
  it('无关消息的提示词不含任何夹具互动文案（否则"不含"类断言会被提示词例句骗过）', () => {
    seedPeople()
    const prompt = promptFor('今天天气不错')
    UNIQUE_TEXTS.forEach(t => {
      expect(prompt, `夹具文案「${t}」与提示词自带文本撞车了，请换一条唯一文案`).not.toContain(t)
    })
  })
})

describe('端到端：消息 → 意图 → 选人 → 归属 → 上下文 → 提示词', () => {
  it('① 明确关系变化：正确人物的互动事实进入最终提示词', () => {
    seedPeople()
    const prompt = promptFor('为什么我和阿伟最近疏远了')
    expect(prompt).toContain(`${TRACEBACK_TAG}阿伟`)
    expect(prompt).toContain('在楼下吃了牛肉面')
    expect(prompt).toContain('结果：他先付的钱')      // 事实带结果
    expect(prompt).not.toContain(`${TRACEBACK_TAG}小王`)
  })

  it('② 含蓄表达：意图命中，人物筛选与上下文构建全通，且事实进提示词', () => {
    seedPeople()
    const prompt = promptFor('感觉和阿伟不如以前了')
    expect(prompt).toContain(`${TRACEBACK_TAG}阿伟`)
    expect(prompt).toContain('借我一本人类简史')
    expect(prompt).toContain('你的感受')
  })

  it('③ 第三人关系：不注入错误人物的回溯', () => {
    seedPeople()
    const prompt = promptFor('阿伟说他跟女朋友关系变差了')
    expect(prompt).not.toContain(TRACEBACK_TAG)
    // 阿伟的互动事实也不能借别的形式泄漏进回溯段
    expect(prompt).not.toContain('在楼下吃了牛肉面')
  })

  it('④ 多人关系：每人独立成段、顺序按消息出现、不超过上限', () => {
    seedPeople()
    const prompt = promptFor('我和小王、阿伟都疏远了')
    const sections = prompt.match(/关系回溯（/g) || []
    expect(sections.length).toBe(2)
    // 顺序按消息里出现的先后（小王在前），而不是按最近互动
    expect(prompt.indexOf(`${TRACEBACK_TAG}小王`)).toBeLessThan(prompt.indexOf(`${TRACEBACK_TAG}阿伟`))
    expect(prompt).toContain('各对应一个人')
  })

  it('④b 三人符合条件时只展开 2 人（上限是注入上限，超出者确定性丢弃）', () => {
    seedPeople()
    const xiaoli = createRelation({ name: '小李', role: '同学' }, { trustScore: true })
    logInteraction({ relation_id: xiaoli.id, relation_name: '小李', scene: '聚会', content: '和小李聚会', date: now - 60 * DAY })

    const prompt = promptFor('我最近和阿伟、小王、小李都疏远了')
    const sections = prompt.match(/关系回溯（/g) || []
    expect(sections.length).toBe(2)
    expect(prompt).toContain(`${TRACEBACK_TAG}阿伟`)
    expect(prompt).toContain(`${TRACEBACK_TAG}小王`)
    expect(prompt).not.toContain(`${TRACEBACK_TAG}小李`)
  })

  it('⑤ 没有明确人物指向：不擅自选一个关系对象', () => {
    seedPeople()
    const prompt = promptFor('他是不是不想理我了')
    expect(prompt).not.toContain(TRACEBACK_TAG)
    expect(prompt).not.toContain('在楼下吃了牛肉面')   // 不能随便拿一个人的历史顶上
    expect(prompt).not.toContain('一起过了季度数据')
  })

  it('⑥ 没有历史记录：如实说明没记录，不编造互动或感受', () => {
    createRelation({ name: '阿伟', role: '朋友' }, { trustScore: true }) // 无任何互动
    const prompt = promptFor('为什么阿伟最近不理我了')
    expect(prompt).toContain(`${TRACEBACK_TAG}阿伟`)
    expect(prompt).toContain('没有记录到')
    expect(prompt).toContain('不能')                 // 不能证明关系变差
    expect(prompt).toContain('不许说')               // 反面例句约束
  })

  it('⑦ 历史事实查询：不走回溯，走 query_interaction（两条路径不混）', () => {
    const { awei } = seedPeople()
    const prompt = promptFor('上次我和阿伟聊得怎么样？')
    expect(prompt).not.toContain(TRACEBACK_TAG)

    const r = store.executeAction({ type: 'query_interaction', payload: { relation_id: awei.id } })
    expect(r.success).toBe(true)
    expect(r.message).toContain('结果：他先付的钱')
    expect(r.message).toContain('用户当时的情绪：开心')
    expect(r.detail.count).toBe(2)
  })

  it('⑧ 回溯被归属拦截时，关系图谱 / 记忆等合法上下文仍正常注入', () => {
    const { awei } = seedPeople()
    uni.setStorageSync('siji_long_term_memory', JSON.stringify([
      { id: 'm1', content: '阿伟是我大学同学', category: 'fact', created_at: now }
    ]))

    const prompt = promptFor('阿伟说他跟女朋友关系变差了')
    expect(prompt).not.toContain(TRACEBACK_TAG)          // 回溯被拦
    expect(prompt).toContain('关系图谱')                  // 关系卡片照常
    expect(prompt).toContain('亲密度')
    expect(prompt).toContain('阿伟是我大学同学')           // 记忆照常
    expect(awei.id).toBeTruthy()
  })

  it('⑨ 回答层约束确实进了提示词（生成质量由真实模型语料 + 观察窗口负责）', () => {
    seedPeople()
    const prompt = promptFor('为什么我和阿伟最近疏远了')
    expect(prompt).toContain('原因只能作为**推测**提出')
    expect(prompt).toContain('禁止断言对方的态度或想法')
    // 提示词里不该出现用户的亲密度分数（来源未必可追溯，不能当关系变化证据）
    expect(prompt).not.toContain('关系回溯（阿伟，只依据用户自己记录的内容，最近 90 天）：\n【事实】亲密度')
  })
})

describe('兜底路径：query_interaction 与回溯互不干扰', () => {
  it('回溯触发时仍可单独查互动记录（两条路径各自独立）', () => {
    const { awei } = seedPeople()
    // 触发回溯的消息
    const p1 = promptFor('我和阿伟最近疏远了')
    expect(p1).toContain(TRACEBACK_TAG)

    // 同一份数据走查询路径，拿到事实与感受分开标注的结果
    const q = store.executeAction({ type: 'query_interaction', payload: { relation_id: awei.id } })
    expect(q.message).toContain('共 2 条互动记录')
    expect(q.message).toContain('（结果：还没还给我）')
    expect(q.message).toContain('（用户当时的情绪：失望）')
  })

  it('查询路径不需要任何关系变化语义（纯事实查询也能用）', () => {
    const { xiaowang } = seedPeople()
    const q = store.executeAction({ type: 'query_interaction', payload: { relation_id: xiaowang.id } })
    expect(q.success).toBe(true)
    expect(q.detail.count).toBe(1)
    expect(q.message).toContain('一起过了季度数据')
  })

  it('溯源：提示词里的回溯段与查询结果用的是同一份互动数据', () => {
    const { awei } = seedPeople()
    const prompt = promptFor('为什么我和阿伟疏远了')
    const q = store.executeAction({ type: 'query_interaction', payload: { relation_id: awei.id } })
    // 两个入口都要能看到同一批事实
    expect(prompt).toContain('在楼下吃了牛肉面')
    expect(q.message).toContain('在楼下吃了牛肉面')
    expect(prompt).toContain('借我一本人类简史')
    expect(q.message).toContain('借我一本人类简史')
  })
})
