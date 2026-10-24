/**
 * ai-guide.test.js — 引导式表达（4.48.0）
 *
 * 锁三件事：
 *  1. 提示层：`## 引导式表达` 段只在开关打开时进 system prompt，且三种路径（full/lite/agentMode）都覆盖
 *  2. 兜底层：chips 是「用户下一句」的短句，具体、最多 2 条、不含评价/催促式伪建议
 *  3. 温柔底线：压力词不出现在引导里；陪伴类回复不推进；执行完写操作不补引导
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { resetStorage } from './setup.js'
import './setup.js'
import {
  GUIDE_SECTION, GUIDE_KINDS, PRESSURE_WORDS, buildGuideSection,
  pickGuideChips, hasGuideTail, guideKindOf
} from '../utils/ai/guide.js'
import { buildSystemPrompt, invalidatePromptCache } from '../utils/ai/prompt-builder.js'
import { setFeatureOn } from '../utils/ai/features.js'
import { useWelcomeMessage } from '../composables/useWelcomeMessage.js'

const EVAL_RE = /你觉得呢|要不要试试|感觉怎么样|怎么想|心情如何/

beforeEach(() => {
  resetStorage()
  invalidatePromptCache()
})

describe('提示层：引导三式进 system prompt', () => {
  it('三式齐全（收一步 / 深一句 / 给两选）', () => {
    expect(GUIDE_KINDS.map(k => k.name)).toEqual(['收一步', '深一句', '给两选'])
    expect(GUIDE_SECTION).toContain('收一步')
    expect(GUIDE_SECTION).toContain('深一句')
    expect(GUIDE_SECTION).toContain('给两选')
  })

  it('写清「最多一句 / 可以不给 / 低落时只留最轻的一句」', () => {
    expect(GUIDE_SECTION).toContain('最多一句')
    expect(GUIDE_SECTION).toContain('宁缺毋滥')
    expect(GUIDE_SECTION).toContain('状态低落')
    expect(GUIDE_SECTION).toContain('不深挖不布置任务')
  })

  it('卡住时必须给「收一步」（真机实测：只说「不知道从哪开始」时模型只安慰、不给动作）', () => {
    expect(GUIDE_SECTION).toContain('不知道从哪开始')
    expect(GUIDE_SECTION).toContain('必须用「收一步」')
    expect(GUIDE_SECTION).toContain('不许只安慰')
  })

  it('压力词被明确写进禁止清单', () => {
    PRESSURE_WORDS.forEach(w => expect(GUIDE_SECTION).toContain(w))
    expect(GUIDE_SECTION).toContain('禁止')
  })

  it('full / lite / agentMode 三条路径都注入', () => {
    expect(buildSystemPrompt(true)).toContain('## 引导式表达')
    expect(buildSystemPrompt(true, { lite: true })).toContain('## 引导式表达')
    expect(buildSystemPrompt(true, { agentMode: true })).toContain('## 引导式表达')
  })

  it('开关关掉整段消失，重开回来', () => {
    setFeatureOn('guide_ask', false)
    invalidatePromptCache()
    expect(buildSystemPrompt(true)).not.toContain('## 引导式表达')
    setFeatureOn('guide_ask', true)
    invalidatePromptCache()
    expect(buildSystemPrompt(true)).toContain('## 引导式表达')
  })

  it('buildGuideSection 与常量同源（不含未替换占位符）', () => {
    expect(buildGuideSection()).toBe(GUIDE_SECTION)
    expect(buildGuideSection()).not.toContain('undefined')
    expect(buildGuideSection()).not.toContain('${')
  })
})

describe('兜底层：chips 是用户能直接发出去的短句', () => {
  it('AI 问「要不要我帮你记」→ 给一键可答的两条', () => {
    expect(pickGuideChips('要不要我帮你把今天的事记下来？')).toEqual(['好，记下来', '先不用'])
  })

  it('AI 提议排计划 → 短句换成排计划口径', () => {
    expect(pickGuideChips('要不要我帮你把这几个想法排成计划？')).toEqual(['好，帮我排一下', '先不用'])
  })

  it('AI 主动说「可以帮你记一笔」也给可点短句（真机实测：查询后主动提议记账）', () => {
    expect(pickGuideChips('这周还没记过账。有收入的话可以帮你记一笔。')).toEqual(['好，记下来', '先不用'])
  })

  it('已经给了一小步 → 递上「现在开始 / 换个更小的」', () => {
    expect(pickGuideChips('先花 5 分钟把桌面收一下，收完就算今天的成果。')).toEqual(['好，现在开始', '换个更小的'])
  })

  it('陪伴类回复不推进（不催）', () => {
    expect(pickGuideChips('今天难为你了，先歇会儿，别的都不急。')).toEqual([])
  })

  it('失败/超时/停止回复不引导', () => {
    expect(pickGuideChips('AI 响应超时，可能网络不稳定或服务繁忙。')).toEqual([])
    expect(pickGuideChips('抱歉，我刚才走神了，能再说一次吗？')).toEqual([])
    expect(pickGuideChips('（已停止）')).toEqual([])
  })

  it('刚执行完写操作不补引导', () => {
    expect(pickGuideChips('午餐 ¥25 记好了。', { didWrite: true })).toEqual([])
  })

  it('最多 2 条、每条不超过 14 字、不含评价式伪建议', () => {
    const samples = [
      '要不要我帮你把今天的开销记下来？',
      '好的，午餐 ¥25 已帮你记好。',
      '先花 10 分钟把第一步写完，写完就可以停。',
      '这个目标建议拆成三步执行。',
      '今天心情不错，去公园走了两圈，阳光很好，风也很舒服，整个人放松了不少。'
    ]
    samples.forEach(text => {
      const chips = pickGuideChips(text)
      expect(chips.length).toBeLessThanOrEqual(2)
      chips.forEach(s => {
        expect(s.length).toBeLessThanOrEqual(14)
        expect(s).not.toMatch(EVAL_RE)
        PRESSURE_WORDS.forEach(w => expect(s).not.toContain(w))
      })
    })
  })
})

describe('判定层：回复有没有把话头递回去', () => {
  it('句末提问算引导', () => {
    expect(hasGuideTail('要不要我先帮你把它拆成第一步？')).toBe(true)
    expect(hasGuideTail('我可以先陪你把桌面收一下。')).toBe(true)
  })

  it('纯陈述/安抚不算引导', () => {
    expect(hasGuideTail('记好了。')).toBe(false)
    expect(hasGuideTail('今天先歇着，什么都不用做。')).toBe(false)
    expect(hasGuideTail('')).toBe(false)
  })

  it('粗分引导式别', () => {
    expect(guideKindOf('要不要先花 5 分钟写三行？')).toBe('step')
    expect(guideKindOf('你想先记一笔，还是先把计划排出来？')).toBe('choice')
    expect(guideKindOf('那时候你是什么感觉？')).toBe('feel')
    expect(guideKindOf('记好了。')).toBe('')
  })
})

describe('入口第一句也带引导（欢迎语）', () => {
  it('收尾是具体入口的引导，不盘点缺口', () => {
    uni.setStorageSync('plan_all', JSON.stringify([{ id: 'p1', status: 1, is_deleted: 0 }]))
    uni.setStorageSync('diary_' + new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0'), JSON.stringify([{ id: 'd1', is_deleted: 0 }]))
    const msg = useWelcomeMessage().getWelcomeMessage()
    expect(msg).toContain('今天想从哪儿开始')
    expect(msg).not.toContain('未完成计划')
    expect(msg).not.toContain('本月写了')
    expect(msg).toContain('，我是思迹。')
  })
})
