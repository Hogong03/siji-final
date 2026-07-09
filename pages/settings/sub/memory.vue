<script setup>
/**
 * 记忆管理页 — 查看/编辑/删除长期记忆，开关控制
 */

import SijiIcon from '@/components/common/SijiIcon.vue'
import { ref, computed, onMounted } from 'vue'
import {
  getAllMemories, addMemory, updateMemory, deleteMemory, clearAllMemories,
  getMemoryStats, isMemoryEnabled, setMemoryEnabled
} from '@/utils/memory.js'

const enabled = ref(true)
const memories = ref([])
const stats = ref({ total: 0, categories: {} })
const filter = ref('all') // all|fact|preference|event|summary|other
const showAddModal = ref(false)
const editingId = ref('')
const inputContent = ref('')
const inputCategory = ref('fact')

const categoryLabels = {
  fact: '已知事实',
  preference: '用户偏好',
  event: '重要事件',
  summary: '对话摘要',
  other: '其他'
}

const categoryIcons = {
  fact: 'pin',
  preference: '❤️',
  event: 'target',
  summary: 'diary',
  other: 'tip'
}

const filteredMemories = computed(() => {
  if (filter.value === 'all') return memories.value
  return memories.value.filter(m => m.category === filter.value)
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

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${m}-${day} ${h}:${min}`
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

    <!-- 统计卡片 -->
    <view class="stats-row" v-if="enabled">
      <view class="stat-item">
        <text class="stat-num">{{ stats.total }}</text>
        <text class="stat-label">总记忆</text>
      </view>
      <view class="stat-item" v-for="(count, cat) in stats.categories" :key="cat">
        <text class="stat-num">{{ count }}</text>
        <text class="stat-label">{{ categoryLabels[cat] || cat }}</text>
      </view>
    </view>

    <template v-if="enabled">
      <!-- 筛选标签 -->
      <scroll-view class="filter-bar" scroll-x>
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
          <text>{{ categoryIcons[cat] }} {{ label }}</text>
        </view>
      </scroll-view>

      <!-- 记忆列表 -->
      <scroll-view class="memory-list" scroll-y>
        <view
          v-for="item in filteredMemories"
          :key="item.id"
          class="memory-item"
        >
          <view class="memory-item-header">
            <SijiIcon :name="categoryIcons[item.category] || 'tip'" size="sm" class="memory-cat-icon" />
            <text class="memory-cat-label">{{ categoryLabels[item.category] || item.category }}</text>
            <text class="memory-time">{{ formatTime(item.updatedAt || item.createdAt) }}</text>
          </view>
          <text class="memory-content" selectable="true" user-select="true">{{ item.content }}</text>
          <view class="memory-actions">
            <text class="action-btn edit" @tap="openEditModal(item)">编辑</text>
            <text class="action-btn del" @tap="handleDelete(item.id)">删除</text>
          </view>
        </view>

        <view v-if="filteredMemories.length === 0" class="empty-state">
          <SijiIcon name="brain" size="xxl" class="empty-icon" />
          <text class="empty-text">还没有记忆</text>
          <text class="empty-hint">和 AI 对话时会自动记住重要信息</text>
        </view>
      </scroll-view>

      <!-- 底部操作 -->
      <view class="bottom-actions">
        <view class="bottom-btn add" @tap="openAddModal">
          <text>+ 手动添加</text>
        </view>
        <view class="bottom-btn clear" @tap="handleClearAll" v-if="memories.length > 0">
          <text>清空全部</text>
        </view>
      </view>
    </template>

    <!-- 关闭提示 -->
    <view v-else class="disabled-hint">
      <SijiIcon name="moon" size="md" class="disabled-icon" />
      <text class="disabled-text">记忆功能已关闭</text>
      <text class="disabled-sub">AI 将不会记住跨会话的信息</text>
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
.memory-page {
  min-height: 100vh;
  background: var(--bg-page);
  padding: $spacing-md;
  padding-bottom: 120rpx;
  box-sizing: border-box;
}

/* 开关卡 */
.switch-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-card);
  border-radius: 16rpx;
  padding: $spacing-md;
  margin-bottom: $spacing-sm;

  .switch-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4rpx;
  }

  .switch-title {
    font-size: $font-lg;
    font-weight: 700;
    color: var(--text-primary);
  }

  .switch-desc {
    font-size: $font-xs;
    color: var(--text-secondary);
  }
}

/* 统计行 */
.stats-row {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-xs;
  margin-bottom: $spacing-sm;

  .stat-item {
    flex: 1;
    min-width: 120rpx;
    background: var(--bg-card);
    border-radius: 12rpx;
    padding: $spacing-sm $spacing-xs;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2rpx;
  }

  .stat-num {
    font-size: $font-xl;
    font-weight: 800;
    color: var(--text-primary);
  }

  .stat-label {
    font-size: 18rpx;
    color: var(--text-secondary);
  }
}

/* 筛选栏 */
.filter-bar {
  display: flex;
  gap: $spacing-xs;
  margin-bottom: $spacing-sm;
  white-space: nowrap;
  padding: 4rpx 0;

  .filter-chip {
    display: inline-flex;
    padding: 8rpx 20rpx;
    border-radius: 20rpx;
    background: var(--bg-card);
    font-size: $font-xs;
    color: var(--text-secondary);
    flex-shrink: 0;

    &.active {
      background: var(--color-ai);
      color: var(--bg-card);
    }
  }
}

/* 记忆列表 */
.memory-list {
  max-height: calc(100vh - 420rpx);
}

.memory-item {
  background: var(--bg-card);
  border-radius: 12rpx;
  padding: $spacing-sm $spacing-md;
  margin-bottom: $spacing-xs;

  .memory-item-header {
    display: flex;
    align-items: center;
    gap: 6rpx;
    margin-bottom: 6rpx;
  }

  .memory-cat-icon {
    font-size: 24rpx;
  }

  .memory-cat-label {
    font-size: $font-xs;
    color: var(--text-secondary);
    font-weight: 500;
  }

  .memory-time {
    font-size: 18rpx;
    color: var(--text-hint);
    margin-left: auto;
  }

  .memory-content {
    font-size: $font-md;
    color: var(--text-primary);
    line-height: 1.6;
    word-break: break-word;
  }

  .memory-actions {
    display: flex;
    gap: $spacing-sm;
    margin-top: 6rpx;
    justify-content: flex-end;
  }

  .action-btn {
    font-size: $font-xs;
    padding: 4rpx 16rpx;
    border-radius: 8rpx;

    &.edit {
      color: var(--text-secondary);
      background: var(--bg-input);
    }

    &.del {
      color: var(--color-danger);
    }
  }
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  padding: 80rpx 0;

  .empty-icon { font-size: 64rpx; }
  .empty-text {
    font-size: $font-md;
    color: var(--text-secondary);
  }
  .empty-hint {
    font-size: $font-xs;
    color: var(--text-hint);
  }
}

/* 底部操作 */
.bottom-actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  gap: $spacing-sm;
  padding: $spacing-md;
  background: var(--bg-card);
  border-top: 1rpx solid var(--border-color);

  .bottom-btn {
    flex: 1;
    text-align: center;
    padding: $spacing-sm;
    border-radius: 12rpx;
    font-size: $font-sm;
    font-weight: 600;

    &.add {
      background: var(--color-ai);
      color: var(--bg-card);
    }

    &.clear {
      background: var(--bg-input);
      color: var(--color-danger);
    }
  }
}

/* 关闭提示 */
.disabled-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  padding: 120rpx 0;

  .disabled-icon { font-size: 80rpx; }
  .disabled-text {
    font-size: $font-lg;
    color: var(--text-secondary);
    font-weight: 600;
  }
  .disabled-sub {
    font-size: $font-xs;
    color: var(--text-hint);
  }
}

/* 弹窗 */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.modal-content {
  width: 85%;
  max-width: 600rpx;
  background: var(--bg-card);
  border-radius: 16rpx;
  padding: $spacing-lg;
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.modal-title {
  font-size: $font-lg;
  font-weight: 700;
  color: var(--text-primary);
  text-align: center;
}

.modal-cat-row {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-xs;
}

.modal-cat-chip {
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
  background: var(--bg-input);
  font-size: $font-xs;
  color: var(--text-secondary);

  &.active {
    background: var(--color-ai);
    color: var(--bg-card);
  }
}

.modal-input {
  width: 100%;
  min-height: 120rpx;
  background: var(--bg-input);
  border-radius: 12rpx;
  padding: $spacing-sm;
  font-size: $font-md;
  color: var(--text-primary);
  box-sizing: border-box;
}

.modal-actions {
  display: flex;
  gap: $spacing-sm;
  margin-top: $spacing-xs;
}

.modal-btn {
  flex: 1;
  text-align: center;
  padding: $spacing-sm;
  border-radius: 12rpx;
  font-size: $font-sm;
  font-weight: 600;

  &.cancel {
    background: var(--bg-input);
    color: var(--text-secondary);
  }

  &.ok {
    background: var(--color-ai);
    color: var(--bg-card);
  }
}
</style>
