/**
 * useConversationManager — 聊天页面会话管理
 *
 * 封装会话列表展示、新建/切换/删除/重命名/标签逻辑，
 * 从 chat/index.vue 提取以减少页面体积。
 *
 * v2: 新增分类功能（按时间分组 + 按标签筛选）
 */
import { ref, computed, onMounted } from 'vue'
import { useAppStore } from '@/store/index.js'
import { getAllConvTags, groupByTime, filterByTag, getConvTags } from '@/utils/conv-tags.js'

export function useConversationManager(store, getWelcomeMessage, scrollReset) {
  const showConvList = ref(false)
  const activeFilter = ref('all') // 'all' | 'time' | 'tag'
  const activeTag = ref(null) // null = 全部

  // 全部标签列表（从全局标签库读取）
  const allTags = ref([])

  function refreshTags() {
    allTags.value = getAllConvTags()
  }

  // 排序后的会话列表（按更新时间降序）
  const sortedConversations = computed(() =>
    [...store.conversations].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  )

  // 按标签筛选后的会话列表
  const filteredConversations = computed(() => {
    if (activeFilter.value === 'tag' && activeTag.value) {
      return filterByTag(sortedConversations.value, activeTag.value)
    }
    return sortedConversations.value
  })

  // 时间分组结果（用于 'all' 和 'time' 模式）
  const groupedConversations = computed(() => {
    return groupByTime(filteredConversations.value)
  })

  // 是否有标签存在
  const hasTags = computed(() => {
    return sortedConversations.value.some(conv => getConvTags(conv).length > 0)
  })

  function toggleConvList() {
    showConvList.value = !showConvList.value
    if (showConvList.value) {
      refreshTags()
    }
  }

  function setFilter(mode) {
    activeFilter.value = mode
    if (mode !== 'tag') {
      activeTag.value = null
    }
  }

  function selectTag(tag) {
    activeTag.value = activeTag.value === tag ? null : tag
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

  // 给对话添加标签
  function handleAddTag(conv) {
    const existingTags = getConvTags(conv)
    const globalTags = getAllConvTags()
    // 合并已有标签 + 全局标签，去重
    const candidateTags = [...new Set([...existingTags, ...globalTags])]

    if (candidateTags.length === 0) {
      // 没有标签，直接让用户输入新标签
      promptNewTag(conv)
      return
    }

    // 有标签，先弹 ActionSheet 选择已有标签或新建
    const items = [...candidateTags, '+ 新建标签']
    uni.showActionSheet({
      itemList: items,
      success: (res) => {
        if (res.tapIndex === items.length - 1) {
          promptNewTag(conv)
        } else {
          const tag = items[res.tapIndex]
          if (!existingTags.includes(tag)) {
            store.addTagToConversation(conv.id, tag)
            refreshTags()
            uni.showToast({ title: `已添加「${tag}」`, icon: 'none' })
          } else {
            // 已有该标签，取消选中
            store.removeTagFromConversation(conv.id, tag)
            refreshTags()
            uni.showToast({ title: `已移除「${tag}」`, icon: 'none' })
          }
        }
      }
    })
  }

  function promptNewTag(conv) {
    uni.showModal({
      title: '新建标签',
      editable: true,
      placeholderText: '输入标签名称（如：工作、生活）',
      content: '',
      success(res) {
        if (res.confirm && res.content && res.content.trim()) {
          const tag = res.content.trim()
          store.addTagToConversation(conv.id, tag)
          refreshTags()
          uni.showToast({ title: `已添加「${tag}」`, icon: 'none' })
        }
      }
    })
  }

  return {
    showConvList, activeFilter, activeTag, allTags,
    sortedConversations, filteredConversations, groupedConversations, hasTags,
    toggleConvList, setFilter, selectTag, refreshTags,
    handleNewConversation, handleSwitchConversation, handleDeleteConversation,
    handleRenameConversation, handleAddTag
  }
}
