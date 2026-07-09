<script setup>
/**
 * SijiIcon — 跨平台图标组件
 *
 * H5 端使用内联 SVG（矢量清晰、支持 currentColor）
 * App/小程序端使用 <image> 引用本地 PNG（原生兼容）
 *
 * 外部 API：name / size / color props，全平台一致。
 */
import { computed } from 'vue'

const SIZES = {
  xs: 24,
  sm: 28,
  md: 32,
  lg: 36,
  xl: 44,
  xxl: 56
}

// rpx → px 转换（H5 端 SVG 需要绝对像素值）
function rpxToPx(rpx) {
  // uni-app H5 默认 750rpx = 屏幕宽度，px = rpx * (windowWidth / 750)
  try {
    const sysInfo = uni.getSystemInfoSync()
    return Math.round(rpx * (sysInfo.windowWidth / 750))
  } catch (e) {
    return Math.round(rpx * 0.5) // 后备：假设 375px 宽
  }
}

// 支持的图标名列表
const ICON_NAMES = [
  'tip', 'diary', 'bill', 'plan', 'stats', 'search', 'user', 'settings',
  'lock', 'sync', 'target', 'brain', 'device', 'calendar', 'trend', 'tag',
  'bell', 'clock', 'check', 'close', 'download', 'mic', 'export', 'moon',
  'sun', 'shield', 'globe', 'plus', 'star', 'info', 'copy', 'edit', 'trash',
  'arrow-down', 'arrow-up', 'arrow-left', 'arrow-right', 'chevron-down',
  'chevron-right', 'menu', 'more-h', 'eye', 'eye-off', 'heart', 'filter',
  'refresh', 'save', 'ai', 'x', 'palette', 'mail', 'book', 'smile',
  'sparkle', 'fire', 'home', 'pin', 'chat-bubble', 'voice-wave', 'music',
  'unlock'
]

const props = defineProps({
  name: { type: String, required: true },
  size: { type: [String, Number], default: 'md' },
  color: { type: String, default: 'currentColor' }
})

// rpx 尺寸字符串（用于 view 容器和 App 端 image）
const sizeRpx = computed(() => {
  if (typeof props.size === 'number') return props.size + 'rpx'
  const v = SIZES[props.size]
  return (v || 32) + 'rpx'
})

// px 尺寸字符串（用于 H5 端 SVG width/height 属性）
const sizePx = computed(() => {
  let rpx
  if (typeof props.size === 'number') rpx = props.size
  else rpx = SIZES[props.size] || 32
  return rpxToPx(rpx) + 'px'
})

// App 端 PNG 路径
const iconSrc = computed(() => `/static/icons/${props.name}.png`)

const containerStyle = computed(() => ({
  width: sizeRpx.value,
  height: sizeRpx.value,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: '0',
  verticalAlign: 'middle'
}))
</script>

