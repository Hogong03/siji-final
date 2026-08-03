/**
 * useExecTags - 执行结果卡片的标签管理逻辑
 *
 * 从 ExecResultCard.vue 拆出 — 处理标签的增删改查、面板交互
 */
import { ref, computed, onMounted } from 'vue'
import { getUsedTags, addCustomTag, getTags, getPlanList, getDiaryList } from '@/utils/storage.js'

export function useExecTags(props, emit) {
  const showTagPanel = ref(false)
  const tagPanelTags = ref([])
  const newTagInput = ref('')
  const tagColorCache = {}

  const canEditTags = computed(() => {
    const detail = props.message?.execResult?.detail
    if (!detail) return false
    return detail.type === 'diary' || detail.type === 'plan'
  })

  function currentTags() {
    const detail = props.message?.execResult?.detail
    if (!detail) return []
    let tags = detail.tags
    if (typeof tags === 'string') {
      try { const p = JSON.parse(tags); tags = Array.isArray(p) ? p : [] } catch { tags = [] }
    }
    if (!Array.isArray(tags)) tags = []
    return tags
  }

  function syncTagsFromStorage() {
    const detail = props.message?.execResult?.detail
    if (!detail || !detail.id) return
    if (detail.type !== 'diary' && detail.type !== 'plan') return

    let storedTags = null
    try {
      if (detail.type === 'plan') {
        const plans = getPlanList()
        const plan = plans.find(p => p.client_id === detail.id)
        if (plan) storedTags = plan.tags
      } else if (detail.type === 'diary') {
        let month
        if (detail.created_at) {
          const d = new Date(detail.created_at)
          if (!isNaN(d.getTime())) {
            month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          }
        }
        if (!month) {
          const now = new Date()
          month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        }
        const diaries = getDiaryList(month)
        const diary = diaries.find(item => item.client_id === detail.id)
        if (diary) storedTags = diary.tags
      }
    } catch (e) {
      console.warn('[ExecResultCard] syncTagsFromStorage error:', e)
    }

    if (storedTags != null) {
      if (typeof storedTags === 'string') {
        try { const p = JSON.parse(storedTags); storedTags = Array.isArray(p) ? p : [] } catch { storedTags = [] }
      }
      if (Array.isArray(storedTags)) {
        detail.tags = [...storedTags]
      }
    }
  }

  onMounted(() => {
    if (canEditTags.value) {
      syncTagsFromStorage()
    }
  })

  function openTagPanel() {
    const detail = props.message?.execResult?.detail
    if (!detail) return
    tagPanelTags.value = getUsedTags(detail.type)
    showTagPanel.value = true
  }

  function closeTagPanel() {
    showTagPanel.value = false
    newTagInput.value = ''
  }

  function toggleTag(tagName) {
    const detail = props.message?.execResult?.detail
    if (!detail) return
    let tags = currentTags()
    const idx = tags.indexOf(tagName)
    if (idx >= 0) {
      tags.splice(idx, 1)
    } else {
      tags.push(tagName)
    }
    detail.tags = [...tags]
    emit('update-tags', { detail, tags: detail.tags })
  }

  function isTagOn(tagName) {
    return currentTags().includes(tagName)
  }

  function createNewTag() {
    const detail = props.message?.execResult?.detail
    if (!detail) return
    const name = newTagInput.value.trim()
    if (!name) return
    let tags = currentTags()
    if (tags.includes(name)) {
      uni.showToast({ title: '标签已存在', icon: 'none' })
      return
    }
    tags.push(name)
    addCustomTag(detail.type, name)
    detail.tags = [...tags]
    tagPanelTags.value = getUsedTags(detail.type)
    newTagInput.value = ''
    emit('update-tags', { detail, tags: detail.tags })
    uni.showToast({ title: '标签已添加', icon: 'success' })
  }

  function removeTagFromCard(tagName) {
    toggleTag(tagName)
  }

  function tagColor(name) {
    if (tagColorCache[name]) return tagColorCache[name]
    const used = tagPanelTags.value.find(t => t.name === name)
    if (used?.color) {
      tagColorCache[name] = used.color
      return used.color
    }
    const detail = props.message?.execResult?.detail
    if (detail) {
      const registry = getTags(detail.type)
      const regItem = registry.find(t => t.name === name)
      if (regItem?.color) {
        tagColorCache[name] = regItem.color
        return regItem.color
      }
    }
    tagColorCache[name] = '#000000'
    return '#000000'
  }

  return {
    showTagPanel, tagPanelTags, newTagInput, canEditTags,
    currentTags, openTagPanel, closeTagPanel, toggleTag, isTagOn,
    createNewTag, removeTagFromCard, tagColor, syncTagsFromStorage
  }
}
