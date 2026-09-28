/**
 * 流式渲染控制 — 从 useChatEngine 拆出
 *
 * 管理 streamedText 的增量更新和节流渲染到 UI
 */
import { ref } from 'vue'
import { RUNTIME_CONFIG } from '@/config/runtime.js'

export function useStreamRenderer(store, scrollHelpers) {
  const streamedText = ref('')
  let flushTimer = null

  function startStream() {
    streamedText.value = ''
    flushTimer = null
    scrollHelpers?.startStreamScroll?.()
  }

  function onChunk(chunk) {
    streamedText.value += chunk
    // 节流：33ms 更新一次 UI
    if (!flushTimer) {
      flushTimer = setTimeout(() => {
        store.updateLastMessage({ content: streamedText.value, loading: true })
        flushTimer = null
      }, RUNTIME_CONFIG.ai.streamThrottle)
    }
  }

  function flushNow() {
    if (flushTimer) {
      clearTimeout(flushTimer)
      flushTimer = null
    }
    store.updateLastMessage({ content: streamedText.value, loading: true })
  }

  function stopStream() {
    if (flushTimer) {
      clearTimeout(flushTimer)
      flushTimer = null
    }
    scrollHelpers?.stopStreamScroll?.()
  }

  return { streamedText, startStream, onChunk, flushNow, stopStream }
}
