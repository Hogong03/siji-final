<script setup>
/**
 * 我的信息 — 个人画像管理 v2
 *
 * 动态画像卡（Dynamic Profile Cards）架构：
 *   - 固定卡片：基本信息、生活方式
 *   - 自定义卡片：用户/AI 可创建任意分组
 *   - 每张卡片包含 title/icon/fields
 *   - 内联编辑：点击字段直接编辑
 *   - AI 填充：通过对话让 AI 帮忙整理信息
 */
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getProfile, saveProfile, setProfileEnabled, clearProfile, getFilledCount,
         createCard, updateCardTitle, deleteCard, setCardField, removeCardField,
         addArrayItem, removeArrayItem } from '@/utils/profile.js'
import { getRelationsStats } from '@/utils/relations.js'
import SijiIcon from '@/components/common/SijiIcon.vue'
import { logger } from '@/utils/logger.js'

/* ---- 响应式数据 ---- */
const profile = ref(getProfile())
const enabled = ref(profile.value.enabled)
const editingField = ref(null) // { cardId, field } 正在编辑的字段
const editingValue = ref('')
const editingCardTitle = ref(null) // { cardId } 正在编辑标题
const editingTitleValue = ref('')
const showAddCard = ref(false)
const newCardTitle = ref('')
const chipInputField = ref(null) // { cardId, field } 正在输入 chip 的数组字段
const chipInputValue = ref('')
const relationsStats = ref({ total: 0, interactionCount: 0, avgScore: 0 })

/* ---- 计算属性 ---- */
const filledCount = computed(() => {
  let count = 0
  for (const card of profile.value.cards) {
    for (const [, val] of Object.entries(card.fields)) {
      if (val == null || val === '') continue
      if (Array.isArray(val) && val.length === 0) continue
      count++
    }
  }
  return count
})

const totalCards = computed(() => profile.value.cards.length)

/* ---- 生命周期 ---- */
onMounted(() => {
  // 确保数据最新
  profile.value = getProfile()
  enabled.value = profile.value.enabled
  if (enabled.value) relationsStats.value = getRelationsStats()
})

onShow(() => {
  profile.value = getProfile()
  enabled.value = profile.value.enabled
  if (enabled.value) relationsStats.value = getRelationsStats()
})

/* ---- 开关 ---- */
function toggleEnabled() {
  enabled.value = !enabled.value
  setProfileEnabled(enabled.value)
  profile.value.enabled = enabled.value
  if (enabled.value) relationsStats.value = getRelationsStats()
}

/* ---- 字段编辑 ---- */
function startEditField(cardId, field) {
  if (!enabled.value) return
  const card = profile.value.cards.find(c => c.id === cardId)
  if (!card) return
  editingField.value = { cardId, field }
  const val = card.fields[field]
  editingValue.value = Array.isArray(val) ? val.join('、') : (val || '')
}

function saveField() {
  if (!editingField.value) return
  const { cardId, field } = editingField.value
  const card = profile.value.cards.find(c => c.id === cardId)
  if (!card) return

  // 判断是否为数组字段
  const isArrayField = Array.isArray(card.fields[field]) ||
    field === 'hobbies' || field === 'dietary'

  if (isArrayField) {
    // 逗号分隔 → 数组
    const items = editingValue.value.split(/[、,，\n]/).map(s => s.trim()).filter(Boolean)
    card.fields[field] = items
  } else {
    card.fields[field] = editingValue.value.trim()
  }
  saveProfile(profile.value)
  editingField.value = null
  editingValue.value = ''
}

function cancelEditField() {
  editingField.value = null
  editingValue.value = ''
}

function clearField(cardId, field) {
  const card = profile.value.cards.find(c => c.id === cardId)
  if (!card) return
  if (Array.isArray(card.fields[field])) {
    card.fields[field] = []
  } else {
    card.fields[field] = ''
  }
  saveProfile(profile.value)
}

/* ---- 数组字段 chip 操作 ---- */
function startChipInput(cardId, field) {
  if (!enabled.value) return
  chipInputField.value = { cardId, field }
  chipInputValue.value = ''
}

function addChip() {
  if (!chipInputField.value || !chipInputValue.value.trim()) return
  const { cardId, field } = chipInputField.value
  const val = chipInputValue.value.trim()
  addArrayItem(cardId, field, val)
  // 刷新本地数据
  profile.value = getProfile()
  chipInputValue.value = ''
}

