<script setup>
/**
 * 模型快速切换 Modal
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

const switchableModels = computed(() => store.getAvailableModels(store.aiProvider))

function quickSwitchProvider(pid) { store.setAiProvider(pid) }
function quickSwitchModel(mid) {
  store.setAiModel(mid)
  emit('close')
}
function goToAiConfig() { emit('close'); uni.navigateTo({ url: '/pages/settings/sub/ai' }) }
</script>

<template>
  <view v-if="show" class="modal-mask" @tap="$emit('close')">
    <view class="modal-container model-switch-container" @tap.stop>
      <view class="modal-header">
        <text class="modal-title">切换模型</text>
        <view class="modal-close" @tap="$emit('close')"><SijiIcon name="close" size="md" /></view>
      </view>
      <scroll-view class="modal-body" scroll-y>
        <text class="switch-section-label">厂商</text>
        <view class="switch-provider-grid">
          <view
            v-for="p in switchableProviders" :key="p.id"
            class="switch-provider-item"
            :class="{ active: store.aiProvider === p.id }"
            @tap="quickSwitchProvider(p.id)"
          >
            <image
              :src="getProviderLogo(p.id)"
              mode="aspectFit"
              class="switch-provider-logo"
            />
            <text class="switch-provider-name">{{ p.name }}</text>
          </view>
        </view>
        <text class="switch-section-label" v-if="switchableProviders.length === 0">未配置任何 API Key</text>
        <view class="switch-empty" v-if="switchableProviders.length === 0">
          <text class="switch-empty-text">请在设置中配置至少一个厂商的 API Key</text>
          <view class="switch-empty-btn" @tap="goToAiConfig">
            <text>去配置</text>
          </view>
        </view>
        <template v-if="switchableProviders.length > 0">
          <text class="switch-section-label">模型</text>
          <view class="switch-model-list">
            <view
              v-for="m in switchableModels" :key="m.id"
              class="switch-model-item"
              :class="{ active: store.aiModel === m.id }"
              @tap="quickSwitchModel(m.id)"
            >
              <view class="switch-model-info">
                <text class="switch-model-name">{{ m.name }}</text>
                <text class="switch-model-desc">{{ m.desc }}</text>
              </view>
              <SijiIcon name="check" size="sm" class="switch-model-check" v-if="store.aiModel === m.id" />
            </view>
          </view>
          <view class="switch-config-btn" @tap="goToAiConfig">
            <SijiIcon name="settings" size="sm" class="switch-config-icon" />
            <text>高级配置</text>
          </view>
        </template>
      </scroll-view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import './modal-mixins.scss';

.model-switch-container {
  max-height: 68vh;
  @include flex-col;
  overflow: hidden;
}
.switch-section-label {
  font-size: 22rpx;
  font-weight: 700;
  color: #71717A;
  text-transform: uppercase;
  letter-spacing: 1rpx;
  display: block;
  margin: 16rpx 0 8rpx;
}
.switch-provider-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  overflow: hidden;
}
.switch-provider-item {
  @include flex-col;
  align-items: center;
  gap: 6rpx;
  padding: 12rpx 16rpx;
  border-radius: 8rpx;
  background: #D4D4D8;
  border: 2rpx solid transparent;
  min-width: 100rpx;
  max-width: calc(50% - 4rpx);
  box-sizing: border-box;
  overflow: hidden;
  &:active { transform: scale(0.95); }
  &.active {
    border-color: #18181B;
    background: #FFFFFF;
  }
  .switch-provider-logo {
    width: 48rpx;
    height: 48rpx;
    border-radius: 12rpx;
    flex-shrink: 0;
  }
  .switch-provider-name {
    font-size: 22rpx;
    font-weight: 600;
    color: #18181B;
    @include text-ellipsis;
    max-width: 100%;
  }
}
.switch-model-list {
  @include flex-col;
  gap: 8rpx;
}
.switch-model-item {
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
  .switch-model-info {
    flex: 1;
    @include flex-col;
    gap: 2rpx;
    min-width: 0;
    overflow: hidden;
  }
  .switch-model-name {
    font-size: 26rpx;
    font-weight: 600;
    color: #18181B;
    @include text-ellipsis;
  }
  .switch-model-desc {
    font-size: 22rpx;
    color: #71717A;
    @include text-ellipsis;
  }
  .switch-model-check {
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
  }
  .switch-model-item {
    background: #27272A;
    &.active { border-color: #FAFAFA; background: #18181B; }
    .switch-model-name { color: #FAFAFA; }
    .switch-model-desc { color: #A1A1AA; }
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
