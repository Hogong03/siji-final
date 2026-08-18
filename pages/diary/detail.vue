<script setup>
/**
 * 记录详情 / 新建页
 * 新建时可选 5 种记录类型，每种不同 placeholder/视觉/行为
 * 编辑区 → 标签&分类 → 图片 → AI菜单 → 摘要 → 关联
 */
import SijiIcon from '@/components/common/SijiIcon.vue'
import { ref, computed } from 'vue'
import { onLoad, onBackPress } from '@dcloudio/uni-app'
import { getDiaryById, saveDiary, deleteDiary, togglePinDiary, getCategories } from '@/utils/storage.js'
import { generateEntityId } from '@/utils/uuid.js'
import { useTagPicker } from '@/composables/useTagPicker.js'
import { useRelatedRecords, useRelatedBills } from '@/composables/useDiaryRelations.js'
import { useDiaryImages } from '@/composables/useDiaryImages.js'
import { useDiaryAI } from '@/composables/useDiaryAI.js'

const isNew = ref(true)
const diaryId = ref('')
const month = ref('')
const originalCreatedAt = ref(null)
const isPinned = ref(false)
const categories = ref([])
const showAIMenu = ref(false)
const showRelated = ref(false)
const recordType = ref('note')  // note|diary|idea|todo|flash
const showTypePicker = ref(false)

const RECORD_TYPES = [
  { key: 'note',  icon: '✏️', label: '随手记', placeholder: '随手记点什么…',  color: '#18181B', desc: '快速记录' },
  { key: 'diary', icon: '📖', label: '日记',   placeholder: '今天发生了什么…',  color: '#0EA5E9', desc: '心情 + 摘要' },
  { key: 'idea',  icon: '💡', label: '灵感',   placeholder: '突然想到…',       color: '#F59E0B', desc: '自动标签' },
  { key: 'todo',  icon: '☑️', label: '待办',   placeholder: '要做什么？每行一个…', color: '#059669', desc: '可勾选' },
  { key: 'flash', icon: '⚡', label: '闪念',   placeholder: '一闪而过的念头…',   color: '#71717A', desc: '极简模式' },
]

const currentType = computed(() => RECORD_TYPES.find(t => t.key === recordType.value) || RECORD_TYPES[0])

// 闪念模式：隐藏标签/分类/图片/AI，只留 textarea + 保存
const isFlashMode = computed(() => recordType.value === 'flash' && isNew.value)

const form = ref({ content: '', tags: [], category: '', images: [], emotion: '', ai_summary: '', ai_advice: '', record_type: 'note' })

const { showTagPicker, newTagInput, allUsedTags, allCategories, selectedCategory, filteredTagList,
  openTagPicker, toggleTag, isTagSelected, addNewTag, removeTag, tagColor } = useTagPicker(form)

const { relatedRecords, loadRelated: loadRelatedRecords } = useRelatedRecords(
  computed(() => form.value.tags), computed(() => diaryId.value), computed(() => month.value)
)
const { relatedBills, loadRelatedBills } = useRelatedBills(originalCreatedAt)

const { chooseImage, removeImage, previewImage, MAX_IMAGES } = useDiaryImages(form)

const { generating, Rewriting, extractingTodos, analyzingEmotion,
  generateAISummary: _genSummary, rewriteContent, extractTodos, analyzeEmotion } = useDiaryAI(form)

const hasRelated = computed(() => relatedRecords.value.length > 0 || relatedBills.value.length > 0)

const initialSnapshot = ref('')
const isDirty = computed(() => {
  return JSON.stringify({ c: form.value.content, tags: [...form.value.tags].sort(), cat: form.value.category, rt: recordType.value }) !== initialSnapshot.value
})

onLoad((query) => {
  categories.value = getCategories()
  if (query?.clientId) {
    isNew.value = false
    diaryId.value = query.clientId
    month.value = query.month || ''
    loadDiary()
  } else if (query?.id === 'new') {
    isNew.value = true
    if (query.type && RECORD_TYPES.find(t => t.key === query.type)) {
      recordType.value = query.type
      showTypePicker.value = false
    } else {
      // 默认直接进随手记，不弹选择器
      recordType.value = 'note'
      showTypePicker.value = false
    }
    applyTypeDefaults()
    initialSnapshot.value = JSON.stringify({ c: '', tags: [], cat: '', rt: recordType.value })
    if (query.tag) form.value.tags = [decodeURIComponent(query.tag)]
    if (query.cat) form.value.category = decodeURIComponent(query.cat)
  }
})

