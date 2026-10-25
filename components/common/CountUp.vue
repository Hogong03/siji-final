<script setup>
/**
 * CountUp — 数字滚动（4.47 灵动性）
 *
 * 跨端（H5/App/微信小程序）用响应式文本驱动，不依赖 DOM 与自定义指令，
 * 规避小程序端 v- 指令拿不到真实 DOM 的限制。class 直接透传到根 <text>。
 *
 * 用法：
 *   <CountUp class="sum-value" :value="totalExpense" prefix="¥" />
 *   <CountUp :value="rate" :decimals="1" suffix="%" />
 */
import { ref, watch, onMounted } from 'vue'

const props = defineProps({
  value: { type: Number, default: 0 },
  decimals: { type: Number, default: 0 },
  prefix: { type: String, default: '' },
  suffix: { type: String, default: '' },
  duration: { type: Number, default: 600 },
  thousands: { type: Boolean, default: false },
  animate: { type: Boolean, default: true }
})

const display = ref('')
let timer = null

function format(n) {
  let s = Number(n).toFixed(props.decimals)
  if (props.thousands) {
    const parts = s.split('.')
    const int = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    s = parts.length > 1 ? int + '.' + parts[1] : int
  }
  return props.prefix + s + props.suffix
}

function setText(n) { display.value = format(n) }

/* 跨端帧调度：H5/App 用 rAF，小程序退回 setTimeout */
function nextFrame(cb) {
  // #ifdef H5 || APP-PLUS
  if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(cb)
  // #endif
  return setTimeout(() => cb(Date.now()), 16)
}
function cancelFrame(id) {
  // #ifdef H5 || APP-PLUS
  if (typeof cancelAnimationFrame === 'function') return cancelAnimationFrame(id)
  // #endif
  return clearTimeout(id)
}

function run(to, from = 0, duration = props.duration) {
  if (timer) { cancelFrame(timer); timer = null }
  if (!props.animate || duration <= 0) { setText(to); return }
  const start = Date.now()
  const tick = () => {
    const p = Math.min(1, (Date.now() - start) / duration)
    const eased = 1 - Math.pow(1 - p, 3) // easeOutCubic
    setText(from + (to - from) * eased)
    if (p < 1) timer = nextFrame(tick)
  }
  timer = nextFrame(tick)
}

onMounted(() => {
  if (props.animate) { setText(0); run(props.value, 0, props.duration) }
  else setText(props.value)
})

watch(() => props.value, (n, o) => {
  run(Number(n) || 0, Number(o) || 0, Math.min(props.duration, 450))
})
</script>

<template>
  <text>{{ display }}</text>
</template>
