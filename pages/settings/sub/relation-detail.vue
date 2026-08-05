<template>
  <view class="page">
    <view v-if="relation" class="detail-content">
      <!-- 人物头部 -->
      <view class="hero">
        <view class="hero-avatar">{{ relation.name.charAt(0) }}</view>
        <view class="hero-info">
          <text class="hero-name">{{ relation.name }}</text>
          <text class="hero-role">{{ relation.role }}{{ relation.context ? ' · ' + relation.context : '' }}</text>
        </view>
        <view class="score-display">
          <text class="score-num">{{ relation.relationship_score }}</text>
          <text class="score-max">/10</text>
        </view>
      </view>

      <!-- 特征标签 -->
      <view v-if="relation.traits && relation.traits.length > 0" class="section">
        <text class="section-title">性格特征</text>
        <view class="tag-wrap">
          <text v-for="t in relation.traits" :key="t" class="tag">{{ t }}</text>
        </view>
      </view>

      <!-- 偏好 -->
      <view v-if="relation.preferences && relation.preferences.length > 0" class="section">
        <text class="section-title">沟通偏好</text>
        <view class="tag-wrap">
          <text v-for="p in relation.preferences" :key="p" class="tag tag-alt">{{ p }}</text>
        </view>
      </view>

      <!-- 备注 -->
      <view v-if="relation.notes" class="section">
        <text class="section-title">备注</text>
        <text class="section-text">{{ relation.notes }}</text>
      </view>

      <!-- 互动记录 -->
      <view class="section">
        <view class="section-header">
          <text class="section-title">互动记录（{{ interactions.length }}）</text>
          <text class="add-btn" @tap="showInteractionForm = true">+ 记录</text>
        </view>

        <view v-if="interactions.length === 0" class="empty-mini">暂无互动记录</view>
        <view v-for="item in interactions" :key="item.id" class="interaction-item">
          <view class="interaction-top">
            <text class="interaction-scene">{{ item.scene }}</text>
            <text class="interaction-date">{{ formatDate(item.date) }}</text>
          </view>
          <text class="interaction-content">{{ item.content }}</text>
          <text v-if="item.result" class="interaction-result">结果：{{ item.result }}</text>
          <text v-if="item.emotion" class="interaction-emotion">情绪：{{ item.emotion }}</text>
        </view>
      </view>

      <!-- 操作按钮 -->
      <view class="actions">
        <button class="btn-action" @tap="startSimulation">模拟演练</button>
        <button class="btn-action" @tap="openEditForm">编辑</button>
        <button class="btn-action btn-danger" @tap="handleDelete">删除</button>
      </view>
    </view>

    <view v-else class="empty">
      <text>关系卡片不存在</text>
    </view>

    <!-- 编辑弹窗 -->
    <view v-if="showEditForm" class="modal-mask" @tap="showEditForm = false">
      <view class="modal-content" @tap.stop>
        <text class="modal-title">编辑人物</text>
        <view class="form-item">
          <text class="form-label">姓名 *</text>
          <input v-model="editForm.name" class="form-input" placeholder="请输入姓名" />
        </view>
        <view class="form-item">
          <text class="form-label">关系</text>
          <picker :value="editForm.roleIndex" :range="roleOptions" @change="onRoleChange">
            <view class="form-input picker-display">{{ editForm.role || '请选择关系' }}</view>
          </picker>
        </view>
        <view class="form-item">
          <text class="form-label">场景</text>
          <input v-model="editForm.context" class="form-input" placeholder="如：公司、家庭、朋友圈" />
        </view>
        <view class="form-item">
          <text class="form-label">性格特征（逗号分隔）</text>
          <input v-model="editForm.traitsStr" class="form-input" placeholder="如：理性,温和,固执" />
        </view>
        <view class="form-item">
          <text class="form-label">偏好（逗号分隔）</text>
          <input v-model="editForm.preferencesStr" class="form-input" placeholder="如：直接沟通,数据驱动" />
        </view>
        <view class="form-item">
          <text class="form-label">亲密度：{{ editForm.relationship_score }}</text>
          <slider :value="editForm.relationship_score" :min="1" :max="10" :step="1" @change="onScoreChange" activeColor="#000000" backgroundColor="#E4E4E7" block-color="#000000" />
        </view>
        <view class="form-item">
          <text class="form-label">备注</text>
          <textarea v-model="editForm.notes" class="form-textarea" placeholder="补充信息..." />
        </view>
        <view class="modal-actions">
          <button class="btn-cancel" @tap="showEditForm = false">取消</button>
          <button class="btn-confirm" @tap="handleEdit">保存</button>
        </view>
      </view>
    </view>

    <!-- 互动记录弹窗 -->
    <view v-if="showInteractionForm" class="modal-mask" @tap="showInteractionForm = false">
      <view class="modal-content" @tap.stop>
        <text class="modal-title">记录互动</text>
        <view class="form-item">
          <text class="form-label">场景</text>
          <input v-model="interactionForm.scene" class="form-input" placeholder="如：开会、微信聊天、聚餐" />
        </view>
        <view class="form-item">
          <text class="form-label">内容</text>
          <textarea v-model="interactionForm.content" class="form-textarea" placeholder="发生了什么..." />
        </view>
        <view class="form-item">
          <text class="form-label">结果</text>
          <input v-model="interactionForm.result" class="form-input" placeholder="可选" />
        </view>
        <view class="form-item">
          <text class="form-label">情绪</text>
          <input v-model="interactionForm.emotion" class="form-input" placeholder="如：愉快、紧张、无奈" />
        </view>
        <view class="modal-actions">
          <button class="btn-cancel" @tap="showInteractionForm = false">取消</button>
          <button class="btn-confirm" @tap="handleLogInteraction">保存</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { getRelationById, getInteractions, logInteraction, deleteRelation, updateRelation } from '@/utils/relations.js'
