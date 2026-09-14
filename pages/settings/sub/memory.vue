<script setup>
/**
 * 记忆管理页 — 查看/编辑/删除长期记忆，开关控制
 */

import SijiIcon from '@/components/common/SijiIcon.vue'
import { getProfile } from '@/utils/profile.js'
import { ref, computed, onMounted } from 'vue'
import {
  getAllMemories, addMemory, updateMemory, deleteMemory, clearAllMemories,
  getMemoryStats, isMemoryEnabled, setMemoryEnabled,
  getUnadoptedMemories, suggestProfileAdoption, integrateMemoriesToProfile,
  findDuplicateGroups, findStaleAdoptedMemories, suggestMemoryCategory,
  applyGovernance, restoreHiddenMemory
} from '@/utils/memory.js'

const enabled = ref(true)
const memories = ref([])
const stats = ref({ total: 0, categories: {} })
const filter = ref('all') // all|fact|preference|event|summary|other
const viewMode = ref('all') // all|unadopted|adopted（3.2 M2：隐藏项只在「已整合」分段出现）
const showFilter = ref(false)
const showAddModal = ref(false)
const showGovernance = ref(false)
const governanceItems = ref([]) // [{ key, kind, checked, title, desc, ... }]
const editingId = ref('')
const inputContent = ref('')
const inputCategory = ref('fact')
const integrateMode = ref(false) // 选择整合模式
const selectedIds = ref([])
const showIntegratePreview = ref(false)
const integratePreview = ref([]) // [{ id, content, field, value }]

const categoryLabels = {
  fact: '已知事实',
  preference: '用户偏好',
  event: '重要事件',
  summary: '对话摘要',
  other: '其他'
}

const categoryIcons = {
  fact: 'pin',
  preference: 'heart',
  event: 'target',
  summary: 'diary',
  other: 'tip'
}

const filteredMemories = computed(() => {
  let list = memories.value
  if (viewMode.value === 'adopted') {
    list = list.filter(m => m.adoptedToProfile || m.hidden)
  } else if (viewMode.value === 'unadopted') {
    list = list.filter(m => !m.adoptedToProfile)
  } else {
    // 默认视图：隐藏项不出现（D2），可在「已整合」分段查看
    list = list.filter(m => !m.hidden)
  }
  if (filter.value === 'all') return list
  return list.filter(m => m.category === filter.value)
})

onMounted(() => {
  enabled.value = isMemoryEnabled()
  refresh()
})

function refresh() {
  memories.value = getAllMemories()
  stats.value = getMemoryStats()
}

function toggleEnabled(e) {
  enabled.value = e.detail.value
  setMemoryEnabled(enabled.value)
  uni.showToast({
    title: enabled.value ? '记忆已开启' : '记忆已关闭',
    icon: 'none'
  })
}

function openAddModal() {
  editingId.value = ''
  inputContent.value = ''
  inputCategory.value = 'fact'
  showAddModal.value = true
}

function openEditModal(item) {
  editingId.value = item.id
  inputContent.value = item.content
  inputCategory.value = item.category
  showAddModal.value = true
}

function handleSave() {
  const text = inputContent.value.trim()
  if (!text) {
    uni.showToast({ title: '内容不能为空', icon: 'none' })
    return
  }
  if (editingId.value) {
    updateMemory(editingId.value, text)
    uni.showToast({ title: '已更新', icon: 'success' })
  } else {
    addMemory(text, inputCategory.value)
    uni.showToast({ title: '已添加', icon: 'success' })
  }
  showAddModal.value = false
  refresh()
}

function handleDelete(id) {
  uni.showModal({
    title: '删除记忆',
    content: '确定删除这条记忆吗？',
    success(res) {
      if (res.confirm) {
        deleteMemory(id)
        uni.showToast({ title: '已删除', icon: 'none' })
        refresh()
      }
    }
  })
}

function handleClearAll() {
  if (memories.value.length === 0) return
  uni.showModal({
    title: '清空所有记忆',
    content: `将删除全部 ${memories.value.length} 条记忆，此操作不可撤销。`,
    confirmColor: '#000000',
    success(res) {
      if (res.confirm) {
        clearAllMemories()
        uni.showToast({ title: '已清空', icon: 'none' })
        refresh()
      }
    }
  })
}

