<script setup>
/**
 * Agent 快速切换 Modal
 */
import SijiIcon from '@/components/common/SijiIcon.vue'
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
            <view class="agent-avatar-wrap">
              <image
                v-if="a.icon"
                :src="a.icon"
                mode="aspectFill"
                class="agent-avatar-img"
              />
              <view v-else class="agent-avatar-fallback">
                <text class="agent-avatar-text">{{ (a.name || '思').charAt(0) }}</text>
              </view>
            </view>
            <view class="switch-agent-text">
              <text class="switch-model-name">{{ a.name }}</text>
              <text class="switch-model-desc">{{ a.description || '自定义 Agent' }}</text>
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
@import './modal-mixins.scss';

.model-switch-container {
  max-height: 68vh;
  @include flex-col;
  overflow: hidden;
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
  .agent-avatar-wrap {
    width: 56rpx;
    height: 56rpx;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    background: #D4D4D8;
    @include flex-center;
  }
  .agent-avatar-img {
    width: 56rpx;
    height: 56rpx;
    border-radius: 50%;
  }
  .agent-avatar-fallback {
    width: 56rpx;
    height: 56rpx;
    border-radius: 50%;
    background: #D4D4D8;
    @include flex-center;
  }
  .agent-avatar-text {
    font-size: 28rpx;
    font-weight: 700;
    color: #18181B;
    line-height: 1;
  }
  .switch-agent-text {
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

@media (prefers-color-scheme: dark) {
  .switch-model-item {
    background: #27272A;
    &.active {
      border-color: #FAFAFA;
      background: #18181B;
    }
    .agent-avatar-wrap { background: #27272A; }
    .agent-avatar-fallback { background: #27272A; }
    .agent-avatar-text { color: #FAFAFA; }
    .switch-model-name { color: #FAFAFA; }
    .switch-model-desc { color: #A1A1AA; }
  }
  .switch-config-btn {
    background: #27272A;
    text { color: #FAFAFA; }
  }
}
</style>
