<template>
  <view class="page">
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

<script>
import { getAllRelations, findRelationsByName, createRelation, updateRelation, deleteRelation, getRelationsStats } from '@/utils/relations.js'

// ─── 关系模板 ───
const RELATION_TEMPLATES = [
  {
    role: '同事', icon: '💼', hint: '项目合作',
    context: '公司/团队',
    traits: '专业, 讲效率',
    preferences: '就事论事, 重视结果',
    score: 5, notes: ''
  },
  {
    role: '领导', icon: '🎯', hint: '上下级',
    context: '公司/部门',
    traits: '决策型, 注重细节',
    preferences: '汇报要有结论, 不喜欢意外',
    score: 6, notes: '直接上级，周一对齐'
  },
  {
    role: '朋友', icon: '🤝', hint: '日常社交',
    context: '朋友聚会/线上',
    traits: '幽默, 靠谱',
    preferences: '随意聊天, 分享生活',
    score: 7, notes: ''
  },
  {
    role: '家人', icon: '🏠', hint: '亲属',
    context: '家庭',
    traits: '关心我, 有时唠叨',
    preferences: '多打电话, 陪伴比礼物重要',
    score: 8, notes: ''
  },
  {
    role: '伴侣', icon: '❤️', hint: '亲密关系',
    context: '生活',
    traits: '温柔, 敏感',
    preferences: '需要倾听, 不喜欢冷战',
    score: 9, notes: '重要纪念日记录'
  },
  {
    role: '其他', icon: '👤', hint: '自定义',
    context: '',
    traits: '',
    preferences: '',
    score: 5, notes: ''
  }
]

