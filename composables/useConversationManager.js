/**
 * useConversationManager — 聊天页面会话管理
 *
 * 封装会话列表展示、新建/切换/删除/重命名/标签逻辑，
 * 从 chat/index.vue 提取以减少页面体积。
 *
 * v2: 新增分类功能（按时间分组 + 按标签筛选）
 * 4.5.0: 空会话种子消息改走 seedOpener()（进入单消息：问候+状态+下一步），
 *        没传 seedOpener 时回落旧欢迎语
 */
import { ref, computed, onMounted } from 'vue'
import { useAppStore } from '@/store/index.js'
import { getAllConvTags, groupByTime, filterByTag, getConvTags } from '@/utils/conv-tags.js'

export function useConversationManager(store, getWelcomeMessage, scrollReset, seedOpener = null) {
  const showConvList = ref(false)
  const activeFilter = ref('all') // 'all' | 'time' | 'tag'
  const activeTag = ref(null) // null = 全部
  const keyword = ref('') // 搜索关键词（标题 + 消息内容）

  // 行操作菜单（自定义底部面板，替代 uni.showActionSheet——H5 深色模式原生 ActionSheet 样式失控）
  const convActionVisible = ref(false)
  const currentConv = ref(null)

  // 全部标签列表（从全局标签库读取）
  const allTags = ref([])

  function refreshTags() {
    allTags.value = getAllConvTags()
  }

  // 排序后的会话列表（按更新时间降序）
  const sortedConversations = computed(() =>
    [...store.conversations].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  )

  /** 搜索匹配：标题或任一条消息正文命中 */
  function matchKeyword(conv, k) {
    if ((conv.title || '').includes(k)) return true
    return (conv.messages || []).some(m => {
      if (!m) return false
      return String(m.content || '').includes(k) || String(m.aiReply || '').includes(k)
    })
  }

  // 搜索 + 标签筛选后的会话列表
  const filteredConversations = computed(() => {
    let list = sortedConversations.value
    const k = keyword.value.trim()
    if (k) list = list.filter(conv => matchKeyword(conv, k))
    if (activeFilter.value === 'tag' && activeTag.value) {
      list = filterByTag(list, activeTag.value)
    }
    return list
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
    // 先清掉历史遗留的空壳会话（保留当前），再新建 —— 避免列表里堆「0 条」
    store.pruneEmptyConversations(current ? current.id : '')
    store.createConversation()
    showConvList.value = false
  }

  /** 行操作菜单（4.24.0）：重命名 / 标签 / 删除 —— 打开自定义底部面板 */
  function handleMoreConversation(conv) {
    currentConv.value = conv
    convActionVisible.value = true
  }
  function closeConvAction() {
    convActionVisible.value = false
    currentConv.value = null
  }
  function onActionRename() {
    const c = currentConv.value
    closeConvAction()
    if (c) handleRenameConversation(c)
  }
  function onActionTag() {
    const c = currentConv.value
    closeConvAction()
    if (c) handleAddTag(c)
  }
  function onActionDelete() {
    const c = currentConv.value
    closeConvAction()
    if (c) handleDeleteConversation(c)
  }

  function handleSwitchConversation(id) {
    store.switchConversation(id)
    showConvList.value = false
    if (scrollReset) scrollReset()
  }

  /** 空会话种子消息（4.5.0）：优先进入单消息，构造不了回落旧欢迎语 */
  function seedEmptyConversation() {
    const opener = seedOpener ? seedOpener() : null
    if (opener && opener.content) {
      store.addMessage(opener)
    } else {
      store.addMessage({ role: 'assistant', content: getWelcomeMessage(), _isWelcome: true })
    }
  }

  function handleDeleteConversation(conv) {
    // 删除是破坏性操作：确认弹窗前轻震提示（4.14.0）
    try { uni.vibrateShort && uni.vibrateShort({ type: 'light', fail: () => {} }) } catch (e) { /* ignore */ }
    uni.showModal({
      title: '删除对话',
      content: `确定删除「${conv.title || '未命名对话'}」吗?`,
      confirmText: '删除',
      confirmColor: '#EF4444',
      success(res) {
        if (res.confirm) {
          store.deleteConversation(conv.id)
          if (store.conversations.length === 0) {
            store.createConversation()
            seedEmptyConversation()
          }
          if (store.messages.length === 0) {
            seedEmptyConversation()
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
      confirmColor: '#000000',
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
      confirmColor: '#000000',
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
    showConvList, activeFilter, activeTag, allTags, keyword,
    sortedConversations, filteredConversations, groupedConversations, hasTags,
    toggleConvList, setFilter, selectTag, refreshTags,
    handleNewConversation, handleSwitchConversation, handleDeleteConversation,
    handleRenameConversation, handleAddTag, handleMoreConversation,
    convActionVisible, currentConv, closeConvAction,
    onActionRename, onActionTag, onActionDelete
  }
}
