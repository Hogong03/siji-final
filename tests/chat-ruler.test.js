/**
 * chat-ruler 测试（3.5.17：对话尺）
 *
 * 覆盖：显示阈值、刻度锚点与降采样、刻度位置、视口换算、点/拖命中的刻度、
 * 跳转前的窗口扩容，以及 composable 的滚动同步与触摸跳转编排。
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { ref, computed, nextTick } from 'vue'
import {
  shouldShowRuler, summarizeMessage, buildRulerTicks, viewportRange,
  pickTickByPercent, pickTickByScroll, percentFromY, resolveWindowSize,
  RULER_MIN_MESSAGES, RULER_MAX_TICKS
} from '../utils/chat-ruler.js'
import { useChatRuler } from '../composables/useChatRuler.js'

function mkMsgs(count, opts) {
  const o = opts || {}
  const out = []
  for (let i = 0; i < count; i++) {
    const user = o.allUser ? true : (i % 2 === 1)
    out.push({ role: user ? 'user' : 'assistant', content: 'm' + i })
  }
  return out
}

function fakeQuery(rects) {
  const self = {
    select() { return self },
    boundingClientRect() { return self },
    exec(cb) { cb(rects); return self }
  }
  return self
}

afterEach(() => {
  delete global.uni.createSelectorQuery
  vi.useRealTimers()
})

describe('shouldShowRuler：显示阈值', () => {
  it('默认 20 条起显示', () => {
    expect(RULER_MIN_MESSAGES).toBe(20)
    expect(shouldShowRuler(19)).toBe(false)
    expect(shouldShowRuler(20)).toBe(true)
    expect(shouldShowRuler(500)).toBe(true)
  })

  it('可自定义阈值，非法输入不显示', () => {
    expect(shouldShowRuler(5, 5)).toBe(true)
    expect(shouldShowRuler(4, 5)).toBe(false)
    expect(shouldShowRuler(undefined)).toBe(false)
    expect(shouldShowRuler('abc')).toBe(false)
    expect(shouldShowRuler(30, 'abc')).toBe(true)
  })
})

describe('summarizeMessage：预览文案', () => {
  it('压平换行与多余空格', () => {
    expect(summarizeMessage({ content: '  今天\n\n下雨   了  ' })).toBe('今天 下雨 了')
  })

  it('超长截断加省略号', () => {
    const text = 'a'.repeat(30)
    const out = summarizeMessage(text ? { content: text } : null, 10)
    expect(out).toBe('aaaaaaaaaa…')
    expect(out.length).toBe(11)
  })

  it('图片消息没有正文时给占位，什么都没有返回空串', () => {
    expect(summarizeMessage({ role: 'user', image: 'x.png' })).toBe('[图片]')
    expect(summarizeMessage({ role: 'user', content: '   ' })).toBe('')
    expect(summarizeMessage(null)).toBe('')
  })
})

describe('buildRulerTicks：刻度生成', () => {
  it('空消息返回空刻度', () => {
    expect(buildRulerTicks([])).toEqual([])
    expect(buildRulerTicks(null)).toEqual([])
  })

  it('锚点取用户消息，刻度落在各自序号占比上', () => {
    const ticks = buildRulerTicks(mkMsgs(15))
    expect(ticks.map(t => t.messageIndex)).toEqual([1, 3, 5, 7, 9, 11, 13])
    expect(ticks[0].percent).toBe(7.14)
    expect(ticks[ticks.length - 1].percent).toBe(92.86)
    expect(ticks[0].label).toBe('m1')
    ticks.forEach(t => expect(t.role).toBe('user'))
  })

  it('用户消息太少时退化为全部消息', () => {
    const msgs = []
    for (let i = 0; i < 30; i++) msgs.push({ role: 'assistant', content: 'a' + i })
    msgs[1].role = 'user'
    msgs[5].role = 'user'
    const ticks = buildRulerTicks(msgs)
    expect(ticks.length).toBe(RULER_MAX_TICKS)
    expect(ticks[0].messageIndex).toBe(0)
    expect(ticks[ticks.length - 1].messageIndex).toBe(29)
    expect(ticks[ticks.length - 1].percent).toBe(100)
    expect(ticks.some(t => t.messageIndex === 1)).toBe(true)
  })

  it('超过上限时降采样，首尾必留且位置递增', () => {
    const ticks = buildRulerTicks(mkMsgs(200, { allUser: true }))
    expect(ticks.length).toBe(RULER_MAX_TICKS)
    expect(ticks[0].messageIndex).toBe(0)
    expect(ticks[ticks.length - 1].messageIndex).toBe(199)
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i].percent).toBeGreaterThan(ticks[i - 1].percent)
      expect(ticks[i].messageIndex).toBeGreaterThan(ticks[i - 1].messageIndex)
    }
  })

  it('单条消息居中，key 唯一', () => {
    const ticks = buildRulerTicks([{ role: 'user', content: 'hi' }])
    expect(ticks).toHaveLength(1)
    expect(ticks[0].percent).toBe(50)
    const many = buildRulerTicks(mkMsgs(60, { allUser: true }))
    const keys = many.map(t => t.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('percent 保留两位小数', () => {
    const ticks = buildRulerTicks(mkMsgs(3, { allUser: true }))
    ticks.forEach(t => expect(String(t.percent).length).toBeLessThanOrEqual(6))
  })
})

describe('viewportRange：视口指示', () => {
  it('内容不足以滚动时铺满', () => {
    expect(viewportRange(0, 300, 400)).toEqual({ top: 0, height: 100 })
    expect(viewportRange(0, 0, 0)).toEqual({ top: 0, height: 100 })
  })

  it('顶部 / 中部 / 底部对应 0 / 中 / 100-top', () => {
    const top = viewportRange(0, 1000, 500)
    expect(top.top).toBe(0)
    expect(top.height).toBe(50)
    const mid = viewportRange(250, 1000, 500)
    expect(mid.top).toBe(25)
    const bottom = viewportRange(500, 1000, 500)
    expect(bottom.top).toBe(50)
    expect(bottom.top + bottom.height).toBe(100)
  })

  it('内容极长时给最小高度，越界滚动被夹住', () => {
    const tiny = viewportRange(0, 10000, 100)
    expect(tiny.height).toBe(6)
    expect(tiny.top).toBe(0)
    const bottom = viewportRange(99999, 1000, 990)
    expect(bottom.height).toBe(99)
    expect(bottom.top).toBe(1)
    expect(viewportRange(-50, 1000, 500).top).toBe(0)
  })
})

describe('pickTickByPercent / pickTickByScroll / percentFromY', () => {
  const ticks = buildRulerTicks(mkMsgs(15))

  it('空刻度返回 null', () => {
    expect(pickTickByPercent([], 50)).toBe(null)
    expect(pickTickByScroll([], 0, 100, 50)).toBe(null)
  })

  it('取最近刻度', () => {
    expect(pickTickByPercent(ticks, 8).messageIndex).toBe(1)
    expect(pickTickByPercent(ticks, 90).messageIndex).toBe(13)
    expect(pickTickByPercent(ticks, -100).messageIndex).toBe(1)
    expect(pickTickByPercent(ticks, 1000).messageIndex).toBe(13)
  })

  it('滚动位置换算到最近刻度', () => {
    expect(pickTickByScroll(ticks, 0, 1000, 500).messageIndex).toBe(1)
    expect(pickTickByScroll(ticks, 500, 1000, 500).messageIndex).toBe(7)
  })

  it('触摸坐标换算百分比并夹在 0-100', () => {
    const rect = { top: 100, height: 400 }
    expect(percentFromY(100, rect)).toBe(0)
    expect(percentFromY(300, rect)).toBe(50)
    expect(percentFromY(900, rect)).toBe(100)
    expect(percentFromY(50, rect)).toBe(0)
    expect(percentFromY(100, null)).toBe(0)
    expect(percentFromY(100, { top: 100, height: 0 })).toBe(0)
  })
})

describe('resolveWindowSize：跳转前的窗口扩容', () => {
  it('目标在窗口内时不动', () => {
    expect(resolveWindowSize(90, 100, 50)).toBe(50)
    expect(resolveWindowSize(99, 100, 50)).toBe(50)
  })

  it('目标在窗口外时扩到「目标上方保留 5 条」', () => {
    expect(resolveWindowSize(10, 100, 50)).toBe(95)
    expect(resolveWindowSize(0, 100, 50)).toBe(100)
    expect(resolveWindowSize(95, 100, 50)).toBe(50)
  })

  it('keepAbove 可调，非法索引返回原值', () => {
    expect(resolveWindowSize(10, 100, 50, 0)).toBe(90)
    expect(resolveWindowSize(-1, 100, 50)).toBe(50)
    expect(resolveWindowSize(100, 100, 50)).toBe(50)
    expect(resolveWindowSize('x', 100, 50)).toBe(50)
  })
})

describe('useChatRuler：滚动同步与触摸跳转', () => {
  function setup(messages, over) {
    const o = over || {}
    const allMessages = computed(() => messages.value)
    const visibleCount = ref(o.visibleCount || 50)
    const scrollIntoView = ref('')
    const scrollWithAnim = ref(true)
    const ruler = useChatRuler({
      allMessages,
      visibleCount,
      scrollIntoView,
      scrollWithAnim
    })
    return { ruler, visibleCount, scrollIntoView, scrollWithAnim }
  }

  it('消息够长才显示，刻度随消息变化', () => {
    const messages = ref(mkMsgs(10))
    const { ruler } = setup(messages)
    expect(ruler.rulerVisible.value).toBe(false)
    messages.value = mkMsgs(40)
    expect(ruler.rulerVisible.value).toBe(true)
    expect(ruler.rulerTicks.value.length).toBeGreaterThan(0)
  })

  it('滚动同步写入视口指示并高亮最近刻度', () => {
    const messages = ref(mkMsgs(40))
    const { ruler } = setup(messages)
    ruler.syncRulerScroll({ detail: { scrollTop: 0, scrollHeight: 1000 }, target: { clientHeight: 500 } })
    expect(ruler.rulerViewportStyle.value).toEqual({ top: '0.00%', height: '50.00%' })
    const firstKey = ruler.rulerActiveKey.value
    expect(firstKey).toBe('t1')
    ruler.syncRulerScroll({ detail: { scrollTop: 500, scrollHeight: 1000 }, target: { clientHeight: 500 } })
    expect(ruler.rulerActiveKey.value).not.toBe(firstKey)
  })

  it('空事件直接忽略，不报错', () => {
    const { ruler } = setup(ref(mkMsgs(40)))
    expect(() => ruler.syncRulerScroll(null)).not.toThrow()
    expect(() => ruler.syncRulerScroll({})).not.toThrow()
  })

  it('跳转：目标在窗口外先扩容再滚过去', async () => {
    const messages = ref(mkMsgs(200, { allUser: true }))
    const { ruler, visibleCount, scrollIntoView } = setup(messages)
    const ok = await ruler.jumpToTick(ruler.rulerTicks.value[0], { instant: true })
    expect(ok).toBe(true)
    expect(visibleCount.value).toBe(200)
    expect(ruler.rulerActiveKey.value).toBe('t0')
    await nextTick()
    expect(scrollIntoView.value).toBe('msg-0')
  })

  it('跳转：目标在窗口内时不动窗口', async () => {
    const messages = ref(mkMsgs(200, { allUser: true }))
    const { ruler, visibleCount, scrollIntoView, scrollWithAnim } = setup(messages)
    await ruler.jumpToTick(ruler.rulerTicks.value[ruler.rulerTicks.value.length - 1], { instant: true })
    expect(visibleCount.value).toBe(50)
    expect(scrollWithAnim.value).toBe(false)
    await nextTick()
    expect(scrollIntoView.value).toBe('msg-199')
  })

  it('跳转：非法刻度返回 false', async () => {
    const { ruler } = setup(ref(mkMsgs(40)))
    expect(await ruler.jumpToTick(null)).toBe(false)
    expect(await ruler.jumpToTick({ key: 'x', messageIndex: 999, percent: 100 })).toBe(false)
  })

  it('重置清掉高亮状态', async () => {
    const messages = ref(mkMsgs(200, { allUser: true }))
    const { ruler } = setup(messages)
    await ruler.jumpToTick(ruler.rulerTicks.value[0], { instant: true })
    expect(ruler.rulerActiveKey.value).toBe('t0')
    ruler.resetRuler()
    expect(ruler.rulerActiveKey.value).toBe('')
    expect(ruler.rulerPreview.value).toBe(null)
    expect(ruler.rulerDragging.value).toBe(false)
  })

  it('轻点刻度跳转，拖动过程不误判为轻点', async () => {
    vi.useFakeTimers()
    global.uni.createSelectorQuery = () => fakeQuery([{ height: 400 }, { top: 100, height: 400 }])
    const messages = ref(mkMsgs(200, { allUser: true }))
    const { ruler, scrollIntoView } = setup(messages)
    vi.advanceTimersByTime(200)
    // 量尺寸后：轻点刻度尺最下方
    ruler.handleRulerTouchStart({ touches: [{ clientY: 100 }] })
    expect(ruler.rulerDragging.value).toBe(false)
    ruler.handleRulerTouchEnd({})
    await Promise.resolve()
    await nextTick()
    expect(scrollIntoView.value).toBe('msg-0')

    scrollIntoView.value = ''
    ruler.handleRulerTouchStart({ touches: [{ clientY: 500 }] })
    expect(ruler.rulerPreview.value).not.toBe(null)
    ruler.handleRulerTouchEnd({})
    await Promise.resolve()
    await nextTick()
    expect(scrollIntoView.value).toBe('msg-199')
  })

  it('H5 鼠标点击：带 clientY 才处理，落到最近的刻度', async () => {
    vi.useFakeTimers()
    global.uni.createSelectorQuery = () => fakeQuery([{ height: 400 }, { top: 100, height: 400 }])
    const messages = ref(mkMsgs(200, { allUser: true }))
    const { ruler, scrollIntoView } = setup(messages)
    vi.advanceTimersByTime(200)
    ruler.handleRulerTap({})
    expect(ruler.rulerActiveKey.value).toBe('')
    ruler.handleRulerTap({ clientY: 500 })
    await Promise.resolve()
    await nextTick()
    expect(scrollIntoView.value).toBe('msg-199')
    expect(ruler.rulerActiveKey.value).toBe('t199')
  })
  it('拖动：超过位移阈值才进入拖动并预览，松手不重复跳', async () => {
    vi.useFakeTimers()
    global.uni.createSelectorQuery = () => fakeQuery([{ height: 400 }, { top: 100, height: 400 }])
    const messages = ref(mkMsgs(200, { allUser: true }))
    const { ruler, scrollIntoView } = setup(messages)
    vi.advanceTimersByTime(200)
    ruler.handleRulerTouchStart({ touches: [{ clientY: 300 }] })
    ruler.handleRulerTouchMove({ touches: [{ clientY: 302 }] })
    expect(ruler.rulerDragging.value).toBe(false)
    scrollIntoView.value = ''
    ruler.handleRulerTouchMove({ touches: [{ clientY: 500 }] })
    expect(ruler.rulerDragging.value).toBe(true)
    await Promise.resolve()
    await nextTick()
    expect(scrollIntoView.value).toBe('msg-199')
    scrollIntoView.value = ''
    ruler.handleRulerTouchEnd({})
    await Promise.resolve()
    await nextTick()
    expect(scrollIntoView.value).toBe('')
    expect(ruler.rulerDragging.value).toBe(false)
  })
})