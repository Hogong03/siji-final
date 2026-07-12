<template>
  <view class="page">
    <view v-if="decision" class="detail-content">
      <!-- 头部 -->
      <view class="hero">
        <text class="hero-title">{{ decision.title }}</text>
        <view class="hero-meta">
          <text class="meta-category">{{ decision.category }}</text>
          <text class="status-badge" :class="'status-' + decision.status">{{ statusLabel(decision.status) }}</text>
        </view>
        <text v-if="decision.deadline" class="hero-deadline">截止：{{ decision.deadline }}</text>
        <text v-if="decision.emotion" class="hero-emotion">当时情绪：{{ decision.emotion }}</text>
      </view>

      <!-- 选项分析 -->
      <view v-if="decision.options && decision.options.length > 0" class="section">
        <text class="section-title">选项分析</text>
        <view v-for="opt in decision.options" :key="opt.name" class="option-item">
          <view class="option-header">
            <text class="option-name">{{ opt.name }}</text>
            <view class="weight-bar">
              <view class="weight-fill" :style="{ width: (opt.weight * 10) + '%' }"></view>
            </view>
            <text class="weight-num">{{ opt.weight }}</text>
          </view>
          <view v-if="opt.pros && opt.pros.length > 0" class="pros-cons">
            <text class="pc-label">优势：</text>
            <text class="pc-text">{{ opt.pros.join('、') }}</text>
          </view>
          <view v-if="opt.cons && opt.cons.length > 0" class="pros-cons">
            <text class="pc-label">劣势：</text>
            <text class="pc-text">{{ opt.cons.join('、') }}</text>
          </view>
        </view>
      </view>

      <!-- 利益相关方 -->
      <view v-if="decision.stakeholders && decision.stakeholders.length > 0" class="section">
        <text class="section-title">利益相关方</text>
        <view class="tag-wrap">
          <text v-for="s in decision.stakeholders" :key="s" class="tag">{{ s }}</text>
        </view>
      </view>

      <!-- 考虑因素 -->
      <view v-if="decision.factors && decision.factors.length > 0" class="section">
        <text class="section-title">考虑因素</text>
        <view class="tag-wrap">
          <text v-for="f in decision.factors" :key="f" class="tag tag-alt">{{ f }}</text>
        </view>
      </view>

      <!-- 最终决定 -->
      <view v-if="decision.decision" class="section section-decision">
        <text class="section-title">最终决定</text>
        <text class="decision-text">{{ decision.decision }}</text>
        <text v-if="decision.reasoning" class="decision-reasoning">{{ decision.reasoning }}</text>
      </view>

      <!-- 复盘 -->
      <view v-if="decision.review_notes" class="section section-review">
        <text class="section-title">复盘</text>
        <text class="review-text">{{ decision.review_notes }}</text>
      </view>

      <!-- 操作按钮 -->
      <view class="actions">
        <button v-if="decision.status === 'thinking'" class="btn-action" @tap="showDecideForm = true">记录决定</button>
        <button v-if="decision.status === 'decided' && !decision.review_notes" class="btn-action" @tap="showReviewForm = true">复盘</button>
        <button class="btn-action btn-danger" @tap="handleDelete">删除</button>
      </view>
    </view>

    <view v-else class="empty"><text>决策记录不存在</text></view>

    <!-- 记录决定弹窗 -->
    <view v-if="showDecideForm" class="modal-mask" @tap="showDecideForm = false">
      <view class="modal-content" @tap.stop>
        <text class="modal-title">记录决定</text>
        <view class="form-item">
          <text class="form-label">你的决定</text>
          <input v-model="decideForm.decision" class="form-input" placeholder="如：接受offer" />
        </view>
        <view class="form-item">
          <text class="form-label">决策理由</text>
          <textarea v-model="decideForm.reasoning" class="form-textarea" placeholder="为什么这样决定..." />
        </view>
        <view class="modal-actions">
          <button class="btn-cancel" @tap="showDecideForm = false">取消</button>
          <button class="btn-confirm" @tap="handleDecide">确认</button>
        </view>
      </view>
    </view>

    <!-- 复盘弹窗 -->
    <view v-if="showReviewForm" class="modal-mask" @tap="showReviewForm = false">
      <view class="modal-content" @tap.stop>
        <text class="modal-title">决策复盘</text>
        <view class="form-item">
          <text class="form-label">结果如何？</text>
          <input v-model="reviewForm.outcome" class="form-input" placeholder="如：顺利、后悔、有待观察" />
        </view>
        <view class="form-item">
          <text class="form-label">复盘笔记</text>
          <textarea v-model="reviewForm.review_notes" class="form-textarea" placeholder="回头看，哪些做对了？哪些可以更好？" />
        </view>
        <view class="modal-actions">
          <button class="btn-cancel" @tap="showReviewForm = false">取消</button>
          <button class="btn-confirm" @tap="handleReview">保存复盘</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { getDecisionById, updateDecision, deleteDecision, reviewDecision } from '@/utils/decisions.js'

