/**
 * 长文目录解析（3.9.0）
 *
 * 目录尺的刻度来源：把记录正文按章节切开。
 * 覆盖 Markdown 标题 / 方括号标题 / 编号标题三套识别、代码块跳过、
 * 切分不丢内容、刻度换算、以及「几节才显示尺子」的门槛。
 */
import { describe, it, expect } from 'vitest'
import './setup.js'
import {
  parseHeading, extractOutline, splitSections, shouldShowOutline, buildOutlineTicks,
  titledSections, OUTLINE_MIN_SECTIONS, OUTLINE_MAX_TITLE_LEN
} from '../utils/text-outline.js'

const DOC = [
  '# 六级·听力章',
  '开头一句总述。',
  '',
  '## 一、视听一致',
  '听到什么选什么。',
  '- 圈关键词',
  '',
  '## 二、答案常在三处',
  '开头句、转折词后、结尾句。',
  '',
  '## 三、今天怎么练',
  '只做打勾。'
].join('\n')

describe('parseHeading：三种章节写法', () => {
  it('Markdown 标题（1-4 级），级别取 # 的数量', () => {
    expect(parseHeading('# 一级')).toEqual({ level: 1, title: '一级' })
    expect(parseHeading('### 三级')).toEqual({ level: 3, title: '三级' })
    expect(parseHeading('## 带尾井号的 ##')).toEqual({ level: 2, title: '带尾井号的' })
  })

  it('【标题】写法', () => {
    expect(parseHeading('【一、视听一致】')).toEqual({ level: 2, title: '一、视听一致' })
  })

  it('编号写法：1. / 1、/ 一、', () => {
    expect(parseHeading('1. 视听一致')).toEqual({ level: 2, title: '1. 视听一致' })
    expect(parseHeading('二、答案三处')).toEqual({ level: 2, title: '二、答案三处' })
  })

  it('正文句子不会被误认成标题', () => {
    expect(parseHeading('听到什么选什么，不要推理。')).toBe(null)
    expect(parseHeading('1. 先读题干，圈定位词，然后回原文找同义替换，注意不要找原词，因为原词多是干扰项')).toBe(null)
    expect(parseHeading('')).toBe(null)
    expect(parseHeading(null)).toBe(null)
  })

  it('编号标题也限长：刚过线的不算', () => {
    const long = '1. ' + '标'.repeat(OUTLINE_MAX_TITLE_LEN + 1)
    expect(parseHeading(long)).toBe(null)
  })
})

describe('extractOutline：逐行扫描', () => {
  it('给出 title / line / percent，percent 按行位置换算', () => {
    const out = extractOutline(DOC)
    expect(out.map(s => s.title)).toEqual(['六级·听力章', '一、视听一致', '二、答案常在三处', '三、今天怎么练'])
    expect(out[0].line).toBe(0)
    expect(out[0].percent).toBe(0)
    // 最后一节后面还有正文 → 不是 100%，但一定在 0-100 之间且大于上一节
    expect(out[out.length - 1].percent).toBeGreaterThan(0)
    expect(out[out.length - 1].percent).toBeLessThanOrEqual(100)
    // 标题正好是最后一行时才是 100%
    expect(extractOutline(['## 一、A', 'x', '## 二、B'].join('\n')).pop().percent).toBe(100)
    // 单调不减
    for (let i = 1; i < out.length; i++) expect(out[i].percent).toBeGreaterThanOrEqual(out[i - 1].percent)
  })

  it('围栏代码块里的 # 不算标题', () => {
    const text = ['## 真标题', '```', '# 这是代码注释', '```', '## 另一个真标题'].join('\n')
    expect(extractOutline(text).map(s => s.title)).toEqual(['真标题', '另一个真标题'])
  })

  it('没有章节时返回空数组', () => {
    expect(extractOutline('就是一段普通的话，没有任何标题。')).toEqual([])
    expect(extractOutline('')).toEqual([])
  })
})