function applyTypeDefaults() {
  if (recordType.value === 'idea') {
    if (!form.value.tags.includes('灵感')) form.value.tags.unshift('灵感')
  } else if (recordType.value === 'diary') {
    const now = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    const weekdays = ['日', '一', '二', '三', '四', '五', '六']
    const weather = '晴'  // 静态占位，后续可接入天气 API
    if (!form.value.content) {
      form.value.content = `${dateStr} 星期${weekdays[now.getDay()]} ${weather}\n`
    }
  }
}

function selectType(key) {
  recordType.value = key
  showTypePicker.value = false
  applyTypeDefaults()
  initialSnapshot.value = JSON.stringify({ c: form.value.content, tags: [...form.value.tags].sort(), cat: form.value.category, rt: key })
}

function closeTypePicker() {
  showTypePicker.value = false
}

function goBack() {
  uni.navigateBack({ delta: 1, fail: () => uni.redirectTo({ url: '/pages/diary/list' }) })
}

onBackPress(() => {
  if (showTypePicker.value) { showTypePicker.value = false; return true }
  if (isDirty.value) {
    uni.showModal({ title: '放弃编辑？', content: '当前修改未保存', confirmText: '放弃', cancelText: '继续编辑', success: (res) => { if (res.confirm) goBack() } })
    return true
  }
  return false
})

function safeParseArray(val) {
  if (Array.isArray(val)) return val
  if (typeof val === 'string') { try { const p = JSON.parse(val); return Array.isArray(p) ? p : [] } catch { return [] } }
  return []
}

function loadDiary() {
  const item = getDiaryById(diaryId.value, month.value)
  if (!item) return
  originalCreatedAt.value = item.created_at || null
  isPinned.value = !!item.pinned
  recordType.value = item.record_type || 'note'
  form.value = {
    content: (item.title ? item.title + '\n' : '') + (item.content || ''),
    tags: safeParseArray(item.tags), category: item.category || '',
    images: safeParseArray(item.images),
    emotion: item.emotion || '', ai_summary: item.ai_summary || '', ai_advice: item.ai_advice || '',
    record_type: recordType.value
  }
  initialSnapshot.value = JSON.stringify({ c: form.value.content, tags: [...form.value.tags].sort(), cat: form.value.category, rt: recordType.value })
  loadRelatedRecords()
  loadRelatedBills()
}

function goRelated(r) { uni.navigateTo({ url: `/pages/diary/detail?clientId=${r.client_id}&month=${r.month}` }) }
function handlePin() {
  isPinned.value = togglePinDiary(diaryId.value, month.value)
  uni.showToast({ title: isPinned.value ? '已置顶' : '已取消置顶', icon: 'none' })
}

// #ifdef APP-PLUS
const recorderManager = uni.getRecorderManager()
const isRecording = ref(false)
function startVoice() {
  if (isRecording.value) { recorderManager.stop(); isRecording.value = false; return }
  isRecording.value = true
  uni.showToast({ title: '说话中…再点结束', icon: 'none' })
  recorderManager.start({ format: 'mp3', duration: 60000 })
}
recorderManager.onStop(() => { isRecording.value = false; uni.showToast({ title: '语音已录制，识别功能待接入', icon: 'none' }) })
// #endif

async function handleSave() {
  if (!form.value.content.trim()) { uni.showToast({ title: '写点什么再保存吧', icon: 'none' }); return }
  const createdAt = isNew.value ? Date.now() : (originalCreatedAt.value || Date.now())
  const text = form.value.content.trim()
  const lineBreak = text.indexOf('\n')
  const title = lineBreak > 0 ? text.substring(0, lineBreak).trim() : ''
  const content = lineBreak > 0 ? text.substring(lineBreak + 1).trim() : ''
  saveDiary({
    client_id: isNew.value ? generateEntityId('diary') : diaryId.value,
    title: title || text.substring(0, 50), content,
    tags: [...form.value.tags], category: form.value.category,
    images: form.value.images || [], emotion: form.value.emotion || '',
    ai_summary: form.value.ai_summary, ai_advice: form.value.ai_advice,
    record_type: recordType.value,
    pinned: isPinned.value, created_at: createdAt, updated_at: Date.now(), is_deleted: 0
  })
  initialSnapshot.value = JSON.stringify({ c: form.value.content, tags: [...form.value.tags].sort(), cat: form.value.category, rt: recordType.value })
  uni.showToast({ title: '已保存', icon: 'success' })
  setTimeout(() => { goBack() }, 800)
}

