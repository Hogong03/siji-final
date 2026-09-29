<script setup>
/**
 * SijiIcon — 图标组件 v4
 *
 * 统一渲染 Lucide 线框 PNG（96×96 高清，三端一致）：
 *   - 浅色模式用深色图标（#18181B），深色模式用白色图标（#FFFFFF）
 *   - color 语义：primary（跟随主题）/ secondary（灰，半透明）/ white（白）/ amber（仅 sun）
 * 原 Unicode 字符方案已废弃（跨平台字形不一致、个别字符会变彩色 emoji）。
 */
import { computed } from 'vue'

const SIZES = {
  xs: 24, sm: 28, md: 32, lg: 36, xl: 44, xxl: 56
}

// 已生成的图标名（与 static/icons 下 {name}-v2.png 对应）
const KNOWN = new Set([
  'ai', 'add', 'arrow-down', 'arrow-left', 'arrow-right', 'bill', 'brain',
  'bug', 'calendar', 'check', 'chat-bubble', 'chevron-right', 'close',
  'clock', 'copy', 'diary', 'download', 'edit', 'export', 'file', 'heart',
  'image', 'info', 'lock', 'mail', 'menu', 'moon', 'more', 'plan',
  'refresh', 'search', 'settings', 'sparkle', 'stats', 'sun', 'target',
  'tip', 'trash', 'unlock', 'user'
])

const props = defineProps({
  name: { type: String, required: true },
  size: { type: [String, Number], default: 'md' },
  color: { type: String, default: 'currentColor' }
})

const file = computed(() => (KNOWN.has(props.name) ? props.name : 'info'))

const sizeRpx = computed(() => {
  if (typeof props.size === 'number') return props.size + 'rpx'
  return (SIZES[props.size] || 32) + 'rpx'
})

/** 颜色语义分组 */
const tone = computed(() => {
  const c = String(props.color || '').trim().toUpperCase()
  if (!c || c === 'CURRENTCOLOR') return 'primary'
  if (c === '#FFFFFF' || c === '#FFF') return 'white'
  if (c === '#B45309') return 'amber'
  if (c === '#71717A' || c === '#A1A1AA') return 'secondary'
  return 'primary'
})

const lightSrc = computed(() => {
  if (tone.value === 'white') return `/static/icons/${file.value}-v2-dark.png`
  if (tone.value === 'amber') return '/static/icons/sun-amber.png'
  return `/static/icons/${file.value}-v2.png`
})
const darkSrc = computed(() => {
  if (tone.value === 'amber') return '/static/icons/sun-amber-dark.png'
  return `/static/icons/${file.value}-v2-dark.png`
})
</script>

<template>
  <view
    class="siji-icon"
    :class="['siji-icon--' + tone]"
    :style="{ width: sizeRpx, height: sizeRpx }"
  >
    <image class="siji-icon-img siji-icon-light" :src="lightSrc" mode="aspectFit" />
    <image class="siji-icon-img siji-icon-dark" :src="darkSrc" mode="aspectFit" />
  </view>
</template>

<style scoped>
.siji-icon {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  vertical-align: middle;
}
.siji-icon-img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
.siji-icon-dark {
  display: none;
}

/* 深色模式：切换为白色图标 */
@media (prefers-color-scheme: dark) {
  .siji-icon-light {
    display: none;
  }
  .siji-icon-dark {
    display: block;
  }
}

/* 次要图标：用透明度降低视觉重量（浅色/深色分别取值） */
.siji-icon--secondary .siji-icon-light {
  opacity: 0.45;
}
.siji-icon--secondary .siji-icon-dark {
  opacity: 0.55;
}
</style>