const decisionId = ref('')
const decision = ref(null)
const showDecideForm = ref(false)
const showReviewForm = ref(false)
const decideForm = ref({ decision: '', reasoning: '' })
const reviewForm = ref({ outcome: '', review_notes: '' })

onLoad((options) => {
  decisionId.value = options.id || ''
  loadData()
})

onShow(() => { loadData() })

function loadData() {
  decision.value = getDecisionById(decisionId.value)
}

function statusLabel(status) {
  const map = { thinking: '思考中', decided: '已决定', acted: '已行动', reviewed: '已复盘', abandoned: '已放弃' }
  return map[status] || status
}

function handleDecide() {
  if (!decideForm.value.decision.trim()) {
    uni.showToast({ title: '请输入决定', icon: 'none' })
    return
  }
  updateDecision(decisionId.value, {
    status: 'decided',
    decision: decideForm.value.decision.trim(),
    reasoning: decideForm.value.reasoning.trim()
  })
  uni.showToast({ title: '已记录', icon: 'success' })
  showDecideForm.value = false
  loadData()
}

function handleReview() {
  if (!reviewForm.value.review_notes.trim()) {
    uni.showToast({ title: '请输入复盘', icon: 'none' })
    return
  }
  reviewDecision(decisionId.value, reviewForm.value.review_notes.trim(), reviewForm.value.outcome.trim())
  uni.showToast({ title: '复盘已保存', icon: 'success' })
  showReviewForm.value = false
  loadData()
}

function handleDelete() {
  uni.showModal({
    title: '确认删除',
    content: '确定要删除这条决策记录吗？',
    success: (res) => {
      if (res.confirm) {
        deleteDecision(decisionId.value)
        uni.showToast({ title: '已删除', icon: 'success' })
        setTimeout(() => uni.navigateBack(), 800)
      }
    }
  })
}
</script>

<style scoped>
.page { min-height: 100vh; background: #F4F4F5; }
.detail-content { padding: 24rpx; }

.hero {
  background: #FFFFFF; border-radius: 24rpx; padding: 32rpx; margin-bottom: 16rpx;
}
.hero-title { font-size: 36rpx; font-weight: 700; color: #18181B; display: block; }
.hero-meta { display: flex; align-items: center; gap: 16rpx; margin-top: 16rpx; }
.meta-category { font-size: 24rpx; color: #71717A; }
.status-badge { font-size: 22rpx; padding: 4rpx 16rpx; border-radius: 8rpx; }
.status-thinking { background: #FEF3C7; color: #92400E; }
.status-decided { background: #DBEAFE; color: #1E40AF; }
.status-acted { background: #D1FAE5; color: #065F46; }
.status-reviewed { background: #F4F4F5; color: #52525B; }
.status-abandoned { background: #FEE2E2; color: #991B1B; }
.hero-deadline, .hero-emotion { font-size: 26rpx; color: #71717A; margin-top: 12rpx; display: block; }

.section {
  background: #FFFFFF; border-radius: 24rpx; padding: 28rpx; margin-bottom: 16rpx;
}
.section-title { font-size: 28rpx; font-weight: 600; color: #18181B; }

.option-item { padding: 20rpx 0; border-bottom: 1rpx solid #F4F4F5; }
.option-item:last-child { border-bottom: none; }
.option-header { display: flex; align-items: center; }
.option-name { font-size: 28rpx; font-weight: 600; color: #18181B; flex: 1; }
.weight-bar { width: 160rpx; height: 8rpx; background: #F4F4F5; border-radius: 4rpx; margin: 0 16rpx; }
.weight-fill { height: 100%; background: #000000; border-radius: 4rpx; }
.weight-num { font-size: 24rpx; color: #71717A; width: 32rpx; text-align: right; }
.pros-cons { margin-top: 8rpx; }
.pc-label { font-size: 24rpx; color: #71717A; }
.pc-text { font-size: 24rpx; color: #3F3F46; }

.tag-wrap { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 16rpx; }
.tag { font-size: 24rpx; padding: 6rpx 20rpx; background: #F4F4F5; color: #3F3F46; border-radius: 12rpx; }
.tag-alt { background: #FAFAFA; color: #52525B; }

.section-decision { background: #FAFAFA; }
.decision-text { font-size: 32rpx; font-weight: 600; color: #18181B; margin-top: 16rpx; display: block; }
.decision-reasoning { font-size: 26rpx; color: #52525B; margin-top: 12rpx; line-height: 1.6; }

.section-review { background: #FEFCE8; }
.review-text { font-size: 28rpx; color: #3F3F46; margin-top: 16rpx; line-height: 1.6; }

.actions { display: flex; gap: 24rpx; margin-top: 24rpx; }
.btn-action {
  flex: 1; height: 88rpx; border-radius: 16rpx; font-size: 30rpx; font-weight: 600; border: none;
  background: #18181B; color: #FFFFFF;
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
.btn-cancel { background: #F4F4F5; color: #71717A; }
.btn-confirm { background: #000000; color: #FFFFFF; }
</style>
