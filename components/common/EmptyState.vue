<script setup>
/**
 * 空状态占位组件 — 统一「图标圆 + 标题 + 副文案（+ 主按钮）」
 *
 * API：
 *   icon       SijiIcon 名，默认 'info'
 *   title      必填，主标题
 *   desc       副文案（description 为旧别名，等价 desc，存量页面迁移后删除）
 *   actionText 主按钮文案（可选），点击 emit('action')
 *   size       'sm' 120rpx 图标圆（默认） / 'lg' 160rpx 图标圆
 */
import { computed } from 'vue'
import SijiIcon from '@/components/common/SijiIcon.vue'

const props = defineProps({
  icon: { type: String, default: 'info' },
  title: { type: String, required: true },
  desc: { type: String, default: '' },
  /** @deprecated 旧 prop 名，等价 desc */
  description: { type: String, default: '' },
  actionText: { type: String, default: '' },
  size: { type: String, default: 'sm' }
})

const emit = defineEmits(['action'])

const descText = computed(() => props.desc || props.description)
const circleSize = computed(() => (props.size === 'lg' ? '160rpx' : '120rpx'))
const iconSize = computed(() => (props.size === 'lg' ? 72 : 48))
</script>

<template>
  <view class="empty-state" :class="'empty-state--' + size">
    <view class="empty-icon-wrap" :style="{ width: circleSize, height: circleSize }">
      <SijiIcon :name="icon" :size="iconSize" class="empty-icon" />
    </view>
    <text class="empty-title">{{ title }}</text>
    <text v-if="descText" class="empty-desc">{{ descText }}</text>
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
  font-size: $font-md;
  font-weight: 600;
  color: #18181B;
  margin-bottom: $spacing-xs;
  animation: emptyTextFadeIn 0.5s ease 0.3s both;
}

.empty-desc {
  font-size: $font-sm;
  color: #71717A;
  text-align: center;
  line-height: 1.6;
  max-width: 480rpx;
  animation: emptyTextFadeIn 0.5s ease 0.4s both;
}

.empty-action {
  margin-top: $spacing-lg;
  min-width: 320rpx;
  height: 72rpx;
  padding: 0 $spacing-lg;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  background: #000000;
  border-radius: 12rpx;
  transition: transform $transition-fast;
  animation: emptyTextFadeIn 0.5s ease 0.5s both;

  &:active {
    transform: scale(0.95);
    opacity: 0.85;
  }

  .empty-action-text {
    font-size: $font-sm;
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

/* ─── 深色模式 ─── */
/* #ifndef MP-WEIXIN */
html.theme-dark {
  .empty-icon-wrap { background: #3F3F46; }
  .empty-title { color: #E4E4E7; }
  .empty-action {
    background: #FAFAFA;
    .empty-action-text { color: #000000; }
  }
}
/* #endif */
/* #ifdef MP-WEIXIN */
@media (prefers-color-scheme: dark) {
  .empty-icon-wrap { background: #3F3F46; }
  .empty-title { color: #E4E4E7; }
  .empty-action {
    background: #FAFAFA;
    .empty-action-text { color: #000000; }
  }
}
/* #endif */
</style>
