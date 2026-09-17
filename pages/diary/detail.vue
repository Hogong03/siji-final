<script setup>
/**
 * 记录详情 / 新建页
 * 新建时可选 5 种记录类型，每种不同 placeholder/视觉/行为
 * 编辑区 → 标签 → 图片 → AI菜单 → 摘要 → 关联（4.2.0：分类并入标签）
 */
import SijiIcon from '@/components/common/SijiIcon.vue'
import { ref, computed } from 'vue'
import { onLoad, onBackPress } from '@dcloudio/uni-app'
import { getDiaryById, saveDiary, deleteDiary, togglePinDiary } from '@/utils/storage.js'
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
// 4.2.0：分类并入标签，「分类」这套候选值不再使用（存量值已由 migrateDiaryCategories 转成标签）
const showAIMenu = ref(false)
const showRelated = ref(false)
const recordType = ref('note')  // note|diary|todo（3.9 之前的 idea/flash 已并入 note）
const showTypePicker = ref(false)

/** 记录类型（4.2.0：5 种收敛到 3 种）
 *  想法/灵感/闪念归入「记录」—— 行为上都是随手写一段文本，没必要记的时候先做一次分类；
 *  系统会按内容自动打标签（#灵感 / #闪念 / #工作…），想找照样找得到。
 */
const RECORD_TYPES = [
  { key: 'note',  icon: '✏️', label: '记录', placeholder: '随手记点什么…',  color: '#18181B', desc: '想到什么写什么' },
  { key: 'diary', icon: '📖', label: '日记', placeholder: '今天发生了什么…',  color: '#0EA5E9', desc: '心情 + 摘要' },
  { key: 'todo',  icon: '☑️', label: '待办', placeholder: '要做什么？每行一个…', color: '#059669', desc: '可勾选' },
]

const currentType = computed(() => RECORD_TYPES.find(t => t.key === recordType.value) || RECORD_TYPES[0])

// 4.2.0：闪念模式已随类型收敛删除
// 4.2.0：闪念模式随类型收敛一并删除（它就是「note + 少几个控件」，不值得单独一种类型）
const showMetaPanel = ref(false) // 类型条+标签区域可收起

const form = ref({ title: '', content: '', tags: [], category: '', images: [], emotion: '', ai_summary: '', ai_advice: '', record_type: 'note' })

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
  return JSON.stringify({ t: form.value.title, c: form.value.content, tags: [...form.value.tags].sort(), cat: form.value.category, rt: recordType.value }) !== initialSnapshot.value
})

onLoad((query) => {
  // 分类已并入标签：这里不再加载分类候选
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
    initialSnapshot.value = JSON.stringify({ t: '', c: '', tags: [], cat: '', rt: recordType.value })
    if (query.tag) form.value.tags = [decodeURIComponent(query.tag)]
    if (query.cat) form.value.category = decodeURIComponent(query.cat)
  }
})

