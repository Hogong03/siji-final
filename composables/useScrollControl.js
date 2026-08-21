/**
 * useScrollControl — 聊天页面双模式滚动控制
 *
 * 方案 C：锚点定位（精确）+ scroll-top 增量（流式零 DOM 查询）
 *
 * 导出：
 *   - scrollTopValue, scrollIntoView, scrollWithAnim (模板绑定)
 *   - isAtBottom, showBackToBottom (UI 状态)
 *   - scrollToBottom, scrollToBottomAnchor (主动调用)
 *   - startStreamScroll, stopStreamScroll (流式期间)
 *   - handleScroll, backToBottom (事件绑定)
 *   - resetScrollState (切换会话时重置)
 */
import { ref, nextTick } from 'vue'

export function useScrollControl() {
  const scrollTopValue = ref(0)
  const scrollIntoView = ref('')
  const scrollWithAnim = ref(true)
  const isAtBottom = ref(true)
  const showBackToBottom = ref(false)
  const navScrolled = ref(false)

  let shouldAutoScroll = false
  let _windowHeightCache = 0
  function getWindowHeight() {
    if (!_windowHeightCache) {
      try { _windowHeightCache = uni.getSystemInfoSync().windowHeight || 600 } catch (e) { _windowHeightCache = 600 }
    }
    return _windowHeightCache
  }
  let isProgrammaticScroll = false
  let lastScrollHeight = 0
  let scrollTick = 0
  let streamScrollTimer = null

  function scrollToBottomAnchor(animate = true) {
    scrollWithAnim.value = animate
    scrollIntoView.value = ''
    nextTick(() => {
      scrollIntoView.value = 'chat-bottom'
    })
  }

  function scrollToBottomTop(estimatedHeight) {
    scrollWithAnim.value = false
    scrollTick++
    scrollTopValue.value = (estimatedHeight || lastScrollHeight || 99999) + scrollTick
  }

  function scrollToBottom(force = false) {
    if (force) {
      shouldAutoScroll = true
      scrollToBottomAnchor(true)
      return
    }
    if (!shouldAutoScroll) return
    scrollToBottomAnchor(true)
  }

  function startStreamScroll() {
    if (streamScrollTimer) return
    const query = uni.createSelectorQuery()
    query.select('#chat-scroll').scrollOffset()
    query.exec(res => {
      if (res && res[0]) lastScrollHeight = res[0].scrollHeight
    })
    streamScrollTimer = setInterval(() => {
      if (!shouldAutoScroll) return
      lastScrollHeight += 400
      scrollToBottomTop(lastScrollHeight)
    }, 150)
  }

  function stopStreamScroll() {
    if (!streamScrollTimer) return
    clearInterval(streamScrollTimer)
    streamScrollTimer = null
    nextTick(() => {
      const query = uni.createSelectorQuery()
      query.select('#chat-scroll').scrollOffset()
      query.exec(res => {
        if (res && res[0]) {
          lastScrollHeight = res[0].scrollHeight
          scrollTick++
          isProgrammaticScroll = true
          scrollTopValue.value = res[0].scrollHeight + scrollTick
          setTimeout(() => { isProgrammaticScroll = false }, 300)
        }
      })
    })
  }

  function handleScroll(e) {
    if (isProgrammaticScroll) return
    const { scrollTop, scrollHeight } = e.detail
    const sh = scrollHeight || (e.target && e.target.scrollHeight) || 0
    lastScrollHeight = sh
    const clientH = e.target && e.target.clientHeight
      ? e.target.clientHeight
      : (typeof window !== 'undefined' ? window.innerHeight : getWindowHeight())
    const distanceFromBottom = sh - scrollTop - clientH
    isAtBottom.value = distanceFromBottom <= 80
    const hasScrolledEnough = sh > clientH * 1.5 && distanceFromBottom > 300
    showBackToBottom.value = !isAtBottom.value && hasScrolledEnough
    navScrolled.value = scrollTop > 20
    if (shouldAutoScroll && distanceFromBottom > 150) {
      shouldAutoScroll = false
    }
  }

  function backToBottom() {
    shouldAutoScroll = true
    isAtBottom.value = true
    showBackToBottom.value = false
    scrollToBottomAnchor(true)
  }

  function resetScrollState() {
    shouldAutoScroll = true
    isAtBottom.value = true
    showBackToBottom.value = false
    nextTick(() => {
      setTimeout(() => scrollToBottomAnchor(false), 50)
    })
  }

  function forceShouldAutoScroll() {
    shouldAutoScroll = true
  }

  return {
    scrollTopValue, scrollIntoView, scrollWithAnim,
    isAtBottom, showBackToBottom, navScrolled,
    scrollToBottom, scrollToBottomAnchor,
    startStreamScroll, stopStreamScroll,
    handleScroll, backToBottom, resetScrollState,
    forceShouldAutoScroll
  }
}
