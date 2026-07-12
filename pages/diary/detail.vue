<script setup>
/**
 * 日记详情 / 新建页
 * 路由: /pages/diary/detail?id=new | ?clientId=xxx&month=YYYY-MM
 */

import SijiIcon from '@/components/common/SijiIcon.vue'
import { ref, onMounted } from 'vue'

import { logger } from '@/utils/logger.js'
import { onLoad } from '@dcloudio/uni-app'
import { getDiaryById, saveDiary, deleteDiary, getDiaryList, getUsedTags, addCustomTag, getTags } from '@/utils/storage.js'
import { generateEntityId } from '@/utils/uuid.js'
import { useAppStore } from '@/store/index.js'

const store = useAppStore()

const isNew = ref(true)
const diaryId = ref('')
const month = ref('')
// 保存加载时的原始 created_at — 编辑时必须用它，不能设为 undefined
// 否则 saveDiary 的 getMonthFromDate(undefined) 会得到 "NaN-NaN"，存到错误 key
const originalCreatedAt = ref(null)

const form = ref({
  title: '',
  content: '',
  mood: 3,
  tags: [],
  ai_summary: '',
  ai_advice: '',
  images: '[]'
})

const moodOptions = [
  { label: '😢 难过', value: 1 },
  { label: '😰 焦虑', value: 2 },
  { label: '😌 平静', value: 3 },
  { label: '😊 开心', value: 4 },
  { label: '🤩 兴奋', value: 5 }
]

onLoad((query) => {
  if (query && query.clientId) {
    isNew.value = false
    diaryId.value = query.clientId
    month.value = query.month || ''
    loadDiary()
  } else if (query && query.id === 'new') {
    isNew.value = true
  }
})

function getQuery() {
  const pages = getCurrentPages()
  const page = pages[pages.length - 1]
  return page?.$route?.query || page?.options || {}
}

function loadDiary() {
  const item = getDiaryById(diaryId.value, month.value)
  if (item) {
    // 保存原始 created_at — 编辑保存时必须复用它，避免存到错误月份 key
    originalCreatedAt.value = item.created_at || null
    let tags = item.tags
    if (typeof tags === 'string') tags = safeParseArray(tags)
    if (!Array.isArray(tags)) tags = []
    form.value = {
      title: item.title || '',
      content: item.content || '',
      mood: item.mood ?? 3,
      tags: tags,
      ai_summary: item.ai_summary || '',
      ai_advice: item.ai_advice || '',
      images: item.images || '[]'
    }
  }
}

function safeParseArray(val) {
  if (Array.isArray(val)) return val
  if (typeof val === 'string') {
    try { const p = JSON.parse(val); return Array.isArray(p) ? p : [] } catch { return [] }
  }
  return []
}

// 标签相关
const showTagPicker = ref(false)
const newTagInput = ref('')
const allUsedTags = ref([])

function openTagPicker() {
  allUsedTags.value = getUsedTags('diary')
  showTagPicker.value = true
}
function toggleTag(tagName) {
  const idx = form.value.tags.indexOf(tagName)
  if (idx >= 0) form.value.tags.splice(idx, 1)
  else form.value.tags.push(tagName)
}
function isTagSelected(tagName) {
  return form.value.tags.includes(tagName)
}
function addNewTag() {
  const name = newTagInput.value.trim()
  if (!name) return
  if (form.value.tags.includes(name)) {
    uni.showToast({ title: '标签已存在', icon: 'none' })
    return
  }
  form.value.tags.push(name)
  const newTag = addCustomTag('diary', name)
  // 刷新可选标签列表，让新标签立即出现
  allUsedTags.value = getUsedTags('diary')
  // 清除颜色缓存，让新标签使用注册表分配的颜色
  delete tagColorCache[name]
  newTagInput.value = ''
  uni.showToast({ title: '标签已创建', icon: 'success' })
}
function removeTag(tagName) {
  const idx = form.value.tags.indexOf(tagName)
  if (idx >= 0) form.value.tags.splice(idx, 1)
}

const tagColorCache = {}
function tagColor(name) {
  if (tagColorCache[name]) return tagColorCache[name]
  // 先从注册表已用标签中找
  const used = allUsedTags.value.find(t => t.name === name)
  if (used?.color) {
    tagColorCache[name] = used.color
    return used.color
  }
  // 再从注册表本身找（addCustomTag 写入但 getUsedTags 可能未收录）
  const registry = getTags('diary')
  const regItem = registry.find(t => t.name === name)
  if (regItem?.color) {
    tagColorCache[name] = regItem.color
    return regItem.color
  }
  tagColorCache[name] = '#000000'
  return '#000000'
}

