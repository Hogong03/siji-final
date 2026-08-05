<script setup>
/**
 * 体验反馈 — 添加/编辑表单页（子页面）
 *
 * 功能：
 *  ① 评分（1-5 星）
 *  ② 分类选择（功能建议 / Bug反馈 / 体验感受 / 功能需求）
 *  ③ 文字反馈
 *  ④ 联系方式（可选）
 *  ⑤ 提交时同步到管理后台（失败则本地缓存，不影响用户体验）
 *  ⑥ 编辑模式：从主页面带 id 参数进入，回填表单
 */

import SijiIcon from '@/components/common/SijiIcon.vue'
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { saveFeedback, updateFeedback, getFeedbackList } from '@/utils/storage.js'
import { useAppStore } from '@/store/index.js'
import { safeNavigateBack } from '@/utils/nav-helper.js'

// 管理后台 API 地址
import { FEEDBACK_URL } from '@/config/endpoints.js'
const SERVER_BASE = FEEDBACK_URL

// 分类映射：本地分类 → 远程 type
const CATEGORY_TO_TYPE = {
  '功能建议': 'suggestion',
  'Bug反馈': 'bug',
  '体验感受': 'feedback',
  '功能需求': 'suggestion'
}

const content = ref('')
const contact = ref('')
const rating = ref(5)
const category = ref('功能建议')
const submitting = ref(false)

// 编辑模式
const editingId = ref(null)
const isEditing = computed(() => !!editingId.value)

const categories = [
  { label: '功能建议', icon: '💡', color: '#000000' },
  { label: 'Bug反馈', icon: '🐛', color: '#DC2626' },
  { label: '体验感受', icon: '💬', color: '#3B82F6' },
  { label: '功能需求', icon: '✨', color: '#059669' }
]

onLoad((options) => {
  if (options && options.id) {
    const id = decodeURIComponent(options.id)
    const list = getFeedbackList()
    const item = list.find(f => f.client_id === id)
    if (item) {
      editingId.value = id
      content.value = item.content || ''
      contact.value = item.contact || ''
      rating.value = item.rating || 5
      category.value = item.category || '功能建议'
      uni.setNavigationBarTitle({ title: '编辑反馈' })
    } else {
      uni.showToast({ title: '反馈不存在', icon: 'none' })
      setTimeout(() => safeNavigateBack(), 500)
    }
  } else {
    uni.setNavigationBarTitle({ title: '添加反馈' })
  }
})

function selectCategory(cat) {
  category.value = cat
}

async function handleSubmit() {
  if (!content.value.trim()) {
    uni.showToast({ title: '请输入反馈内容', icon: 'none' })
    return
  }
  if (submitting.value) return
  submitting.value = true

  const isUpdate = !!editingId.value

  // 1. 保存到本地（更新或新建）
  if (isUpdate) {
    updateFeedback(editingId.value, {
      rating: rating.value,
      category: category.value,
      content: content.value.trim(),
      contact: contact.value.trim()
    })
  } else {
    saveFeedback({
      rating: rating.value,
      category: category.value,
      content: content.value.trim(),
      contact: contact.value.trim()
    })
  }

  // 2. 异步提交到管理后台（失败不阻断）
  try {
    const store = useAppStore()
    const appVersion = '1.2.0'
    let platform = 'unknown'
    try {
      const sysInfo = uni.getSystemInfoSync()
      platform = sysInfo.platform || 'unknown'
    } catch (e) { /* ignore */ }

    const deviceId = store.deviceId || 'unknown'

    // 2a. 先确保设备已注册到后端（幂等）
    await new Promise((resolve, reject) => {
      uni.request({
        url: `${SERVER_BASE}/api/register`,
        method: 'POST',
        header: { 'Content-Type': 'application/json' },
        data: { device_id: deviceId, nickname: '思迹用户' },
        timeout: 5000,
        success: (res) => {
          if (res.statusCode === 200) resolve(res.data)
          else reject(new Error(`注册 HTTP ${res.statusCode}`))
        },
        fail: (err) => reject(err)
      })
    })

    // 2b. 提交反馈
    await new Promise((resolve, reject) => {
      uni.request({
        url: `${SERVER_BASE}/api/feedback`,
        method: 'POST',
        header: { 'Content-Type': 'application/json' },
        data: {
          device_id: deviceId,
          type: CATEGORY_TO_TYPE[category.value] || 'other',
          content: `${content.value.trim()}${rating.value > 0 ? ' [评分:' + rating.value + '星]' : ''}${isUpdate ? ' [已编辑]' : ''}`,
          contact: contact.value.trim() || undefined,
          app_version: appVersion,
          platform
        },
        timeout: 5000,
        success: (res) => {
          if (res.statusCode === 200) resolve(res.data)
          else reject(new Error(`HTTP ${res.statusCode}`))
        },
        fail: (err) => reject(err)
      })
    })
    uni.showToast({ title: isUpdate ? '已更新！' : '感谢反馈！', icon: 'success' })
  } catch (err) {
    console.warn('[feedback] 远程提交失败，已保存本地:', err.message)
    uni.showToast({ title: isUpdate ? '已更新！' : '感谢反馈！', icon: 'success' })
  }

  submitting.value = false
  setTimeout(() => safeNavigateBack(), 800)
}

function handleCancel() {
  safeNavigateBack()
}
</script>

<template>
  <view class="feedback-form-page">
    <!-- 编辑提示 -->
    <view v-if="isEditing" class="edit-banner">
      <text class="edit-banner-text">正在编辑反馈</text>
    </view>

    <!-- 评分 -->
    <view class="section">
      <text class="section-title">评分</text>
      <view class="rating-row">
        <view
          v-for="star in 5"
          :key="star"
          class="star"
          :class="{ active: star <= rating }"
          @tap="rating = star"
        >
          <text class="star-icon">{{ star <= rating ? '★' : '☆' }}</text>
        </view>
        <text class="rating-text">{{ rating }}星</text>
      </view>
    </view>

    <!-- 分类选择 -->
    <view class="section">
      <text class="section-title">分类</text>
      <view class="category-row">
        <view
          v-for="cat in categories"
          :key="cat.label"
          class="category-chip"
          :class="{ active: category === cat.label }"
          @tap="selectCategory(cat.label)"
        >
          <text class="cat-icon">{{ cat.icon }}</text>
          <text class="cat-label">{{ cat.label }}</text>
        </view>
      </view>
    </view>

    <!-- 反馈内容 -->
    <view class="section">
      <text class="section-title">反馈内容</text>
      <textarea
        v-model="content"
        class="feedback-input"
        placeholder="请详细描述您的建议或问题..."
        maxlength="500"
        :auto-height="true"
      />
      <text class="char-count">{{ content.length }}/500</text>
    </view>

    <!-- 联系方式 -->
    <view class="section">
      <text class="section-title">联系方式（可选）</text>
      <input
        v-model="contact"
        class="contact-input"
        placeholder="邮箱或手机号，方便我们回复您"
        maxlength="50"
      />
    </view>

    <!-- 提交按钮 -->
    <view class="submit-row">
      <button class="submit-btn" :disabled="submitting" @tap="handleSubmit">
        {{ submitting ? '提交中...' : (isEditing ? '更新反馈' : '提交反馈') }}
      </button>
      <button class="cancel-btn" @tap="handleCancel">取消</button>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import './feedback-new.scss';
</style>