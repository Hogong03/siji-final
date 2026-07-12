<script setup>
/**
 * Agent 快速切换 Modal
 */
import SijiIcon from '@/components/common/SijiIcon.vue'
import AgentAvatar from '@/components/common/AgentAvatar.vue'
import { useAppStore } from '@/store/index.js'

const store = useAppStore()
defineProps({ show: Boolean })
const emit = defineEmits(['close'])

function quickSwitchAgent(agentId) {
  const a = store.agents.find(a => a.id === agentId)
  if (a) {
    store.setActiveAgent(agentId)
    emit('close')
  }
}
function goToAgentConfig() { emit('close'); uni.navigateTo({ url: '/pages/settings/sub/agent' }) }
</script>

<template>
  <view v-if="show" class="modal-mask" @tap="$emit('close')">
    <view class="modal-container model-switch-container" @tap.stop>
      <view class="modal-header">
        <text class="modal-title">切换 Agent</text>
        <view class="modal-close" @tap="$emit('close')"><SijiIcon name="close" size="md" /></view>
      </view>
      <scroll-view class="modal-body" scroll-y>
        <view class="switch-model-list">
          <view
            v-for="a in store.agents" :key="a.id"
            class="switch-model-item"
            :class="{ active: store.activeAgentId === a.id }"
            @tap="quickSwitchAgent(a.id)"
          >
            <view class="switch-model-info switch-agent-info">
              <AgentAvatar :name="a.name" size="56" />
              <view class="switch-agent-text">
                <text class="switch-model-name">{{ a.name }}</text>
                <text class="switch-model-desc">{{ a.description || '自定义 Agent' }}</text>
              </view>
            </view>
            <SijiIcon name="check" size="sm" class="switch-model-check" v-if="store.activeAgentId === a.id" />
          </view>
        </view>
        <view class="switch-config-btn" @tap="goToAgentConfig">
          <SijiIcon name="settings" size="sm" class="switch-config-icon" /><text>管理 Agent</text>
        </view>
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
.switch-agent-info {
  flex-direction: row !important;
  align-items: center;
  gap: 16rpx;
}
.switch-agent-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2rpx;
  min-width: 0;
  overflow: hidden;
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
</style>