function removeChip(cardId, field, value) {
  removeArrayItem(cardId, field, value)
  profile.value = getProfile()
}

function finishChipInput() {
  chipInputField.value = null
  chipInputValue.value = ''
}

/* ---- 卡片标题编辑 ---- */
function startEditTitle(cardId) {
  const card = profile.value.cards.find(c => c.id === cardId)
  if (!card) return
  editingCardTitle.value = { cardId }
  editingTitleValue.value = card.title
}

function saveTitle() {
  if (!editingCardTitle.value) return
  const { cardId } = editingCardTitle.value
  updateCardTitle(cardId, editingTitleValue.value.trim())
  profile.value = getProfile()
  editingCardTitle.value = null
  editingTitleValue.value = ''
}

function cancelEditTitle() {
  editingCardTitle.value = null
  editingTitleValue.value = ''
}

/* ---- 卡片增删 ---- */
function handleCreateCard() {
  const title = newCardTitle.value.trim()
  if (!title) return
  createCard(title, 'sparkle', {})
  profile.value = getProfile()
  newCardTitle.value = ''
  showAddCard.value = false
}

function handleDeleteCard(cardId) {
  uni.showModal({
    title: '删除分组',
    content: '确定删除该分组及其所有字段吗？',
    success: (res) => {
      if (res.confirm) {
        deleteCard(cardId)
        profile.value = getProfile()
      }
    }
  })
}

/* ---- 添加自定义字段 ---- */
function addCustomField(cardId) {
  if (!enabled.value) return
  uni.showModal({
    title: '添加字段',
    placeholderText: '输入字段名称，如：MBTI、血型',
    editable: true,
    success: (res) => {
      if (res.confirm && res.content?.trim()) {
        const fieldName = res.content.trim()
        const card = profile.value.cards.find(c => c.id === cardId)
        if (card && card.fields[fieldName] === undefined) {
          card.fields[fieldName] = ''
          saveProfile(profile.value)
        }
      }
    }
  })
}

/* ---- 清空 ---- */
function handleClearAll() {
  uni.showModal({
    title: '清空所有信息',
    content: '此操作将清空所有个人信息且不可恢复，确定继续吗？',
    confirmColor: '#000000',
    success: (res) => {
      if (res.confirm) {
        clearProfile()
        profile.value = getProfile()
        enabled.value = false
      }
    }
  })
}

/* ---- 工具函数 ---- */
function isArrayField(card, field) {
  return Array.isArray(card.fields[field])
}

function getFieldLabel(key) {
  const labels = {
    nickname: '昵称', gender: '性别', birthday: '生日',
    occupation: '职业', location: '所在地', bio: '自我介绍',
    budget: '月预算', sleepTime: '作息',
    hobbies: '兴趣爱好', dietary: '饮食偏好'
  }
  return labels[key] || key
}

function isFixedCard(card) {
  return card.id === 'basic' || card.id === 'lifestyle'
}

function goRelations() {
  uni.navigateTo({ url: '/pages/settings/sub/relation-graph' })
}
</script>

