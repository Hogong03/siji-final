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
.modal-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: maskFadeIn 0.2s ease both;
}
.modal-container {
  width: 86%;
  max-width: 640rpx;
  max-height: 72vh;
  background: var(--bg-card);
  border-radius: 16rpx;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  animation: modalSlideIn 0.3s cubic-bezier(0.34, 1.2, 0.64, 1) both;
}
.model-switch-container {
  max-height: 68vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
@keyframes modalSlideIn {
  from { opacity: 0; transform: translateY(40rpx) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes maskFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 32rpx;
  border-bottom: 1rpx solid var(--border-color);
  flex-shrink: 0;
  box-sizing: border-box;
  .modal-title {
    font-size: 32rpx;
    font-weight: 700;
    color: var(--color-ai);
    flex: 1;
    min-width: 0;
  }
  .modal-close {
    padding: 0 8rpx;
    flex-shrink: 0;
  }
}
.modal-body {
  padding: 24rpx 32rpx;
  flex: 1;
  overflow-y: auto;
  box-sizing: border-box;
}
.switch-section-label {
  font-size: 22rpx;
  font-weight: 700;
  color: var(--text-secondary);
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
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;
  padding: 8rpx 16rpx;
  border-radius: 8rpx;
  background: var(--bg-input);
  border: 2rpx solid transparent;
  min-width: 100rpx;
  max-width: calc(50% - 4rpx);
  box-sizing: border-box;
  overflow: hidden;
  &:active { transform: scale(0.95); }
  &.active {
    border-color: var(--color-ai);
    background: var(--bg-card);
  }
  .switch-provider-name {
    font-size: 22rpx;
    font-weight: 600;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }
}
.switch-model-list {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.switch-model-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx;
  border-radius: 8rpx;
  background: var(--bg-input);
  border: 2rpx solid transparent;
  box-sizing: border-box;
  overflow: hidden;
  &:active { transform: scale(0.98); }
  &.active {
    border-color: var(--color-ai);
    background: var(--bg-card);
  }
  .switch-model-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2rpx;
    min-width: 0;
    overflow: hidden;
  }
  .switch-model-name {
    font-size: 26rpx;
    font-weight: 600;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .switch-model-desc {
    font-size: 22rpx;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
  background: var(--bg-input);
  box-sizing: border-box;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  text {
    font-size: 22rpx;
    color: var(--color-ai);
    font-weight: 600;
  }
}
.switch-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24rpx;
  padding: 32rpx 0;
  .switch-empty-text {
    font-size: 22rpx;
    color: var(--text-secondary);
  }
  .switch-empty-btn {
    padding: 8rpx 32rpx;
    background: var(--color-ai);
    border-radius: 8rpx;
    text {
      font-size: 22rpx;
      color: var(--bg-card);
      font-weight: 600;
    }
  }
}
</style>
