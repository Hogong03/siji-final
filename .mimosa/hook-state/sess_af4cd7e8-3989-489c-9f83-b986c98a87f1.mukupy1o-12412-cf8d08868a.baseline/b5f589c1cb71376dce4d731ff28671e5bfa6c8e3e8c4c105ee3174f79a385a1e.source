/**
 * useChatRuler — 对话尺状态与跳转编排（3.5.17）
 *
 * 把 utils/chat-ruler.js 的纯计算接到聊天页的滚动 / 触摸上，不写样式、不碰 store。
 *
 * 依赖注入（页面传入）：
 *   allMessages    — computed，全量消息
 *   visibleCount   — ref，虚拟窗口渲染条数（跳转前先扩窗）
 *   scrollIntoView — ref，scroll-view 的 scroll-into-view 绑定
 *   scrollWithAnim — ref，scroll-view 的 scroll-with-animation 绑定
 */
import { ref, computed, watch, nextTick } from 'vue'
import {
  shouldShowRuler, buildRulerTicks, viewportRange, pickTickByScroll, pickTickByPercent,
  percentFromY, resolveWindowSize, RULER_JUMP_INTERVAL, RULER_KEEP_ABOVE
} from '@/utils/chat-ruler.js'

const TOUCH_MOVE_SLOP = 8   // 手指位移超过该值才算拖动（否则是轻点）
const MEASURE_DELAY = 150   // 刻度尺尺寸测量防抖
const PREVIEW_KEEP_MS = 700 // 预览停留时间
const SCROLL_RETRY_DELAY = 90 // 扩窗后补一次跳转的延迟

