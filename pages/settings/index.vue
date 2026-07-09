<script setup>
/**
 * 设置页 — 入口枢纽
 * 主页仅显示当前 AI 厂商/模型摘要，详细配置在子页面
 */
import SijiIcon from '@/components/common/SijiIcon.vue'
import { onShow } from '@dcloudio/uni-app'
import { ref, computed } from 'vue'
import { useAppStore } from '@/store/index.js'
import { AI_PROVIDERS } from '@/utils/api.js'
import { getQueueLength } from '@/utils/sync.js'
import { hasPin } from '@/utils/pin.js'
import { getFeedbackStats } from '@/utils/storage.js'
import { isMemoryEnabled } from '@/utils/memory.js'
import { getProfile, getFilledCount } from '@/utils/profile.js'

const store = useAppStore()

/* ---- AI 摘要 ---- */
const currentProvider = computed(() => AI_PROVIDERS[store.aiProvider] || AI_PROVIDERS.deepseek)
const currentModel = computed(() => currentProvider.value.models?.find(m => m.id === store.aiModel))
const hasKey = computed(() => !!store.providerKeys[store.aiProvider])

/* ---- 列表项状态 ---- */
const syncQueueLen = ref(0)
const pinStatus = computed(() => hasPin() ? '已开启' : '未开启')
const fbStats = ref({ total: 0, avgRating: '0.0', categoryMap: {} })
const memoryEnabled = ref(true)
const profileEnabled = ref(false)
const profileFilled = ref(0)


onShow(() => {
  syncQueueLen.value = getQueueLength()
  fbStats.value = getFeedbackStats()
  memoryEnabled.value = isMemoryEnabled()
  const p = getProfile()
  profileEnabled.value = p.enabled
  profileFilled.value = getFilledCount()
})

/* ---- 导航 ---- */
function navTo(target) {
  const routes = {
    ai: '/pages/settings/sub/ai',
    agent: '/pages/settings/sub/agent',
    profile: '/pages/settings/sub/profile',
    data: '/pages/settings/sub/data',
    privacy: '/pages/settings/sub/privacy',
    memory: '/pages/settings/sub/memory',
    feedback: '/pages/settings/sub/feedback',
    about: '/pages/settings/sub/about'
  }
  uni.navigateTo({ url: routes[target] })
}
</script>

<template>
  <view class="settings-page">
    <scroll-view class="settings-scroll" scroll-y>
      <!-- ===== Section: AI 与个性化 ===== -->
      <text class="section-title">AI 与个性化</text>

      <!-- ===== AI 配置摘要卡 ===== -->
      <view class="ai-card" @tap="navTo('ai')">
        <view class="ai-card-header">
          <view class="ai-brand" :style="{ background: currentProvider.color }">
            <text class="ai-brand-short">{{ currentProvider.short }}</text>
          </view>
          <view class="ai-info">
            <text class="ai-name">{{ currentProvider.name }}</text>
            <text class="ai-model">{{ currentModel?.tag }} {{ currentModel?.name || store.aiModel }}</text>
          </view>
          <view class="ai-status">
            <view class="status-dot" :class="hasKey ? 'ok' : 'warn'" />
            <text class="status-text">{{ hasKey ? '已配置' : '未配置' }}</text>
          </view>
          <text class="ai-arrow">›</text>
        </view>
      </view>

      <!-- ===== Agent 管理卡 ===== -->
      <view class="agent-card" @tap="navTo('agent')">
        <view class="agent-avatar-sm">{{ store.activeAgent.avatar }}</view>
        <view class="agent-info">
          <text class="agent-name-sm">Agent 管理</text>
          <text class="agent-desc-sm">当前: {{ store.activeAgent.name }}{{ store.agents.length > 1 ? ' · 共 ' + store.agents.length + ' 个' : '' }}</text>
        </view>
        <text class="ai-arrow">›</text>
      </view>

      <!-- ===== 我的信息卡 ===== -->
      <view class="agent-card profile-card" :class="{ 'profile-on': profileEnabled, 'profile-off': !profileEnabled }" @tap="navTo('profile')">
        <view class="agent-avatar-sm">
          <SijiIcon v-if="profileEnabled" name="check" size="sm" color="var(--text-primary)" />
          <SijiIcon v-else name="user" size="sm" color="var(--text-tertiary)" />
        </view>
        <view class="agent-info">
          <text class="agent-name-sm">我的信息</text>
          <text class="agent-desc-sm">{{ profileEnabled ? `已开启 · 填写 ${profileFilled} 项` : '未开启 · 点击开启' }}</text>
        </view>
        <text class="ai-arrow">›</text>
      </view>

      <view class="settings-list">
        <view class="list-item" @tap="navTo('memory')">
          <SijiIcon name="brain" size="md" class="item-icon" />
          <view class="item-body">
            <text class="item-label">记忆管理</text>
          </view>
          <text class="item-value">{{ memoryEnabled ? '已开启' : '已关闭' }}</text>
          <text class="item-arrow">›</text>
        </view>
      </view>

      <!-- ===== Section: 数据与隐私 ===== -->
      <text class="section-title">数据与隐私</text>
      <view class="settings-list">
        <view class="list-item" @tap="navTo('data')">
          <SijiIcon name="sync" size="md" class="item-icon" />
          <view class="item-body">
            <text class="item-label">数据同步与导出</text>
          </view>
          <text class="item-value">{{ syncQueueLen > 0 ? '待同步: ' + syncQueueLen + '条' : '已同步' }}</text>
          <text class="item-arrow">›</text>
        </view>

        <view class="list-item" @tap="navTo('privacy')">
          <SijiIcon name="lock" size="md" class="item-icon" />
          <view class="item-body">
            <text class="item-label">应用锁</text>
          </view>
          <text class="item-value">{{ pinStatus }}</text>
          <text class="item-arrow">›</text>
        </view>
      </view>

      <!-- ===== Section: 其他 ===== -->
      <text class="section-title">其他</text>
      <view class="settings-list">
        <view class="list-item" @tap="navTo('feedback')">
          <SijiIcon name="mail" size="md" class="item-icon" />
          <view class="item-body">
            <text class="item-label">体验反馈</text>
          </view>
          <text class="item-value">{{ fbStats.total > 0 ? fbStats.total + '条 · 均分' + fbStats.avgRating : '去反馈' }}</text>
          <text class="item-arrow">›</text>
        </view>

        <view class="list-item" @tap="navTo('about')">
          <SijiIcon name="info" size="md" class="item-icon" />
          <view class="item-body">
            <text class="item-label">关于思迹</text>
          </view>
          <text class="item-value">v1.2.0</text>
          <text class="item-arrow">›</text>
        </view>
      </view>

      <view style="height: 60rpx" />
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
.settings-page {
  height: 100vh;
  background: var(--bg-page);
  overflow: hidden;
}
.settings-scroll {
  height: 100%;
  padding: $spacing-md;
  box-sizing: border-box;
}

