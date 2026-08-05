<script setup>
/**
 * 设置页 v3 - 精简版
 *
 * 只保留设置类功能，非设置功能移至功能页
 */
import SijiIcon from '@/components/common/SijiIcon.vue'
import AgentAvatar from '@/components/common/AgentAvatar.vue'
import { onShow } from '@dcloudio/uni-app'
import { computed } from 'vue'
import { useAppStore } from '@/store/index.js'
import { AI_PROVIDERS } from '@/utils/api.js'
import { hasPin } from '@/utils/pin.js'
import { getVersion } from '@/utils/version-check.js'

const store = useAppStore()

// ─── 厂商图标映射 ───
const PROVIDER_ICONS = {
  deepseek: 'ds',
  openai: 'oa',
  moonshot: 'ms',
  zhipu: 'zg',
  qwen: 'qw'
}

const currentProvider = computed(() => AI_PROVIDERS[store.aiProvider] || AI_PROVIDERS.deepseek)
const currentModel = computed(() => currentProvider.value.models?.find(m => m.id === store.aiModel))
const hasKey = computed(() => !!store.providerKeys[store.aiProvider])
const pinStatus = computed(() => hasPin() ? '已开启' : '未开启')
const appVersion = computed(() => 'v' + getVersion())

const modelAbbr = computed(() => {
  const p = store.aiProvider
  if (p === 'deepseek') return 'DS'
  if (p === 'openai') return 'GPT'
  if (p === 'zhipu') return 'GLM'
  if (p === 'qwen') return 'Qwen'
  if (p === 'moonshot') return 'Kimi'
  return ''
})

// ─── 导航 ───
function go(target) {
  const m = {
    ai: '/pages/settings/sub/ai',
    agent: '/pages/settings/sub/agent',
    data: '/pages/settings/sub/data',
    privacy: '/pages/settings/sub/privacy',
    feedback: '/pages/settings/sub/feedback-list',
    about: '/pages/settings/sub/about',
    version: '/pages/settings/sub/version-history',
  }
  uni.navigateTo({ url: m[target] })
}
</script>

<template>
  <view class="page">
    <scroll-view class="scroll" scroll-y>

      <!-- ===== AI 配置 ===== -->
      <text class="sec-title">AI 配置</text>
      <view class="card card-ai-section slide-in-left-stagger">
        <view class="row ai-row card-press" @tap="go('ai')">
          <image
            :src="`/static/icons/provider-${PROVIDER_ICONS[store.aiProvider] || 'ds'}.png`"
            mode="aspectFit"
            class="row-provider-logo"
          />
          <view class="row-body">
            <text class="row-label">AI 模型</text>
            <text class="row-desc">{{ currentProvider.name }} · {{ currentModel?.name || store.aiModel }}</text>
          </view>
          <view class="row-right">
            <view class="dot" :class="hasKey ? 'ok' : 'warn'" />
            <text class="row-value">{{ hasKey ? modelAbbr + ' · 已配置' : '未配置' }}</text>
            <text class="row-arrow">›</text>
          </view>
        </view>
      </view>
      <view class="card slide-in-left-stagger">
        <view class="row card-press" @tap="go('agent')">
          <AgentAvatar :name="store.activeAgent.name" :icon="store.activeAgent.icon" :size="64" />
          <view class="row-body">
            <text class="row-label">Agent 管理</text>
            <text class="row-desc">{{ store.activeAgent.name }}{{ store.agents.length > 1 ? ' · 共' + store.agents.length + '个' : '' }}</text>
          </view>
          <text class="row-arrow">›</text>
        </view>
      </view>

      <!-- ===== 数据与安全 ===== -->
      <text class="sec-title">数据与安全</text>
      <view class="card slide-in-left-stagger">
        <view class="row card-press" @tap="go('data')">
          <SijiIcon name="download" size="lg" class="row-icon" />
          <view class="row-body"><text class="row-label">数据管理</text></view>
          <text class="row-arrow">›</text>
        </view>
        <view class="row card-press" @tap="go('privacy')">
          <SijiIcon name="lock" size="lg" class="row-icon" />
          <view class="row-body"><text class="row-label">应用锁</text></view>
          <text class="row-value">{{ pinStatus }}</text>
          <text class="row-arrow">›</text>
        </view>
      </view>

      <!-- ===== 关于 ===== -->
      <text class="sec-title">关于</text>
      <view class="card slide-in-left-stagger">
        <view class="row card-press" @tap="go('about')">
          <SijiIcon name="info" size="lg" class="row-icon" />
          <view class="row-body"><text class="row-label">关于思迹</text></view>
          <text class="row-value">{{ appVersion }}</text>
          <text class="row-arrow">›</text>
        </view>
        <view class="row card-press" @tap="go('version')">
          <SijiIcon name="info" size="lg" class="row-icon" />
          <view class="row-body"><text class="row-label">版本历史</text></view>
          <text class="row-arrow">›</text>
        </view>
        <view class="row card-press" @tap="go('feedback')">
          <SijiIcon name="mail" size="lg" class="row-icon" />
          <view class="row-body"><text class="row-label">体验反馈</text></view>
          <text class="row-arrow">›</text>
        </view>
      </view>

      <view style="height: 80rpx" />
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
.page { height: 100vh; background: var(--bg-page); }
.scroll { height: 100%; padding: $spacing-md; box-sizing: border-box; }

/* ─── Section 标题 ─── */
.sec-title {
  display: flex;
  align-items: center;
  gap: 12rpx;
  font-size: 28rpx;
  font-weight: 700;
  color: #18181B;
  letter-spacing: 1rpx;
  margin: 0 0 16rpx 4rpx;
  padding-left: 16rpx;
  border-left: 4rpx solid #18181B;
  &:first-child { margin-top: 0; padding-top: 0; }
}

/* ─── 统一卡片 ─── */
.card {
  background: #FFFFFF;
  border-radius: 24rpx;
  overflow: hidden;
  border: 1rpx solid #E4E4E7;
  margin-bottom: $spacing-lg;
}

/* ─── 统一行 ─── */
.row {
  display: flex;
  align-items: center;
  padding: 28rpx $spacing-md;
  border-bottom: 1rpx solid var(--bg-input);
  gap: $spacing-sm;
  box-sizing: border-box;
  &:last-child { border-bottom: none; }
  &:active { background: var(--bg-input); }
}

.ai-row { padding-top: 32rpx; padding-bottom: 32rpx; }

/* AI 配置区顶部黑条 */
.card-ai-section {
  border-top: 3rpx solid var(--color-ai);
}

/* 厂商 logo 替代 SijiIcon */
.row-provider-logo {
  width: 40rpx;
  height: 40rpx;
  border-radius: 10rpx;
  flex-shrink: 0;
}

.row-icon { flex-shrink: 0; }

.row-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4rpx; }
.row-label { font-size: $font-md; font-weight: 600; color: #18181B; 
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row-desc { font-size: $font-xs; color: var(--text-hint);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.row-right { display: flex; align-items: center; gap: 6rpx; flex-shrink: 0; }
.row-value { font-size: $font-xs; color: var(--text-hint); flex-shrink: 0; max-width: 40%;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row-arrow { font-size: $font-lg; color: var(--text-hint); font-weight: 300; flex-shrink: 0; }

.dot { width: 16rpx; height: 16rpx; border-radius: 50%; flex-shrink: 0;
  &.ok { background: var(--color-plan); box-shadow: 0 0 0 6rpx rgba(16, 185, 129, 0.12); }
  &.warn { background: var(--color-bill); box-shadow: 0 0 0 6rpx rgba(245, 158, 11, 0.12); }
}
</style>
