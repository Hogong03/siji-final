/**
 * 计划详情 — 标签管理 composable
 */
import { ref } from 'vue'
import { getTags } from '@/utils/storage'

const tagColorCache = {}

export function usePlanTags(form) {
  const showTagPicker = ref(false)

  function openTagPicker() {
    showTagPicker.value = true
  }

  function toggleTag(tagName) {
    const idx = form.value.tags.indexOf(tagName)
    if (idx > -1) {
      form.value.tags.splice(idx, 1)
    } else {
      form.value.tags.push(tagName)
    }
  }

  function handleAddTag(name) {
    if (name && !form.value.tags.includes(name)) {
      form.value.tags.push(name)
    }
  }

  function removeTagFromPlan(tagName) {
    const idx = form.value.tags.indexOf(tagName)
    if (idx > -1) form.value.tags.splice(idx, 1)
  }

  function tagColor(name) {
    if (tagColorCache[name]) return tagColorCache[name]
    const registry = getTags('plan')
    const regItem = registry.find(t => t.name === name)
    if (regItem && regItem.color) {
      tagColorCache[name] = regItem.color
      return regItem.color
    }
    return '#999'
  }

  return { showTagPicker, openTagPicker, toggleTag, handleAddTag, removeTagFromPlan, tagColor }
}
