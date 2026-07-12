<script setup>
/**
 * AgentAvatar — Agent 卡通形象组件
 *
 * 根据 Agent 名称渲染对应的 SVG 卡通头像
 * 纯黑白线描风格，匹配思迹极简主题
 * 默认 fallback：通用机器人头像
 */
import { computed } from 'vue'

const props = defineProps({
  name: { type: String, default: '' },
  size: { type: [String, Number], default: 72 } // rpx
})

// 名称 → 角色类型映射
const TYPE_MAP = {
  '思迹助手': 'robot',
  '心理咨询师': 'meditate',
  '健身教练': 'muscle',
  '财务顾问': 'coin',
  '学习伙伴': 'book',
  '极简助手': 'star',
  '情感顾问': 'heart',
  '职场参谋': 'briefcase',
  '求职教练': 'target'
}

const type = computed(() => TYPE_MAP[props.name] || 'robot')

const sizeRpx = computed(() => {
  if (typeof props.size === 'number') return props.size + 'rpx'
  return props.size
})

// rpx → px
function rpxToPx(rpx) {
  try {
    const sys = uni.getSystemInfoSync()
    return Math.round(rpx * (sys.windowWidth / 750))
  } catch { return Math.round(rpx * 0.5) }
}

const sizePx = computed(() => {
  const n = typeof props.size === 'number' ? props.size : parseInt(props.size) || 72
  return rpxToPx(n) + 'px'
})
</script>