async function handleSave() {
  if (!form.value.title.trim() && !form.value.content.trim()) {
    uni.showToast({ title: '请至少填写标题或内容', icon: 'none' })
    return
  }

  // 编辑时复用原始 created_at；新建时用当前时间
  // 注意：created_at 不能为 undefined，否则 saveDiary 的 getMonthFromDate(undefined)
  // → new Date(undefined) → Invalid Date → "NaN-NaN" → 存到 diary_NaN-NaN 错误 key
  const createdAt = isNew.value
    ? Date.now()
    : (originalCreatedAt.value || Date.now())

  const diary = {
    client_id: isNew.value ? generateEntityId('diary') : diaryId.value,
    title: form.value.title.trim(),
    content: form.value.content.trim(),
    mood: form.value.mood,
    tags: [...form.value.tags],
    ai_summary: form.value.ai_summary,
    ai_advice: form.value.ai_advice,
    images: form.value.images,
    created_at: createdAt,
    updated_at: Date.now(),
    is_deleted: 0
  }

  logger.log('[日记保存] tags:', JSON.stringify(diary.tags), 'created_at:', diary.created_at, 'isNew:', isNew.value)
  saveDiary(diary)
  logger.log('[日记保存] 完成, client_id:', diary.client_id)

  uni.showToast({ title: '已保存', icon: 'success' })
  setTimeout(() => { uni.navigateBack() }, 800)
}

function handleDelete() {
  uni.showModal({
    title: '删除日记',
    content: '确定要删除这篇日记吗？',
    success(res) {
      if (res.confirm) {
        deleteDiary(diaryId.value, month.value)
        uni.showToast({ title: '已删除', icon: 'success' })
        setTimeout(() => { uni.navigateBack() }, 800)
      }
    }
  })
}
</script>

<template>
  <view class="detail-page">
    <scroll-view class="detail-scroll" scroll-y>
      <!-- 心情选择 -->
      <view class="section">
        <text class="section-label">心情</text>
        <view class="mood-row">
          <view
            v-for="m in moodOptions" :key="m.value"
            class="mood-item"
            :class="{ active: form.mood === m.value }"
            @tap="form.mood = m.value"
          >
            {{ m.label }}
          </view>
        </view>
      </view>

      <!-- 标题 -->
      <view class="section">
        <text class="section-label">标题</text>
        <input
          v-model="form.title"
          class="input-field"
          placeholder="给今天起个名字..."
          maxlength="100"
        />
      </view>

      <!-- 正文 -->
      <view class="section">
        <text class="section-label">正文</text>
        <textarea
          v-model="form.content"
          class="textarea-field"
          placeholder="今天发生了什么... 想到什么都可以写下来"
          :maxlength="5000"
          :auto-height="true"
        />
      </view>

      <!-- 标签 -->
      <view class="section">
        <text class="section-label">标签 <text class="tag-hint">长按移除</text></text>
        <view class="tag-chips">
          <view
            v-for="t in form.tags" :key="t"
            class="tag-chip"
            :style="{ background: tagColor(t) + '1a', color: tagColor(t), borderColor: tagColor(t) }"
            @longpress="removeTag(t)"
          >
            <text class="tc-label">{{ t }}</text>
          </view>
          <view class="tag-add-btn" @tap="openTagPicker">
            <text>+ 添加标签</text>
          </view>
        </view>
      </view>

      <!-- AI 摘要（只读） -->
      <view v-if="form.ai_summary" class="section ai-section">
        <view class="section-label"><SijiIcon name="sparkle" size="sm" class="section-icon" /><text>AI 摘要</text></view>
        <text class="ai-text">{{ form.ai_summary }}</text>
      </view>

      <!-- AI 建议（只读） -->
      <view v-if="form.ai_advice" class="section ai-section">
        <view class="section-label"><SijiIcon name="tip" size="sm" class="section-icon" /><text>AI 建议</text></view>
        <text class="ai-text">{{ form.ai_advice }}</text>
      </view>
    </scroll-view>

    <!-- 标签选择弹窗 -->
    <view class="tag-picker-overlay" v-if="showTagPicker" @tap.self="showTagPicker = false">
      <view class="tag-picker">
        <text class="tp-title">选择标签</text>

        <view class="tp-current" v-if="form.tags.length > 0">
          <view
            v-for="t in form.tags" :key="t"
            class="tag-chip"
            :style="{ background: tagColor(t) + '1a', color: tagColor(t), borderColor: tagColor(t) }"
            @tap="removeTag(t)"
          >
            <text class="tc-label">{{ t }}</text>
            <text class="tc-close">✕</text>
          </view>
        </view>

        <view class="tp-list">
          <view
            v-for="t in allUsedTags" :key="t.name"
            class="tp-item"
            :class="{ selected: isTagSelected(t.name) }"
            @tap="toggleTag(t.name)"
          >
            <text class="tp-dot" :style="{ background: isTagSelected(t.name) ? t.color : 'var(--bg-input)' }">{{ isTagSelected(t.name) ? '✓' : '' }}</text>
            <text class="tp-name">{{ t.name }}</text>
            <text class="tp-count">{{ t.count }}</text>
          </view>
          <view class="tp-empty" v-if="allUsedTags.length === 0">
            <text>暂无标签，输入下方创建</text>
          </view>
        </view>

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

        <view class="tp-done" @tap="showTagPicker = false">完成</view>
      </view>
    </view>

    <!-- 底部操作栏 -->
    <view class="bottom-bar safe-area-bottom">
      <view v-if="!isNew" class="btn-delete" @tap="handleDelete">删除</view>
      <view class="btn-save" @tap="handleSave">保存日记</view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.detail-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: $bg-page;
}