describe('splitSections：切正文不丢内容', () => {
  it('按标题切开，标题行不进正文', () => {
    const secs = splitSections(DOC)
    expect(secs.map(s => s.title)).toEqual(['六级·听力章', '一、视听一致', '二、答案常在三处', '三、今天怎么练'])
    expect(secs[0].body).toBe('开头一句总述。')
    expect(secs[1].body).toContain('听到什么选什么。')
    expect(secs[1].body).toContain('圈关键词')
    expect(secs[1].body.indexOf('## ')).toBe(-1)
  })

  it('每节 body 都能在原文里找到（切分不凭空造内容）', () => {
    const secs = splitSections(DOC)
    secs.forEach(s => {
      if (!s.body) return
      s.body.split('\n').forEach(line => {
        const t = line.trim()
        if (!t) return
        expect(DOC).toContain(t.replace(/^[-*]\s*/, ''))
      })
    })
  })

  it('第一个标题之前的内容保留成前言（title 为空）', () => {
    const secs = splitSections(['写在最前。', '## 一、小节', '正文'].join('\n'))
    expect(secs[0].title).toBe('')
    expect(secs[0].body).toBe('写在最前。')
    expect(secs[1].title).toBe('一、小节')
  })

  it('完全没有标题 → 单节返回（阅读页照常渲染整段）', () => {
    const secs = splitSections('一句话记录。')
    expect(secs).toHaveLength(1)
    expect(secs[0].title).toBe('')
    expect(secs[0].body).toBe('一句话记录。')
  })

  it('index 连续，与钥匙一一对应（阅读页锚点 id 用 index）', () => {
    const secs = splitSections(DOC)
    secs.forEach((s, i) => {
      expect(s.index).toBe(i)
      expect(s.key).toBe('sec-' + i)
    })
  })
})

describe('shouldShowOutline / buildOutlineTicks / titledSections', () => {
  it('章节数不到门槛不显示尺子', () => {
    expect(shouldShowOutline(OUTLINE_MIN_SECTIONS)).toBe(true)
    expect(shouldShowOutline(OUTLINE_MIN_SECTIONS - 1)).toBe(false)
    expect(shouldShowOutline(NaN)).toBe(false)
    expect(shouldShowOutline(5, 6)).toBe(false)
  })

  it('刻度只保留有标题的节，且带 label / percent', () => {
    const secs = splitSections(['前言', '## 一、A', 'x', '## 二、B', 'y'].join('\n'))
    const ticks = buildOutlineTicks(secs)
    expect(ticks.map(t => t.label)).toEqual(['一、A', '二、B'])
    expect(ticks[0]).toHaveProperty('percent')
    expect(titledSections(secs)).toHaveLength(2)
  })

  it('空输入不炸', () => {
    expect(buildOutlineTicks(null)).toEqual([])
    expect(titledSections(undefined)).toEqual([])
  })
})

/* ==================== 4.1.0：阅读进度与当前章节 ==================== */

import { readingProgress, sectionAtProgress } from '../utils/text-outline.js'

describe('readingProgress：读到多少（底部进度条）', () => {
  it('视口底部 ÷ 总高度，夹在 0-100', () => {
    expect(readingProgress(0, 2000, 1000)).toBe(50)
    expect(readingProgress(1000, 2000, 1000)).toBe(100)
    expect(readingProgress(0, 1000, 1000)).toBe(100)   // 内容不足一屏 → 直接算读完
    expect(readingProgress(0, 20000, 1000)).toBe(5)
  })

  it('脏数据不炸：高度为 0 / 负数 / 非数字', () => {
    expect(readingProgress(0, 0, 100)).toBe(0)
    expect(readingProgress(0, -5, 100)).toBe(0)
    expect(readingProgress(NaN, NaN, NaN)).toBe(0)
    expect(readingProgress(99999, 2000, 1000)).toBe(100)
  })
})

describe('sectionAtProgress：当前读到哪一节', () => {
  const outline = [
    { key: 'sec-0', index: 0, title: '一、总述', percent: 0 },
    { key: 'sec-1', index: 1, title: '二、方法', percent: 40 },
    { key: 'sec-2', index: 2, title: '三、练习', percent: 80 }
  ]

  it('按进度落到对应小节，并给出序号与总数', () => {
    expect(sectionAtProgress(outline, 0)).toEqual({ index: 1, title: '一、总述', total: 3 })
    expect(sectionAtProgress(outline, 55).title).toBe('二、方法')
    expect(sectionAtProgress(outline, 100)).toEqual({ index: 3, title: '三、练习', total: 3 })
  })

  it('没有小节 / 空输入返回 null', () => {
    expect(sectionAtProgress([], 50)).toBe(null)
    expect(sectionAtProgress(null, 50)).toBe(null)
    expect(sectionAtProgress([{ key: 'sec-0', title: '' }], 50)).toBe(null)
  })
})
