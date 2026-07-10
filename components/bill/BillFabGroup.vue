<script setup>
/**
 * 快速记账 FAB 按钮组
 */
const emit = defineEmits(['add'])

function goAdd(type) {
  emit('add', type)
}
</script>

<template>
  <view class="fab-group">
    <view class="fab fab-income" @tap="goAdd('income')">
      <text class="fab-icon">+</text>
      <text class="fab-label">收入</text>
    </view>
    <view class="fab fab-expense" @tap="goAdd('expense')">
      <text class="fab-icon">+</text>
      <text class="fab-label">支出</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.fab-group {
  position: fixed;
  right: $spacing-md;
  bottom: 120rpx;
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
  z-index: 100;
  animation: fabIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

@keyframes fabIn {
  from { opacity: 0; transform: scale(0); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes fabIdle {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4rpx); }
}

.fab {
  width: 96rpx;
  height: 96rpx;
  border-radius: $radius-round;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: $shadow-lg;
  transition: transform $transition-fast;
  animation: fabIdle 2.5s ease-in-out infinite;

  &:active { transform: scale(0.92); }

  &.fab-expense {
    background: var(--color-ai);
    box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.12);
  }

  &.fab-income {
    background: var(--text-strong);
    box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.08);
  }

  .fab-icon {
    font-size: 32rpx;
    color: var(--text-on-ai);
    font-weight: 300;
    line-height: 1;
  }

  .fab-label {
    font-size: 18rpx;
    color: var(--text-on-ai);
    margin-top: 2rpx;
  }
}
</style>
