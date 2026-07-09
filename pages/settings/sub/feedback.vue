<script setup>
/**
 * 体验反馈 — 主页面（历史列表）
 *
 * 功能：
 *  ① 反馈统计概览
 *  ② 历史反馈列表（编辑/删除）
 *  ③ 点击「添加反馈」跳转到反馈表孙子页面
 *  ④ 点击「编辑」跳转到反馈表单页（带参数）
 */
import SijiIcon from '@/components/common/SijiIcon.vue'
import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getFeedbackList, deleteFeedback, getFeedbackStats } from '@/utils/storage.js'

const feedbackList = ref([])
const stats = ref({ total: 0, avgRating: '0.0', categoryMap: {} })

const categories = [
  { label: '功能建议', icon: '💡', color: '#000000' },
  { label: 'Bug反馈', icon: '🐛', color: '#EF4444' },
  { label: '体验感受', icon: '💬', color: '#3B82F6' },
  { label: '功能需求', icon: '✨', color: '#10B981' }
]

function loadAll() {
  feedbackList.value = getFeedbackList()
  stats.value = getFeedbackStats()
}

function goNew() {
  uni.navigateTo({ url: '/pages/settings/sub/feedback-new' })
}

function goEdit(item) {
  uni.navigateTo({
    url: `/pages/settings/sub/feedback-new?id=${encodeURIComponent(item.client_id)}`
  })
}

function handleDelete(clientId) {
  uni.showModal({
    title: '删除反馈',
    content: '确定删除这条反馈吗？',
    success(res) {
      if (res.confirm) {
        deleteFeedback(clientId)
        loadAll()
        uni.showToast({ title: '已删除', icon: 'none' })
      }
    }
  })
}

onMounted(() => {
  loadAll()
})

onShow(() => {
  loadAll()
})

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function getCategoryStyle(cat) {
  const item = categories.find(c => c.label === cat)
  return item ? { color: item.color, borderColor: item.color } : { color: '#000', borderColor: '#000' }
}
</script>

<template>
  <view class="feedback-page">
    <!-- 统计概览 -->
    <view class="stats-card">
      <view class="stats-row">
        <view class="stat-item">
          <text class="stat-num">{{ stats.total }}</text>
          <text class="stat-label">总反馈</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat-item">
          <text class="stat-num">{{ stats.avgRating }}</text>
          <text class="stat-label">平均评分</text>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-if="feedbackList.length === 0" class="empty-state">
      <SijiIcon name="mail" size="xl" class="empty-icon" />
      <text class="empty-title">还没有反馈记录</text>
      <text class="empty-desc">点击下方按钮，告诉我们你的想法</text>
    </view>

    <!-- 历史反馈列表 -->
    <view v-else class="history-section">
      <text class="section-title">历史反馈</text>
      <view class="history-list">
        <view v-for="item in feedbackList" :key="item.client_id" class="history-item">
          <view class="history-header">
            <text class="history-category" :style="getCategoryStyle(item.category)">{{ item.category }}</text>
            <text class="history-rating">{{ '★'.repeat(item.rating) }}{{ '☆'.repeat(5 - item.rating) }}</text>
            <text class="history-date">{{ formatDate(item.created_at) }}</text>
          </view>
          <text class="history-content">{{ item.content }}</text>
          <view v-if="item.contact" class="history-contact">
            <text class="contact-label">联系方式：</text>
            <text class="contact-value">{{ item.contact }}</text>
          </view>
          <view class="history-actions">
            <text class="edit-btn" @tap="goEdit(item)">编辑</text>
            <text class="delete-btn" @tap="handleDelete(item.client_id)">删除</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 底部添加按钮 -->
    <view class="fab-row">
      <button class="fab-btn" @tap="goNew">
        <text class="fab-icon">+</text>
        <text class="fab-text">添加反馈</text>
      </button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.feedback-page {
  min-height: 100vh;
  background: var(--bg-primary, #FFFFFF);
  padding: 24rpx;
  padding-bottom: 180rpx;
  box-sizing: border-box;
}

/* 统计卡片 */
.stats-card {
  background: var(--bg-card, #F5F5F5);
  border-radius: 20rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-sizing: border-box;
  overflow: hidden;
}

.stats-row {
  display: flex;
  align-items: center;
  justify-content: space-around;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-num {
  font-size: 44rpx;
  font-weight: 700;
  color: var(--text-primary, #000000);
}

.stat-label {
  font-size: 24rpx;
  color: var(--text-secondary, #999999);
  margin-top: 8rpx;
}

.stat-divider {
  width: 2rpx;
  height: 60rpx;
  background: var(--border-color, #E5E5E5);
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 40rpx;
}

.empty-icon {
  font-size: 80rpx;
  margin-bottom: 24rpx;
}

.empty-title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-primary, #000000);
  margin-bottom: 12rpx;
}

.empty-desc {
  font-size: 26rpx;
  color: var(--text-secondary, #999999);
}

/* 历史列表 */
.history-section {
  margin-top: 16rpx;
}

.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-primary, #000000);
  margin-bottom: 16rpx;
  display: block;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.history-item {
  background: var(--bg-card, #F5F5F5);
  border-radius: 16rpx;
  padding: 24rpx;
  box-sizing: border-box;
  overflow: hidden;
}

.history-header {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 12rpx;
  flex-wrap: wrap;
}

.history-category {
  font-size: 24rpx;
  padding: 4rpx 16rpx;
  border-radius: 8rpx;
  border: 2rpx solid;
}

.history-rating {
  font-size: 24rpx;
  color: var(--text-primary);
}

.history-date {
  font-size: 24rpx;
  color: var(--text-tertiary, #CCCCCC);
  margin-left: auto;
}

.history-content {
  font-size: 28rpx;
  color: var(--text-primary, #000000);
  line-height: 1.6;
}

.history-contact {
  margin-top: 8rpx;
  display: flex;
  align-items: center;
}

.contact-label {
  font-size: 24rpx;
  color: var(--text-tertiary, #CCCCCC);
}

.contact-value {
  font-size: 24rpx;
  color: var(--text-secondary, #666666);
}

.history-actions {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
  margin-top: 12rpx;
}

.edit-btn {
  font-size: 24rpx;
  color: var(--text-secondary, #666666);
  padding: 8rpx 16rpx;
}

.edit-btn:active {
  color: var(--text-primary, #000000);
}

.delete-btn {
  font-size: 24rpx;
  color: var(--text-tertiary, #999999);
  padding: 8rpx 16rpx;
}

/* 底部添加按钮 */
.fab-row {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 24rpx 32rpx;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
  background: var(--bg-card, #FFFFFF);
  border-top: 1rpx solid var(--border-color, #E5E5E5);
}

.fab-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  width: 100%;
  height: 88rpx;
  background: var(--color-ai);
  color: var(--text-on-ai);
  font-size: 30rpx;
  font-weight: 600;
  border-radius: 16rpx;
  border: none;
  box-sizing: border-box;
  padding: 0;
}

.fab-btn:active {
  opacity: 0.85;
}

.fab-icon {
  font-size: 36rpx;
  font-weight: 400;
}

.fab-text {
  font-size: 30rpx;
}
</style>
