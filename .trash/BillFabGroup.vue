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
  0%, 100% { transform: translateY(0); opacity: 1; box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.08); }
  50% { transform: translateY(-2rpx); opacity: 0.88; box-shadow: 0 4rpx 18rpx rgba(0, 0, 0, 0.14); }
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
  animation: fabIdle 3s ease-in-out infinite;

  &:active { transform: scale(0.88); }

  &.fab-expense {
    background: #000000;
    box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.12);
  }

  &.fab-income {
    background: #3F3F46;
    box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.08);
  }

  .fab-icon {
    font-size: 32rpx;
    color: #FFFFFF;
    font-weight: 300;
    line-height: 1;
  }

  .fab-label {
    font-size: 18rpx;
    color: #FFFFFF;
    margin-top: 2rpx;
  }
}

@media (prefers-color-scheme: dark) {
  .fab-btn.fab-expense {
    background: #FAFAFA;
    .fab-icon, .fab-label { color: #18181B; }
  }
  .fab-btn.fab-income {
    background: #A1A1AA;
    .fab-icon, .fab-label { color: #18181B; }
  }
}
</style>
