<script setup>
/**
 * SijiIcon — APP 端图标组件 v3
 *
 * 使用 Unicode 文本字符渲染，零外部文件依赖
 * 只使用 Basic Multilingual Plane 安全字符，避免 emoji 不兼容
 */
import { computed } from 'vue'

const SIZES = {
  xs: 24, sm: 28, md: 32, lg: 36, xl: 44, xxl: 56
}

// Unicode 字符映射（仅使用 BMP 安全字符）
const ICON_MAP = {
  'menu': '☰', 'arrow-left': '←', 'arrow-down': '↓', 'arrow-up': '↑',
  'arrow-right': '→', 'refresh': '↻', 'settings': '⚙', 'edit': '✎',
  'sparkle': '✦', 'ai': '◆', 'bill': '¥', 'diary': '✍', 'plan': '✔',
  'book': '▣', 'brain': '◎', 'check': '✓', 'close': '✕', 'copy': '⧉',
  'mail': '✉', 'moon': '☾', 'sun': '☀', 'info': 'ℹ', 'star': '★',
  'fire': '♨', 'tag': '#', 'stats': '▤', 'export': '⇧', 'download': '⇩',
  'calendar': '◷', 'trash': '✂', 'tip': '!', 'plus': '+', 'add': '+',
  'more-h': '⋯', 'heart': '♥', 'filter': '⊞', 'save': '↘',
  'eye': '◎', 'eye-off': '∅', 'x': '✕', 'palette': '◇', 'smile': '☺',
  'target': '◎', 'bell': '♪', 'clock': '◷', 'globe': '◉',
  'shield': '⛉', 'mic': '♫', 'chat-bubble': '◌', 'music': '♬',
  'home': '⌂', 'pin': '✦', 'device': '⊡', 'briefcase': '■',
  'dumbbell': '⏣', 'trend': '↗', 'relation': '⊕', 'voice-wave': '∿',
  'camera': '◉', 'search': '⌕', 'chevron-down': '▼',
  'chevron-right': '›', 'chevron-left': '‹', 'lock': '⚿',
  'unlock': '∅', 'user': '◉',
  // 厂商：用首字母缩写
  'provider-ds': 'D', 'provider-oa': 'O', 'provider-ms': 'M',
  'provider-zg': 'Z', 'provider-qw': 'Q',
}

const props = defineProps({
  name: { type: String, required: true },
  size: { type: [String, Number], default: 'md' },
  color: { type: String, default: 'currentColor' }
})

const sizeRpx = computed(() => {
  if (typeof props.size === 'number') return props.size + 'rpx'
  const v = SIZES[props.size]
  return (v || 32) + 'rpx'
})

const glyph = computed(() => ICON_MAP[props.name] || '●')
</script>

<template>
  <text
    class="siji-icon-text"
    :style="{
      width: sizeRpx,
      height: sizeRpx,
      fontSize: sizeRpx,
      color: color,
      lineHeight: sizeRpx
    }"
  >{{ glyph }}</text>
</template>

<style scoped>
.siji-icon-text {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  vertical-align: middle;
  text-align: center;
  font-weight: 400;
}
</style>
