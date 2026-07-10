<script setup>
/**
 * 设置页 v3 — 精简版
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

const store = useAppStore()

// ─── 厂商图标映射 ───
const PROVIDER_ICONS = {
  deepseek: 'provider-ds',
  openai: 'provider-oa',
  moonshot: 'provider-ms',
  zhipu: 'provider-zg',
  qwen: 'provider-qw'
}

const currentProvider = computed(() => AI_PROVIDERS[store.aiProvider] || AI_PROVIDERS.deepseek)
const currentModel = computed(() => currentProvider.value.models?.find(m => m.id === store.aiModel))
const hasKey = computed(() => !!store.providerKeys[store.aiProvider])
const pinStatus = computed(() => hasPin() ? '已开启' : '未开启')

// ─── 导航 ───
function go(target) {
  const m = {
    ai: '/pages/settings/sub/ai',
    agent: '/pages/settings/sub/agent',
    data: '/pages/settings/sub/data',
    privacy: '/pages/settings/sub/privacy',
    about: '/pages/settings/sub/about',
    help: '/pages/settings/sub/help'
  }
  uni.navigateTo({ url: m[target] })
}
</script>

<template>
  <view class="page">
    <scroll-view class="scroll" scroll-y>

      <!-- ===== AI 配置 ===== -->
      <text class="sec-title">AI 配置</text>
      <view class="card">
        <view class="row ai-row" @tap="go('ai')">
          <SijiIcon :name="PROVIDER_ICONS[store.aiProvider] || 'provider-ds'" size="lg" class="row-icon" />
          <view class="row-body">
            <text class="row-label">AI 模型</text>
            <text class="row-desc">{{ currentProvider.name }} · {{ currentModel?.name || store.aiModel }}</text>
          </view>
          <view class="row-right">
            <view class="dot" :class="hasKey ? 'ok' : 'warn'" />
            <text class="row-value">{{ hasKey ? '已配置' : '未配置' }}</text>
            <text class="row-arrow">›</text>
          </view>
        </view>
        <view class="row" @tap="go('agent')">
          <AgentAvatar :name="store.activeAgent.name" :size="64" />
          <view class="row-body">
            <text class="row-label">Agent 管理</text>
            <text class="row-desc">{{ store.activeAgent.name }}{{ store.agents.length > 1 ? ' · 共 ' + store.agents.length + ' 个' : '' }}</text>
          </view>
          <text class="row-arrow">›</text>
        </view>
      </view>

      <!-- ===== 数据与安全 ===== -->
      <text class="sec-title">数据与安全</text>
      <view class="card">
        <view class="row" @tap="go('data')">
          <SijiIcon name="download" size="lg" class="row-icon" />
          <view class="row-body"><text class="row-label">数据管理</text></view>
          <text class="row-arrow">›</text>
        </view>
        <view class="row" @tap="go('privacy')">
          <SijiIcon name="lock" size="lg" class="row-icon" />
          <view class="row-body"><text class="row-label">应用锁</text></view>
          <text class="row-value">{{ pinStatus }}</text>
          <text class="row-arrow">›</text>
        </view>
      </view>

      <!-- ===== 关于 ===== -->
      <text class="sec-title">关于</text>
      <view class="card">
        <view class="row" @tap="go('about')">
          <SijiIcon name="info" size="lg" class="row-icon" />
          <view class="row-body"><text class="row-label">关于思迹</text></view>
          <text class="row-value">v1.2.0</text>
          <text class="row-arrow">›</text>
        </view>
        <view class="row" @tap="go('help')">
          <SijiIcon name="book" size="lg" class="row-icon" />
          <view class="row-body"><text class="row-label">使用说明</text></view>
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
  display: block;
  font-size: $font-xs;
  font-weight: 600;
  color: var(--text-hint);
  letter-spacing: 2rpx;
  text-transform: uppercase;
  margin: $spacing-lg 0 $spacing-sm $spacing-xs;
  &:first-child { margin-top: 0; }
}

/* ─── 统一卡片 ─── */
.card {
  background: var(--bg-card);
  border-radius: $radius-md;
  overflow: hidden;
  border: 1rpx solid var(--border-color);
  margin-bottom: $spacing-md;
}

/* ─── 统一行 ─── */
.row {
  display: flex;
  align-items: center;
  padding: $spacing-md;
  border-bottom: 1rpx solid var(--border-color);
  gap: $spacing-sm;
  box-sizing: border-box;
  &:last-child { border-bottom: none; }
  &:active { background: var(--bg-input); }
}

.ai-row { padding-top: 20rpx; padding-bottom: 20rpx; }

.row-icon { flex-shrink: 0; }

.row-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4rpx; }
.row-label { font-size: $font-md; font-weight: 600; color: var(--text-primary); 
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row-desc { font-size: $font-xs; color: var(--text-hint);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.row-right { display: flex; align-items: center; gap: 6rpx; flex-shrink: 0; }
.row-value { font-size: $font-xs; color: var(--text-hint); flex-shrink: 0; max-width: 40%;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row-arrow { font-size: $font-lg; color: var(--text-hint); font-weight: 300; flex-shrink: 0; }

.dot { width: 12rpx; height: 12rpx; border-radius: 50%; flex-shrink: 0;
  &.ok { background: var(--color-plan); }
  &.warn { background: var(--color-bill); }
}
</style>
