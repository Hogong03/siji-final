<script setup>
/**
 * 执行结果卡片 — 从 MessageBubble 拆出
 *
 * 显示 AI 自动执行操作后的结果摘要（日记/账单/计划/查询/撤销）
 * 支持内联标签编辑（diary/plan）
 *
 * props: message, isEditing
 * emits: confirm-action, start-edit, save-edit, cancel-edit, update-tags
 */
import { ref, watch, computed, onMounted } from 'vue'
import SijiIcon from '@/components/common/SijiIcon.vue'
import { getUsedTags, addCustomTag, getTags, getPlanList, getDiaryList } from '@/utils/storage.js'

const props = defineProps({
  message: { type: Object, required: true },
  isEditing: { type: Boolean, default: false }
})

const emit = defineEmits([
  'confirm-action', 'start-edit', 'save-edit', 'cancel-edit', 'update-tags'
])

const localForm = ref({})

/* 双击检测 */
let lastTapTime = 0
function onCardTap() {
  const now = Date.now()
  if (now - lastTapTime < 350) {
    lastTapTime = 0
    emit('start-edit')
  } else {
    lastTapTime = now
  }
}

function onEditConfirm() {
  emit('save-edit', localForm.value)
}

function initEditForm(detail) {
  if (!detail) { localForm.value = {}; return }
  if (detail.type === 'bill') {
    localForm.value = { amount: String(detail.amount || ''), category: detail.category || '其他', note: '' }
  } else if (detail.type === 'diary') {
    localForm.value = { title: detail.title || '', mood: detail.mood || '平静' }
  } else if (detail.type === 'plan') {
    localForm.value = { title: detail.title || '' }
  } else {
    localForm.value = {}
  }
}

watch(() => props.isEditing, (editing) => {
  if (editing && props.message?.execResult?.detail) {
    initEditForm(props.message.execResult.detail)
  }
})

function execIcon(type) {
  const map = {
    diary: 'diary', bill: 'bill', plan: 'plan',
    query_diary: 'search', query_bill: 'stats', query_plan: 'search', query_stat: 'stats'
  }
  return map[type] || 'check'
}

const categories = ['餐饮', '交通', '购物', '娱乐', '医疗', '住房', '工资', '兼职', '红包', '其他']
const moods = ['开心', '平静', '难过', '焦虑', '愤怒', '满足', '疲惫', '兴奋']

// ==================== 标签管理 ====================

const canEditTags = computed(() => {
  const detail = props.message?.execResult?.detail
  if (!detail) return false
  return detail.type === 'diary' || detail.type === 'plan'
})

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

const showTagPanel = ref(false)
const tagPanelTags = ref([])
const newTagInput = ref('')

