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
import { getAdoptableMemories, suggestProfileAdoption, adoptMemoryToProfile } from '@/utils/memory.js'
import SijiIcon from '@/components/common/SijiIcon.vue'
import { logger } from '@/utils/logger.js'
import { useTheme } from '@/composables/useTheme.js'

const { isDark } = useTheme()

/* ---- 响应式数据 ---- */
const profile = ref(getProfile())
const enabled = ref(profile.value.enabled)
const editingField = ref(null) // { cardId, field } 正在编辑的字段
const editingValue = ref('')
const editingCardTitle = ref(null) // { cardId } 正在编辑标题
const editingTitleValue = ref('')
const showAddCard = ref(false)
const newCardTitle = ref('')
const collapsedCards = ref({}) // cardId → true=折叠；默认折叠，用户画像默认展开
const chipInputField = ref(null) // { cardId, field } 正在输入 chip 的数组字段
const chipInputValue = ref('')
const relationsStats = ref({ total: 0, interactionCount: 0, avgScore: 0 })
const aiPrefs = ref([])
const showAiPrefs = ref(false) // AI偏好区默认折叠

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

const totalFields = computed(() => {
  let count = 0
  for (const card of profile.value.cards) {
    count += Object.keys(card.fields).length
  }
  return count
})

const fillPercent = computed(() => {
  if (!totalFields.value) return 0
  return Math.round((filledCount.value / totalFields.value) * 100)
})

const totalCards = computed(() => profile.value.cards.length)

/* ---- 三层分组：身份 / 方向 / 行动（参考 Replika、Serenity 人生领域划分） ---- */
const PROFILE_GROUPS = [
  { label: '我是谁', fields: ['当前阶段', 'MBTI', '性格优势', '主要短板'] },
  { label: '我要去哪', fields: ['职业方向', '人生关键词', '金钱目标', '家庭目标', '感情目标'] },
  { label: '我怎么做', fields: ['行动原则', '产品意识', '创业潜力'] }
]

/** 把一张卡的字段按三层分组；无命中字段返回 null（平铺） */
function groupCardFields(card) {
  const grouped = []
  const ungrouped = []
  const assigned = new Set()
  for (const g of PROFILE_GROUPS) {
    const items = []
    for (const f of g.fields) {
      if (card.fields[f] !== undefined) {
        items.push([f, card.fields[f]])
        assigned.add(f)
      }
    }
    if (items.length) grouped.push({ label: g.label, items })
  }
  for (const [k, v] of Object.entries(card.fields)) {
    if (!assigned.has(k)) ungrouped.push([k, v])
  }
  return { grouped, ungrouped, hasGroups: grouped.length > 0 }
}

/** 预计算每张卡的分组结果（避免模板重复调用） */
const cardGroups = computed(() => {
  const map = {}
  for (const card of profile.value.cards) {
    map[card.id] = groupCardFields(card)
  }
  return map
})

/* ---- 人生六维概览（职业/财务/家庭/感情/成长/健康） ---- */
const LIFE_DIMENSIONS = computed(() => {
  const custom = profile.value.cards.find(c => !isFixedCard(c))
  const life = profile.value.cards.find(c => c.id === 'lifestyle')
  const get = (card, key) => {
    if (!card) return ''
    const v = card.fields[key]
    return Array.isArray(v) ? v.length > 0 : (v && v !== '')
  }
  return [
    { label: '职业', filled: get(custom, '职业方向') },
    { label: '财务', filled: get(custom, '金钱目标') },
    { label: '家庭', filled: get(custom, '家庭目标') },
    { label: '感情', filled: get(custom, '感情目标') },
    { label: '成长', filled: get(custom, '当前阶段') || get(custom, '性格优势') },
    { label: '健康', filled: get(life, '作息') || get(life, '饮食偏好') }
  ]
})

/* ---- 生命周期 ---- */
onMounted(() => {
  // 确保数据最新
  profile.value = getProfile()
  enabled.value = profile.value.enabled
  // 默认展开有内容的画像卡（我的画像），空的固定卡保持折叠
  profile.value.cards.forEach(card => {
    const filled = Object.values(card.fields).some(v => v != null && v !== '' && !(Array.isArray(v) && v.length === 0))
    if (filled && !isFixedCard(card)) {
      collapsedCards.value[card.id] = false
    }
  })
  if (enabled.value) relationsStats.value = getRelationsStats()
  refreshAiPrefs()
})