export default {
  data() {
    return {
      list: [],
      filteredList: [],
      keyword: '',
      stats: { total: 0, interactionCount: 0, avgScore: 0 },
      showAddForm: false,
      editMode: false,
      editingId: null,
      selectedTpl: '',
      RELATION_TEMPLATES,
      roles: ['同事', '领导', '朋友', '家人', '伴侣', '客户', '老师', '其他'],
      roleIndex: 0,
      form: {
        name: '',
        role: '同事',
        context: '',
        traitsStr: '',
        preferencesStr: '',
        relationship_score: 5,
        notes: ''
      }
    }
  },
  onShow() {
    this.loadData()
  },
  methods: {
    loadData() {
      this.list = getAllRelations()
      this.filteredList = this.list
      this.stats = getRelationsStats()
    },
    handleSearch() {
      if (this.keyword.trim()) {
        this.filteredList = findRelationsByName(this.keyword.trim())
      } else {
        this.filteredList = this.list
      }
    },
    onRoleChange(e) {
      this.roleIndex = e.detail.value
      this.form.role = this.roles[e.detail.value]
    },
    onScoreChange(e) {
      this.form.relationship_score = e.detail.value
    },
    handleSubmit() {
      if (!this.form.name.trim()) {
        uni.showToast({ title: '请输入姓名', icon: 'none' })
        return
      }
      const payload = {
        name: this.form.name.trim(),
        role: this.form.role,
        context: this.form.context.trim(),
        traits: this.form.traitsStr ? this.form.traitsStr.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [],
        preferences: this.form.preferencesStr ? this.form.preferencesStr.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [],
        relationship_score: this.form.relationship_score,
        notes: this.form.notes.trim()
      }
      if (this.editMode) {
        updateRelation(this.editingId, payload)
        uni.showToast({ title: '已保存', icon: 'success' })
      } else {
        createRelation(payload)
        uni.showToast({ title: '已收录', icon: 'success' })
      }
      this.showAddForm = false
      this.editMode = false
      this.editingId = null
      this.resetForm()
      this.loadData()
    },
    handleEdit(item) {
      this.editMode = true
      this.editingId = item.id
      this.form = {
        name: item.name || '',
        role: item.role || '同事',
        context: item.context || '',
        traitsStr: (item.traits && item.traits.length) ? item.traits.join(', ') : '',
        preferencesStr: (item.preferences && item.preferences.length) ? item.preferences.join(', ') : '',
        relationship_score: item.relationship_score || 5,
        notes: item.notes || ''
      }
      const idx = this.roles.indexOf(item.role)
      this.roleIndex = idx >= 0 ? idx : 0
      this.selectedTpl = ''
      this.showAddForm = true
    },
    handleDelete(item) {
      uni.showModal({
        title: '确认删除',
        content: `确定要删除「${item.name}」吗？此操作不可撤销。`,
        confirmColor: '#000000',
        success: (res) => {
          if (res.confirm) {
            deleteRelation(item.id)
            uni.showToast({ title: '已删除', icon: 'success' })
            this.loadData()
          }
        }
      })
    },
    closeForm() {
      this.showAddForm = false
      this.editMode = false
      this.editingId = null
      this.resetForm()
    },
    resetForm() {
      this.form = {
        name: '', role: '同事', context: '', traitsStr: '', preferencesStr: '',
        relationship_score: 5, notes: ''
      }
      this.roleIndex = 0
      this.selectedTpl = ''
    },
    applyTemplate(tpl) {
      this.selectedTpl = tpl.role
      this.form.role = tpl.role
      this.form.context = tpl.context
      this.form.traitsStr = tpl.traits
      this.form.preferencesStr = tpl.preferences
      this.form.relationship_score = tpl.score
      this.form.notes = tpl.notes
      const idx = this.roles.indexOf(tpl.role)
      if (idx >= 0) this.roleIndex = idx
    },
    goDetail(id) {
      uni.navigateTo({ url: `/pages/settings/sub/relation-detail?id=${id}` })
    },
    scoreClass(score) {
      if (score >= 8) return 'score-high'
      if (score >= 5) return 'score-mid'
      return 'score-low'
    },
    loadMore() { /* 已全部加载 */ }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; background: #F4F4F5; }

.stats-bar {
  display: flex; justify-content: space-around;
  padding: 32rpx 24rpx; background: #FFFFFF;
  border-bottom: 1rpx solid #E4E4E7;
}
.stat-item { display: flex; flex-direction: column; align-items: center; }
.stat-num { font-size: 40rpx; font-weight: 700; color: #000000; }
.stat-label { font-size: 24rpx; color: #71717A; margin-top: 4rpx; }

.search-bar { padding: 20rpx 24rpx; background: #FFFFFF; }
.search-input {
  width: 100%; height: 72rpx; padding: 0 24rpx;
  background: #F4F4F5; border-radius: 36rpx;
  font-size: 28rpx; color: #18181B;
}

.list-area { height: calc(100vh - 320rpx); padding: 16rpx 24rpx; }

.empty { display: flex; flex-direction: column; align-items: center; padding-top: 200rpx; }
.empty-icon { font-size: 80rpx; margin-bottom: 24rpx; }
.empty-text { font-size: 32rpx; color: #71717A; }
.empty-hint { font-size: 26rpx; color: #A1A1AA; margin-top: 8rpx; }

.relation-card {
  background: #FFFFFF; border-radius: 24rpx; padding: 28rpx;
  margin-bottom: 16rpx;
}
.card-header { display: flex; align-items: center; }
.avatar {
  width: 72rpx; height: 72rpx; border-radius: 50%;
  background: #18181B; color: #FFFFFF;
  font-size: 32rpx; font-weight: 600;
  display: flex; align-items: center; justify-content: center;
}
.info { flex: 1; margin-left: 20rpx; }
.name { font-size: 32rpx; font-weight: 600; color: #18181B; display: block; }
.role { font-size: 26rpx; color: #71717A; margin-top: 4rpx; }
.score-badge {
  width: 48rpx; height: 48rpx; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 26rpx; font-weight: 700;
}
.score-high { background: #000000; color: #FFFFFF; }
.score-mid { background: #E4E4E7; color: #3F3F46; }
.score-low { background: #F4F4F5; color: #A1A1AA; }

.card-context { font-size: 26rpx; color: #52525B; margin-top: 16rpx; }
.card-tags { display: flex; flex-wrap: wrap; margin-top: 12rpx; gap: 8rpx; }
.tag {
  font-size: 22rpx; padding: 4rpx 16rpx;
  background: #F4F4F5; color: #52525B; border-radius: 8rpx;
}

.card-actions {
  display: flex; justify-content: flex-end; gap: 24rpx;
  margin-top: 16rpx; padding-top: 16rpx;
  border-top: 1rpx solid #F4F4F5;
}
.action-btn {
  display: flex; align-items: center; gap: 6rpx;
  padding: 8rpx 20rpx; border-radius: 12rpx;
  background: #F4F4F5;
}
.action-icon { font-size: 24rpx; }
.action-text { font-size: 24rpx; color: #52525B; }

.fab {
  position: fixed; right: 40rpx; bottom: 80rpx;
  width: 96rpx; height: 96rpx; border-radius: 50%;
  background: #000000; color: #FFFFFF;
  font-size: 56rpx; line-height: 96rpx; text-align: center;
  box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.2);
}

.modal-mask {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: flex-end; z-index: 1000;
}
.modal-content {
  width: 100%; max-height: 80vh; overflow-y: auto;
  background: #FFFFFF; border-radius: 32rpx 32rpx 0 0;
  padding: 40rpx 32rpx;
}
.modal-title { font-size: 36rpx; font-weight: 700; color: #18181B; display: block; margin-bottom: 32rpx; }
.form-item { margin-bottom: 24rpx; }
.form-label { font-size: 26rpx; color: #71717A; display: block; margin-bottom: 8rpx; }
.form-input {
  width: 100%; height: 80rpx; padding: 0 24rpx;
  background: #F4F4F5; border-radius: 16rpx;
  font-size: 28rpx; color: #18181B; line-height: 80rpx;
}
.form-textarea {
  width: 100%; min-height: 120rpx; padding: 16rpx 24rpx;
  background: #F4F4F5; border-radius: 16rpx;
  font-size: 28rpx; color: #18181B;
}
.modal-actions { display: flex; gap: 24rpx; margin-top: 32rpx; }
.btn-cancel, .btn-confirm {
  flex: 1; height: 88rpx; border-radius: 16rpx;
  font-size: 30rpx; font-weight: 600; border: none;
}
.btn-cancel { background: #F4F4F5; color: #71717A; }
.btn-confirm { background: #000000; color: #FFFFFF; }

/* 模板快选 */
.tpl-section { margin-bottom: 32rpx; }
.tpl-title { font-size: 26rpx; color: #71717A; display: block; margin-bottom: 16rpx; }
.tpl-grid { display: flex; flex-wrap: wrap; gap: 16rpx; }
.tpl-card {
  width: calc(33.33% - 12rpx);
  padding: 20rpx 12rpx;
  background: #F4F4F5; border-radius: 16rpx;
  border: 2rpx solid transparent;
  display: flex; flex-direction: column; align-items: center; gap: 6rpx;
  box-sizing: border-box;
}
.tpl-card.active { border-color: #000000; background: #FFFFFF; }
.tpl-icon-wrap { width: 56rpx; height: 56rpx; border-radius: 50%; background: #FFFFFF; display: flex; align-items: center; justify-content: center; }
.tpl-card.active .tpl-icon-wrap { background: #000000; }
.tpl-icon { font-size: 28rpx; }
.tpl-name { font-size: 24rpx; font-weight: 600; color: #18181B; }
.tpl-hint { font-size: 20rpx; color: #A1A1AA; }
</style>