import { safeNavigateBack } from '@/utils/nav-helper.js'

const relationId = ref('')
const relation = ref(null)
const interactions = ref([])
const showInteractionForm = ref(false)
const interactionForm = ref({ scene: '', content: '', result: '', emotion: '' })
const showEditForm = ref(false)
const roleOptions = ref(['家人', '朋友', '同事', '上级', '下属', '客户', '导师', '同学', '伴侣', '其他'])
const editForm = ref({
  name: '',
  role: '',
  roleIndex: 0,
  context: '',
  traitsStr: '',
  preferencesStr: '',
  relationship_score: 5,
  notes: ''
})

onLoad((options) => {
  relationId.value = options.id || ''
  loadData()
})

onShow(() => {
  loadData()
})

function loadData() {
  relation.value = getRelationById(relationId.value)
  if (relation.value) {
    interactions.value = getInteractions(relationId.value)
  }
}

function formatDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function handleLogInteraction() {
  if (!interactionForm.value.content.trim()) {
    uni.showToast({ title: '请输入内容', icon: 'none' })
    return
  }
  logInteraction({
    relation_id: relationId.value,
    relation_name: relation.value.name,
    scene: interactionForm.value.scene || '日常',
    content: interactionForm.value.content,
    result: interactionForm.value.result,
    emotion: interactionForm.value.emotion
  })
  uni.showToast({ title: '已记录', icon: 'success' })
  showInteractionForm.value = false
  interactionForm.value = { scene: '', content: '', result: '', emotion: '' }
  loadData()
}

function openEditForm() {
  const r = relation.value
  editForm.value = {
    name: r.name || '',
    role: r.role || '',
    roleIndex: Math.max(0, roleOptions.value.indexOf(r.role)),
    context: r.context || '',
    traitsStr: (r.traits || []).join(','),
    preferencesStr: (r.preferences || []).join(','),
    relationship_score: r.relationship_score || 5,
    notes: r.notes || ''
  }
  showEditForm.value = true
}

function onRoleChange(e) {
  const idx = e.detail.value
  editForm.value.roleIndex = idx
  editForm.value.role = roleOptions.value[idx]
}

function onScoreChange(e) {
  editForm.value.relationship_score = e.detail.value
}

function handleEdit() {
  if (!editForm.value.name.trim()) {
    uni.showToast({ title: '请输入姓名', icon: 'none' })
    return
  }
  const updates = {
    name: editForm.value.name.trim(),
    role: editForm.value.role,
    context: editForm.value.context.trim(),
    traits: editForm.value.traitsStr
      ? editForm.value.traitsStr.split(',').map(s => s.trim()).filter(Boolean)
      : [],
    preferences: editForm.value.preferencesStr
      ? editForm.value.preferencesStr.split(',').map(s => s.trim()).filter(Boolean)
      : [],
    relationship_score: editForm.value.relationship_score,
    notes: editForm.value.notes.trim()
  }
  updateRelation(relationId.value, updates)
  uni.showToast({ title: '已保存', icon: 'success' })
  showEditForm.value = false
  loadData()
}

function startSimulation() {
  uni.navigateTo({
    url: `/pages/settings/sub/simulation?relation_id=${relationId.value}&name=${encodeURIComponent(relation.value.name)}`
  })
}

