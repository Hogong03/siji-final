<template>
  <view class="page">
    <!-- 状态筛选 -->
    <view class="filter-bar">
      <text
        v-for="tab in tabs"
        :key="tab.value"
        class="filter-tab"
        :class="{ active: currentTab === tab.value }"
        @tap="currentTab = tab.value"
      >{{ tab.label }} ({{ getCount(tab.value) }})</text>
    </view>

    <!-- 决策列表 -->
    <scroll-view scroll-y class="list-area">
      <view v-if="filteredList.length === 0" class="empty">
        <text class="empty-icon">🤔</text>
        <text class="empty-text">暂无决策记录</text>
        <text class="empty-hint">在对话中说"帮我做个决策"即可开始</text>
      </view>

      <view
        v-for="item in filteredList"
        :key="item.id"
        class="decision-card"
        @tap="goDetail(item.id)"
      >
        <view class="card-top">
          <text class="card-title">{{ item.title }}</text>
          <text class="status-badge" :class="'status-' + item.status">{{ statusLabel(item.status) }}</text>
        </view>
        <text class="card-category">{{ item.category }}</text>
        <view v-if="item.options && item.options.length > 0" class="card-options">
          <text v-for="opt in item.options.slice(0, 3)" :key="opt.name" class="option-chip">{{ opt.name }}</text>
          <text v-if="item.options.length > 3" class="option-more">+{{ item.options.length - 3 }}</text>
        </view>
        <view v-if="item.deadline" class="card-deadline">
          截止：{{ item.deadline }}
        </view>
        <view v-if="item.decision" class="card-decision">
          <text class="decision-label">决定：</text>
          <text class="decision-text">{{ item.decision }}</text>
        </view>
        <text class="card-time">{{ formatTime(item.created_at) }}</text>

        <!-- 操作按钮区 -->
        <view class="card-actions" @tap.stop>
          <text class="action-btn edit-btn" @tap="handleEdit(item)">编辑</text>
          <text class="action-btn delete-btn" @tap="handleDelete(item)">删除</text>
        </view>
      </view>
    </scroll-view>

    <!-- 新增按钮 -->
    <view class="fab" @tap="openAddForm">+</view>

    <!-- 新增/编辑弹窗 -->
    <view v-if="showAddForm" class="modal-mask" @tap="showAddForm = false">
      <view class="modal-content" @tap.stop>
        <text class="modal-title">{{ editMode ? '编辑决策' : '记录决策' }}</text>

        <view class="form-item">
          <text class="form-label">决策标题 *</text>
          <input v-model="form.title" class="form-input" placeholder="如：是否接受新offer" />
        </view>
        <view class="form-item">
          <text class="form-label">分类</text>
          <picker :range="categories" :value="catIndex" @change="onCatChange">
            <view class="form-input">{{ form.category }}</view>
          </picker>
        </view>
        <view class="form-item">
          <text class="form-label">截止日期</text>
          <input v-model="form.deadline" class="form-input" placeholder="如：2026-07-30（可选）" />
        </view>
        <view class="form-item">
          <text class="form-label">选项（每行一个，格式：名称）</text>
          <textarea v-model="form.optionsStr" class="form-textarea" placeholder="接受offer&#10;留在现公司&#10;再等等看" />
        </view>
        <view class="form-item">
          <text class="form-label">利益相关方（逗号分隔）</text>
          <input v-model="form.stakeholdersStr" class="form-input" placeholder="如：我、家人、现领导" />
        </view>
        <view class="form-item">
          <text class="form-label">考虑因素（逗号分隔）</text>
          <input v-model="form.factorsStr" class="form-input" placeholder="如：薪资、成长、通勤、风险" />
        </view>
        <view class="form-item">
          <text class="form-label">当前情绪</text>
          <input v-model="form.emotion" class="form-input" placeholder="如：纠结、期待、焦虑" />
        </view>

        <view class="modal-actions">
          <button class="btn-cancel" @tap="showAddForm = false">取消</button>
          <button class="btn-confirm" @tap="editMode ? handleSave() : handleAdd()">{{ editMode ? '保存' : '创建' }}</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
  getAllDecisions, getDecisionsByStatus, createDecision, getDecisionStats, getPendingReviews,
  updateDecision, deleteDecision
} from '@/utils/decisions.js'

const tabs = ref([
  { label: '全部', value: 'all' },
  { label: '思考中', value: 'thinking' },
  { label: '已决定', value: 'decided' },
  { label: '已复盘', value: 'reviewed' }
])
const currentTab = ref('all')
const allList = ref([])
const filteredList = ref([])
const stats = ref({})
const showAddForm = ref(false)
const editMode = ref(false)
const editingId = ref(null)
const categories = ref(['职业', '感情', '财务', '生活', '其他'])
const catIndex = ref(0)
const form = ref({
  title: '',
  category: '职业',
  deadline: '',
  optionsStr: '',
  stakeholdersStr: '',
  factorsStr: '',
  emotion: ''
})

