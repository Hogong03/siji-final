<script setup>
/**
 * SijiIcon — APP 端图标组件 v2
 *
 * 使用本地 PNG 渲染，路径 /static/icons/{name}.png
 * 外部 API：name / size / color props
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

const iconSrc = computed(() => `/static/icons/${props.name}.png`)
</script>

<template>
  <image
    :src="iconSrc"
    mode="aspectFit"
    :style="{
      width: sizeRpx,
      height: sizeRpx,
      display: 'inline-flex',
      flexShrink: '0',
      verticalAlign: 'middle'
    }"
  />
</template>
