/**
 * 记录详情页标签管理（分类感知）
 * @param {Ref<Object>} formRef - 外部 form 引用，操作 formRef.value.tags
 */
import { ref, computed } from 'vue'
import { getUsedTags, addCustomTag, getTags, getCategories } from '@/utils/storage.js'

export function useTagPicker(formRef) {
  const showTagPicker = ref(false)
  const newTagInput = ref('')
  const allUsedTags = ref([])
  const allCategories = ref([])
  const selectedCategory = ref('')
  const tagColorCache = {}

  function getTagsArr() { return formRef.value.tags }

  function openTagPicker() {
    allUsedTags.value = getUsedTags('diary')
    allCategories.value = getCategories()
    showTagPicker.value = true
  }

  const filteredTagList = computed(() => {
    if (!selectedCategory.value) return allUsedTags.value
    return allUsedTags.value.filter(t => t.category === selectedCategory.value)
  })

  function toggleTag(tagName) {
    const tags = getTagsArr()
    const idx = tags.indexOf(tagName)
    if (idx >= 0) tags.splice(idx, 1)
    else tags.push(tagName)
  }

  function isTagSelected(tagName) {
    return getTagsArr().includes(tagName)
  }

  function addNewTag() {
    const name = newTagInput.value.trim()
    if (!name) return
    const tags = getTagsArr()
    if (tags.includes(name)) {
      uni.showToast({ title: '标签已存在', icon: 'none' })
      return
    }
    tags.push(name)
    addCustomTag('diary', name, undefined, selectedCategory.value || undefined)
    allUsedTags.value = getUsedTags('diary')
    delete tagColorCache[name]
    newTagInput.value = ''
    uni.showToast({ title: '标签已创建', icon: 'success' })
  }

  function removeTag(tagName) {
    const tags = getTagsArr()
    const idx = tags.indexOf(tagName)
    if (idx >= 0) tags.splice(idx, 1)
  }

  function tagColor(name) {
    if (tagColorCache[name]) return tagColorCache[name]
    const used = allUsedTags.value.find(t => t.name === name)
    if (used?.color) { tagColorCache[name] = used.color; return used.color }
    const registry = getTags('diary')
    const regItem = registry.find(t => t.name === name)
    if (regItem?.color) { tagColorCache[name] = regItem.color; return regItem.color }
    tagColorCache[name] = '#000000'
    return '#000000'
  }

  return {
    showTagPicker, newTagInput, allUsedTags, allCategories, selectedCategory, filteredTagList,
    openTagPicker, toggleTag, isTagSelected, addNewTag, removeTag, tagColor
  }
}
