/**
 * useOutlineRuler — 长文目录尺的状态与跳转编排（3.9.0）
 *
 * 与对话尺（useChatRuler）同一手感，差别只有一个：
 * 长文的所有小节都在 DOM 里（没有虚拟窗口），所以跳转直接用 scroll-into-view 锚点，
 * 精确到位、不需要扩窗补跳。
 *
 * 纯计算全部复用 utils/chat-ruler.js（视口换算 / 取最近刻度 / 触摸坐标转百分比），
 * 目录解析在 utils/text-outline.js。
 *
 * 依赖注入（页面传入）：
 *   sections       — computed，切好的小节数组（每项有 key / title）
 *   scrollIntoView — ref，scroll-view 的 scroll-into-view 绑定
 *   scrollWithAnim — ref，scroll-view 的 scroll-with-animation 绑定
 *   scrollId       — 滚动容器 id（默认 #read-scroll），量视口高度用
 *   trackId        — 刻度尺轨道 id（默认 #read-ruler-track），量尺子位置用
 */
import { ref, computed } from 'vue'
import { nextTick } from 'vue'
import {
  viewportRange, pickTickByPercent, pickTickByScroll, percentFromY,
  RULER_JUMP_INTERVAL, RULER_MIN_VIEWPORT
} from '@/utils/chat-ruler.js'
import { buildOutlineTicks, shouldShowOutline, readingProgress, sectionAtProgress } from '@/utils/text-outline.js'

const TOUCH_MOVE_SLOP = 8      // 位移超过该值才算拖动（否则算轻点）
const MEASURE_DELAY = 150      // 尺寸测量防抖
const PREVIEW_KEEP_MS = 900    // 预览停留时间
const PREVIEW_LEN = 14         // 预览文案截断长度

export function useOutlineRuler(ctx) {
  const sections = ctx.sections
  const scrollIntoView = ctx.scrollIntoView
  const scrollWithAnim = ctx.scrollWithAnim
  const scrollId = ctx.scrollId || '#read-scroll'
  const trackId = ctx.trackId || '#read-ruler-track'

  const rulerVisible = computed(() => shouldShowOutline(titledCount(sections.value)))
  const rulerTicks = computed(() => buildOutlineTicks(sections.value))
  const rulerActiveKey = ref('')
  const rulerTop = ref(0)
  const rulerHeight = ref(100)
  const rulerPreview = ref(null)
  const rulerDragging = ref(false)
  // 4.1.0：阅读进度条 + 顶部「当前章节 3/8」
  const readProgress = ref(0)
  const activeSection = ref(null)

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
  let _previewTimer = null
  let _measureTimer = null

  function titledCount(list) {
    return (Array.isArray(list) ? list : []).filter(s => s && s.title).length
  }

  /** 量滚动区与刻度尺尺寸（拿不到就退回窗口高度估算） */
  function measure() {
    _measureTimer = null
    if (typeof uni === 'undefined' || !uni.createSelectorQuery) return
    const query = uni.createSelectorQuery()
    query.select(scrollId).boundingClientRect()
    query.select(trackId).boundingClientRect()
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

  /** 滚动同步：视口指示 + 当前小节高亮（拖动中不抢手） */
  function syncScroll(e) {
    if (!rulerVisible.value || !e || !e.detail) return
    const scrollTop = e.detail.scrollTop || 0
    const scrollHeight = e.detail.scrollHeight || 0
    const clientHeight = clientHeightOf(e)
    const range = viewportRange(scrollTop, scrollHeight, clientHeight)
    rulerTop.value = range.top
    rulerHeight.value = Math.max(range.height, RULER_MIN_VIEWPORT)
    readProgress.value = readingProgress(scrollTop, scrollHeight, clientHeight)
    activeSection.value = sectionAtProgress(ctx.outline ? ctx.outline.value : [], readProgress.value)
    if (!_trackRect) measureSoon()
    if (rulerDragging.value) return
    const tick = pickTickByScroll(rulerTicks.value, scrollTop, scrollHeight, clientHeight)
    if (tick && tick.key !== rulerActiveKey.value) rulerActiveKey.value = tick.key
  }

  /** 跳到某小节（锚点精确跳转） */
  async function jumpTo(tick, instant) {
    if (!tick) return false
    rulerActiveKey.value = tick.key
    showPreview(tick)
    _lastJumpAt = Date.now()
    scrollWithAnim.value = !instant
    scrollIntoView.value = ''
    await nextTick()
    scrollIntoView.value = 'sec-view-' + tick.index
    return true
  }

  function showPreview(tick) {
    if (!tick) return
    const label = String(tick.label || '')
    rulerPreview.value = Object.assign({}, tick, {
      label: label.length > PREVIEW_LEN ? label.slice(0, PREVIEW_LEN) + '…' : label
    })
  }

  function clearPreviewTimer() {
    if (_previewTimer) { clearTimeout(_previewTimer); _previewTimer = null }
  }

  function schedulePreviewClear(ms) {
    clearPreviewTimer()
    _previewTimer = setTimeout(function () { rulerPreview.value = null }, ms || PREVIEW_KEEP_MS)
  }

  function firstTouch(e) {
    if (!e) return null
    const list = (e.touches && e.touches.length) ? e.touches : (e.changedTouches || [])
    return list && list.length ? list[0] : null
  }

  /** 手指位置 → 最近小节；allowJump 为 true 时按节流直接跳 */
  function applyTouchY(clientY, allowJump) {
    if (!_trackRect) { measure(); return }
    const tick = pickTickByPercent(rulerTicks.value, percentFromY(clientY, _trackRect))
    if (!tick) return
    if (allowJump) {
      const now = Date.now()
      if (now - _lastJumpAt >= RULER_JUMP_INTERVAL) jumpTo(tick, true)
      else showPreview(tick)
    } else {
      showPreview(tick)
    }
  }

  function handleTouchStart(e) {
    const t = firstTouch(e)
    if (!t) return
    rulerDragging.value = true
    _moved = false
    _touchStartY = t.clientY
    if (!_trackRect) measure()
    applyTouchY(t.clientY, true)
  }

  function handleTouchMove(e) {
    const t = firstTouch(e)
    if (!t) return
    if (Math.abs(t.clientY - _touchStartY) > TOUCH_MOVE_SLOP) _moved = true
    applyTouchY(t.clientY, true)
  }

  function handleTouchEnd(e) {
    rulerDragging.value = false
    const t = firstTouch(e)
    if (!_moved && t) applyTouchY(t.clientY, true)
    schedulePreviewClear()
  }

  /** 轻点刻度（部分端 tap 与 touch 会同时来，这里只保证不重复跳） */
  function handleTap(e) {
    const t = firstTouch(e)
    if (!t) return
    applyTouchY(t.clientY, true)
  }

  function resetRuler() {
    rulerActiveKey.value = ''
    rulerTop.value = 0
    rulerHeight.value = 100
    rulerPreview.value = null
    _trackRect = null
    _clientHeight = 0
  }

  return {
    readProgress, activeSection,
    rulerVisible, rulerTicks, rulerActiveKey,
    rulerTop, rulerHeight, rulerPreview, rulerDragging,
    rulerViewportStyle, rulerPreviewStyle,
    syncScroll, resetRuler, measureSoon,
    handleTouchStart, handleTouchMove, handleTouchEnd, handleTap
  }
}