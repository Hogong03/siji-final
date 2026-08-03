<script setup>
/**
 * 历史反馈列表页
 *
 * 功能：
 *  ① 展示所有已提交的反馈（按时间倒序）
 *  ② 统计概览（总数、平均评分、分类分布）
 *  ③ 点击进入编辑（跳转 feedback-new.vue?id=xxx）
 *  ④ 长按删除（确认弹窗）
 *  ⑤ FAB 新建反馈
 */

import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getFeedbackList, deleteFeedback, getFeedbackStats } from '@/utils/storage.js'

const list = ref([])
const stats = ref({ total: 0, avgRating: '0.0', categoryMap: {} })

function loadData() {
  list.value = getFeedbackList()
  stats.value = getFeedbackStats()
}
onShow(loadData)

// 分类配置
const categoryConfig = {
  '功能建议': { icon: '💡', color: '#18181B' },
  'Bug反馈': { icon: '🐛', color: '#EF4444' },
  '体验感受': { icon: '💬', color: '#3B82F6' },
  '功能需求': { icon: '✨', color: '#10B981' }
}

const categoryKeys = computed(() => Object.keys(stats.value.categoryMap || {}))

function fmtDate(ts) {
  const d = new Date(ts)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function preview(text, maxLen = 50) {
  if (!text) return '（无内容）'
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text
}

function goEdit(item) {
  uni.navigateTo({ url: `/pages/settings/sub/feedback-new?id=${encodeURIComponent(item.client_id)}` })
}

function goAdd() {
  uni.navigateTo({ url: '/pages/settings/sub/feedback-new' })
}

function handleDelete(item) {
  uni.showModal({
    title: '删除反馈',
    content: '确定要删除这条反馈吗？此操作不可恢复。',
    confirmText: '删除',
    confirmColor: '#EF4444',
    success: (res) => {
      if (res.confirm) {
        deleteFeedback(item.client_id)
        loadData()
        uni.showToast({ title: '已删除', icon: 'success' })
      }
    }
  })
}
</script>

<template>
  <view class="feedback-page">
    <!-- 统计概览 -->
    <view class="stats-bar">
      <view class="stat-item">
        <text class="stat-num">{{ stats.total }}</text>
        <text class="stat-label">条反馈</text>
      </view>
      <view class="stat-item">
        <text class="stat-num">{{ stats.avgRating }}</text>
        <text class="stat-label">平均分</text>
      </view>
      <view class="stat-item" v-for="key in categoryKeys" :key="key">
        <text class="stat-num">{{ stats.categoryMap[key] }}</text>
        <text class="stat-label">{{ key }}</text>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-if="list.length === 0" class="empty-state">
      <text class="empty-icon">📝</text>
      <text class="empty-title">还没有反馈</text>
      <text class="empty-desc">点击右下角 + 按钮添加第一条反馈</text>
    </view>

    <!-- 反馈列表 -->
    <view v-else class="feedback-list">
      <view
        v-for="item in list"
        :key="item.client_id"
        class="feedback-card"
        @tap="goEdit(item)"
        @longpress="handleDelete(item)"
      >
        <view class="card-header">
          <view class="card-category" :style="{ color: (categoryConfig[item.category] || {}).color || '#18181B' }">
            <text>{{ (categoryConfig[item.category] || {}).icon || '📌' }}</text>
            <text>{{ item.category || '其他' }}</text>
          </view>
          <text class="card-date">{{ fmtDate(item.created_at) }}</text>
        </view>

        <view class="card-stars">
          <text v-for="s in 5" :key="s" class="star" :class="{ active: s <= (item.rating || 0) }">
            {{ s <= (item.rating || 0) ? '★' : '☆' }}
          </text>
        </view>

        <text class="card-content">{{ preview(item.content) }}</text>

        <view v-if="item.contact" class="card-contact">
          <text class="contact-label">联系方式：</text>
          <text class="contact-value">{{ item.contact }}</text>
        </view>

        <view v-if="item.updated_at" class="card-edited">
          <text>已编辑 · {{ fmtDate(item.updated_at) }}</text>
        </view>
      </view>
    </view>

    <!-- 底部安全区占位 -->
    <view class="bottom-spacer" />

    <!-- FAB 新建 -->
    <view class="fab" @tap="goAdd">
      <text class="fab-icon">+</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import './feedback-list.scss';
</style>