onShow(() => {
  profile.value = getProfile()
  enabled.value = profile.value.enabled
  if (enabled.value) relationsStats.value = getRelationsStats()
  refreshAiPrefs()
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

/* ---- 卡片折叠（默认折叠，点击头部展开/收起） ---- */
function isCardCollapsed(cardId) {
  return collapsedCards.value[cardId] !== false
}

function toggleCard(cardId) {
  collapsedCards.value[cardId] = !isCardCollapsed(cardId)
}

/** 标题点击分流：自定义卡片=编辑标题（可编辑时），固定卡片=展开/收起 */
function handleTitleTap(card) {
  if (!isFixedCard(card) && enabled.value) {
    startEditTitle(card.id)
  } else {
    toggleCard(card.id)
  }
}

/* ---- 卡片增删 ---- */
function handleCreateCard() {
  const title = newCardTitle.value.trim()
  if (!title) return
  const card = createCard(title, 'sparkle', {})
  profile.value = getProfile()
  // 新建分组自动展开，方便立即填写字段
  collapsedCards.value[card.id] = false
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
        delete collapsedCards.value[cardId]
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

/* ---- AI 偏好采纳（记忆 → 画像联动） ---- */
function refreshAiPrefs() {
  aiPrefs.value = getAdoptableMemories()
}

function handleAdopt(item) {
  const sug = suggestProfileAdoption(item.content)
  if (sug) {
    uni.showModal({
      title: '采纳到画像',
      content: `写入「${sug.label}」：${sug.value}`,
      confirmText: '采纳',
      confirmColor: '#000000',
      success: (res) => {
        if (res.confirm) doAdopt(item, sug.cardId, sug.field, sug.value)
      }
    })
    return
  }
  uni.showModal({
    title: '采纳到画像',
    editable: true,
    placeholderText: '输入字段名，如：hobbies、MBTI',
    confirmText: '采纳',
    confirmColor: '#000000',
    success: (res) => {
      if (res.confirm && res.content && res.content.trim()) {
        doAdopt(item, 'lifestyle', res.content.trim(), item.content)
      }
    }
  })
}

function doAdopt(item, cardId, field, value) {
  const r = adoptMemoryToProfile(item.id, cardId, field, value)
  if (r.success) {
    uni.showToast({ title: '已采纳到画像', icon: 'none' })
    profile.value = getProfile()
    refreshAiPrefs()
  } else {
    uni.showToast({ title: r.message, icon: 'none' })
  }
}

function goRelations() {
  uni.navigateTo({ url: '/pages/settings/sub/relation-graph' })
}

/* ---- 导出画像 JSON（解决 localStorage 换机丢失） ---- */
function handleExport() {
  const data = JSON.stringify({ exportedAt: new Date().toISOString(), profile: profile.value }, null, 2)
  // #ifdef H5
  try {
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'siji-profile.json'
    a.click()
    URL.revokeObjectURL(url)
    uni.showToast({ title: '已导出 JSON', icon: 'none' })
  } catch (e) {
    uni.setClipboardData({ data, success: () => uni.showToast({ title: '已复制画像 JSON', icon: 'none' }) })
  }
  // #endif
  // #ifndef H5
  uni.setClipboardData({ data, success: () => uni.showToast({ title: '已复制画像 JSON，可粘贴保存', icon: 'none' }) })
  // #endif
}
</script>

<template>
  <view class="profile-page">
    <!-- 顶部开关 -->
    <view class="header-card" :class="{ 'header-enabled': enabled }">
      <view class="header-left">
        <view class="header-title-row">
          <view class="header-title">个人信息</view>
          <view v-if="enabled" class="rel-link" @tap.stop="goRelations">
            <SijiIcon name="heart" :size="13" />
            <text>关系图谱 · {{ relationsStats.total }}人</text>
          </view>
        </view>
        <view class="header-desc">
          {{ enabled ? `已完善 ${fillPercent}%（${filledCount}/${totalFields} 项）` : '开启后即可编辑，AI 将感知你的个人信息' }}
        </view>
      </view>
      <switch :checked="enabled" @change="toggleEnabled" :color="isDark ? '#FFFFFF' : '#000000'" />
    </view>

    <!-- 完整度进度条 -->
    <view v-if="enabled" class="progress-wrap">
      <view class="progress-bar">
        <view class="progress-fill" :style="{ width: fillPercent + '%' }" />
      </view>
    </view>

    <!-- 人生六维概览 -->
    <view v-if="enabled" class="life-wheel">
      <view class="lw-title">人生六维</view>
      <view class="lw-dims">
        <view v-for="d in LIFE_DIMENSIONS" :key="d.label" class="lw-dim" :class="{ 'dim-on': d.filled }">
          <view class="dot" />
          <text class="lw-label">{{ d.label }}</text>
        </view>
      </view>
    </view>

    <!-- 画像卡片列表 -->
    <view v-for="card in profile.cards" :key="card.id" class="profile-card" :class="'card-' + card.id">
      <!-- 卡片头部 -->
      <view class="card-header" :class="{ collapsed: isCardCollapsed(card.id) }" @tap="toggleCard(card.id)">
        <view class="card-title-wrap" @tap.stop="handleTitleTap(card)">
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
        <view v-if="!isFixedCard(card) && enabled" class="card-edit-btn" @tap.stop="startEditTitle(card.id)">
          <SijiIcon name="edit" :size="14" />
        </view>
        <view v-if="!isFixedCard(card) && enabled" class="card-delete" @tap.stop="handleDeleteCard(card.id)">
          <SijiIcon name="close" :size="16" />
        </view>
        <view class="card-collapse">
          <SijiIcon :name="isCardCollapsed(card.id) ? 'chevron-down' : 'chevron-up'" :size="14" />
        </view>
      </view>

      <!-- 字段列表（折叠时隐藏，加过渡动画） -->
      <view class="card-body" :class="{ 'body-collapsed': isCardCollapsed(card.id) }">
        <view v-if="!isCardCollapsed(card.id)" class="card-body-inner">
        <!-- 三层分组渲染（我的画像卡：身份/方向/行动） -->
        <template v-if="cardGroups[card.id].hasGroups">
          <view v-for="g in cardGroups[card.id].grouped" :key="g.label" class="field-group">
            <view class="group-label">{{ g.label }}</view>
            <view v-for="[key, value] in g.items" :key="key" class="field-row">
              <text class="field-label">{{ getFieldLabel(key) }}</text>
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
              </view>
              <view v-else class="field-value-wrap">
                <view
                  v-if="!editingField || editingField.cardId !== card.id || editingField.field !== key"
                  class="field-display"
                  @tap="enabled && !value && startEditField(card.id, key)"
                >
                  <text :class="{ 'field-empty': !value }">{{ value || '点击填写' }}</text>
                  <view v-if="enabled && value" class="field-actions">
                    <view class="field-edit" @tap.stop="startEditField(card.id, key)">
                    <SijiIcon name="edit" :size="12" />
                    </view>
                    <view class="field-clear" @tap.stop="clearField(card.id, key)">
                    <SijiIcon name="close" :size="12" />
                    </view>
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
          </view>
          <view v-for="[key, value] in cardGroups[card.id].ungrouped" :key="key" class="field-row">
            <text class="field-label">{{ getFieldLabel(key) }}</text>
            <view v-if="isArrayField(card, key)" class="field-chips">
              <view v-for="chip in value" :key="chip" class="chip">
                <text class="chip-text">{{ chip }}</text>
                <view v-if="enabled" class="chip-remove" @tap="removeChip(card.id, key, chip)">
                  <SijiIcon name="close" :size="12" />
                </view>
              </view>
            </view>
            <view v-else class="field-value-wrap">
              <view
                v-if="!editingField || editingField.cardId !== card.id || editingField.field !== key"
                class="field-display"
                @tap="enabled && !value && startEditField(card.id, key)"
              >
                <text :class="{ 'field-empty': !value }">{{ value || '点击填写' }}</text>
                <view v-if="enabled && value" class="field-actions">
                  <view class="field-edit" @tap.stop="startEditField(card.id, key)">
                  <SijiIcon name="edit" :size="12" />
                  </view>
                  <view class="field-clear" @tap.stop="clearField(card.id, key)">
                  <SijiIcon name="close" :size="12" />
                  </view>
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
        </template>
        <!-- 平铺渲染（固定卡 / 其他自定义卡） -->
        <template v-else>
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
              @tap="enabled && !value && startEditField(card.id, key)"
            >
              <text :class="{ 'field-empty': !value }">{{ value || '点击填写' }}</text>
              <view v-if="enabled && value" class="field-actions">
                <view class="field-edit" @tap.stop="startEditField(card.id, key)">
                <SijiIcon name="edit" :size="12" />
                </view>
                <view class="field-clear" @tap.stop="clearField(card.id, key)">
                <SijiIcon name="close" :size="12" />
                </view>
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
        </template>

        <!-- 添加自定义字段按钮 -->
        <view v-if="enabled" class="add-field-btn" @tap="addCustomField(card.id)">
          <SijiIcon name="add" :size="14" />
          <text>添加字段</text>
        </view>
        </view><!-- /card-body-inner -->
      </view>
    </view>

    <!-- AI 学到的偏好（记忆 → 画像联动，可折叠） -->
    <view v-if="enabled && aiPrefs.length > 0" class="ai-prefs-section">
      <view class="ai-prefs-header" @tap="showAiPrefs = !showAiPrefs">
        <text class="ai-prefs-title">AI 学到的偏好</text>
        <view class="ai-prefs-right">
          <text class="ai-prefs-count">{{ aiPrefs.length }} 条待采纳</text>
          <SijiIcon :name="showAiPrefs ? 'chevron-up' : 'chevron-down'" :size="14" />
        </view>
      </view>
      <view v-if="showAiPrefs" class="ai-prefs-body">
        <view v-for="item in aiPrefs" :key="item.id" class="ai-pref-item">
          <text class="ai-pref-content">{{ item.content }}</text>
          <view class="ai-pref-adopt" @tap="handleAdopt(item)">
            <text class="ai-pref-adopt-text">采纳</text>
          </view>
        </view>
        <view class="ai-prefs-hint">采纳后写入画像分组，AI 不再重复记忆</view>
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

    <!-- 底部操作 -->
    <view v-if="enabled && filledCount > 0" class="bottom-actions">
      <view class="btn-secondary" @tap="handleExport">
        <SijiIcon name="export" :size="14" />
        <text>导出画像 JSON</text>
      </view>
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
