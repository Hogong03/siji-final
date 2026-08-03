/**
 * useConversationManager — 聊天页面会话管理
 *
 * 封装会话列表展示、新建/切换/删除/重命名逻辑，
 * 从 chat/index.vue 提取以减少页面体积。
 */
import { ref, computed } from 'vue'
import { useAppStore } from '@/store/index.js'

export function useConversationManager(store, getWelcomeMessage, scrollReset) {
  const showConvList = ref(false)
  const sortedConversations = computed(() =>
    [...store.conversations].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  )

  function toggleConvList() {
    showConvList.value = !showConvList.value
  }

  function handleNewConversation() {
    const current = store.activeConversation
    if (current && current.messages.length === 0) {
      showConvList.value = false
      return
    }
    const count = store.conversations.length
    const defaultName = count === 0 ? '对话' : `对话${count + 1}`
    uni.showModal({
      title: '新建对话',
      editable: true,
      placeholderText: `输入对话名称（留空则用「${defaultName}」）`,
      content: '',
      success(res) {
        const title = (res.confirm && res.content && res.content.trim())
          ? res.content.trim()
          : defaultName
        store.createConversation(title)
        showConvList.value = false
        uni.showToast({ title: '对话已创建', icon: 'none' })
      }
    })
  }

  function handleSwitchConversation(id) {
    store.switchConversation(id)
    showConvList.value = false
    if (scrollReset) scrollReset()
  }

  function handleDeleteConversation(conv) {
    uni.showModal({
      title: '删除对话',
      content: `确定删除「${conv.title || '未命名对话'}」吗?`,
      success(res) {
        if (res.confirm) {
          store.deleteConversation(conv.id)
          if (store.conversations.length === 0) {
            store.createConversation()
            store.addMessage({ role: 'assistant', content: getWelcomeMessage(), _isWelcome: true })
          }
          if (store.messages.length === 0) {
            store.addMessage({ role: 'assistant', content: getWelcomeMessage(), _isWelcome: true })
          }
          uni.showToast({ title: '已删除', icon: 'none' })
          if (scrollReset) scrollReset()
        }
      }
    })
  }

  function handleRenameConversation(conv) {
    uni.showModal({
      title: '重命名对话',
      editable: true,
      placeholderText: '输入新名称',
      content: conv.title || '',
      success(res) {
        if (res.confirm && res.content) {
          store.renameConversation(conv.id, res.content.trim())
          uni.showToast({ title: '已重命名', icon: 'none' })
        }
      }
    })
  }

  return {
    showConvList, sortedConversations,
    toggleConvList, handleNewConversation,
    handleSwitchConversation, handleDeleteConversation,
    handleRenameConversation
  }
}
