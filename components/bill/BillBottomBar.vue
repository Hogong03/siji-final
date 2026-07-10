<script setup>
/**
 * 底部统计入口栏
 */
defineEmits(['goStats'])
</script>

<template>
  <view class="bottom-bar" @tap="$emit('goStats')">
    <view class="bar-text-row">
      <text class="bar-text">收支统计分析</text>
    </view>
    <text class="bar-arrow">→</text>
  </view>
</template>

<style lang="scss" scoped>
.bottom-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $spacing-sm $spacing-md;
  background: $bg-card;
  border-top: 1rpx solid rgba(0, 0, 0, 0.05);

  .bar-text {
    font-size: $font-sm;
    color: $accent;
  }

  .bar-arrow {
    font-size: $font-md;
    color: $accent;
    margin-left: $spacing-xs;
  }
}
</style>