/* ===== Section 标题 ===== */
.section-title {
  display: block;
  font-size: $font-xs;
  font-weight: 600;
  color: var(--text-hint);
  letter-spacing: 2rpx;
  text-transform: uppercase;
  margin: $spacing-lg 0 $spacing-sm $spacing-xs;

  &:first-child {
    margin-top: 0;
  }
}

/* ===== AI 配置摘要卡 ===== */
.ai-card {
  background: var(--bg-card);
  border-radius: $radius-md;
  padding: $spacing-md;
  margin-bottom: $spacing-md;
  border: 1rpx solid var(--border-color);
  transition: all $transition-fast;
  box-sizing: border-box;
  overflow: hidden;

  &:active {
    transform: scale(0.98);
    border-color: var(--text-primary);
  }
}

/* ===== Agent 管理卡 ===== */
.agent-card {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  background: var(--bg-card);
  border-radius: $radius-md;
  padding: $spacing-md;
  margin-bottom: $spacing-md;
  border: 1rpx solid var(--border-color);
  transition: all $transition-fast;
  box-sizing: border-box;
  overflow: hidden;

  &:active {
    transform: scale(0.98);
    border-color: var(--text-primary);
  }
}

.agent-avatar-sm {
  font-size: 36rpx;
  width: 64rpx;
  height: 64rpx;
  min-width: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-input);
  border-radius: 50%;
  flex-shrink: 0;
  box-sizing: border-box;
}

.agent-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  min-width: 0;
  overflow: hidden;
}

.agent-name-sm {
  font-size: $font-md;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-desc-sm {
  font-size: $font-xs;
  color: var(--text-hint);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-count {
  font-size: $font-xs;
  color: var(--text-hint);
  flex-shrink: 0;
  white-space: nowrap;
}

.ai-card-header {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
}

.ai-brand {
  width: 72rpx;
  height: 72rpx;
  min-width: 72rpx;
  border-radius: $radius-md;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-sizing: border-box;

  .ai-brand-short {
    font-size: $font-sm;
    font-weight: 700;
    color: var(--text-on-ai);
    letter-spacing: 1rpx;
  }
}

.ai-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  min-width: 0;
  overflow: hidden;

  .ai-name {
    font-size: $font-md;
    font-weight: 700;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ai-model {
    font-size: $font-xs;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.ai-status {
  display: flex;
  align-items: center;
  gap: 6rpx;
  flex-shrink: 0;

  .status-dot {
    width: 12rpx;
    height: 12rpx;
    border-radius: 50%;

    &.ok { background: var(--color-plan); }
    &.warn { background: var(--color-bill); }
  }
  .status-text {
    font-size: $font-xs;
    color: var(--text-hint);
    white-space: nowrap;
  }
}

.ai-arrow {
  font-size: $font-lg;
  color: var(--text-hint);
  font-weight: 300;
  flex-shrink: 0;
}

/* ===== Profile 卡片状态样式 ===== */
.profile-card {
  transition: all $transition-fast;
}
.profile-on {
  border-color: var(--text-primary) !important;
  .agent-avatar-sm {
    background: var(--text-primary);
    color: var(--bg-card);
  }
}
.profile-off {
  opacity: 0.7;
}

/* ===== 设置列表 ===== */
.settings-list {
  background: var(--bg-card);
  border-radius: $radius-md;
  overflow: hidden;
  border: 1rpx solid var(--border-color);
}

.list-item {
  display: flex;
  align-items: center;
  padding: $spacing-md;
  border-bottom: 1rpx solid var(--border-color);
  box-sizing: border-box;
  overflow: hidden;

  &:last-child { border-bottom: none; }
  &:active { background: var(--bg-input); }

  .item-icon { font-size: 36rpx; margin-right: $spacing-sm; flex-shrink: 0; }
  .item-body { flex: 1; min-width: 0; overflow: hidden; }
  .item-label { font-size: $font-md; font-weight: 500; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .item-value { font-size: $font-xs; color: var(--text-hint); margin-right: 8rpx; flex-shrink: 0; max-width: 40%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .item-arrow { font-size: $font-lg; color: var(--text-hint); font-weight: 300; flex-shrink: 0; }
}
</style>
