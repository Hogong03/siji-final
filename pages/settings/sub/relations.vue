<template>
  <view class="page">
    <!-- 自定义导航栏：左侧返回 + 标题 + 右侧「自己」/「关系图」 -->
    <view class="custom-nav" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content">
        <view class="nav-back" @tap="goBack">
          <text class="nav-back-icon">‹</text>
        </view>
        <text class="nav-title">关系图谱</text>
        <view class="nav-actions">
          <view class="nav-btn" @tap="goProfile">
            <text class="nav-btn-text">自己</text>
          </view>
          <view class="nav-btn" @tap="goGraph">
            <text class="nav-btn-text">关系图</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 本周社交额度（自己定，不设则不显示） -->
    <SocialQuotaBar :revision="quotaRevision" />

    <!-- 顶部统计 -->
    <view class="stats-bar">
      <view class="stat-item">
        <text class="stat-num">{{ stats.total }}</text>
        <text class="stat-label">总人数</text>
      </view>
      <view class="stat-item">
        <text class="stat-num">{{ stats.interactionCount }}</text>
        <text class="stat-label">互动记录</text>
      </view>
      <view class="stat-item">
        <text class="stat-num">{{ stats.avgScore }}</text>
        <text class="stat-label">平均亲密度</text>
      </view>
    </view>

    <!-- 搜索栏 -->
    <view class="search-bar">
      <input
        v-model="keyword"
        class="search-input"
        placeholder="搜索姓名、标签、场景..."
        @confirm="handleSearch"
      />
    </view>

    <!-- 关系列表 -->
    <scroll-view scroll-y class="list-area" @scrolltolower="loadMore">
      <view v-if="filteredList.length === 0" class="empty">
        <text class="empty-icon">👥</text>
        <text class="empty-text">关系图谱为空</text>
        <text class="empty-hint">在对话中提到人物即可自动收录</text>
      </view>

      <view
        v-for="item in filteredList"
        :key="item.id"
        class="relation-card"
        @tap="goDetail(item.id)"
      >
        <view class="card-header">
          <view class="avatar">{{ item.name.charAt(0) }}</view>
          <view class="info">
            <text class="name">{{ item.name }}</text>
            <text class="role">{{ item.role }}</text>
          </view>
          <view class="score-badge" :class="scoreClass(item.relationship_score)">
            {{ item.relationship_score }}
          </view>
        </view>
        <view v-if="item.context" class="card-context">{{ item.context }}</view>
        <view v-if="item.traits && item.traits.length > 0" class="card-tags">
          <text v-for="t in item.traits.slice(0, 3)" :key="t" class="tag">{{ t }}</text>
        </view>
        <!-- 操作按钮区 -->
        <view class="card-actions" @tap.stop>
          <view class="action-btn" @tap="handleEdit(item)">
            <text class="action-icon">✏️</text>
            <text class="action-text">编辑</text>
          </view>
          <view class="action-btn" @tap="handleDelete(item)">
            <text class="action-icon">🗑️</text>
            <text class="action-text">删除</text>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- 新增按钮 -->
    <view class="fab" @tap="showAddForm = true">+</view>

    <!-- 新增/编辑弹窗 -->
    <view v-if="showAddForm" class="modal-mask" @tap="closeForm">
      <view class="modal-content" @tap.stop>
        <text class="modal-title">{{ editMode ? '编辑人物' : '收录人物' }}</text>

        <!-- 模板快选（仅新建模式显示） -->
        <view v-if="!editMode" class="tpl-section">
          <text class="tpl-title">快速选择模板</text>
          <view class="tpl-grid">
            <view
              v-for="tpl in RELATION_TEMPLATES" :key="tpl.role"
              class="tpl-card"
              :class="{ active: selectedTpl === tpl.role }"
              @tap="applyTemplate(tpl)"
            >
              <view class="tpl-icon-wrap">
                <text class="tpl-icon">{{ tpl.icon }}</text>
              </view>
              <text class="tpl-name">{{ tpl.role }}</text>
              <text class="tpl-hint">{{ tpl.hint }}</text>
            </view>
          </view>
        </view>

        <view class="form-item">
          <text class="form-label">姓名 *</text>
          <input v-model="form.name" class="form-input" placeholder="对方姓名" />
        </view>
        <view class="form-item">
          <text class="form-label">关系</text>
          <picker :range="roles" :value="roleIndex" @change="onRoleChange">
            <view class="form-input">{{ form.role }}</view>
          </picker>
        </view>
        <view class="form-item">
          <text class="form-label">场景</text>
          <input v-model="form.context" class="form-input" placeholder="如：公司、小区、朋友聚会" />
        </view>
        <view class="form-item">
          <text class="form-label">性格特征（逗号分隔）</text>
          <input v-model="form.traitsStr" class="form-input" placeholder="如：开朗、急性子、讲逻辑" />
        </view>
        <view class="form-item">
          <text class="form-label">偏好（逗号分隔）</text>
          <input v-model="form.preferencesStr" class="form-input" placeholder="如：喜欢被肯定、讨厌绕弯子" />
        </view>
        <view class="form-item">
          <text class="form-label">亲密度 (1-10)</text>
          <slider :value="form.relationship_score" :min="1" :max="10" @change="onScoreChange" />
        </view>
        <view class="form-item">
          <text class="form-label">备注</text>
          <textarea v-model="form.notes" class="form-textarea" placeholder="其他需要记住的信息" />
        </view>

        <view class="modal-actions">
          <button class="btn-cancel" @tap="closeForm">取消</button>
          <button class="btn-confirm" @tap="handleSubmit">{{ editMode ? '保存' : '收录' }}</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getAllRelations, findRelationsByName, createRelation, updateRelation, deleteRelation, getRelationsStats } from '@/utils/relations.js'
