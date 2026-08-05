<script setup>
/**
 * AgentAvatar — Agent 头像组件 v2
 *
 * 支持两种模式：
 *   1. icon 模式：传入 icon PNG 路径，渲染品牌图标
 *   2. text 模式（默认）：取名字首字+彩色底色
 */
import { computed } from 'vue'

const props = defineProps({
  name: { type: String, default: '' },
  size: { type: [String, Number], default: 72 },
  icon: { type: String, default: '' }  // 新增：PNG 图标路径
})

const TYPE_COLORS = {
  '思迹助手': '#F5F0E8', '职场参谋': '#F0F0E8', '情感顾问': '#F5E8F0',
  '求职教练': '#E8F0F0', '心理咨询师': '#F5F0E8', '健身教练': '#E8F0E8',
  '财务顾问': '#F0E8E8', '学习伙伴': '#E8EEF5', '极简助手': '#F0F0F0',
}

const bgColor = computed(() => TYPE_COLORS[props.name] || '#EBEBEB')
const firstChar = computed(() => (props.name || '思').charAt(0))

const sizeRpx = computed(() => {
  if (typeof props.size === 'number') return props.size + 'rpx'
  return props.size
})

const fontSize = computed(() => {
  const n = typeof props.size === 'number' ? props.size : parseInt(props.size) || 72
  return Math.round(n * 0.45) + 'rpx'
})

const hasIcon = computed(() => !!props.icon)
</script>

<template>
  <view
    v-if="hasIcon"
    class="agent-avatar agent-avatar--icon"
    :style="{ width: sizeRpx, height: sizeRpx }"
  >
    <image
      :src="icon"
      mode="aspectFill"
      class="avatar-icon-img"
      :style="{ width: '100%', height: '100%' }"
    />
  </view>
  <view
    v-else
    class="agent-avatar"
    :style="{ width: sizeRpx, height: sizeRpx, backgroundColor: bgColor }"
  >
    <text class="avatar-text" :style="{ fontSize }">{{ firstChar }}</text>
  </view>
</template>

<style scoped>
.agent-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  flex-shrink: 0;
  overflow: hidden;
  border: 2rpx solid rgba(0, 0, 0, 0.08);
}
.agent-avatar--icon {
  background: #F4F4F5;
  border: none;
}
.avatar-icon-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}
.avatar-text {
  font-weight: 700;
  color: $ai-primary;
  line-height: 1;
  user-select: none;
}
</style>
