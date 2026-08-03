<script setup>
/**
 * 厂商快速切换 Modal
 *
 * 简化版 ModelSwitcher — 只切厂商，自动选默认模型
 * 用于顶部导航快速切换
 */
import SijiIcon from '@/components/common/SijiIcon.vue'
import { computed } from 'vue'
import { useAppStore } from '@/store/index.js'
import { AI_PROVIDERS } from '@/utils/api.js'

const store = useAppStore()
defineProps({ show: Boolean })
const emit = defineEmits(['close'])

const PROVIDER_LOGO_MAP = {
  deepseek: 'ds',
  zhipu: 'zg',
  qwen: 'qw',
  moonshot: 'ms',
  openai: 'oa'
}

function getProviderLogo(pid) {
  const suffix = PROVIDER_LOGO_MAP[pid] || 'oa'
  return `/static/icons/provider-${suffix}.png`
}

const switchableProviders = computed(() => {
  const customRaw = uni.getStorageSync('siji_custom_providers')
  let custom = {}
  try { custom = customRaw ? JSON.parse(customRaw) : {} } catch {}
  const all = { ...AI_PROVIDERS, ...custom }
  return Object.values(all).filter(p => store.providerKeys[p.id])
})

function quickSwitchProvider(pid) {
  if (pid === store.aiProvider) {
    emit('close')
    return
  }
  store.setAiProvider(pid)
  emit('close')
}

function goToAiConfig() { emit('close'); uni.navigateTo({ url: '/pages/settings/sub/ai' }) }
</script>

<template>
  <view v-if="show" class="modal-mask" @tap="$emit('close')">
    <view class="modal-container provider-switch-container" @tap.stop>
      <view class="modal-header">
        <text class="modal-title">切换厂商</text>
        <view class="modal-close" @tap="$emit('close')"><SijiIcon name="close" size="md" /></view>
      </view>
      <scroll-view class="modal-body" scroll-y>
        <view v-if="switchableProviders.length > 0" class="switch-provider-list">
          <view
            v-for="p in switchableProviders" :key="p.id"
            class="switch-provider-item"
            :class="{ active: store.aiProvider === p.id }"
            @tap="quickSwitchProvider(p.id)"
          >
            <view class="switch-provider-logo-wrap">
              <image
                :src="getProviderLogo(p.id)"
                mode="aspectFit"
                class="switch-provider-logo"
              />
            </view>
            <view class="switch-provider-info">
              <text class="switch-provider-name">{{ p.name }}</text>
              <text class="switch-provider-desc">{{ store.getAvailableModels(p.id).length }} 个模型</text>
            </view>
            <SijiIcon name="check" size="sm" class="switch-provider-check" v-if="store.aiProvider === p.id" />
          </view>
        </view>
        <view v-else class="switch-empty">
          <text class="switch-empty-text">请在设置中配置至少一个厂商的 API Key</text>
          <view class="switch-empty-btn" @tap="goToAiConfig">
            <text>去配置</text>
          </view>
        </view>
        <view v-if="switchableProviders.length > 0" class="switch-config-btn" @tap="goToAiConfig">
          <SijiIcon name="settings" size="sm" class="switch-config-icon" />
          <text>高级配置</text>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import './modal-mixins.scss';

.provider-switch-container {
  max-height: 60vh;
  @include flex-col;
  overflow: hidden;
}
.switch-provider-list {
  @include flex-col;
  gap: 8rpx;
}
.switch-provider-item {
  @include flex-row;
  gap: 16rpx;
  padding: 16rpx;
  border-radius: 8rpx;
  background: #D4D4D8;
  border: 2rpx solid transparent;
  box-sizing: border-box;
  overflow: hidden;
  &:active { transform: scale(0.98); }
  &.active {
    border-color: #18181B;
    background: #FFFFFF;
  }
  .switch-provider-logo-wrap {
    width: 48rpx;
    height: 48rpx;
    border-radius: 12rpx;
    overflow: hidden;
    flex-shrink: 0;
    background: #FFFFFF;
    @include flex-center;
  }
  .switch-provider-logo {
    width: 40rpx;
    height: 40rpx;
  }
  .switch-provider-info {
    flex: 1;
    @include flex-col;
    gap: 2rpx;
    min-width: 0;
    overflow: hidden;
  }
  .switch-provider-name {
    font-size: 28rpx;
    font-weight: 600;
    color: #18181B;
    @include text-ellipsis;
  }
  .switch-provider-desc {
    font-size: 22rpx;
    color: #71717A;
    @include text-ellipsis;
  }
  .switch-provider-check {
    flex-shrink: 0;
  }
}
.switch-config-btn {
  margin-top: 24rpx;
  padding: 16rpx;
  text-align: center;
  border-radius: 8rpx;
  background: #D4D4D8;
  box-sizing: border-box;
  overflow: hidden;
  @include flex-row;
  justify-content: center;
  gap: 8rpx;
  text {
    font-size: 22rpx;
    color: #18181B;
    font-weight: 600;
  }
}
.switch-empty {
  @include flex-col;
  align-items: center;
  gap: 24rpx;
  padding: 32rpx 0;
  .switch-empty-text {
    font-size: 22rpx;
    color: #71717A;
    text-align: center;
  }
  .switch-empty-btn {
    padding: 8rpx 32rpx;
    background: #000000;
    border-radius: 8rpx;
    text {
      font-size: 22rpx;
      color: #FFFFFF;
      font-weight: 600;
    }
  }
}

@media (prefers-color-scheme: dark) {
  .switch-section-label { color: #A1A1AA; }
  .switch-provider-item {
    background: #27272A;
    &.active { border-color: #FAFAFA; background: #18181B; }
    .switch-provider-name { color: #FAFAFA; }
    .switch-provider-desc { color: #A1A1AA; }
    .switch-provider-logo-wrap { background: #18181B; }
  }
  .switch-config-btn {
    background: #27272A;
    text { color: #FAFAFA; }
  }
  .switch-empty {
    .switch-empty-text { color: #A1A1AA; }
    .switch-empty-btn {
      background: #27272A;
      text { color: #FAFAFA; }
    }
  }
}

</style>
