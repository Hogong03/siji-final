/**
 * useRetryBar - 重试栏 + 网络状态横幅逻辑
 *
 * 从 chat/index.vue 拆出 — 处理失败检测、重试栏显示/隐藏、网络横幅
 */
import { ref, watch, computed, nextTick } from 'vue'

export function useRetryBar(store, isSending, engineRetry, inputAreaRef, scrollHelpers) {
  const showRetryBar = ref(false)
  const retryMessage = ref('')
  const retryImage = ref(null)
  const pendingRetryData = ref(null)

  const retryTitle = computed(() => {
    const msgs = store.messages
    const last = msgs[msgs.length - 1]
    if (last?.content?.includes('超时')) return 'AI 响应超时，要不要再试一次？'
    return 'AI 走神了，要不要再试一次？'
  })

  // ===== 网络状态横幅 =====
  const showOfflineBanner = ref(false)
  const showReconnectedBanner = ref(false)
  let offlineTimer = null
  let reconnectedTimer = null

  watch(() => store.isOnline, (online) => {
    if (online) {
      clearTimeout(offlineTimer)
      if (showOfflineBanner.value) {
        showOfflineBanner.value = false
        showReconnectedBanner.value = true
        clearTimeout(reconnectedTimer)
        reconnectedTimer = setTimeout(() => {
          showReconnectedBanner.value = false
        }, 2500)
      }
    } else {
      offlineTimer = setTimeout(() => {
        showOfflineBanner.value = true
      }, 3000)
    }
  })

  // ===== 失败检测 =====
  watch(isSending, async (v, prev) => {
    if (!v && prev && !showRetryBar.value) {
      await nextTick()
      const msgs = store.messages
      const lastMsg = msgs[msgs.length - 1]
      const isFailed = lastMsg && lastMsg.role === 'assistant' && (
        lastMsg.failed ||
        (lastMsg.content && (lastMsg.content.includes('走神了') || lastMsg.content.includes('超时'))) ||
        lastMsg.loading === true
      )
      if (isFailed) {
        if (lastMsg.loading) {
          store.updateLastMessage({ loading: false, failed: true })
        }
        for (let i = store.messages.length - 2; i >= 0; i--) {
          if (store.messages[i].role === 'user') {
            retryMessage.value = store.messages[i].content
            retryImage.value = store.messages[i].image || null
            break
          }
        }
        showRetryBar.value = true
      }
    }
  })

  function handleRetrySend() {
    showRetryBar.value = false
    engineRetry({}, inputAreaRef, scrollHelpers.scrollToBottom, scrollHelpers)
  }

  function handleRetryWithModel(showModelSwitch) {
    showRetryBar.value = false
    pendingRetryData.value = { message: retryMessage.value, image: retryImage.value }
    showModelSwitch.value = true
  }

  function handleRetryEdit(inputAreaRef) {
    showRetryBar.value = false
    const conv = store.activeConversation
    if (conv && conv.messages.length > 0 && conv.messages[conv.messages.length - 1].role === 'assistant' && conv.messages[conv.messages.length - 1].failed) {
      conv.messages.pop()
    }
    inputAreaRef.value?.setText(retryMessage.value)
  }

  return {
    showRetryBar, retryMessage, retryImage, pendingRetryData, retryTitle,
    showOfflineBanner, showReconnectedBanner,
    handleRetrySend, handleRetryWithModel, handleRetryEdit
  }
}
