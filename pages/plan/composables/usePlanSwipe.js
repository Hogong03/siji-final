/**
 * 计划卡片左滑手势 — 完成 / 编辑 / 删除
 *
 * 2026-11-01 修复「计划页滑不出删除按钮」：
 *   1) 手势宽度原来是 210（当作 px 用），而按钮是 70rpx×3=210rpx（375pt 屏上约 105px）。
 *      结果：要滑 105px 才触发（正好是整个按钮区宽度），短滑完全没反应；打开后卡片位移
 *      210px，按钮只占右侧 105px，露出一大片空白。改为按 rpx 换算成 px，阈值同步减半。
 *   2) 补 touchcancel：App 端 scroll-view 抢走手势时子元素收到的是 touchcancel，
 *      原来没有处理，状态卡在「滑动中」，松手也不打开。
 *   3) 拖动过程中关掉 transition，避免每次 touchmove 都补间、手感发黏。
 */

import { ref, computed } from 'vue'

/** 三个按钮的总宽度（rpx）：完成 70 + 编辑 70 + 删除 70 */
export const SWIPE_ACTION_RPX = 210

/**
 * 手势宽度换算成 px。
 * 优先用 uni.upx2px（按设备实际屏宽换算），拿不到时按 750rpx 设计宽度回落一半。
 */
export function actionWidthPx() {
  try {
    if (typeof uni !== 'undefined' && typeof uni.upx2px === 'function') {
      const px = Number(uni.upx2px(SWIPE_ACTION_RPX))
      if (Number.isFinite(px) && px > 0) return px
    }
  } catch (e) { /* 回落 */ }
  return SWIPE_ACTION_RPX / 2
}

export function usePlanSwipe(onComplete, onEdit, onDelete) {
  const swipeItem = ref(null)
  const swipeStartX = ref(0)
  const swipeStartId = ref('')
  const swipeMoveX = ref(0)
  const swipingId = ref('')
  /** 本次拖动的起点位移：已打开的卡片从 -width 开始，右滑才会跟着手指收回 */
  let swipeBaseX = 0

  /** 正在拖动（模板据此关掉 transition） */
  const isSwiping = computed(() => !!swipingId.value)

  function pointX(e) {
    const t = e && e.touches && e.touches[0]
    return t && Number.isFinite(t.clientX) ? t.clientX : null
  }

  function onTouchStart(e, plan) {
    const x = pointX(e)
    if (x == null || !plan) return
    swipeStartX.value = x
    swipeStartId.value = plan.client_id
    swipingId.value = ''
    // 打开着别的卡片时，先收起（点按由 handleTap 统一处理）
    if (swipeItem.value && swipeItem.value !== plan.client_id) swipeItem.value = null
    swipeBaseX = swipeItem.value === plan.client_id ? -actionWidthPx() : 0
    swipeMoveX.value = swipeBaseX
  }

  function onTouchMove(e, plan) {
    const x = pointX(e)
    if (x == null || !plan || swipeStartId.value !== plan.client_id) return
    const dx = x - swipeStartX.value
    if (dx === 0) return
    swipingId.value = plan.client_id
    const width = actionWidthPx()
    swipeMoveX.value = Math.max(-width, Math.min(0, swipeBaseX + dx))
  }

  function onTouchEnd(plan) {
    if (!plan || swipingId.value !== plan.client_id) return
    const width = actionWidthPx()
    swipeItem.value = swipeMoveX.value < -width / 2 ? plan.client_id : null
    swipingId.value = ''
    swipeMoveX.value = 0
  }

  function getSwipeOffset(plan) {
    if (!plan) return '0px'
    if (swipingId.value === plan.client_id) return swipeMoveX.value + 'px'
    if (swipeItem.value === plan.client_id) return '-' + actionWidthPx() + 'px'
    return '0px'
  }

  function closeSwipe() {
    swipeItem.value = null
  }

  function handleTap(plan, onTap) {
    if (swipeItem.value) { closeSwipe(); return }
    onTap?.(plan)
  }

  function handleComplete(plan) {
    closeSwipe()
    onComplete?.(plan)
  }

  function handleEdit(plan) {
    closeSwipe()
    onEdit?.(plan)
  }

  function handleDelete(plan) {
    uni.showModal({
      title: '删除计划',
      content: `确认删除「${plan.title}」？`,
      confirmColor: '#D35D5D',
      success: (res) => {
        if (res.confirm) {
          try { uni.vibrateShort({ type: 'light' }) } catch (e) { /* 无震动模块时不拦 */ }
          onDelete?.(plan)
          swipeItem.value = null
        }
      }
    })
  }

  return {
    swipeItem,
    isSwiping,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    getSwipeOffset,
    closeSwipe,
    handleTap,
    handleComplete,
    handleEdit,
    handleDelete
  }
}