.detail-scroll {
  flex: 1;
  padding: $spacing-md;
}

.section {
  margin-bottom: $spacing-md;
  background: $bg-card;
  border-radius: $radius-md;
  padding: $spacing-md;
  box-shadow: $shadow-sm;
}

.section-label {
  font-size: $font-sm;
  color: $text-secondary;
  margin-bottom: $spacing-sm;
  display: block;

  .tag-hint {
    font-size: $font-xs;
    color: $text-hint;
    margin-left: $spacing-xs;
    font-weight: 400;
  }
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: $spacing-sm;

  .section-label {
    margin-bottom: 0;
  }
}

.mood-row {
  display: flex;
  gap: $spacing-sm;
  flex-wrap: wrap;
}

.mood-item {
  padding: 10rpx 24rpx;
  border-radius: 32rpx;
  font-size: $font-sm;
  background: $bg-input;
  color: $text-secondary;
  transition: all $transition-fast;

  &.active {
    background: var(--color-ai);
    color: var(--text-on-ai);
    font-weight: 600;
  }
}

.input-field {
  font-size: $font-md;
  padding: $spacing-sm 0;
  border-bottom: 1rpx solid rgba(0,0,0,0.06);
  width: 100%;
}

.textarea-field {
  font-size: $font-md;
  min-height: 300rpx;
  width: 100%;
  line-height: 1.8;
  padding: $spacing-sm 0;
}

.ai-section {
  background: rgba(0, 0, 0, 0.04);
  border: 1rpx solid var(--border-color);

  .ai-text {
    font-size: $font-sm;
    color: $text-primary;
    line-height: 1.7;
  }
}

/* 底部操作 */
.bottom-bar {
  display: flex;
  gap: $spacing-md;
  padding: $spacing-md;
  background: $bg-card;
  border-top: 1rpx solid rgba(0,0,0,0.06);

  .btn-delete {
    flex: 1;
    text-align: center;
    padding: 24rpx 0;
    border-radius: $radius-md;
    background: $bg-input;
    color: $danger;
    font-size: $font-md;
    font-weight: 600;
  }

  .btn-save {
    flex: 2;
    text-align: center;
    padding: 24rpx 0;
    border-radius: $radius-md;
    background: var(--color-ai);
    color: var(--text-on-ai);
    font-size: $font-md;
    font-weight: 600;
  }
}

/* ===== 标签系统 ===== */
.tag-chips {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
  align-items: center;
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

.tag-add-btn {
  padding: 6rpx 20rpx;
  border-radius: 24rpx;
  border: 1rpx dashed $text-hint;
  font-size: $font-xs;
  color: $text-secondary;
}

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
  background: $bg-card;
  border-radius: $radius-md $radius-md 0 0;
  padding: $spacing-md;
  display: flex;
  flex-direction: column;
}

.tp-title {
  font-size: $font-lg;
  font-weight: 700;
  color: $text-primary;
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

  .tp-dot {
    width: 36rpx; height: 36rpx;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 18rpx; color: var(--text-on-ai);
    font-weight: 700;
    flex-shrink: 0;
  }

  .tp-name { flex: 1; font-size: $font-sm; color: $text-primary; font-weight: 500; }
  .tp-count { font-size: $font-xs; color: $text-hint; }
}

.tp-empty {
  text-align: center;
  padding: $spacing-lg;
  font-size: $font-sm;
  color: $text-hint;
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
    background: $bg-input;
    border-radius: $radius-md;
    font-size: $font-sm;
  }

  .tp-add {
    font-size: $font-sm;
    color: var(--color-ai);
    font-weight: 700;
    padding: 0 $spacing-sm;
    flex-shrink: 0;
  }
}

.tp-done {
  margin-top: $spacing-md;
  padding: 24rpx 0;
  text-align: center;
  background: var(--color-ai);
  border-radius: $radius-md;
  color: var(--text-on-ai);
  font-size: $font-md;
  font-weight: 700;
}
</style>