onShow(() => {
  loadData()
})

watch(currentTab, () => { applyFilter() })

function loadData() {
  allList.value = getAllDecisions()
  stats.value = getDecisionStats()
  applyFilter()
}

function applyFilter() {
  if (currentTab.value === 'all') {
    filteredList.value = allList.value
  } else {
    filteredList.value = allList.value.filter(d => d.status === currentTab.value)
  }
}

function getCount(tabValue) {
  if (tabValue === 'all') return allList.value.length
  return allList.value.filter(d => d.status === tabValue).length
}

function statusLabel(status) {
  const map = { thinking: '思考中', decided: '已决定', acted: '已行动', reviewed: '已复盘', abandoned: '已放弃' }
  return map[status] || status
}

function formatTime(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

function onCatChange(e) {
  catIndex.value = e.detail.value
  form.value.category = categories.value[e.detail.value]
}

function openAddForm() {
  editMode.value = false
  editingId.value = null
  resetForm()
  showAddForm.value = true
}

function handleAdd() {
  if (!form.value.title.trim()) {
    uni.showToast({ title: '请输入决策标题', icon: 'none' })
    return
  }
  const options = form.value.optionsStr
    ? form.value.optionsStr.split('\n').map(s => s.trim()).filter(Boolean).map(name => ({ name, pros: [], cons: [], weight: 5 }))
    : []
  createDecision({
    title: form.value.title.trim(),
    category: form.value.category,
    deadline: form.value.deadline.trim(),
    options,
    stakeholders: form.value.stakeholdersStr ? form.value.stakeholdersStr.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [],
    factors: form.value.factorsStr ? form.value.factorsStr.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [],
    emotion: form.value.emotion.trim()
  })
  uni.showToast({ title: '已创建', icon: 'success' })
  showAddForm.value = false
  resetForm()
  loadData()
}

function handleEdit(item) {
  editMode.value = true
  editingId.value = item.id
  form.value.title = item.title || ''
  form.value.category = item.category || '职业'
  form.value.deadline = item.deadline || ''
  form.value.optionsStr = (item.options && item.options.length > 0)
    ? item.options.map(opt => opt.name).join('\n')
    : ''
  form.value.stakeholdersStr = (item.stakeholders && item.stakeholders.length > 0)
    ? item.stakeholders.join('，')
    : ''
  form.value.factorsStr = (item.factors && item.factors.length > 0)
    ? item.factors.join('，')
    : ''
  form.value.emotion = item.emotion || ''
  const idx = categories.value.indexOf(form.value.category)
  catIndex.value = idx >= 0 ? idx : 0
  showAddForm.value = true
}

function handleSave() {
  if (!form.value.title.trim()) {
    uni.showToast({ title: '请输入决策标题', icon: 'none' })
    return
  }
  const options = form.value.optionsStr
    ? form.value.optionsStr.split('\n').map(s => s.trim()).filter(Boolean).map(name => ({ name, pros: [], cons: [], weight: 5 }))
    : []
  updateDecision(editingId.value, {
    title: form.value.title.trim(),
    category: form.value.category,
    deadline: form.value.deadline.trim(),
    options,
    stakeholders: form.value.stakeholdersStr ? form.value.stakeholdersStr.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [],
    factors: form.value.factorsStr ? form.value.factorsStr.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [],
    emotion: form.value.emotion.trim()
  })
  uni.showToast({ title: '已保存', icon: 'success' })
  showAddForm.value = false
  editMode.value = false
  editingId.value = null
  resetForm()
  loadData()
}

function handleDelete(item) {
  uni.showModal({
    title: '确认删除',
    content: `确定要删除「${item.title}」吗？此操作不可撤销。`,
    confirmColor: '#000000',
    success: (res) => {
      if (res.confirm) {
        deleteDecision(item.id)
        uni.showToast({ title: '已删除', icon: 'success' })
        loadData()
      }
    }
  })
}

function resetForm() {
  form.value = { title: '', category: '职业', deadline: '', optionsStr: '', stakeholdersStr: '', factorsStr: '', emotion: '' }
  catIndex.value = 0
}

function goDetail(id) {
  uni.navigateTo({ url: `/pages/settings/sub/decision-detail?id=${id}` })
}
</script>

<style scoped>
.page { min-height: 100vh; background: var(--bg-page); }

.filter-bar {
  display: flex; background: var(--bg-card); padding: 16rpx 24rpx;
  overflow-x: auto; border-bottom: 1rpx solid var(--border-color);
}
.filter-tab {
  font-size: 26rpx; color: var(--text-secondary); padding: 8rpx 24rpx;
  border-radius: 20rpx; margin-right: 12rpx; white-space: nowrap;
}
.filter-tab.active { background: var(--color-ai); color: var(--bg-card); }

.list-area { height: calc(100vh - 140rpx); padding: 16rpx 24rpx; }

.empty { display: flex; flex-direction: column; align-items: center; padding-top: 200rpx; }
.empty-icon { font-size: 80rpx; margin-bottom: 24rpx; }
.empty-text { font-size: 32rpx; color: var(--text-secondary); }
.empty-hint { font-size: 26rpx; color: var(--text-hint); margin-top: 8rpx; }

.decision-card {
  background: var(--bg-card); border-radius: 24rpx; padding: 28rpx; margin-bottom: 16rpx;
}
.card-top { display: flex; justify-content: space-between; align-items: flex-start; }
.card-title { font-size: 32rpx; font-weight: 600; color: var(--text-primary); flex: 1; }
.status-badge {
  font-size: 22rpx; padding: 4rpx 16rpx; border-radius: 8rpx; margin-left: 16rpx;
  white-space: nowrap;
}
.status-thinking { background: var(--color-bill-light); color: var(--color-bill-text); }
.status-decided { background: var(--color-info-light); color: var(--color-info-text); }
.status-acted { background: var(--color-plan-light); color: var(--color-plan-text); }
.status-reviewed { background: var(--bg-btn-secondary); color: var(--text-mid); }
.status-abandoned { background: var(--color-danger-light); color: var(--color-danger-text); }

.card-category { font-size: 24rpx; color: var(--text-secondary); margin-top: 8rpx; }
.card-options { display: flex; flex-wrap: wrap; gap: 8rpx; margin-top: 16rpx; }
.option-chip { font-size: 22rpx; padding: 4rpx 16rpx; background: var(--bg-btn-secondary); color: var(--text-strong); border-radius: 8rpx; }
.option-more { font-size: 22rpx; color: var(--text-hint); padding: 4rpx 8rpx; }
.card-deadline { font-size: 24rpx; color: var(--text-secondary); margin-top: 12rpx; }
.card-decision { margin-top: 12rpx; padding: 12rpx 16rpx; background: var(--bg-card-alt); border-radius: 12rpx; }
.decision-label { font-size: 24rpx; color: var(--text-secondary); }
.decision-text { font-size: 26rpx; color: var(--text-primary); font-weight: 500; }
.card-time { font-size: 22rpx; color: var(--text-hint); margin-top: 12rpx; display: block; }

/* 操作按钮区 */
.card-actions {
  display: flex; justify-content: flex-end; gap: 24rpx;
  margin-top: 16rpx; padding-top: 16rpx; border-top: 1rpx solid var(--border-color);
}
.action-btn { font-size: 26rpx; padding: 8rpx 24rpx; border-radius: 12rpx; }
.edit-btn { color: var(--text-primary); background: var(--bg-btn-secondary); }
.delete-btn { color: var(--bg-card); background: var(--color-ai); }

.fab {
  position: fixed; right: 40rpx; bottom: 80rpx;
  width: 96rpx; height: 96rpx; border-radius: 50%;
  background: var(--color-ai); color: var(--bg-card);
  font-size: 56rpx; line-height: 96rpx; text-align: center;
  box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.2);
}