<template>
  <view class="siji-icon" :style="containerStyle">
    <!-- #ifdef H5 -->
    <svg
      xmlns="http://www.w3.org/2000/svg"
      :width="sizePx"
      :height="sizePx"
      viewBox="0 0 24 24"
      fill="none"
      :stroke="color"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <template v-if="name === 'tip'">
        <path d="M12 2a6 6 0 0 0-2.5 11.5v2a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-2A6 6 0 0 0 12 2z"/>
        <path d="M9 20v1a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-1"/>
      </template>
      <template v-else-if="name === 'diary'">
        <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 3 22l1.5-4.5Z"/>
      </template>
      <template v-else-if="name === 'bill'">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 6v2M12 16v2M9 10h3a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h3.5"/>
      </template>
      <template v-else-if="name === 'plan'">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <path d="M9 3v18M3 9h6M3 15h6"/>
      </template>
      <template v-else-if="name === 'stats'">
        <path d="M3 3v18h18"/>
        <path d="M7 16l4-8 3 3 4-6"/>
      </template>
      <template v-else-if="name === 'search'">
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.35-4.35"/>
      </template>
      <template v-else-if="name === 'user'">
        <circle cx="12" cy="8" r="4"/>
        <path d="M4 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2"/>
      </template>
      <template v-else-if="name === 'settings'">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </template>
      <template v-else-if="name === 'lock'">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        <circle cx="12" cy="16" r="1"/>
      </template>
      <template v-else-if="name === 'sync'">
        <path d="M21.5 2v6h-6M2.5 22v-6h6"/>
        <path d="M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
      </template>
      <template v-else-if="name === 'target'">
        <circle cx="12" cy="12" r="10"/>
        <circle cx="12" cy="12" r="6"/>
        <circle cx="12" cy="12" r="2"/>
      </template>
      <template v-else-if="name === 'brain'">
        <path d="M12 4a4 4 0 0 0-2 7.46V13a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2v-1.54A4 4 0 0 0 12 4z"/>
        <path d="M6 10a2 2 0 0 0-1 3.73V15a1 1 0 0 0 1 1h0a1 1 0 0 0 1-1v-.77A2 2 0 0 0 6 10z"/>
        <path d="M18 10a2 2 0 0 1 1 3.73V15a1 1 0 0 1-1 1h0a1 1 0 0 1-1-1v-.77A2 2 0 0 1 18 10z"/>
        <path d="M12 15v2M10 19h4M12 19v2"/>
      </template>
      <template v-else-if="name === 'device'">
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
        <path d="M12 18h.01"/>
      </template>
      <template v-else-if="name === 'calendar'">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <path d="M16 2v4M8 2v4M3 10h18"/>
      </template>
      <template v-else-if="name === 'trend'">
        <path d="M3 3v18h18"/>
        <path d="m7 16 4-8 3 3 4-6"/>
        <path d="M18 5v3h-3"/>
      </template>
      <template v-else-if="name === 'tag'">
        <path d="m2.5 2.5 7.07 7.07a2 2 0 0 1 0 2.83l-4.24 4.24a2 2 0 0 1-2.83 0L2.5 9.57a2 2 0 0 1 0-2.83l7.07-7.07A2 2 0 0 1 11 0h8a2 2 0 0 1 2 2v8a2 2 0 0 1-.59 1.41L13.34 18.5"/>
        <circle cx="16" cy="5" r="1.5" fill="currentColor"/>
      </template>
      <template v-else-if="name === 'bell'">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </template>
      <template v-else-if="name === 'clock'">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 6v6l4 2"/>
      </template>
      <template v-else-if="name === 'check'">
        <path d="M20 6 9 17l-5-5"/>
      </template>
      <template v-else-if="name === 'close'">
        <path d="M18 6 6 18M6 6l12 12"/>
      </template>
      <template v-else-if="name === 'download'">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <path d="m7 10 5 5 5-5"/>
        <path d="M12 15V3"/>
      </template>
      <template v-else-if="name === 'mic'">
        <rect x="9" y="1" width="6" height="11" rx="3"/>
        <path d="M5 11a7 7 0 0 0 14 0"/>
        <path d="M8 19h8M12 15v4"/>
      </template>
      <template v-else-if="name === 'export'">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <path d="m17 8-5-5-5 5"/>
        <path d="M12 3v12"/>
      </template>
      <template v-else-if="name === 'moon'">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </template>
      <template v-else-if="name === 'sun'">
        <circle cx="12" cy="12" r="5"/>
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
      </template>
      <template v-else-if="name === 'shield'">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        <path d="m9 12 2 2 4-4"/>
      </template>
      <template v-else-if="name === 'globe'">
        <circle cx="12" cy="12" r="10"/>
        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </template>
      <template v-else-if="name === 'plus'">
        <path d="M12 5v14M5 12h14"/>
      </template>
      <template v-else-if="name === 'star'">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </template>
      <template v-else-if="name === 'info'">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 16v-4M12 8h.01"/>
      </template>
      <template v-else-if="name === 'copy'">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
      </template>
      <template v-else-if="name === 'edit'">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </template>
      <template v-else-if="name === 'trash'">
        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
        <path d="M10 11v6M14 11v6"/>
      </template>
      <template v-else-if="name === 'arrow-down'">
        <path d="m6 9 6 6 6-6"/>
      </template>
      <template v-else-if="name === 'arrow-up'">
        <path d="m18 15-6-6-6 6"/>
      </template>
      <template v-else-if="name === 'arrow-left'">
        <path d="m15 18-6-6 6-6"/>
      </template>
      <template v-else-if="name === 'arrow-right'">
        <path d="m9 18 6-6-6-6"/>
      </template>
      <template v-else-if="name === 'chevron-down'">
        <path d="m6 9 6 6 6-6"/>
      </template>
      <template v-else-if="name === 'chevron-right'">
        <path d="m9 5 7 7-7 7"/>
      </template>
      <template v-else-if="name === 'menu'">
        <path d="M3 12h18M3 6h18M3 18h18"/>
      </template>
      <template v-else-if="name === 'more-h'">
        <circle cx="12" cy="12" r="1.3"/>
        <circle cx="19" cy="12" r="1.3"/>
        <circle cx="5" cy="12" r="1.3"/>
      </template>
      <template v-else-if="name === 'eye'">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </template>
      <template v-else-if="name === 'eye-off'">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
        <path d="m14.12 14.12a3 3 0 1 1-4.24-4.24M1 1l22 22"/>
      </template>
      <template v-else-if="name === 'heart'">
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
      </template>
      <template v-else-if="name === 'filter'">
        <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>
      </template>
      <template v-else-if="name === 'refresh'">
        <path d="M23 4v6h-6M1 20v-6h6"/>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
      </template>
      <template v-else-if="name === 'save'">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
        <path d="M17 21v-8H7v8M7 3v5h8"/>
      </template>
      <template v-else-if="name === 'ai'">
        <path d="M12 2a3 3 0 0 0-3 3v1H5a3 3 0 0 0-3 3v4a3 3 0 0 0 3 3h1l-1 3h4l3-3h6l3 3h4l-1-3h1a3 3 0 0 0 3-3V9a3 3 0 0 0-3-3h-4V5a3 3 0 0 0-3-3z"/>
        <circle cx="8.5" cy="11" r="1.5" fill="currentColor"/>
        <circle cx="15.5" cy="11" r="1.5" fill="currentColor"/>
      </template>
      <template v-else-if="name === 'x'">
        <path d="M18 6 6 18M6 6l12 12"/>
      </template>
      <template v-else-if="name === 'palette'">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 2a10 10 0 0 1 0 20"/>
        <path d="M12 2a10 10 0 0 0 0 20"/>
        <circle cx="12" cy="12" r="3"/>
      </template>
      <template v-else-if="name === 'mail'">
        <rect x="2" y="4" width="20" height="16" rx="2"/>
        <path d="m22 4-10 8L2 4"/>
      </template>
      <template v-else-if="name === 'book'">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        <path d="M8 7h6M8 11h8"/>
      </template>
      <template v-else-if="name === 'smile'">
        <circle cx="12" cy="12" r="10"/>
        <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
        <path d="M9 9h.01M15 9h.01"/>
      </template>
      <template v-else-if="name === 'sparkle'">
        <path d="M12 2l1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5z"/>
      </template>
      <template v-else-if="name === 'fire'">
        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 0-5 .17.78.56 1.77 1 3 1.07 2.14.22 4.05 2 6 .22.27.44.55.56.84A2.5 2.5 0 0 1 12 18c0 1.38-.5 2-1 3-1.07 2.14-.22 4.05 0 5-.17-.78-.56-1.77-1-3-1.07-2.14-.22-4.05-2-6a6.8 6.8 0 0 1-.56-.84A2.5 2.5 0 0 0 8.5 14.5z"/>
      </template>
      <template v-else-if="name === 'home'">
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <path d="M9 22V12h6v10"/>
      </template>
      <template v-else-if="name === 'pin'">
        <path d="m12 17-2.5 5L12 21l2.5-1L12 17z"/>
        <circle cx="12" cy="11" r="3"/>
        <path d="M12 2v6M12 14v4"/>
      </template>
      <template v-else-if="name === 'chat-bubble'">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </template>
      <template v-else-if="name === 'voice-wave'">
        <path d="M11 5 6 9H2v6h4l5 4z"/>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/>
      </template>
      <template v-else-if="name === 'music'">
        <path d="M9 18V5l12-2v13"/>
        <circle cx="6" cy="18" r="3"/>
        <circle cx="18" cy="16" r="3"/>
      </template>
      <template v-else-if="name === 'unlock'">
        <rect x="3" y="11" width="18" height="11" rx="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0"/>
      </template>
      <!-- Fallback -->
      <template v-else>
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 8v4M12 16h.01"/>
      </template>
    </svg>
    <!-- #endif -->

    <!-- #ifndef H5 -->
    <!-- App/小程序端使用本地 PNG -->
    <image
      :src="iconSrc"
      mode="aspectFit"
      :style="{ width: sizeRpx, height: sizeRpx }"
    />
    <!-- #endif -->
  </view>
</template>

<style scoped>
.siji-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  vertical-align: middle;
}
</style>