function openTagPanel() {
  const detail = props.message?.execResult?.detail
  if (!detail) return
  const type = detail.type
  tagPanelTags.value = getUsedTags(type)
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

function formatTs(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ''
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const tagColorCache = {}
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
</script>

<template>
  <!-- 复合意图结果 -->
  <template v-if="message.execResults && message.execResults.length > 1">
    <view class="exec-header">
      <text class="exec-status">{{ message.execResults.length }} 个操作已执行</text>
    </view>
    <view class="exec-multi-card" v-for="(r, idx) in message.execResults" :key="idx">
      <view class="exec-multi-row">
        <SijiIcon :name="execIcon(r.detail?.type)" size="sm" class="exec-multi-icon" />
        <view class="exec-multi-body">
          <text class="exec-multi-text">{{ r.message }}</text>
          <text v-if="r.detail?.type === 'bill'" class="exec-multi-sub">¥{{ r.detail.amount }} {{ r.detail.category }}</text>
          <text v-else-if="r.detail?.type === 'diary'" class="exec-multi-sub">{{ r.detail.title }}</text>
          <text v-else-if="r.detail?.type === 'plan'" class="exec-multi-sub">{{ r.detail.title }}</text>
        </view>
        <text class="exec-multi-arrow" @tap="$emit('confirm-action', { type: r.detail?.type ? ('create_' + r.detail.type) : '', payload: r.detail })">查看 →</text>
      </view>
    </view>
  </template>

  <!-- 单意图结果 -->
  <template v-else>
    <view class="exec-header">
      <text class="exec-status">已保存</text>
      <text class="exec-edit" @tap="$emit('start-edit')">编辑</text>
      <text class="exec-arrow" @tap="$emit('confirm-action', message.actionCard)">查看 →</text>
    </view>
    <!-- 编辑提示条 -->
    <view class="dbl-tap-hint" v-if="!isEditing">
      <text class="dth-text">双击卡片编辑</text>
    </view>

    <view class="exec-body" @tap="onCardTap">
      <!-- 日记 -->
      <template v-if="message.execResult.detail?.type === 'diary'">
        <text class="exec-title">{{ message.execResult.detail.title }}</text>
        <text class="exec-sub" v-if="message.execResult.detail.content">{{ (message.execResult.detail.content || '').substring(0, 60) }}{{ (message.execResult.detail.content || '').length > 60 ? '...' : '' }}</text>
        <view class="exec-tags">
          <text class="exec-tag">心情: {{ message.execResult.detail.mood }}</text>
        </view>
      </template>
      <!-- 账单 -->
      <template v-else-if="message.execResult.detail?.type === 'bill'">
        <text class="exec-amount">¥{{ message.execResult.detail.amount }}</text>
        <text class="exec-cat">{{ message.execResult.detail.category }}</text>
      </template>
      <!-- 计划 -->
      <template v-else-if="message.execResult.detail?.type === 'plan'">
        <text class="exec-title">{{ message.execResult.detail.title }}</text>
        <text class="exec-sub" v-if="message.execResult.detail.description">{{ message.execResult.detail.description }}</text>
        <view class="exec-date-row" v-if="message.execResult.detail.estimated_time || message.execResult.detail.due_date || message.execResult.detail.deadline">
          <text v-if="message.execResult.detail.estimated_time" class="exec-date-chip est">预计 {{ message.execResult.detail.estimated_time }}</text>
          <text v-if="message.execResult.detail.due_date || message.execResult.detail.deadline" class="exec-date-chip due">截止 {{ message.execResult.detail.due_date || message.execResult.detail.deadline }}</text>
        </view>
        <view class="exec-subtasks" v-if="message.execResult.detail.subtasks?.length > 0">
          <view class="subtask-row" v-for="(st, idx) in message.execResult.detail.subtasks" :key="idx">
            <text class="subtask-dot">○</text>
            <text class="subtask-title">{{ st.title }}</text>
          </view>
        </view>
        <text class="exec-sub" v-if="message.execResult.detail.subtaskCount > 0 && !message.execResult.detail.subtasks">
          {{ message.execResult.detail.subtaskCount }} 个子任务
        </text>
      </template>
      <!-- 查询结果 -->
      <template v-else-if="(message.execResult.detail?.type || '').startsWith('query_')">
        <text class="exec-title">{{ message.execResult.message }}</text>
        <template v-if="message.execResult.detail.type === 'query_bill' && message.execResult.detail.items?.length > 0">
          <view class="query-list">
            <view class="query-item" v-for="(item, idx) in message.execResult.detail.items.slice(0, 5)" :key="idx">
              <text class="qi-amount" :class="item.type">{{ item.type === 'expense' ? '-' : '+' }}¥{{ item.amount }}</text>
              <text class="qi-cat">{{ item.category }}</text>
              <text class="qi-note" v-if="item.note">{{ item.note }}</text>
              <text class="qi-date">{{ item.bill_date }}</text>
            </view>
          </view>
          <text class="exec-sub" v-if="message.execResult.detail.totalExpense != null">
            支出 ¥{{ message.execResult.detail.totalExpense?.toFixed(2) }} · 收入 ¥{{ message.execResult.detail.totalIncome?.toFixed(2) }}
          </text>
        </template>
        <template v-else-if="message.execResult.detail.type === 'query_diary' && message.execResult.detail.items?.length > 0">
          <view class="query-list">
            <view class="query-item" v-for="(item, idx) in message.execResult.detail.items.slice(0, 5)" :key="idx">
              <text class="qi-title">{{ item.title }}</text>
              <text class="qi-mood" v-if="item.mood">{{ item.mood }}</text>
              <text class="qi-date">{{ formatTs(item.created_at) }}</text>
            </view>
          </view>
        </template>
        <template v-else-if="message.execResult.detail.type === 'query_plan' && message.execResult.detail.items?.length > 0">
          <view class="query-list">
            <view class="query-item" v-for="(item, idx) in message.execResult.detail.items.slice(0, 5)" :key="idx">
              <text class="qi-title">{{ item.title }}</text>
              <text class="qi-sub" v-if="item.description">{{ (item.description || '').substring(0, 30) }}</text>
              <text class="qi-progress" v-if="item.subtasks?.length">{{ item.subtasks.filter(s => s.done).length }}/{{ item.subtasks.length }}</text>
            </view>
          </view>
        </template>
      </template>
      <!-- 撤销结果 -->
      <template v-else-if="message.execResult.detail?.type === 'undo'">
        <text class="exec-title">{{ message.execResult.message }}</text>
      </template>
    </view>

    <!-- 标签行 — 仅 diary / plan 类型显示 -->
    <view v-if="canEditTags" class="tag-section">
      <view class="tag-section-header">
        <text class="tag-section-label">标签</text>
        <text class="tag-section-count" v-if="currentTags().length > 0">{{ currentTags().length }}</text>
      </view>
      <view class="tag-section-chips">
        <view
          v-for="t in currentTags()" :key="t"
          class="tag-chip-item"
          :style="{ background: tagColor(t) + '1a', color: tagColor(t), borderColor: tagColor(t) + '40' }"
        >
          <text class="tci-label">#{{ t }}</text>
          <text class="tci-close" @tap.stop="removeTagFromCard(t)">✕</text>
        </view>
        <view class="tag-add-chip" @tap="openTagPanel">
          <text class="tag-add-text">+ 标签</text>
        </view>
      </view>
    </view>
  </template>

  <!-- 就地编辑表单 -->
  <view v-if="isEditing" class="edit-card">
    <view class="edit-header">
      <text class="edit-title">编辑</text>
    </view>
    <template v-if="message.execResult.detail?.type === 'bill'">
      <view class="edit-field">
        <text class="edit-label">金额</text>
        <input v-model="localForm.amount" type="digit" class="edit-input" placeholder="金额" @confirm="onEditConfirm" />
      </view>
      <view class="edit-field">
        <text class="edit-label">分类</text>
        <picker :range="categories" @change="localForm.category = categories[$event.detail.value]">
          <text class="edit-picker">{{ localForm.category }}</text>
        </picker>
      </view>
    </template>
    <template v-else-if="message.execResult.detail?.type === 'diary'">
      <view class="edit-field">
        <text class="edit-label">标题</text>
        <input v-model="localForm.title" class="edit-input" placeholder="标题" @confirm="onEditConfirm" />
      </view>
      <view class="edit-field">
        <text class="edit-label">心情</text>
        <picker :range="moods" @change="localForm.mood = moods[$event.detail.value]">
          <text class="edit-picker">{{ localForm.mood }}</text>
        </picker>
      </view>
    </template>
    <template v-else-if="message.execResult.detail?.type === 'plan'">
      <view class="edit-field">
        <text class="edit-label">标题</text>
        <input v-model="localForm.title" class="edit-input" placeholder="计划标题" @confirm="onEditConfirm" />
      </view>
    </template>
    <view class="edit-actions">
      <view class="edit-btn cancel" @tap="$emit('cancel-edit')"><text>取消</text></view>
      <view class="edit-btn save" @tap="$emit('save-edit', localForm)"><text>保存</text></view>
    </view>
  </view>

  <!-- 标签选择面板 -->
  <view v-if="showTagPanel" class="tag-panel-overlay" @tap.self="closeTagPanel">
    <view class="tag-panel">
      <text class="tp-title">选择标签</text>
      <view class="tp-current" v-if="currentTags().length > 0">
        <view
          v-for="t in currentTags()" :key="t"
          class="tag-chip-item"
          :style="{ background: tagColor(t) + '1a', color: tagColor(t), borderColor: tagColor(t) + '40' }"
          @tap="toggleTag(t)"
        >
          <text class="tci-label">#{{ t }}</text>
          <text class="tci-close">✕</text>
        </view>
      </view>
      <view class="tp-list">
        <view
          v-for="t in tagPanelTags" :key="t.name"
          class="tp-item"
          :class="{ selected: isTagOn(t.name) }"
          @tap="toggleTag(t.name)"
        >
          <text class="tp-dot" :style="{ background: isTagOn(t.name) ? t.color : '#F4F4F5' }">{{ isTagOn(t.name) ? '✓' : '' }}</text>
          <text class="tp-name">{{ t.name }}</text>
          <text class="tp-count">{{ t.count }}</text>
        </view>
        <view class="tp-empty" v-if="tagPanelTags.length === 0">
          <text>暂无标签，输入下方创建</text>
        </view>
      </view>
      <view class="tp-input-row">
        <input
          v-model="newTagInput"
          class="tp-input"
          placeholder="输入新标签名..."
          maxlength="20"
          @confirm="createNewTag"
        />
        <text class="tp-add" @tap="createNewTag">创建</text>
      </view>
      <view class="tp-done" @tap="closeTagPanel">完成</view>
    </view>
  </view>
</template>

<style scoped lang="scss">
/* 执行结果卡片样式 — 从 MessageBubble 迁移 */
.dbl-tap-hint { text-align: center; padding: 4rpx 0; }
.dth-text { font-size: 20rpx; color: var(--text-hint); opacity: 0.5; }

.exec-header {
  display: flex; align-items: center; gap: 12rpx;
  padding: 16rpx 20rpx 8rpx;
}
.exec-status { font-size: 24rpx; color: var(--text-hint); }
.exec-edit { font-size: 24rpx; color: var(--color-ai); margin-left: auto; }
.exec-arrow { font-size: 24rpx; color: var(--text-hint); }

.exec-body { padding: 0 20rpx 16rpx; }
.exec-title { display: block; font-size: 28rpx; font-weight: 600; color: var(--text-primary); margin-bottom: 4rpx; }
.exec-sub { display: block; font-size: 24rpx; color: var(--text-secondary); margin-top: 4rpx; }
.exec-amount { display: block; font-size: 36rpx; font-weight: 700; color: var(--text-primary); }
.exec-cat { display: block; font-size: 24rpx; color: var(--text-secondary); margin-top: 4rpx; }
.exec-tags { display: flex; flex-wrap: wrap; gap: 8rpx; margin-top: 8rpx; }
.exec-tag { font-size: 22rpx; color: var(--text-hint); background: var(--bg-input); padding: 4rpx 12rpx; border-radius: 6rpx; }

.exec-date-row { display: flex; gap: 8rpx; margin-top: 8rpx; flex-wrap: wrap; }
.exec-date-chip { font-size: 22rpx; padding: 4rpx 12rpx; border-radius: 6rpx; }
.exec-date-chip.est { background: var(--bg-input); color: var(--text-secondary); }
.exec-date-chip.due { background: var(--color-danger-light); color: var(--color-danger); }

.exec-subtasks { margin-top: 8rpx; }
.subtask-row { display: flex; align-items: center; gap: 8rpx; padding: 4rpx 0; }
.subtask-dot { font-size: 24rpx; color: var(--text-hint); }
.subtask-title { font-size: 24rpx; color: var(--text-secondary); }

.exec-multi-card { padding: 12rpx 20rpx; border-top: 1rpx solid var(--border-color); }
.exec-multi-row { display: flex; align-items: center; gap: 12rpx; }
.exec-multi-icon { font-size: 28rpx; }
.exec-multi-body { flex: 1; }
.exec-multi-text { display: block; font-size: 26rpx; color: var(--text-primary); }
.exec-multi-sub { display: block; font-size: 22rpx; color: var(--text-hint); }
.exec-multi-arrow { font-size: 24rpx; color: var(--text-hint); }

.query-list { margin-top: 8rpx; }
.query-item { display: flex; align-items: center; gap: 8rpx; padding: 8rpx 0; border-bottom: 1rpx solid var(--border-color); }
.qi-amount { font-size: 26rpx; font-weight: 600; }
.qi-amount.expense { color: var(--color-danger); }
.qi-amount.income { color: var(--color-plan); }
.qi-cat { font-size: 24rpx; color: var(--text-secondary); }
.qi-note { font-size: 22rpx; color: var(--text-hint); flex: 1; }
.qi-date { font-size: 22rpx; color: var(--text-hint); }
.qi-title { font-size: 26rpx; color: var(--text-primary); flex: 1; }
.qi-mood { font-size: 22rpx; color: var(--text-hint); }
.qi-sub { font-size: 22rpx; color: var(--text-hint); }
.qi-progress { font-size: 22rpx; color: var(--text-hint); }

/* 标签区域 */
.tag-section { padding: 8rpx 20rpx 16rpx; border-top: 1rpx solid var(--border-color); }
.tag-section-header { display: flex; align-items: center; gap: 8rpx; margin-bottom: 8rpx; }
.tag-section-label { font-size: 24rpx; color: var(--text-hint); }
.tag-section-count { font-size: 22rpx; color: var(--text-hint); }
.tag-section-chips { display: flex; flex-wrap: wrap; gap: 8rpx; }
.tag-chip-item {
  display: flex; align-items: center; gap: 4rpx;
  padding: 4rpx 12rpx; border-radius: 20rpx;
  border: 1rpx solid;
}
.tci-label { font-size: 22rpx; }
.tci-close { font-size: 20rpx; opacity: 0.6; }
.tag-add-chip {
  padding: 4rpx 12rpx; border-radius: 20rpx;
  border: 1rpx dashed var(--text-hint);
}
.tag-add-text { font-size: 22rpx; color: var(--text-hint); }

/* 标签面板 */
.tag-panel-overlay {
  position: fixed; left: 0; right: 0; bottom: 0; top: 0;
  background: rgba(0,0,0,0.4); z-index: 999;
  display: flex; align-items: flex-end;
}
.tag-panel {
  width: 100%; background: var(--bg-card);
  border-radius: 24rpx 24rpx 0 0; padding: 24rpx;
  max-height: 70vh; overflow-y: auto;
}
.tp-title { font-size: 30rpx; font-weight: 600; display: block; margin-bottom: 16rpx; color: var(--text-primary); }
.tp-current { display: flex; flex-wrap: wrap; gap: 8rpx; margin-bottom: 16rpx; }
.tp-list { margin-bottom: 16rpx; }
.tp-item {
  display: flex; align-items: center; gap: 12rpx;
  padding: 16rpx 0; border-bottom: 1rpx solid var(--border-color);
}
.tp-dot { width: 36rpx; height: 36rpx; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20rpx; }
.tp-name { flex: 1; font-size: 28rpx; color: var(--text-primary); }
.tp-count { font-size: 24rpx; color: var(--text-hint); }
.tp-empty { text-align: center; padding: 32rpx; color: var(--text-hint); }
.tp-input-row { display: flex; gap: 12rpx; margin-bottom: 16rpx; }
.tp-input { flex: 1; border: 1rpx solid var(--border-color); border-radius: 12rpx; padding: 16rpx; font-size: 28rpx; color: var(--text-primary); }
.tp-add { font-size: 28rpx; color: var(--color-ai); padding: 16rpx 24rpx; }
.tp-done { text-align: center; padding: 20rpx; font-size: 30rpx; color: var(--color-ai); border-top: 1rpx solid var(--border-color); }

/* 编辑表单 */
.edit-card { padding: 16rpx 20rpx; }
.edit-header { margin-bottom: 12rpx; }
.edit-title { font-size: 28rpx; font-weight: 600; color: var(--text-primary); }
.edit-field { margin-bottom: 12rpx; }
.edit-label { display: block; font-size: 24rpx; color: var(--text-hint); margin-bottom: 4rpx; }
.edit-input { border: 1rpx solid var(--border-color); border-radius: 12rpx; padding: 16rpx; font-size: 28rpx; color: var(--text-primary); }
.edit-picker { display: block; padding: 16rpx; border: 1rpx solid var(--border-color); border-radius: 12rpx; font-size: 28rpx; color: var(--text-primary); }
.edit-actions { display: flex; gap: 12rpx; margin-top: 16rpx; }
.edit-btn { flex: 1; text-align: center; padding: 20rpx; border-radius: 12rpx; }
.edit-btn.cancel { background: var(--bg-input); color: var(--text-secondary); }
.edit-btn.save { background: var(--color-ai); color: var(--text-on-ai); }
</style>