import { RELATION_TEMPLATES, buildRelationForm, applyRelationTemplate } from '@/utils/relation-templates.js'
import { safeNavigateBack } from '@/utils/nav-helper.js'
import SocialQuotaBar from '@/components/common/SocialQuotaBar.vue'

const statusBarHeight = ref(20)
try {
  const sys = uni.getSystemInfoSync()
  if (sys && sys.statusBarHeight) statusBarHeight.value = sys.statusBarHeight
} catch (e) {}

function goBack() {
  safeNavigateBack()
}

// 跳转「人物关系图」
function goGraph() {
  uni.navigateTo({ url: '/pages/settings/sub/relation-graph' })
}

// 跳转「我的画像」
function goProfile() {
  uni.navigateTo({ url: '/pages/settings/sub/profile' })
}

// ─── 关系模板 ───
// 4.39.0：模板数据与「应用模板」逻辑抽到 utils/relation-templates.js（纯函数，可测）。
// 模板不含亲密度：产品预设分数预填会被当成用户评价，污染平均亲密度与情景模拟人设。

const list = ref([])
const filteredList = ref([])
const keyword = ref('')
const stats = ref({ total: 0, interactionCount: 0, avgScore: 0 })
const quotaRevision = ref(0)
const showAddForm = ref(false)
const editMode = ref(false)
const editingId = ref(null)
const selectedTpl = ref('')
const roles = ref(['同事', '领导', '朋友', '家人', '伴侣', '客户', '老师', '其他'])
const roleIndex = ref(0)
const form = ref(buildRelationForm())

onShow(() => {
  loadData()
})

function loadData() {
  list.value = getAllRelations()
  filteredList.value = list.value
  stats.value = getRelationsStats()
  quotaRevision.value += 1
}

function handleSearch() {
  if (keyword.value.trim()) {
    filteredList.value = findRelationsByName(keyword.value.trim())
  } else {
    filteredList.value = list.value
  }
}

function onRoleChange(e) {
  roleIndex.value = e.detail.value
  form.value.role = roles.value[e.detail.value]
}

function onScoreChange(e) {
  form.value.relationship_score = e.detail.value
}

function handleSubmit() {
  if (!form.value.name.trim()) {
    uni.showToast({ title: '请输入姓名', icon: 'none' })
    return
  }
  const payload = {
    name: form.value.name.trim(),
    role: form.value.role,
    context: form.value.context.trim(),
    traits: form.value.traitsStr ? form.value.traitsStr.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [],
    preferences: form.value.preferencesStr ? form.value.preferencesStr.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [],
    relationship_score: form.value.relationship_score,
    notes: form.value.notes.trim()
  }
  if (editMode.value) {
    // trustScore：手动编辑是亲密度唯一的合法写入路径（4.38.0）
    updateRelation(editingId.value, payload, { trustScore: true })
    uni.showToast({ title: '已保存', icon: 'success' })
  } else {
    createRelation(payload, { trustScore: true })
    uni.showToast({ title: '已收录', icon: 'success' })
  }
  showAddForm.value = false
  editMode.value = false
  editingId.value = null
  resetForm()
  loadData()
}

function handleEdit(item) {
  editMode.value = true
  editingId.value = item.id
  form.value = buildRelationForm({
    name: item.name || '',
    role: item.role || '同事',
    context: item.context || '',
    traitsStr: (item.traits && item.traits.length) ? item.traits.join(', ') : '',
    preferencesStr: (item.preferences && item.preferences.length) ? item.preferences.join(', ') : '',
    relationship_score: item.relationship_score || 5,
    notes: item.notes || ''
  })
  const idx = roles.value.indexOf(item.role)
  roleIndex.value = idx >= 0 ? idx : 0
  selectedTpl.value = ''
  showAddForm.value = true
}

function handleDelete(item) {
  uni.showModal({
    title: '确认删除',
    content: `确定要删除「${item.name}」吗？此操作不可撤销。`,
    confirmColor: '#000000',
    success: (res) => {
      if (res.confirm) {
        deleteRelation(item.id)
        uni.showToast({ title: '已删除', icon: 'success' })
        loadData()
      }
    }
  })
}

function closeForm() {
  showAddForm.value = false
  editMode.value = false
  editingId.value = null
  resetForm()
}

function resetForm() {
  form.value = buildRelationForm()
  roleIndex.value = 0
  selectedTpl.value = ''
}

function applyTemplate(tpl) {
  selectedTpl.value = tpl.role
  // 只填角色与画像信息；亲密度永远不动（用户没评价过就保持默认值）
  applyRelationTemplate(form.value, tpl)
  const idx = roles.value.indexOf(tpl.role)
  if (idx >= 0) roleIndex.value = idx
}

function goDetail(id) {
  uni.navigateTo({ url: `/pages/settings/sub/relation-detail?id=${id}` })
}

function scoreClass(score) {
  if (score >= 8) return 'score-high'
  if (score >= 5) return 'score-mid'
  return 'score-low'
}

function loadMore() { /* 已全部加载 */ }
</script>

<style scoped lang="scss">
@import './relations.scss';
</style>