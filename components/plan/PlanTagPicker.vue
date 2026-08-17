<script setup>
/**
 * 标签选择弹窗组件
 * 显示已有标签列表 + 新建标签输入，支持多选/取消/创建标签
 * 自包含：直接读取 storage 获取标签列表和颜色
 */
import { ref, computed, watch } from 'vue'
import { getUsedTags, addCustomTag, getTags } from '@/utils/storage.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  selectedTags: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:visible', 'toggle-tag', 'add-tag', 'remove-tag'])

const newTagInput = ref('')
const allUsedTags = ref([])

// 标签颜色缓存
const tagColorCache = {}

function tagColor(name) {
  if (tagColorCache[name]) return tagColorCache[name]
  const used = allUsedTags.value.find(t => t.name === name)
  if (used?.color) {
    tagColorCache[name] = used.color
    return used.color
  }
  const registry = getTags('plan')
  const regItem = registry.find(t => t.name === name)
  if (regItem?.color) {
    tagColorCache[name] = regItem.color
    return regItem.color
  }
  tagColorCache[name] = '#000000'
  return '#000000'
}

function isTagSelected(tagName) {
  return props.selectedTags.includes(tagName)
}

function toggleTag(tagName) {
  emit('toggle-tag', tagName)
}

function removeTag(tagName) {
  emit('remove-tag', tagName)
}

function addNewTag() {
  const name = newTagInput.value.trim()
  if (!name) return
  if (props.selectedTags.includes(name)) {
    uni.showToast({ title: '标签已存在', icon: 'none' })
    return
  }
  addCustomTag('plan', name)
  // 不清除颜色缓存（父组件不负责维护），直接改本地缓存
  delete tagColorCache[name]
  allUsedTags.value = getUsedTags('plan')
  newTagInput.value = ''
  emit('add-tag', name)
}

function close() {
  emit('update:visible', false)
}

// 弹窗打开时刷新标签列表
watch(() => props.visible, (v) => {
  if (v) {
    allUsedTags.value = getUsedTags('plan')
  }
}, { immediate: true })
</script>

<template>
  <view class="tag-picker-overlay" v-if="visible" @tap.self="close">
    <view class="tag-picker">
      <text class="tp-title">选择标签</text>

      <!-- 当前计划标签 -->
      <view class="tp-current" v-if="selectedTags.length > 0">
        <view
          v-for="t in selectedTags" :key="t"
          class="tag-chip"
          :style="{ background: tagColor(t) + '1a', color: tagColor(t), borderColor: tagColor(t) }"
          @tap="removeTag(t)"
        >
          <text class="tc-label">{{ t }}</text>
          <text class="tc-close">✕</text>
        </view>
      </view>

      <!-- 可选标签 -->
      <view class="tp-list">
        <view
          v-for="t in allUsedTags" :key="t.name"
          class="tp-item"
          :class="{ selected: isTagSelected(t.name) }"
          @tap="toggleTag(t.name)"
        >
          <text class="tp-dot" :style="{ background: t.color }">{{ isTagSelected(t.name) ? '✓' : '' }}</text>
          <text class="tp-name">{{ t.name }}</text>
          <text class="tp-count">{{ t.count }}</text>
        </view>
        <view class="tp-empty" v-if="allUsedTags.length === 0">
          <text>暂无标签，输入下方创建</text>
        </view>
      </view>

      <!-- 新建标签 -->
      <view class="tp-input-row">
        <input
          v-model="newTagInput"
          class="tp-input"
          placeholder="输入新标签名..."
          maxlength="20"
          @confirm="addNewTag"
        />
        <text class="tp-add" @tap="addNewTag">创建</text>
      </view>

      <view class="tp-done" @tap="close">完成</view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.tag-picker-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 999;
}

.tag-picker {
  width: 100%;
  max-height: 70vh;
  background: #FFFFFF;
  border-radius: $radius-xl $radius-xl 0 0;
  padding: $spacing-md;
  display: flex;
  flex-direction: column;
  box-shadow: none;
}

.tp-title {
  font-size: $font-lg;
  font-weight: 700;
  color: #18181B;
  text-align: center;
  margin-bottom: $spacing-md;
}

.tp-current {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
  margin-bottom: $spacing-md;
  padding-bottom: $spacing-md;
  border-bottom: 1rpx solid rgba(0,0,0,0.06);
}

.tag-chip {
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 6rpx 16rpx;
  border-radius: 24rpx;
  border: 1rpx solid;
  font-size: $font-xs;

  .tc-label { font-weight: 500; }
  .tc-close { font-size: 20rpx; opacity: 0.7; margin-left: 2rpx; }
}

.tp-list {
  flex: 1;
  overflow-y: auto;
  max-height: 400rpx;
}

.tp-item {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: 18rpx $spacing-sm;
  border-radius: $radius-md;
  margin-bottom: 6rpx;
  transition: all $transition-fast;

  &.selected { background: rgba(0, 0, 0, 0.04); }

  .tp-dot {
    width: 36rpx; height: 36rpx;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 18rpx; color: #FFFFFF;
    font-weight: 700;
    flex-shrink: 0;
  }

  .tp-name { flex: 1; font-size: $font-sm; color: #18181B; font-weight: 500; }
  .tp-count { font-size: $font-xs; color: #A1A1AA; }
}

.tp-empty {
  text-align: center;
  padding: $spacing-lg;
  font-size: $font-sm;
  color: #A1A1AA;
}

.tp-input-row {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  margin-top: $spacing-md;
  padding: 0 $spacing-sm;
  padding-top: $spacing-md;
  border-top: 1rpx solid rgba(0,0,0,0.06);

  .tp-input {
    flex: 1;
    height: 72rpx;
    padding: 0 $spacing-md;
    background: #E4E4E7;
    border-radius: $radius-md;
    font-size: $font-sm;
  }

  .tp-add {
    font-size: $font-sm;
    color: #000000;
    font-weight: 700;
    padding: 0 $spacing-sm;
    flex-shrink: 0;
  }
}

.tp-done {
  margin-top: $spacing-md;
  padding: 24rpx 0;
  text-align: center;
  background: #000000;
  border-radius: $radius-md;
  color: #FFFFFF;
  font-size: $font-md;
  font-weight: 700;
}
</style>