export function useChatRuler(ctx) {
  const allMessages = ctx.allMessages
  const visibleCount = ctx.visibleCount
  const scrollIntoView = ctx.scrollIntoView
  const scrollWithAnim = ctx.scrollWithAnim

  const rulerDragging = ref(false)
  const rulerActiveKey = ref('')
  const rulerTop = ref(0)
  const rulerHeight = ref(100)
  const rulerPreview = ref(null)

  const rulerVisible = computed(() => shouldShowRuler(allMessages.value.length))
  const rulerTicks = computed(() => buildRulerTicks(allMessages.value))
  const rulerViewportStyle = computed(() => ({
    top: rulerTop.value.toFixed(2) + '%',
    height: rulerHeight.value.toFixed(2) + '%'
  }))
  const rulerPreviewStyle = computed(() => ({
    top: (rulerPreview.value ? rulerPreview.value.percent : 0).toFixed(2) + '%'
  }))

  let _trackRect = null
  let _clientHeight = 0
  let _lastJumpAt = 0
  let _touchStartY = 0
  let _moved = false
  let _pendingTick = null
  let _previewTimer = null
  let _measureTimer = null

  /** 量刻度尺与聊天区尺寸（异步，结果缓存；拿不到就退回窗口高度估算） */
  function measure() {
    _measureTimer = null
    if (typeof uni === 'undefined' || !uni.createSelectorQuery) return
    const query = uni.createSelectorQuery()
    query.select('#chat-scroll').boundingClientRect()
    query.select('#chat-ruler-track').boundingClientRect()
    query.exec(function (res) {
      if (!res) return
      if (res[0] && res[0].height) _clientHeight = res[0].height
      if (res[1] && res[1].height) _trackRect = { top: res[1].top, height: res[1].height }
    })
  }

  function measureSoon() {
    if (_measureTimer) return
    _measureTimer = setTimeout(measure, MEASURE_DELAY)
  }

  function clientHeightOf(e) {
    const target = e && e.target
    if (target && target.clientHeight) return target.clientHeight
    if (_clientHeight > 0) return _clientHeight
    let windowHeight = 600
    try { windowHeight = uni.getSystemInfoSync().windowHeight || 600 } catch (err) { windowHeight = 600 }
    return Math.round(windowHeight * 0.6)
  }

  /** 滚动同步：视口指示 + 高亮当前刻度（拖动中不抢用户的手） */
  function syncRulerScroll(e) {
    if (!rulerVisible.value || !e || !e.detail) return
    const scrollTop = e.detail.scrollTop || 0
    const scrollHeight = e.detail.scrollHeight || 0
    const clientHeight = clientHeightOf(e)
    const range = viewportRange(scrollTop, scrollHeight, clientHeight)
    rulerTop.value = range.top
    rulerHeight.value = range.height
    if (!_trackRect) measureSoon()
    if (rulerDragging.value) return
    const tick = pickTickByScroll(rulerTicks.value, scrollTop, scrollHeight, clientHeight)
    const key = tick ? tick.key : ''
    if (key && key !== rulerActiveKey.value) rulerActiveKey.value = key
  }

  /** 跳到某个刻度：先把虚拟窗口扩到目标，再交给 scroll-into-view */
  async function jumpToTick(tick, options) {
    if (!tick) return false
    const total = allMessages.value.length
    const index = tick.messageIndex
    if (!(index >= 0 && index < total)) return false
    rulerActiveKey.value = tick.key
    showPreview(tick)

    const needed = resolveWindowSize(index, total, visibleCount.value, RULER_KEEP_ABOVE)
    const expanded = needed > visibleCount.value
    if (expanded) {
      visibleCount.value = needed
      await nextTick()
    }
    const windowStart = Math.max(0, total - Math.min(visibleCount.value, total))
    if (index < windowStart) return false

    _lastJumpAt = Date.now()
    await applyScrollIntoView('msg-' + index, !(options && options.instant), expanded)
    return true
  }

  /**
   * 设置 scroll-into-view 跳转
   * 空串 -> 目标 id 是为了让同一个目标能重复触发；扩窗后消息批量插入，
   * App / 小程序首次布局可能慢一拍，expanded 为 true 时补一次（幂等，已在位则无感）
   */
  async function applyScrollIntoView(id, animate, retry) {
    scrollWithAnim.value = animate
    scrollIntoView.value = ''
    await nextTick()
    scrollIntoView.value = id
    if (retry) {
      setTimeout(function () {
        if (scrollIntoView.value !== id) return
        scrollIntoView.value = ''
        nextTick(function () { scrollIntoView.value = id })
      }, SCROLL_RETRY_DELAY)
    }
  }

  /** 渐显预览，不跳转 */
  function showPreview(tick) {
    if (tick && tick.label) rulerPreview.value = tick
  }

  function clearPreviewTimer() {
    if (_previewTimer) {
      clearTimeout(_previewTimer)
      _previewTimer = null
    }
  }

  function schedulePreviewClear(ms) {
    clearPreviewTimer()
    _previewTimer = setTimeout(function () { rulerPreview.value = null }, ms || PREVIEW_KEEP_MS)
  }

  function firstTouch(e) {
    if (!e) return null
    const list = e.touches && e.touches.length ? e.touches : (e.changedTouches || [])
    return list && list.length ? list[0] : null
  }

  /** 手指位置 → 最近刻度；allowJump 为 true 时按节流直接跳 */
  function applyTouchY(clientY, allowJump) {
    if (!_trackRect) {
      measure()
      return
    }
    const tick = pickTickByPercent(rulerTicks.value, percentFromY(clientY, _trackRect))
    if (!tick) return
    _pendingTick = tick
    rulerActiveKey.value = tick.key
    showPreview(tick)
    clearPreviewTimer()
    if (!allowJump) return
    if (Date.now() - _lastJumpAt < RULER_JUMP_INTERVAL) return
    jumpToTick(tick, { instant: true })
  }

  function handleRulerTouchStart(e) {
    const touch = firstTouch(e)
    if (!touch) return
    _touchStartY = touch.clientY
    _moved = false
    rulerDragging.value = false
    clearPreviewTimer()
    applyTouchY(touch.clientY, false)
  }

  function handleRulerTouchMove(e) {
    const touch = firstTouch(e)
    if (!touch) return
    if (!_moved && Math.abs(touch.clientY - _touchStartY) < TOUCH_MOVE_SLOP) return
    _moved = true
    rulerDragging.value = true
    applyTouchY(touch.clientY, true)
  }

  /**
   * H5 桌面端鼠标点击（触屏事件不触发）：只认带 clientY 的事件，
   * App / 小程序走 touchstart->touchend 链路，这里直接跳过，避免重复跳转
   */
  function handleRulerTap(e) {
    if (!e || typeof e.clientY !== 'number') return
    if (!_trackRect) measure()
    applyTouchY(e.clientY, true)
    schedulePreviewClear(PREVIEW_KEEP_MS)
  }

  function handleRulerTouchEnd() {
    const tick = _pendingTick
    const wasMoving = _moved
    rulerDragging.value = false
    _moved = false
    _pendingTick = null
    if (!wasMoving && tick) jumpToTick(tick, { instant: true })
    schedulePreviewClear(PREVIEW_KEEP_MS)
  }

  function resetRuler() {
    rulerActiveKey.value = ''
    rulerPreview.value = null
    rulerDragging.value = false
    _pendingTick = null
    _moved = false
    _lastJumpAt = 0
    _trackRect = null
    clearPreviewTimer()
  }

  // 换会话（消息数组换新）时重置，避免残留上一条会话的刻度高亮 / 预览
  watch(allMessages, resetRuler)
  watch(rulerVisible, function (on) { if (on) measureSoon() }, { immediate: true })

  return {
    rulerVisible, rulerTicks, rulerActiveKey, rulerDragging,
    rulerViewportStyle, rulerPreview, rulerPreviewStyle,
    syncRulerScroll, jumpToTick, resetRuler,
    handleRulerTouchStart, handleRulerTouchMove, handleRulerTouchEnd,
    handleRulerTap
  }
}