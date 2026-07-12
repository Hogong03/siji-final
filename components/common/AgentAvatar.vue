<script setup>
/**
 * AgentAvatar — Agent 头像组件 v2（APP Only）
 *
 * 根据 Agent 名称渲染第一字的圆形头像
 * 不同 Agent 类型使用不同底色区分
 */
import { computed } from 'vue'

const props = defineProps({
  name: { type: String, default: '' },
  size: { type: [String, Number], default: 72 }
})

// Agent 类型 → 首字 → 背景色
const TYPE_COLORS = {
  '心理咨询师': '#F5F0E8',
  '健身教练': '#E8F0E8',
  '财务顾问': '#F0E8E8',
  '学习伙伴': '#E8EEF5',
  '极简助手': '#F0F0F0',
  '情感顾问': '#F5E8F0',
  '职场参谋': '#F0F0E8',
  '求职教练': '#E8F0F0'
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
</script>

<template>
  <view
    class="agent-avatar"
    :style="{
      width: sizeRpx,
      height: sizeRpx,
      backgroundColor: bgColor
    }"
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
.avatar-text {
  font-weight: 700;
  color: #000;
  line-height: 1;
  user-select: none;
}
</style>