.modal-mask {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: flex-end; z-index: 1000;
}
.modal-content {
  width: 100%; max-height: 80vh; overflow-y: auto;
  background: var(--bg-card); border-radius: 32rpx 32rpx 0 0; padding: 40rpx 32rpx;
}
.modal-title { font-size: 36rpx; font-weight: 700; color: var(--text-primary); display: block; margin-bottom: 32rpx; }
.form-item { margin-bottom: 24rpx; }
.form-label { font-size: 26rpx; color: var(--text-secondary); display: block; margin-bottom: 8rpx; }
.form-input {
  width: 100%; height: 80rpx; padding: 0 24rpx;
  background: var(--bg-input); border-radius: 16rpx; font-size: 28rpx; color: var(--text-primary); line-height: 80rpx;
}
.form-textarea {
  width: 100%; min-height: 160rpx; padding: 16rpx 24rpx;
  background: var(--bg-input); border-radius: 16rpx; font-size: 28rpx;
}
.modal-actions { display: flex; gap: 24rpx; margin-top: 32rpx; }
.btn-cancel, .btn-confirm {
  flex: 1; height: 88rpx; border-radius: 16rpx; font-size: 30rpx; font-weight: 600; border: none;
}
.btn-cancel { background: var(--bg-btn-secondary); color: var(--text-secondary); }
.btn-confirm { background: var(--color-ai); color: var(--bg-card); }

</style>