function handleDelete() {
  uni.showModal({ title: '删除记录', content: '确定要删除？删除后可在回收站恢复。', success(res) {
    if (res.confirm) { deleteDiary(diaryId.value, month.value); uni.showToast({ title: '已删除', icon: 'success' }); setTimeout(() => { goBack() }, 800) }
  }})
}

function generateAISummary() { _genSummary(isNew.value, diaryId.value, month.value, getDiaryById, saveDiary) }

function doAI(action) {
  showAIMenu.value = false
  if (action === 'summary') generateAISummary()
  else if (action === 'rewrite') rewriteContent()
  else if (action === 'todos') extractTodos()
  else if (action === 'emotion') analyzeEmotion(isNew.value, diaryId.value, month.value, getDiaryById, saveDiary)
}

const emotionLabel = computed(() => {
  const map = { 开心: '😊', 平静: '😌', 焦虑: '😰', 低落: '😔', 愤怒: '😠' }
  return form.value.emotion ? `${map[form.value.emotion] || ''} ${form.value.emotion}` : ''
})
</script>

<template>
  <view class="detail-page" :class="'type-' + recordType">
    <!-- 记录类型选择器（新建时） -->
    <view class="type-picker-overlay" v-if="showTypePicker && isNew" @tap.self="goBack">
      <view class="type-picker">
        <text class="tp-title">选择记录类型</text>
        <view class="tp-grid">
          <view
            v-for="t in RECORD_TYPES" :key="t.key"
            class="tp-type-card"
            :class="{ active: recordType === t.key }"
            @tap="selectType(t.key)"
          >
            <text class="tp-type-icon">{{ t.icon }}</text>
            <text class="tp-type-label">{{ t.label }}</text>
            <text class="tp-type-desc">{{ t.desc }}</text>
          </view>
        </view>
        <text class="tp-cancel" @tap="closeTypePicker">取消</text>
      </view>
    </view>

    <scroll-view class="detail-scroll" scroll-y v-if="!showTypePicker || !isNew">
      <!-- 类型标识条 -->
      <view class="type-bar">
        <!-- 始终显示类型标识条 -->
        <text class="type-bar-icon">{{ currentType.icon }}</text>
        <text class="type-bar-label">{{ currentType.label }}</text>
        <text class="type-bar-switch" v-if="isNew" @tap="showTypePicker = true">切换</text>
      </view>

      <!-- 编辑区 -->
      <view class="textarea-section" :class="{ 'flash-mode': isFlashMode }">
        <textarea
          v-model="form.content"
          class="textarea-field"
          :placeholder="currentType.placeholder"
          :maxlength="5000"
          :auto-height="true"
          :focus="isNew && !showTypePicker"
        />
        <view class="textarea-actions" v-if="!isFlashMode">
          <!-- #ifdef APP-PLUS -->
          <text class="ta-btn" :class="{ recording: isRecording }" @tap="startVoice">{{ isRecording ? '⏹' : '🎤' }}</text>
          <!-- #endif -->
          <text class="ta-btn" @tap="chooseImage" v-if="form.images.length < MAX_IMAGES">🖼</text>
          <text class="ta-btn" @tap="showAIMenu = !showAIMenu" v-if="form.content.trim()">✨</text>
        </view>
      </view>

      <!-- AI 菜单 -->
      <view class="ai-menu" v-if="showAIMenu && form.content.trim() && !isFlashMode">
        <view class="ai-menu-item" @tap="doAI('summary')"><text>{{ generating ? '⏳ 生成中…' : '📋 生成摘要' }}</text></view>
        <view class="ai-menu-item" @tap="doAI('rewrite')"><text>{{ Rewriting ? '⏳ 润色中…' : '✏️ 润色文本' }}</text></view>
        <view class="ai-menu-item" @tap="doAI('todos')"><text>{{ extractingTodos ? '⏳ 提取中…' : '☑️ 提取待办' }}</text></view>
        <view class="ai-menu-item" @tap="doAI('emotion')"><text>{{ analyzingEmotion ? '⏳ 分析中…' : '💭 情绪分析' }}</text></view>
      </view>

      <!-- 标签 & 分类（闪念模式隐藏） -->
      <view class="meta-row" v-if="!isFlashMode">
        <view class="meta-chips">
          <view class="meta-chip cat-chip" :class="{ active: !form.category }" @tap="form.category = ''"><text>无分类</text></view>
          <view v-for="c in categories" :key="c.name" class="meta-chip cat-chip" :class="{ active: form.category === c.name }" @tap="form.category = c.name"><text>{{ c.name }}</text></view>
          <view v-for="t in form.tags" :key="t" class="meta-chip tag-chip" :style="{ color: tagColor(t), borderColor: tagColor(t) }" @longpress="removeTag(t)"><text>{{ t }}</text></view>
          <text class="meta-add" @tap="openTagPicker">+ 标签</text>
        </view>
      </view>

      <!-- 图片（闪念模式隐藏） -->
      <view class="image-section" v-if="!isFlashMode && form.images && form.images.length > 0">
        <view class="image-grid">
          <view v-for="(img, i) in form.images" :key="i" class="image-item" @tap="previewImage(i)">
            <image :src="img" mode="aspectFill" class="img-thumb" />
            <view class="img-remove" @tap.stop="removeImage(i)"><text>✕</text></view>
          </view>
        </view>
      </view>

      <!-- 情绪标签 -->
      <view class="emotion-badge" v-if="emotionLabel && !isFlashMode"><text>{{ emotionLabel }}</text></view>

      <!-- AI 摘要 -->
      <view v-if="!isFlashMode && form.ai_summary" class="ai-section">
        <view class="ai-section-header">
          <text class="ai-section-title">摘要</text>
          <text class="ai-refresh" @tap="generateAISummary">{{ generating ? '⏳' : '↻' }}</text>
        </view>
        <text class="ai-text">{{ form.ai_summary }}</text>
      </view>

      <view v-if="!isFlashMode && form.ai_advice" class="ai-section">
        <text class="ai-section-title">建议</text>
        <text class="ai-text">{{ form.ai_advice }}</text>
      </view>

      <!-- 关联区域 -->
      <view class="related-section" v-if="!isNew && !isFlashMode && hasRelated">
        <view class="related-header" @tap="showRelated = !showRelated">
          <text class="related-title-text">关联内容</text>
          <text class="related-arrow">{{ showRelated ? '▲' : '▼' }}</text>
        </view>
        <template v-if="showRelated">
          <view v-for="r in relatedRecords" :key="r.client_id" class="related-item" @tap="goRelated(r)">
            <text class="related-item-title">{{ r.title }}</text>
            <text class="related-item-preview" v-if="r.content">{{ r.content }}</text>
          </view>
          <view v-for="(b, i) in relatedBills" :key="'b'+i" class="bill-item">
            <text class="bill-category">{{ b.category }}</text>
            <text class="bill-amount">¥{{ b.amount }}</text>
          </view>
        </template>
      </view>
    </scroll-view>

    <!-- 标签选择器 -->
    <view class="tag-picker-overlay" v-if="showTagPicker" @tap.self="showTagPicker = false">
      <view class="tag-picker">
        <text class="tp-title">选择标签</text>
        <view class="tp-current" v-if="form.tags.length > 0">
          <view v-for="t in form.tags" :key="t" class="tag-chip" :style="{ color: tagColor(t), borderColor: tagColor(t) }" @tap="removeTag(t)"><text>{{ t }}</text><text class="tc-close">✕</text></view>
        </view>
        <view class="tp-list">
          <view v-for="t in filteredTagList" :key="t.name" class="tp-item" :class="{ selected: isTagSelected(t.name) }" @tap="toggleTag(t.name)">
            <text class="tp-dot" :style="{ background: isTagSelected(t.name) ? t.color : '#E4E4E7' }">{{ isTagSelected(t.name) ? '✓' : '' }}</text>
            <text class="tp-name">{{ t.name }}</text>
            <text class="tp-count">{{ t.count }}</text>
          </view>
        </view>
        <view class="tp-input-row">
          <input v-model="newTagInput" class="tp-input" placeholder="新标签..." maxlength="20" @confirm="addNewTag" />
          <text class="tp-add" @tap="addNewTag">创建</text>
        </view>
        <view class="tp-done" @tap="showTagPicker = false">完成</view>
      </view>
    </view>

    <!-- 底部操作栏 -->
    <view class="bottom-bar safe-area-bottom" v-if="!showTypePicker || !isNew">
      <text v-if="!isNew" class="bar-btn" @tap="handlePin">{{ isPinned ? '📌' : '📍' }}</text>
      <text v-if="!isNew" class="bar-btn bar-delete" @tap="handleDelete">删除</text>
      <view class="bar-save" @tap="handleSave"><text>保存</text></view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import './detail.scss';
</style>