/* ---- 记忆治理（3.2 M2：重复合并 / 超期隐藏 / other 归类建议） ---- */
function openGovernance() {
  if (!enabled.value) return
  const items = []
  for (const g of findDuplicateGroups()) {
    const keep = g.members[0]
    items.push({
      key: `merge_${g.keepId}`,
      kind: 'merge',
      checked: true,
      title: keep.content,
      desc: `与 ${g.members.length - 1} 条重复，合并后保留较新一条`,
      merge: g
    })
  }
  for (const m of findStaleAdoptedMemories()) {
    items.push({
      key: `hide_${m.id}`,
      kind: 'hide',
      checked: true,
      title: m.content,
      desc: '已整合超过 90 天，将隐藏（可在「已整合」分段查看）',
      id: m.id
    })
  }
  for (const m of getAllMemories()) {
    if (m.category !== 'other') continue
    const sug = suggestMemoryCategory(m.content)
    if (!sug || sug === 'other') continue
    items.push({
      key: `recat_${m.id}`,
      kind: 'recat',
      checked: true,
      title: m.content,
      desc: `归类建议：${categoryLabels[sug]}（当前：其他）`,
      id: m.id,
      category: sug
    })
  }
  if (items.length === 0) {
    uni.showToast({ title: '暂无可治理的记忆', icon: 'none' })
    return
  }
  governanceItems.value = items
  showGovernance.value = true
}

function toggleGovernanceItem(item) {
  item.checked = !item.checked
}

function confirmGovernance() {
  const merge = []
  const hide = []
  const recategorize = []
  for (const it of governanceItems.value) {
    if (!it.checked) continue
    if (it.kind === 'merge' && it.merge) {
      for (const rid of it.merge.removeIds) {
        merge.push({ keepId: it.merge.keepId, removeId: rid })
      }
    } else if (it.kind === 'hide' && it.id) {
      hide.push(it.id)
    } else if (it.kind === 'recat' && it.id && it.category) {
      recategorize.push({ id: it.id, category: it.category })
    }
  }
  if (merge.length === 0 && hide.length === 0 && recategorize.length === 0) {
    showGovernance.value = false
    governanceItems.value = []
    return
  }
  const r = applyGovernance({ merge, hide, recategorize })
  showGovernance.value = false
  governanceItems.value = []
  refresh()
  uni.showToast({
    title: `已治理：合并 ${r.merged}、隐藏 ${r.hidden}、归类 ${r.recategorized}`,
    icon: 'none'
  })
}

