/**
 * test: 画像摘要注入（4.36.0）
 *
 * 锁死四件事（对应本轮审查提出的 4 个修正点）：
 *  1. 预算约束的是**最终输出**（标题 + 正文 + 尾注一起算），不是字段预算
 *  2. 不无条件声明「以摘要为准」—— 可变信息必须让位于更近期的记录
 *  3. lite 不等于闲聊，不按模式名打折（摘要长度在两种模式下一致）
 *  4. 画像关闭后 getProfileValues 返回空数组（记忆不再被画像字段过滤）
 *
 * 断言对象是 buildChatMessages 产出的 messages[0].content —— 防「函数写对了但没接上」的回归。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import './setup.js'
import { resetStorage } from './setup.js'
import { buildChatMessages } from '../utils/ai/chat-helpers.js'
import { saveProfile } from '../utils/profile.js'
import {
  buildProfileContextBrief,
  PROFILE_BRIEF_MAX_CHARS,
  PROFILE_FIELD_MAX_CHARS
} from '../utils/profileContext.js'
import { getProfileValues } from '../utils/memory/profile-values.js'
import { buildMemoryContext } from '../utils/memory/context.js'

const BRIEF_TAG = '【用户画像摘要】'

/** 种一张 portrait 卡 */
function seedPortrait(fields, enabled = true) {
  saveProfile({
    enabled,
    version: 2,
    cards: [{ id: 'portrait', title: '我的画像', icon: 'sparkle', fields, source: 'manual', createdAt: Date.now() }],
    updatedAt: Date.now()
  })
}

/** 取 system 里画像段的原文（没有则返回 ''） */
function briefOf(system) {
  const i = system.indexOf(BRIEF_TAG)
  if (i < 0) return ''
  const j = system.indexOf('\n', system.indexOf('\n', i) + 1)
  return system.slice(i, j > 0 ? j : system.length)
}

beforeEach(() => {
  resetStorage()
})

describe('buildProfileContextBrief：开关与空态', () => {
  it('画像开关关闭 → 不生成摘要，system 里也没有', () => {
    seedPortrait({ 职业方向: 'AI 工程' }, false)
    expect(buildProfileContextBrief()).toBeNull()
    expect(buildChatMessages('今天有点累', [], {})[0].content).not.toContain(BRIEF_TAG)
  })

  it('画像为空（无 portrait 卡）→ 不注入、不报错', () => {
    saveProfile({ enabled: true, version: 2, cards: [], updatedAt: Date.now() })
    expect(buildProfileContextBrief()).toBeNull()
    expect(() => buildChatMessages('今天有点累', [], {})).not.toThrow()
  })

  it('只有非 portrait 卡 → 不注入（其余卡片走 get_profile 按需）', () => {
    saveProfile({
      enabled: true, version: 2, updatedAt: Date.now(),
      cards: [{ id: 'custom_x', title: '杂项', fields: { 咖啡: '美式' }, source: 'manual' }]
    })
    expect(buildProfileContextBrief()).toBeNull()
  })
})

