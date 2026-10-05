/**
 * font-scale 字号档位测试（4.13.1）
 *
 * 覆盖：比例换算数学、非法档位忽略、档位表完整性。
 * 组件侧的绑定（MessageBubble/MarkdownRenderer/EnterBriefing）消费同一响应式单例。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import './setup.js'
import {
  FONT_SCALES, fontScale, fontRpx,
  initFontScale, getFontScaleId, setFontScaleId
} from '../utils/font-scale.js'

beforeEach(() => {
  initFontScale()
  setFontScaleId('normal')
})

describe('font-scale：档位与换算', () => {
  it('档位表四档、id 唯一、比例单调递增', () => {
    expect(FONT_SCALES.map(s => s.id)).toEqual(['small', 'normal', 'large', 'xlarge'])
    expect(new Set(FONT_SCALES.map(s => s.id)).size).toBe(4)
    for (let i = 1; i < FONT_SCALES.length; i++) {
      expect(FONT_SCALES[i].ratio).toBeGreaterThan(FONT_SCALES[i - 1].ratio)
    }
  })

  it('fontRpx 按档位缩放：标准 28 → 大 32 → 特大 29(22 基准)', () => {
    setFontScaleId('normal')
    expect(fontRpx(28)).toBe('28rpx')
    setFontScaleId('large')
    expect(fontRpx(28)).toBe('32rpx')
    setFontScaleId('xlarge')
    expect(fontRpx(22)).toBe('29rpx')
    setFontScaleId('small')
    expect(fontRpx(28)).toBe('25rpx')
  })

  it('非法档位被忽略（比例与 id 均保持）', () => {
    setFontScaleId('huge')
    expect(getFontScaleId()).toBe('normal')
    expect(fontRpx(28)).toBe('28rpx')
  })

  it('响应式单例：setFontScaleId 后 fontScale 立即变化', () => {
    setFontScaleId('xlarge')
    expect(fontScale.value).toBeCloseTo(1.3)
  })
})