function handleRestoreHidden(item) {
  if (restoreHiddenMemory(item.id)) {
    uni.showToast({ title: '已恢复显示', icon: 'none' })
    refresh()
  }
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${m}-${day} ${h}:${min}`
}

/* ---- 整合到画像 ---- */
function openIntegrateMenu() {
  if (!enabled.value) return
  const unadopted = getUnadoptedMemories('all')
  if (unadopted.length === 0) {
    uni.showToast({ title: '没有可整合的记忆', icon: 'none' })
    return
  }
  uni.showActionSheet({
    itemList: ['全部整合', '选择整合'],
    success: (res) => {
      if (res.tapIndex === 0) startIntegrateAll()
      else enterSelectMode()
    }
  })
}

function startIntegrateAll() {
  buildIntegratePreview(getUnadoptedMemories('all'))
}

function enterSelectMode() {
  integrateMode.value = true
  selectedIds.value = []
}

function cancelSelectMode() {
  integrateMode.value = false
  selectedIds.value = []
}

function isSelected(id) {
  return selectedIds.value.includes(id)
}

function toggleSelect(item) {
  const idx = selectedIds.value.indexOf(item.id)
  if (idx >= 0) selectedIds.value.splice(idx, 1)
  else selectedIds.value.push(item.id)
}

function startIntegrateSelected() {
  const items = getUnadoptedMemories('all').filter(m => selectedIds.value.includes(m.id))
  if (items.length === 0) {
    uni.showToast({ title: '请先勾选记忆', icon: 'none' })
    return
  }
  buildIntegratePreview(items)
}

function buildIntegratePreview(items) {
  const profile = getProfile()
  integratePreview.value = items.map(m => {
    const sug = suggestProfileAdoption(m.content)
    const cardTitle = sug ? sug.cardTitle : '其他信息'
    const field = sug ? sug.field : '备注'
    const value = sug ? sug.value : m.content
    // 已有分组同字段的旧值（提示将更新）
    const targetCard = profile.cards.find(c => c.title === cardTitle)
    const oldVal = targetCard && targetCard.fields[field] != null ? targetCard.fields[field] : null
    return {
      id: m.id,
      content: m.content,
      cardTitle,
      field,
      value,
      existing: oldVal == null ? '' : (Array.isArray(oldVal) ? oldVal.join('、') : String(oldVal))
    }
  })
  integrateMode.value = false
  selectedIds.value = []
  showIntegratePreview.value = true
}

function confirmIntegrate() {
  const r = integrateMemoriesToProfile(integratePreview.value)
  showIntegratePreview.value = false
  integratePreview.value = []
  refresh()
  uni.showToast({
    title: r.skipped > 0 ? `已整合 ${r.success} 条，${r.skipped} 条未填写跳过` : `已整合 ${r.success} 条到我的信息`,
    icon: 'none'
  })
}

function cancelIntegratePreview() {
  showIntegratePreview.value = false
  integratePreview.value = []
}
</script>

<template>
  <view class="memory-page">
    <!-- 顶部开关 -->
    <view class="switch-card">
      <view class="switch-info">
        <text class="switch-title">长期记忆</text>
        <text class="switch-desc">AI 自动记住你的偏好、重要事件和事实</text>
      </view>
      <switch :checked="enabled" @change="toggleEnabled" color="#000000" />
    </view>

    <!-- 统计精简为一行 -->
    <view class="stats-row" v-if="enabled">
      <text class="stats-summary">{{ stats.total }} 条记忆</text>
      <text class="stats-toggle" @tap="showFilter = !showFilter">{{ showFilter ? '收起筛选' : '筛选' }}</text>
      <text class="stats-toggle" @tap="openGovernance">治理</text>
      <text class="stats-structured" v-if="stats.structured && (stats.structured.entities + stats.structured.relations + stats.structured.events) > 0">结构化 {{ stats.structured.entities }}实体/{{ stats.structured.relations }}关系/{{ stats.structured.events }}事件</text>
    </view>

    <template v-if="enabled">
      <!-- 视图分段（3.2 M2）：隐藏项只在「已整合」出现 -->
      <view class="scope-bar">
        <view class="filter-chip" :class="{ active: viewMode === 'all' }" @tap="viewMode = 'all'">
          <text>全部</text>
        </view>
        <view class="filter-chip" :class="{ active: viewMode === 'unadopted' }" @tap="viewMode = 'unadopted'">
          <text>未整合</text>
        </view>
        <view class="filter-chip" :class="{ active: viewMode === 'adopted' }" @tap="viewMode = 'adopted'">
          <text>已整合</text>
        </view>
      </view>

      <!-- 筛选标签（可折叠） -->
      <scroll-view v-if="showFilter" class="filter-bar" scroll-x>
        <view class="filter-chip" :class="{ active: filter === 'all' }" @tap="filter = 'all'">
          <text>全部</text>
        </view>
        <view
          v-for="(label, cat) in categoryLabels"
          :key="cat"
          class="filter-chip"
          :class="{ active: filter === cat }"
          @tap="filter = cat"
        >
          <text>{{ label }}</text>
        </view>
      </scroll-view>

      <!-- 记忆列表 -->
      <scroll-view class="memory-list" scroll-y>
        <view
          v-for="item in filteredMemories"
          :key="item.id"
          class="memory-item"
          :class="{ 'selecting': integrateMode }"
        >
          <view v-if="integrateMode" class="select-badge" :class="{ selected: isSelected(item.id) }" @tap="toggleSelect(item)">
            <SijiIcon v-if="isSelected(item.id)" name="check" size="sm" color="#FFFFFF" />
          </view>
          <view class="memory-item-body">
            <view class="memory-item-header">
              <SijiIcon :name="categoryIcons[item.category] || 'tip'" size="sm" class="memory-cat-icon" />
              <text class="memory-cat-label">{{ categoryLabels[item.category] || item.category }}</text>
              <text v-if="item.adoptedToProfile" class="integrated-tag">已整合</text>
              <text v-if="item.hidden" class="hidden-tag">已隐藏</text>
              <text class="memory-time">{{ formatTime(item.updatedAt || item.createdAt) }}</text>
            </view>
            <text class="memory-content" selectable="true" user-select="true">{{ item.content }}</text>
            <view class="memory-actions">
              <text v-if="item.hidden" class="action-btn edit" @tap="handleRestoreHidden(item)">恢复显示</text>
              <text class="action-btn edit" @tap="openEditModal(item)">编辑</text>
              <text class="action-btn del" @tap="handleDelete(item.id)">删除</text>
            </view>
          </view>
        </view>

        <view v-if="filteredMemories.length === 0" class="empty-state">
          <SijiIcon name="brain" size="xxl" class="empty-icon" />
          <text class="empty-text">还没有记忆</text>
          <text class="empty-hint">和 AI 对话时会自动记住重要信息</text>
        </view>
      </scroll-view>

      <!-- 底部操作 -->
      <view class="bottom-actions" v-if="integrateMode">
        <view class="bottom-btn add" @tap="startIntegrateSelected">
          <text>整合所选 ({{ selectedIds.length }})</text>
        </view>
        <view class="bottom-btn clear" @tap="cancelSelectMode">
          <text>取消</text>
        </view>
      </view>
      <view class="bottom-actions" v-else>
        <view class="bottom-btn integrate" @tap="openIntegrateMenu">
          <text>整合到画像</text>
        </view>
        <view class="bottom-btn add" @tap="openAddModal">
          <text>+ 手动添加</text>
        </view>
        <view class="bottom-btn clear" @tap="handleClearAll" v-if="memories.length > 0">
          <text>清空</text>
        </view>
      </view>
    </template>

    <!-- 关闭提示 -->
    <view v-else class="disabled-hint">
      <SijiIcon name="moon" size="md" class="disabled-icon" />
      <text class="disabled-text">记忆功能已关闭</text>
      <text class="disabled-sub">AI 将不会记住跨会话的信息</text>
    </view>

    <!-- 整合预览弹窗 -->
    <view v-if="showIntegratePreview" class="modal-overlay" @tap="cancelIntegratePreview">
      <view class="modal-content integrate-modal" @tap.stop>
        <text class="modal-title">整合预览 · 共 {{ integratePreview.length }} 条</text>
        <text class="modal-sub">分组已存在则直接填入或修改，不存在将自动新建</text>
        <scroll-view scroll-y class="integrate-list">
          <view v-for="item in integratePreview" :key="item.id" class="integrate-item">
            <text class="integrate-content">{{ item.content }}</text>
            <view class="integrate-row">
              <input v-model="item.cardTitle" class="integrate-input group" placeholder="分组" />
              <input v-model="item.field" class="integrate-input field" placeholder="字段名" />
            </view>
            <view class="integrate-row">
              <input v-model="item.value" class="integrate-input value" placeholder="内容" />
            </view>
            <text v-if="item.existing" class="integrate-existing">已存在：{{ item.existing }}，将更新</text>
          </view>
        </scroll-view>
        <view class="modal-actions">
          <view class="modal-btn cancel" @tap="cancelIntegratePreview">
            <text>取消</text>
          </view>
          <view class="modal-btn ok" @tap="confirmIntegrate">
            <text>确定整合</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 记忆治理弹窗（3.2 M2） -->
    <view v-if="showGovernance" class="modal-overlay" @tap="showGovernance = false">
      <view class="modal-content integrate-modal" @tap.stop>
        <text class="modal-title">记忆治理 · {{ governanceItems.length }} 项</text>
        <text class="modal-sub">勾选后确定执行：重复合并、超期隐藏、other 归类</text>
        <scroll-view scroll-y class="integrate-list">
          <view
            v-for="item in governanceItems"
            :key="item.key"
            class="integrate-item gov-item"
            @tap="toggleGovernanceItem(item)"
          >
            <view class="gov-check" :class="{ selected: item.checked }">
              <SijiIcon v-if="item.checked" name="check" size="sm" color="#FFFFFF" />
            </view>
            <view class="gov-body">
              <text class="integrate-content gov-title">{{ item.title }}</text>
              <text class="gov-desc">{{ item.desc }}</text>
            </view>
          </view>
        </scroll-view>
        <view class="modal-actions">
          <view class="modal-btn cancel" @tap="showGovernance = false">
            <text>取消</text>
          </view>
          <view class="modal-btn ok" @tap="confirmGovernance">
            <text>确定</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 添加/编辑弹窗 -->
    <view v-if="showAddModal" class="modal-overlay" @tap="showAddModal = false">
      <view class="modal-content" @tap.stop>
        <text class="modal-title">{{ editingId ? '编辑记忆' : '添加记忆' }}</text>

        <view class="modal-cat-row">
          <view
            v-for="(label, cat) in categoryLabels"
            :key="cat"
            class="modal-cat-chip"
            :class="{ active: inputCategory === cat }"
            @tap="inputCategory = cat"
          >
            <text>{{ categoryIcons[cat] }} {{ label }}</text>
          </view>
        </view>

        <textarea
          v-model="inputContent"
          class="modal-input"
          placeholder="输入记忆内容…"
          :maxlength="200"
          auto-height
        />

        <view class="modal-actions">
          <view class="modal-btn cancel" @tap="showAddModal = false">
            <text>取消</text>
          </view>
          <view class="modal-btn ok" @tap="handleSave">
            <text>保存</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import './memory.scss';
</style>