describe('预算：约束最终输出（修正点 1）', () => {
  it('开启 + 正常字段 → 注入摘要，且总长 ≤ 预算', () => {
    seedPortrait({ 当前阶段: '23 岁，学生到社会人过渡', 职业方向: 'AI 工程' })
    const brief = buildProfileContextBrief()
    expect(brief).not.toBeNull()
    expect(brief.text).toContain('职业方向：AI 工程')
    expect(brief.chars).toBe(brief.text.length)
    expect(brief.text.length).toBeLessThanOrEqual(PROFILE_BRIEF_MAX_CHARS)

    const system = buildChatMessages('我该往哪个方向发展', [], {})[0].content
    expect(system).toContain(BRIEF_TAG)
    expect(system).toContain('职业方向：AI 工程')
  })

  it('字段很多时按预算裁剪：总长仍 ≤ 预算，高优先级字段优先保留', () => {
    const fields = {}
    // 20 个字段，每个 200 字，全部超长 → 必然触发裁剪
    for (let i = 0; i < 20; i++) fields[`字段${i}`] = '填'.repeat(200)
    fields['当前阶段'] = '过渡期'
    fields['职业方向'] = 'AI 工程'
    fields['人生关键词'] = '不要后悔'
    seedPortrait(fields)

    const brief = buildProfileContextBrief()
    expect(brief.text.length).toBeLessThanOrEqual(PROFILE_BRIEF_MAX_CHARS)
    expect(brief.dropped).toBeGreaterThan(0)
    // 白名单靠前的三个必须活下来
    expect(brief.text).toContain('当前阶段：过渡期')
    expect(brief.text).toContain('职业方向：AI 工程')
    expect(brief.text).toContain('人生关键词：不要后悔')
  })

  it('单字段超长 → 截断到字段上限并带省略号', () => {
    seedPortrait({ 当前阶段: '长'.repeat(500) })
    const brief = buildProfileContextBrief()
    const firstLine = brief.text.split('\n')[1]
    const value = firstLine.slice(firstLine.indexOf('：') + 1)
    expect(value.length).toBeLessThanOrEqual(PROFILE_FIELD_MAX_CHARS + 1) // +1 = 省略号
    expect(value.endsWith('…')).toBe(true)
  })

  it('maxChars 可注入（回归：不同预算都要守住上限）', () => {
    seedPortrait({ 当前阶段: 'A'.repeat(80), 职业方向: 'B'.repeat(80), MBTI: 'INTJ' })
    const small = buildProfileContextBrief({ maxChars: 200 })
    expect(small.text.length).toBeLessThanOrEqual(200)
    const big = buildProfileContextBrief({ maxChars: 900 })
    expect(big.text.length).toBeLessThanOrEqual(900)
  })
})

describe('冲突语义（修正点 2）', () => {
  it('不声明「以摘要为准」；明确可变信息以更近记录为准', () => {
    seedPortrait({ 职业方向: 'AI 工程' })
    const text = buildProfileContextBrief().text
    expect(text).not.toContain('以本摘要为准')
    expect(text).toContain('以更近期的记录为准')
    expect(text).toContain('稳定性内容可长期沿用')
  })
})

describe('lite 与完整档一致（修正点 3）', () => {
  it('lite 判据是无指令无金额，不代表闲聊 → 两档摘要长度一致、都不打折', () => {
    seedPortrait({ 当前阶段: '过渡期', 职业方向: 'AI 工程', 人生关键词: '不要后悔' })
    // 无指令动词 → lite；含金额 → 完整档
    const liteMsgs = buildChatMessages('最近总觉得自己没什么长进', [], {})
    const fullMsgs = buildChatMessages('帮我记一下今天花了25块', [], {})
    const liteBrief = briefOf(liteMsgs[0].content)
    const fullBrief = briefOf(fullMsgs[0].content)
    expect(liteBrief).not.toBe('')
    expect(fullBrief).not.toBe('')
    expect(liteBrief.length).toBe(fullBrief.length)
    expect(liteBrief.length).toBeLessThanOrEqual(PROFILE_BRIEF_MAX_CHARS + 2) // +2 补取段时的换行容差
  })
})

describe('注入位置', () => {
  it('画像摘要排在「用户近期数据」之后（先数据概览，再画像）', () => {
    seedPortrait({ 职业方向: 'AI 工程' })
    const system = buildChatMessages('我最近在想要不要换方向', [], {})[0].content
    const iData = system.indexOf('用户近期数据')
    const iBrief = system.indexOf(BRIEF_TAG)
    expect(iData).toBeGreaterThan(-1)
    expect(iBrief).toBeGreaterThan(iData)
  })
})

describe('记忆过滤与开关一致（修正点 4）', () => {
  it('画像开启 → 命中画像字段值的 fact 记忆不再注入', () => {
    seedPortrait({ location: '杭州' }, true)
    uni.setStorageSync('siji_long_term_memory', JSON.stringify([
      { id: 'm1', content: '我住在杭州', category: 'fact', createdAt: Date.now() }
    ]))
    expect(getProfileValues()).toContain('杭州')
    expect(buildMemoryContext('')).not.toContain('我住在杭州')
  })

  it('画像关闭 → 记忆不再被画像字段过滤（开关语义一致）', () => {
    seedPortrait({ location: '杭州' }, false)
    uni.setStorageSync('siji_long_term_memory', JSON.stringify([
      { id: 'm1', content: '我住在杭州', category: 'fact', createdAt: Date.now() }
    ]))
    expect(getProfileValues()).toEqual([])
    expect(buildMemoryContext('')).toContain('我住在杭州')
  })
})
