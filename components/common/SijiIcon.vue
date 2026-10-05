<script setup>
/**
 * SijiIcon — 图标组件 v5（4.12.5 改 JS 驱动换图）
 *
 * 统一渲染 Lucide 线框 PNG（96×96 高清，三端一致）：
 *   - 浅色模式用深色图标（#18181B），深色模式用白色图标（#FFFFFF）
 *   - color 语义：primary（跟随主题）/ secondary（灰）/ white（白）/ amber（仅 sun）
 *
 * v4 及之前靠「双 <image> 叠放 + html.theme-dark CSS 切换显隐」—— H5 正常，但 App 端
 * 样式编译器对这类选择器的处理与 H5 不同，实测深色下图标仍停留在浅色版（用户截图实证：
 * 发送箭头 white 系可见、primary/secondary 系若隐若现）。v5 改为直接消费 theme.js 的
 * 响应式 isDark 单例换 src：单 <image>、无 CSS 依赖，三端行为一致（MP 下 isDark 走系统跟随）。
 * 原 Unicode 字符方案已废弃（跨平台字形不一致、个别字符会变彩色 emoji）。
 */
import { computed } from 'vue'
import { isDark } from '@/utils/theme.js'

const SIZES = {
  xs: 24, sm: 28, md: 32, lg: 36, xl: 44, xxl: 56
}

// 已生成的图标名（与 static/icons 下 {name}-v2.png 对应）
const KNOWN = new Set([
  'ai', 'add', 'arrow-down', 'arrow-left', 'arrow-right', 'bill', 'brain',
  'bug', 'calendar', 'check', 'chat-bubble', 'chevron-right', 'close',
  'clock', 'copy', 'diary', 'download', 'edit', 'export', 'file', 'heart',
  'image', 'info', 'lock', 'mail', 'menu', 'monitor', 'moon', 'more', 'plan',
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

/** 当前主题下的实际 src：JS 驱动，不依赖 CSS 编译器行为（4.12.5） */
const currentSrc = computed(() => (isDark.value ? darkSrc.value : lightSrc.value))

/** secondary 灰图标的视觉降权：浅色 0.45 / 深色 0.55（沿用 v4 的两档） */
const imgOpacity = computed(() => (tone.value === 'secondary' ? (isDark.value ? 0.55 : 0.45) : 1))
</script>

<template>
  <view
    class="siji-icon"
    :class="['siji-icon--' + tone]"
    :style="{ width: sizeRpx, height: sizeRpx }"
  >
    <image class="siji-icon-img" :src="currentSrc" mode="aspectFit" :style="{ opacity: imgOpacity }" />
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
  width: 100%;
  height: 100%;
}
</style>
