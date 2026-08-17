<script setup>
/** 空状态占位组件 — 含引导操作 */
import SijiIcon from '@/components/common/SijiIcon.vue'

defineProps({
  icon: { type: String, default: 'diary' },
  title: { type: String, default: '暂无数据' },
  description: { type: String, default: '' },
  actionText: { type: String, default: '' }
})

const emit = defineEmits(['action'])
</script>

<template>
  <view class="empty-state">
    <view class="empty-icon-wrap">
      <SijiIcon :name="icon" size="xxl" class="empty-icon" />
    </view>
    <text class="empty-title">{{ title }}</text>
    <text v-if="description" class="empty-desc">{{ description }}</text>
    <view v-if="actionText" class="empty-action" @tap="emit('action')">
      <text class="empty-action-text">{{ actionText }}</text>
    </view>
    <slot />
  </view>
</template>

<style lang="scss" scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: $spacing-xl * 2 $spacing-lg;
}

.empty-icon-wrap {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: #F4F4F5;
  align-items: center;
  justify-content: center;
  margin-bottom: $spacing-md;
  animation: floatGentle 3s ease-in-out infinite;
}

.empty-icon {
  opacity: 0.4;
}

.empty-title {
  font-size: $font-lg;
  font-weight: 600;
  color: #71717A;
  margin-bottom: $spacing-xs;
  animation: emptyTextFadeIn 0.5s ease 0.3s both;
}

.empty-desc {
  font-size: $font-sm;
  color: #A1A1AA;
  text-align: center;
  line-height: 1.6;
  max-width: 480rpx;
  animation: emptyTextFadeIn 0.5s ease 0.4s both;
}

.empty-action {
  margin-top: $spacing-lg;
  padding: 16rpx 48rpx;
  background: #000000;
  border-radius: $radius-lg;
  transition: transform $transition-fast;
  animation: emptyTextFadeIn 0.5s ease 0.5s both;

  &:active {
    transform: scale(0.95);
    opacity: 0.85;
  }

  .empty-action-text {
    font-size: $font-md;
    color: #FFFFFF;
    font-weight: 600;
  }
}

@keyframes floatGentle {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-12rpx); }
}

@keyframes emptyTextFadeIn {
  from { opacity: 0; transform: translateY(8rpx); }
  to   { opacity: 1; transform: translateY(0); }
}
</style>