<template>
  <view class="profile-page">
    <!-- 顶部开关 -->
    <view class="header-card" :class="{ 'header-enabled': enabled }">
      <view class="header-left">
        <view class="header-title">个人信息</view>
        <view class="header-desc">
          {{ enabled ? `已填写 ${filledCount} 项，${totalCards} 个分组` : '开启后，AI 将感知你的个人信息' }}
        </view>
      </view>
      <switch :checked="enabled" @change="toggleEnabled" color="#000000" />
    </view>

    <!-- 未开启提示 -->
    <view v-if="!enabled" class="disabled-hint">
      <SijiIcon name="lock" :size="24" />
      <text>开启个人信息后即可编辑</text>
    </view>

    <!-- 画像卡片列表 -->
    <view v-for="card in profile.cards" :key="card.id" class="profile-card" :class="'card-' + card.id">
      <!-- 卡片头部 -->
      <view class="card-header">
        <view class="card-title-wrap" @tap="!isFixedCard(card) && enabled && startEditTitle(card.id)">
          <SijiIcon :name="card.icon || 'sparkle'" :size="18" />
          <text v-if="!editingCardTitle || editingCardTitle.cardId !== card.id" class="card-title-text">{{ card.title }}</text>
          <input
            v-else
            v-model="editingTitleValue"
            class="title-input"
            :focus="true"
            @confirm="saveTitle"
            @blur="saveTitle"
          />
        </view>
        <view v-if="!isFixedCard(card) && enabled" class="card-delete" @tap="handleDeleteCard(card.id)">
          <SijiIcon name="close" :size="16" />
        </view>
      </view>

      <!-- 字段列表 -->
      <view class="card-body">
        <view v-for="(value, key) in card.fields" :key="key" class="field-row">
          <!-- 字段标签 -->
          <text class="field-label">{{ getFieldLabel(key) }}</text>

          <!-- 数组字段：chip 展示 -->
          <view v-if="isArrayField(card, key)" class="field-chips">
            <view v-for="chip in value" :key="chip" class="chip">
              <text class="chip-text">{{ chip }}</text>
              <view v-if="enabled" class="chip-remove" @tap="removeChip(card.id, key, chip)">
                <SijiIcon name="close" :size="12" />
              </view>
            </view>
            <view v-if="enabled && (!chipInputField || chipInputField.cardId !== card.id || chipInputField.field !== key)"
                  class="chip-add" @tap="startChipInput(card.id, key)">
              <text class="chip-add-text">+ 添加</text>
            </view>
            <view v-if="chipInputField && chipInputField.cardId === card.id && chipInputField.field === key"
                  class="chip-input-wrap">
              <input
                v-model="chipInputValue"
                class="chip-input"
                placeholder="输入后回车"
                :focus="true"
                @confirm="addChip"
                @blur="finishChipInput"
              />
            </view>
          </view>

          <!-- 标量字段：内联编辑 -->
          <view v-else class="field-value-wrap">
            <view
              v-if="!editingField || editingField.cardId !== card.id || editingField.field !== key"
              class="field-display"
              @tap="enabled && startEditField(card.id, key)"
            >
              <text :class="{ 'field-empty': !value }">{{ value || '点击填写' }}</text>
              <view v-if="enabled && value" class="field-clear" @tap.stop="clearField(card.id, key)">
                <SijiIcon name="close" :size="12" />
              </view>
            </view>
            <input
              v-else
              v-model="editingValue"
              class="field-input"
              :focus="true"
              :placeholder="getFieldLabel(key)"
              @confirm="saveField"
              @blur="saveField"
            />
          </view>
        </view>

        <!-- 添加自定义字段按钮 -->
        <view v-if="enabled" class="add-field-btn" @tap="addCustomField(card.id)">
          <SijiIcon name="add" :size="14" />
          <text>添加字段</text>
        </view>
      </view>
    </view>

    <!-- 添加新分组 -->
    <view v-if="enabled" class="add-card-section">
      <view v-if="!showAddCard" class="add-card-btn" @tap="showAddCard = true">
        <SijiIcon name="add" :size="16" />
        <text>新建分组</text>
      </view>
      <view v-else class="add-card-form">
        <input
          v-model="newCardTitle"
          class="add-card-input"
          placeholder="分组名称，如：性格特征"
          :focus="true"
          @confirm="handleCreateCard"
        />
        <view class="add-card-actions">
          <view class="btn-cancel" @tap="showAddCard = false; newCardTitle = ''">取消</view>
          <view class="btn-confirm" @tap="handleCreateCard">创建</view>
        </view>
      </view>
    </view>

    <!-- 关系图谱入口（仅开启时显示，紧跟开关下方） -->
    <view v-if="enabled" class="relations-entry" @tap="goRelations">
      <view class="re-left">
        <view class="re-icon">
          <SijiIcon name="heart" :size="20" />
        </view>
        <view class="re-info">
          <text class="re-title">关系图谱</text>
          <text class="re-desc">{{ relationsStats.total }} 人 · {{ relationsStats.interactionCount }} 次互动</text>
        </view>
      </view>
      <text class="re-arrow">›</text>
    </view>

    <!-- 底部操作 -->
    <view v-if="enabled && filledCount > 0" class="bottom-actions">
      <view class="btn-danger" @tap="handleClearAll">
        <SijiIcon name="trash" :size="14" />
        <text>清空所有信息</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import './profile.scss';
</style>
