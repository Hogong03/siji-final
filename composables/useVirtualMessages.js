/**
 * 虚拟消息列表 composable
 *
 * 策略：窗口化渲染（windowing）
 * - 默认渲染最近 PAGE_SIZE 条消息
 * - 向上滚动到顶部时加载更多
 * - 滚动位置保持（加载后不跳屏）
 * - 适用于消息高度不固定的场景
 */

import { ref, computed, watch, nextTick } from 'vue'

const PAGE_SIZE = 50 // 每次加载的消息数
const SCROLL_LOAD_THRESHOLD = 80 // 距顶部多少 px 时触发加载

export function useVirtualMessages(allMessages) {
  const visibleCount = ref(PAGE_SIZE)
  const isLoadingMore = ref(false)
  const savedScrollTop = ref(0)
  const savedScrollHeight = ref(0)

  // 当前可见的消息（从末尾截取 visibleCount 条）
  const visibleMessages = computed(() => {
    const total = allMessages.value.length
    if (total <= visibleCount.value) return allMessages.value
    const start = total - visibleCount.value
    return allMessages.value.slice(start)
  })

  // 是否还有更多消息可加载
  const hasMore = computed(() => visibleCount.value < allMessages.value.length)

  // 切换会话时重置
  watch(() => allMessages.value, (newVal) => {
    if (newVal.length <= PAGE_SIZE) {
      visibleCount.value = PAGE_SIZE
    }
  }, { flush: 'sync' })

  /**
   * 检查是否需要加载更多
   * 在 scroll-view 的 @scroll 中调用
   */
  function checkLoadMore(scrollTop, scrollHeight) {
    if (!hasMore.value || isLoadingMore.value) return false
    if (scrollTop <= SCROLL_LOAD_THRESHOLD) {
      loadMore(scrollTop, scrollHeight)
      return true
    }
    return false
  }

  /**
   * 加载更多消息
   * @param {number} currentScrollTop - 当前滚动位置
   * @param {number} currentScrollHeight - 当前内容高度
   */
  async function loadMore(currentScrollTop, currentScrollHeight) {
    if (!hasMore.value || isLoadingMore.value) return

    isLoadingMore.value = true
    savedScrollTop.value = currentScrollTop
    savedScrollHeight.value = currentScrollHeight

    visibleCount.value = Math.min(
      visibleCount.value + PAGE_SIZE,
      allMessages.value.length
    )

    await nextTick()

    // 恢复滚动位置 — 保持视觉上不跳动
    isLoadingMore.value = false
    return {
      scrollTop: currentScrollTop,
      // 新增内容在顶部，需要计算高度差并补偿
      adjustScrollTop: (newScrollHeight) => {
        const diff = newScrollHeight - currentScrollHeight
        return currentScrollTop + diff
      }
    }
  }

  /**
   * 重置为初始状态（切换会话时调用）
   */
  function reset() {
    visibleCount.value = PAGE_SIZE
    isLoadingMore.value = false
  }

  /**
   * 获取消息在可见列表中的索引偏移
   * 全局 index → 可见 index
   */
  function toVisibleIndex(globalIndex) {
    const total = allMessages.value.length
    const offset = total - visibleMessages.value.length
    return globalIndex - offset
  }

  /**
   * 获取可见列表中的全局索引
   */
  function toGlobalIndex(visibleIndex) {
    const total = allMessages.value.length
    const offset = total - visibleMessages.value.length
    return visibleIndex + offset
  }

  return {
    visibleMessages,
    visibleCount,
    hasMore,
    isLoadingMore,
    checkLoadMore,
    loadMore,
    reset,
    toVisibleIndex,
    toGlobalIndex,
    PAGE_SIZE
  }
}