function handleDelete() {
  uni.showModal({
    title: '确认删除',
    content: `确定要从关系图谱中移除「${relation.value.name}」吗？`,
    success: (res) => {
      if (res.confirm) {
        deleteRelation(relationId.value)
        uni.showToast({ title: '已删除', icon: 'success' })
        setTimeout(() => safeNavigateBack(), 800)
      }
    }
  })
}
</script>

<style scoped>
.page { min-height: 100vh; background: #FAFAFA; }
.detail-content { padding: 24rpx; }

.hero {
  display: flex; align-items: center;
  background: #FFFFFF; border-radius: 24rpx; padding: 32rpx;
  margin-bottom: 16rpx;
}
.hero-avatar {
  width: 96rpx; height: 96rpx; border-radius: 50%;
  background: #000000; color: #FFFFFF;
  font-size: 40rpx; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.hero-info { flex: 1; margin-left: 24rpx; }
.hero-name { font-size: 36rpx; font-weight: 700; color: #18181B; display: block; }
.hero-role { font-size: 26rpx; color: #71717A; margin-top: 8rpx; }
.score-display { display: flex; align-items: baseline; }
.score-num { font-size: 56rpx; font-weight: 800; color: #18181B; }
.score-max { font-size: 28rpx; color: #A1A1AA; }

.section {
  background: #FFFFFF; border-radius: 24rpx; padding: 28rpx;
  margin-bottom: 16rpx;
}
.section-header { display: flex; justify-content: space-between; align-items: center; }
.section-title { font-size: 28rpx; font-weight: 600; color: #18181B; }
.section-text { font-size: 28rpx; color: #3F3F46; line-height: 1.6; margin-top: 12rpx; }
.add-btn { font-size: 26rpx; color: #18181B; font-weight: 600; }

.tag-wrap { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 16rpx; }
.tag { font-size: 24rpx; padding: 6rpx 20rpx; background: #D4D4D8; color: #3F3F46; border-radius: 12rpx; }
.tag-alt { background: #E4E4E7; color: #52525B; }

.empty-mini { font-size: 26rpx; color: #A1A1AA; margin-top: 16rpx; }

.interaction-item {
  padding: 20rpx 0; border-bottom: 1rpx solid #E4E4E7;
}
.interaction-item:last-child { border-bottom: none; }
.interaction-top { display: flex; justify-content: space-between; }
.interaction-scene { font-size: 26rpx; font-weight: 600; color: #18181B; }
.interaction-date { font-size: 24rpx; color: #A1A1AA; }
.interaction-content { font-size: 28rpx; color: #3F3F46; margin-top: 8rpx; display: block; }
.interaction-result, .interaction-emotion { font-size: 24rpx; color: #71717A; margin-top: 4rpx; display: block; }

.actions { display: flex; gap: 24rpx; margin-top: 24rpx; }
.btn-action {
  flex: 1; height: 88rpx; border-radius: 16rpx;
  font-size: 30rpx; font-weight: 600; border: none;
  background: #000000; color: #FFFFFF;
}
.btn-danger { background: #FEE2E2; color: #DC2626; }

.empty { display: flex; justify-content: center; padding-top: 200rpx; color: #A1A1AA; }

.modal-mask {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: flex-end; z-index: 1000;
}
.modal-content {
  width: 100%; max-height: 80vh; overflow-y: auto;
  background: #FFFFFF; border-radius: 32rpx 32rpx 0 0; padding: 40rpx 32rpx;
}
.modal-title { font-size: 36rpx; font-weight: 700; color: #18181B; display: block; margin-bottom: 32rpx; }
.form-item { margin-bottom: 24rpx; }
.form-label { font-size: 26rpx; color: #71717A; display: block; margin-bottom: 8rpx; }
.form-input {
  width: 100%; height: 80rpx; padding: 0 24rpx;
  background: #F4F4F5; border-radius: 16rpx; font-size: 28rpx; color: #18181B;
}
.form-textarea {
  width: 100%; min-height: 120rpx; padding: 16rpx 24rpx;
  background: #F4F4F5; border-radius: 16rpx; font-size: 28rpx;
}
.modal-actions { display: flex; gap: 24rpx; margin-top: 32rpx; }
.btn-cancel, .btn-confirm {
  flex: 1; height: 88rpx; border-radius: 16rpx; font-size: 30rpx; font-weight: 600; border: none;
}
.btn-cancel { background: #D4D4D8; color: #71717A; }
.btn-confirm { background: #000000; color: #FFFFFF; }
.picker-display {
  display: flex; align-items: center;
  color: #18181B;
}

</style>

