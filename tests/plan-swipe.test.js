/**
 * plan-swipe.test.js — 计划页左滑删除（2026-11-01 修「滑不出按钮」）
 *
 * 回归点：手势宽度曾按 210px 算，而按钮实际是 210rpx（375pt 屏约 105px）。
 * 于是要滑 105px 才触发、打开后位移 210px 只露出 105px 按钮 + 一片空白，短滑毫无反应。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { usePlanSwipe, actionWidthPx, SWIPE_ACTION_RPX } from '../pages/plan/composables/usePlanSwipe.js'

const PLAN = { client_id: 'p1', title: '整理作品集' }
const OTHER = { client_id: 'p2', title: '预约体检' }

function touch(x) {
  return { touches: [{ clientX: x }] }
}

beforeEach(() => {
  uni.clearStorageSync()
  // 375pt 屏：1rpx = 0.5px
  uni.upx2px = (v) => v / 2
})

function make(over = {}) {
  const onComplete = vi.fn()
  const onEdit = vi.fn()
  const onDelete = vi.fn()
  const api = usePlanSwipe(onComplete, onEdit, onDelete)
  return { api, onComplete, onEdit, onDelete, ...over }
}

describe('宽度换算', () => {
  it('210rpx 在 375pt 屏换算为 105px（不是 210）', () => {
    expect(SWIPE_ACTION_RPX).toBe(210)
    expect(actionWidthPx()).toBe(105)
  })

  it('拿不到 upx2px 时按一半回落', () => {
    const saved = uni.upx2px
    delete uni.upx2px
    expect(actionWidthPx()).toBe(105)
    uni.upx2px = saved
  })
})

describe('左滑开启', () => {
  it('短滑 60px 就能打开（旧实现要求 105px，等于滑不动）', () => {
    const { api } = make()
    api.onTouchStart(touch(300), PLAN)
    api.onTouchMove(touch(240), PLAN)
    api.onTouchEnd(PLAN)
    expect(api.swipeItem.value).toBe('p1')
  })

  it('打开后位移等于按钮总宽，不留空白', () => {
    const { api } = make()
    api.onTouchStart(touch(300), PLAN)
    api.onTouchMove(touch(240), PLAN)
    api.onTouchEnd(PLAN)
    expect(api.getSwipeOffset(PLAN)).toBe('-105px')
  })

  it('滑得再远也不超过按钮宽度', () => {
    const { api } = make()
    api.onTouchStart(touch(300), PLAN)
    api.onTouchMove(touch(0), PLAN)
    expect(api.getSwipeOffset(PLAN)).toBe('-105px')
    api.onTouchEnd(PLAN)
    expect(api.swipeItem.value).toBe('p1')
  })

  it('不足一半不打开', () => {
    const { api } = make()
    api.onTouchStart(touch(300), PLAN)
    api.onTouchMove(touch(260), PLAN)
    api.onTouchEnd(PLAN)
    expect(api.swipeItem.value).toBe(null)
    expect(api.getSwipeOffset(PLAN)).toBe('0px')
  })

  it('touchcancel（被 scroll-view 抢走手势）也按松手处理', () => {
    const { api } = make()
    api.onTouchStart(touch(300), PLAN)
    api.onTouchMove(touch(220), PLAN)
    // App 端被 scroll-view 接管时收到的是 cancel，页面同样调 onTouchEnd
    api.onTouchEnd(PLAN)
    expect(api.swipeItem.value).toBe('p1')
  })

  it('touchstart 没有触点不崩', () => {
    const { api } = make()
    expect(() => api.onTouchStart({}, PLAN)).not.toThrow()
    expect(api.swipeItem.value).toBe(null)
  })
})

describe('多卡片与收回', () => {
  it('打开 A 后滑 B，A 自动收起', () => {
    const { api } = make()
    api.onTouchStart(touch(300), PLAN)
    api.onTouchMove(touch(240), PLAN)
    api.onTouchEnd(PLAN)
    api.onTouchStart(touch(300), OTHER)
    expect(api.swipeItem.value).toBe(null)
  })

  it('右滑跟随手指收回', () => {
    const { api } = make()
    api.onTouchStart(touch(300), PLAN)
    api.onTouchMove(touch(240), PLAN)
    api.onTouchEnd(PLAN)
    api.onTouchStart(touch(200), PLAN)
    // 先小幅度右移：位移从 -105 跟着手指走，而不是从 0 重新开始
    api.onTouchMove(touch(230), PLAN)
    expect(api.getSwipeOffset(PLAN)).toBe('-75px')
    // 继续右移到超过原宽度 → 收回 0
    api.onTouchMove(touch(320), PLAN)
    expect(api.getSwipeOffset(PLAN)).toBe('0px')
    api.onTouchEnd(PLAN)
    expect(api.swipeItem.value).toBe(null)
  })

  it('isSwiping 只在拖动时为真（模板据此关掉 transition）', () => {
    const { api } = make()
    expect(api.isSwiping.value).toBe(false)
    api.onTouchStart(touch(300), PLAN)
    api.onTouchMove(touch(240), PLAN)
    expect(api.isSwiping.value).toBe(true)
    api.onTouchEnd(PLAN)
    expect(api.isSwiping.value).toBe(false)
  })
})

describe('点击与删除', () => {
  it('打开状态点卡片只收起，不进详情', () => {
    const { api } = make()
    const goDetail = vi.fn()
    api.onTouchStart(touch(300), PLAN)
    api.onTouchMove(touch(240), PLAN)
    api.onTouchEnd(PLAN)
    api.handleTap(PLAN, goDetail)
    expect(goDetail).not.toHaveBeenCalled()
    expect(api.swipeItem.value).toBe(null)
  })

  it('关闭状态点卡片进详情', () => {
    const { api } = make()
    const goDetail = vi.fn()
    api.handleTap(PLAN, goDetail)
    expect(goDetail).toHaveBeenCalledWith(PLAN)
  })

  it('删除按钮 → 确认后回调并收起', () => {
    const { api, onDelete } = make()
    uni.showModal = (opts) => opts.success({ confirm: true })
    api.onTouchStart(touch(300), PLAN)
    api.onTouchMove(touch(240), PLAN)
    api.onTouchEnd(PLAN)
    api.handleDelete(PLAN)
    expect(onDelete).toHaveBeenCalledWith(PLAN)
    expect(api.swipeItem.value).toBe(null)
  })

  it('删除取消 → 不回调', () => {
    const { api, onDelete } = make()
    uni.showModal = (opts) => opts.success({ confirm: false })
    api.handleDelete(PLAN)
    expect(onDelete).not.toHaveBeenCalled()
  })
})