<template>
  <view class="agent-avatar" :style="{ width: sizeRpx, height: sizeRpx }">
    <!-- #ifdef H5 -->
    <svg :width="sizePx" :height="sizePx" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color:#000">
      <!-- 机器人（思迹助手）-->
      <template v-if="type === 'robot'">
        <rect x="12" y="14" width="24" height="22" rx="5"/>
        <path d="M18 14V10a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4"/>
        <path d="M24 8V4"/>
        <circle cx="24" cy="4" r="1.5" fill="currentColor"/>
        <circle cx="19" cy="22" r="2" fill="currentColor"/>
        <circle cx="29" cy="22" r="2" fill="currentColor"/>
        <path d="M19 29h10"/>
        <path d="M21 32v2M27 32v2"/>
        <path d="M8 22v6M40 22v6"/>
        <circle cx="8" cy="20" r="1.5" fill="currentColor"/>
        <circle cx="40" cy="20" r="1.5" fill="currentColor"/>
      </template>

      <!-- 冥想（心理咨询师）-->
      <template v-else-if="type === 'meditate'">
        <circle cx="24" cy="12" r="5"/>
        <path d="M24 17v8"/>
        <path d="M14 38c0-6 4-10 10-10s10 4 10 10"/>
        <path d="M14 38h20"/>
        <path d="M10 24c4 2 8 3 14 3s10-1 14-3"/>
        <path d="M18 22c2 1 4 1.5 6 1.5s4-.5 6-1.5"/>
        <circle cx="20" cy="11" r="1" fill="currentColor"/>
        <circle cx="28" cy="11" r="1" fill="currentColor"/>
        <path d="M21 14c1 .5 2 .5 3 .5s2 0 3-.5"/>
      </template>

      <!-- 肌肉（健身教练）-->
      <template v-else-if="type === 'muscle'">
        <circle cx="24" cy="10" r="4.5"/>
        <path d="M24 14.5v5"/>
        <path d="M16 22c-2 2-3 5-3 8v6h6v-6"/>
        <path d="M32 22c2 2 3 5 3 8v6h-6v-6"/>
        <path d="M19 22c0 3 2 5 5 5s5-2 5-5"/>
        <path d="M16 36h-4M32 36h4"/>
        <path d="M20 28h8"/>
        <path d="M24 27v2"/>
        <path d="M14 40h-2M34 40h2"/>
      </template>

      <!-- 硬币（财务顾问）-->
      <template v-else-if="type === 'coin'">
        <circle cx="24" cy="24" r="16"/>
        <circle cx="24" cy="24" r="12" stroke-dasharray="2 2"/>
        <path d="M24 16v16"/>
        <path d="M20 20h6a2 2 0 0 1 0 4h-6"/>
        <path d="M20 24h7a2 2 0 0 1 0 4h-7"/>
        <path d="M22 14v4M22 30v4"/>
        <path d="M26 14v4M26 30v4"/>
      </template>

      <!-- 书本（学习伙伴）-->
      <template v-else-if="type === 'book'">
        <path d="M8 12c4-2 10-2 16 0 6-2 12-2 16 0v28c-4-2-10-2-16 0-6-2-12-2-16 0z"/>
        <path d="M24 12v28"/>
        <path d="M12 18h8M12 23h8M12 28h8"/>
        <path d="M28 18h8M28 23h8M28 28h8"/>
        <circle cx="24" cy="6" r="2" fill="currentColor"/>
        <path d="M24 8v4"/>
      </template>

      <!-- 星星（极简助手）-->
      <template v-else-if="type === 'star'">
        <path d="M24 6l4 12 12 1-9 8 3 12-10-7-10 7 3-12-9-8 12-1z"/>
        <circle cx="24" cy="22" r="2" fill="currentColor"/>
        <path d="M22 26h4"/>
      </template>

      <!-- 心形（情感顾问）-->
      <template v-else-if="type === 'heart'">
        <path d="M24 42s-14-9-14-20a7 7 0 0 1 14-2 7 7 0 0 1 14 2c0 11-14 20-14 20z"/>
        <path d="M18 18c0-2 2-4 4-4"/>
        <path d="M20 22c0 3 2 5 4 5s4-2 4-5"/>
        <circle cx="20" cy="18" r="1" fill="currentColor"/>
        <circle cx="28" cy="18" r="1" fill="currentColor"/>
        <path d="M21 26c1 .5 2 .5 3 .5s2 0 3-.5"/>
      </template>

      <!-- 公文包（职场参谋）-->
      <template v-else-if="type === 'briefcase'">
        <rect x="8" y="16" width="32" height="24" rx="3"/>
        <path d="M18 16v-3a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3"/>
        <path d="M8 26h32"/>
        <rect x="21" y="24" width="6" height="4" rx="1" fill="currentColor" stroke="none"/>
        <circle cx="16" cy="12" r="1" fill="currentColor"/>
        <circle cx="32" cy="12" r="1" fill="currentColor"/>
        <path d="M16 12c0-2 2-3 4-3M32 12c0-2-2-3-4-3"/>
      </template>

      <!-- 靶心（求职教练）-->
      <template v-else-if="type === 'target'">
        <circle cx="24" cy="24" r="18"/>
        <circle cx="24" cy="24" r="13"/>
        <circle cx="24" cy="24" r="8"/>
        <circle cx="24" cy="24" r="3" fill="currentColor"/>
        <path d="M24 6v4M24 38v4M6 24h4M38 24h4"/>
        <path d="M30 18l4-4M18 30l-4 4"/>
      </template>

      <!-- Fallback：通用机器人 -->
      <template v-else>
        <rect x="12" y="14" width="24" height="22" rx="5"/>
        <path d="M24 14V8"/>
        <circle cx="24" cy="6" r="2" fill="currentColor"/>
        <circle cx="19" cy="22" r="2" fill="currentColor"/>
        <circle cx="29" cy="22" r="2" fill="currentColor"/>
        <path d="M19 29h10"/>
      </template>
    </svg>
    <!-- #endif -->

    <!-- #ifndef H5 -->
    <!-- App/小程序端：用文字 fallback -->
    <text class="avatar-fallback">{{ name.charAt(0) }}</text>
    <!-- #endif -->
  </view>
</template>

<style scoped>
.agent-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-input, #EBEBEB);
  border-radius: 50%;
  flex-shrink: 0;
  color: var(--text-primary, #000);
  overflow: hidden;
}
.avatar-fallback {
  font-size: 28rpx;
  font-weight: 700;
  color: var(--text-primary, #000);
}
</style>
