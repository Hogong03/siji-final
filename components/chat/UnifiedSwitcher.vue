<script setup>
/**
 * 统一切换 Modal — 厂商 + Agent 一站式切换
 *
 * 上半部分：厂商切换（logo + 名称 + 模型数）
 * 下半部分：Agent 切换（头像 + 名称 + 描述）
 * 底部：高级配置入口
 */
import SijiIcon from '@/components/common/SijiIcon.vue'
import AgentAvatar from '@/components/common/AgentAvatar.vue'
import { computed } from 'vue'
import { useAppStore } from '@/store/index.js'
import { AI_PROVIDERS } from '@/utils/api.js'

const store = useAppStore()
defineProps({ show: Boolean })
const emit = defineEmits(['close'])

const PROVIDER_LOGO_MAP = {
  deepseek: 'ds', zhipu: 'zg', qwen: 'qw', moonshot: 'ms', openai: 'oa'
}
function getProviderLogo(pid) {
  return `/static/icons/provider-${PROVIDER_LOGO_MAP[pid] || 'oa'}-v2.png`
}

const switchableProviders = computed(() => {
  const customRaw = uni.getStorageSync('siji_custom_providers')
  let custom = {}
  try { custom = customRaw ? JSON.parse(customRaw) : {} } catch {}
  const all = { ...AI_PROVIDERS, ...custom }
  return Object.values(all).filter(p => store.providerKeys[p.id])
})

function quickSwitchProvider(pid) {
  if (pid === store.aiProvider) return
  store.setAiProvider(pid)
}

function quickSwitchAgent(agentId) {
  const a = store.agents.find(a => a.id === agentId)
  if (a) {
    store.setActiveAgent(agentId)
    emit('close')
  }
}

function goToAiConfig() { emit('close'); uni.navigateTo({ url: '/pages/settings/sub/ai' }) }
function goToAgentConfig() { emit('close'); uni.navigateTo({ url: '/pages/settings/sub/agent' }) }
</script>

<template>
  <view v-if="show" class="modal-mask" @tap="$emit('close')">
    <view class="modal-container unified-switch-container" @tap.stop>
      <view class="modal-header">
        <text class="modal-title">切换</text>
        <view class="modal-close" @tap="$emit('close')"><SijiIcon name="close" size="md" /></view>
      </view>
      <scroll-view class="modal-body" scroll-y>
        <!-- 厂商区 -->
        <text class="unified-section-label">厂商</text>
        <view class="unified-provider-list">
          <view
            v-for="p in switchableProviders" :key="p.id"
            class="unified-provider-item"
            :class="{ active: store.aiProvider === p.id }"
            @tap="quickSwitchProvider(p.id)"
          >
            <view class="unified-provider-logo-wrap">
              <image :src="getProviderLogo(p.id)" mode="aspectFit" class="unified-provider-logo" />
            </view>
            <view class="unified-provider-info">
              <text class="unified-provider-name">{{ p.name }}</text>
              <text class="unified-provider-desc">{{ store.getAvailableModels(p.id).length }} 个模型</text>
            </view>
            <SijiIcon name="check" size="sm" class="unified-check" v-if="store.aiProvider === p.id" />
          </view>
        </view>

        <!-- 分隔线 -->
        <view class="unified-divider" />

        <!-- Agent 区 -->
        <text class="unified-section-label">Agent</text>
        <view class="unified-agent-list">
          <view
            v-for="a in store.agents" :key="a.id"
            class="unified-agent-item"
            :class="{ active: store.activeAgentId === a.id }"
            @tap="quickSwitchAgent(a.id)"
          >
            <AgentAvatar :name="a.name" :icon="a.icon" :size="48" />
            <view class="unified-agent-info">
              <text class="unified-agent-name">{{ a.name }}</text>
              <text class="unified-agent-desc">{{ a.description || '自定义 Agent' }}</text>
            </view>
            <SijiIcon name="check" size="sm" class="unified-check" v-if="store.activeAgentId === a.id" />
          </view>
        </view>

        <!-- 底部配置入口 -->
        <view class="unified-config-row">
          <view class="unified-config-btn" @tap="goToAiConfig">
            <SijiIcon name="settings" size="sm" />
            <text>AI 配置</text>
          </view>
          <view class="unified-config-btn" @tap="goToAgentConfig">
            <SijiIcon name="user" size="sm" />
            <text>管理 Agent</text>
          </view>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import './modal-mixins.scss';

.unified-switch-container {
  max-height: 70vh;
  @include flex-col;
  overflow: hidden;
}

.unified-section-label {
  font-size: $font-xs;
  font-weight: 700;
  color: #71717A;
  text-transform: uppercase;
  letter-spacing: 1rpx;
  display: block;
  margin: 0 0 $spacing-xs;
}

.unified-divider {
  height: 1rpx;
  background: #E4E4E7;
  margin: $spacing-md 0;
}

.unified-provider-list,
.unified-agent-list {
  @include flex-col;
  gap: 8rpx;
}

.unified-provider-item,
.unified-agent-item {
  @include flex-row;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 20rpx;
  border-radius: 12rpx;
  background: #F4F4F5;
  border: 2rpx solid transparent;
  box-sizing: border-box;
  overflow: hidden;
  transition: all 0.15s ease;
  &:active { transform: scale(0.98); }
  &.active {
    border-color: #18181B;
    background: #18181B;
    .unified-provider-name,
    .unified-agent-name { color: #FAFAFA; }
    .unified-provider-desc,
    .unified-agent-desc { color: #A1A1AA; }
  }
}

.unified-provider-logo-wrap {
  width: 40rpx;
  height: 40rpx;
  border-radius: 10rpx;
  overflow: hidden;
  flex-shrink: 0;
  background: #FFFFFF;
  @include flex-center;
}

.unified-provider-logo {
  width: 34rpx;
  height: 34rpx;
}

.unified-provider-info,
.unified-agent-info {
  flex: 1;
  @include flex-col;
  gap: 2rpx;
  min-width: 0;
  overflow: hidden;
}

.unified-provider-name,
.unified-agent-name {
  font-size: 26rpx;
  font-weight: 600;
  color: #18181B;
  @include text-ellipsis;
}

.unified-provider-desc,
.unified-agent-desc {
  font-size: 22rpx;
  color: #71717A;
  @include text-ellipsis;
}

.unified-check {
  flex-shrink: 0;
}

.unified-config-row {
  display: flex;
  gap: 8rpx;
  margin-top: $spacing-md;
}

.unified-config-btn {
  flex: 1;
  @include flex-row;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  padding: 14rpx;
  border-radius: 12rpx;
  background: #F4F4F5;
  text {
    font-size: 22rpx;
    color: #18181B;
    font-weight: 600;
  }
  &:active { transform: scale(0.97); }
}

@media (prefers-color-scheme: dark) {
  .unified-section-label { color: #A1A1AA; }
  .unified-divider { background: #27272A; }
  .unified-provider-item,
  .unified-agent-item {
    background: #27272A;
    &.active {
      border-color: #FAFAFA;
      background: #FAFAFA;
      .unified-provider-name,
      .unified-agent-name { color: #18181B; }
      .unified-provider-desc,
      .unified-agent-desc { color: #71717A; }
    }
  }
  .unified-provider-logo-wrap { background: #18181B; }
  .unified-provider-name,
  .unified-agent-name { color: #FAFAFA; }
  .unified-provider-desc,
  .unified-agent-desc { color: #A1A1AA; }
  .unified-config-btn {
    background: #27272A;
    text { color: #FAFAFA; }
  }
}

</style>