function applyTypeDefaults() {
  if (recordType.value === 'diary') {
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
  initialSnapshot.value = JSON.stringify({ t: form.value.title, c: form.value.content, tags: [...form.value.tags].sort(), cat: form.value.category, rt: key })
}

function closeTypePicker() {
  showTypePicker.value = false
}

let leaveConfirmed = false

/** 进入阅读页（长文按章节读，左侧目录尺跳小节） */
function goRead() {
  if (isNew.value) return
  uni.navigateTo({ url: `/pages/diary/read?clientId=${diaryId.value}&month=${month.value}` })
}

function goBack() {
  leaveConfirmed = true
  uni.navigateBack({ delta: 1, fail: () => uni.redirectTo({ url: '/pages/diary/list' }) })
}

onBackPress(() => {
  // 放弃/保存/删除后放行：navigateBack 会再次触发 onBackPress，不置标志会重复弹窗（反馈 2026-09-01）
  if (leaveConfirmed) return false
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
    title: item.title || '',
    content: item.content || '',
    tags: safeParseArray(item.tags), category: item.category || '',
    images: safeParseArray(item.images),
    emotion: item.emotion || '', ai_summary: item.ai_summary || '', ai_advice: item.ai_advice || '',
    record_type: recordType.value
  }
  initialSnapshot.value = JSON.stringify({ t: form.value.title, c: form.value.content, tags: [...form.value.tags].sort(), cat: form.value.category, rt: recordType.value })
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
  const title = form.value.title.trim() || text.substring(0, 50)
  saveDiary({
    client_id: isNew.value ? generateEntityId('diary') : diaryId.value,
    title, content: text,
    tags: [...form.value.tags], category: form.value.category,
    images: form.value.images || [], emotion: form.value.emotion || '',
    ai_summary: form.value.ai_summary, ai_advice: form.value.ai_advice,
    record_type: recordType.value,
    pinned: isPinned.value, created_at: createdAt, updated_at: Date.now(), is_deleted: 0
  })
  initialSnapshot.value = JSON.stringify({ t: form.value.title, c: form.value.content, tags: [...form.value.tags].sort(), cat: form.value.category, rt: recordType.value })
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
      <!-- 顶部筛选行 -->
      <view class="filter-bar">
        <view class="filter-left">
          <text class="filter-type-icon">{{ currentType.icon }}</text>
          <text class="filter-type-label">{{ currentType.label }}</text>
        </view>
        <view class="filter-right">
          <view v-if="!isNew && form.content.trim()" class="read-entry" @tap="goRead">
            <text class="read-entry-text">阅读</text>
          </view>
          <view class="filter-toggle-wrap" @tap="showMetaPanel = !showMetaPanel">
            <text class="filter-toggle">{{ showMetaPanel ? '▲' : '▼' }}</text>
          </view>
        </view>
      </view>

      <!-- 筛选条件（收展按钮控制） -->
      <view class="meta-panel" v-if="showMetaPanel">
        <!-- 类型选择 -->
        <view class="meta-section">
          <text class="meta-section-title">类型</text>
          <view class="meta-chips">
            <view v-for="t in RECORD_TYPES" :key="t.key" class="meta-chip cat-chip" :class="{ active: recordType === t.key }" @tap="selectType(t.key)"><text>{{ t.icon }}{{ t.label }}</text></view>
          </view>
        </view>
        <!-- 标签 -->
        <view class="meta-section" >
          <text class="meta-section-title">标签</text>
          <view class="meta-chips">
            <view v-for="t in form.tags" :key="t" class="meta-chip tag-chip" :style="{ color: tagColor(t), borderColor: tagColor(t) }" @tap="removeTag(t)"><text>{{ t }}</text><text class="tag-remove">✕</text></view>
            <text class="meta-add" @tap="openTagPicker">+</text>
          </view>
        </view>
      </view>

      <!-- 标题（独立输入，紧贴正文编辑区） -->
      <view  class="title-section">
        <input
          v-model="form.title"
          class="title-input"
          placeholder="标题（可选）"
          :maxlength="50"
          :placeholder-style="'color: #A1A1AA'"
        />
      </view>

      <!-- 编辑区 -->
      <view class="textarea-section">
        <textarea
          v-model="form.content"
          class="textarea-field"
          :placeholder="currentType.placeholder"
          :maxlength="5000"
          :auto-height="true"
          :focus="isNew && !showTypePicker"
        />
        <view class="textarea-actions" >
          <!-- #ifdef APP-PLUS -->
          <text class="ta-btn" :class="{ recording: isRecording }" @tap="startVoice">{{ isRecording ? '⏹' : '🎤' }}</text>
          <!-- #endif -->
          <text class="ta-btn" @tap="chooseImage" v-if="form.images.length < MAX_IMAGES">🖼</text>
          <text class="ta-btn" @tap="showAIMenu = !showAIMenu" v-if="form.content.trim()">✨</text>
        </view>
      </view>

      <!-- AI 菜单 -->
      <view class="ai-menu" v-if="showAIMenu && form.content.trim()">
        <view class="ai-menu-item" @tap="doAI('summary')"><text>{{ generating ? '⏳ 生成中…' : '📋 生成摘要' }}</text></view>
        <view class="ai-menu-item" @tap="doAI('rewrite')"><text>{{ Rewriting ? '⏳ 润色中…' : '✏️ 润色文本' }}</text></view>
        <view class="ai-menu-item" @tap="doAI('todos')"><text>{{ extractingTodos ? '⏳ 提取中…' : '☑️ 提取待办' }}</text></view>
        <view class="ai-menu-item" @tap="doAI('emotion')"><text>{{ analyzingEmotion ? '⏳ 分析中…' : '💭 情绪分析' }}</text></view>
      </view>

      <!-- 图片（闪念模式隐藏） -->
      <view class="image-section" v-if="form.images && form.images.length > 0">
        <view class="image-grid">
          <view v-for="(img, i) in form.images" :key="i" class="image-item" @tap="previewImage(i)">
            <image :src="img" mode="aspectFill" class="img-thumb" />
            <view class="img-remove" @tap.stop="removeImage(i)"><text>✕</text></view>
          </view>
        </view>
      </view>

      <!-- 情绪标签 -->
      <view class="emotion-badge" v-if="emotionLabel"><text>{{ emotionLabel }}</text></view>

      <!-- AI 摘要 -->
      <view v-if="form.ai_summary" class="ai-section">
        <view class="ai-section-header">
          <text class="ai-section-title">摘要</text>
          <text class="ai-refresh" @tap="generateAISummary">{{ generating ? '⏳' : '↻' }}</text>
        </view>
        <text class="ai-text">{{ form.ai_summary }}</text>
      </view>

      <view v-if="form.ai_advice" class="ai-section">
        <text class="ai-section-title">建议</text>
        <text class="ai-text">{{ form.ai_advice }}</text>
      </view>

      <!-- 关联区域 -->
      <view class="related-section" v-if="!isNew && hasRelated">
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
