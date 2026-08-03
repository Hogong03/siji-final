/**
 * useNumberRoll — 数字滚动动画
 *
 * 用法：
 *   const display = useNumberRoll(computed(() => someNumber.value))
 *   <text>{{ display }}</text>
 *
 * App 端 vue 页面可用，nvue 不支持 requestAnimationFrame
 */
import { ref, watch, isRef, unref } from 'vue'

// 降级链：低版本安卓 WebView (<7.0) 可能不支持 requestAnimationFrame / performance.now
const raf = typeof requestAnimationFrame !== 'undefined'
  ? requestAnimationFrame
  : (cb) => setTimeout(cb, 16)
const caf = typeof cancelAnimationFrame !== 'undefined'
  ? cancelAnimationFrame
  : (id) => clearTimeout(id)
const perfNow = typeof performance !== 'undefined' && performance.now
  ? () => performance.now()
  : () => Date.now()

export function useNumberRoll(source, duration = 600) {
  const display = ref(0)
  let rafId = null

  function animate(from, to) {
    if (rafId) caf(rafId)
    if (from === to) {
      display.value = to
      return
    }
    const startTime = perfNow()
    const delta = to - from

    function tick(now) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3)
      display.value = Math.round(from + delta * eased)
      if (progress < 1) {
        rafId = raf(tick)
      } else {
        display.value = to
        rafId = null
      }
    }
    rafId = raf(tick)
  }

  const unwrapped = isRef(source) ? source : { value: source }
  watch(unwrapped, (newVal, oldVal) => {
    const to = Number(unref(newVal)) || 0
    const from = Number(unref(oldVal)) || 0
    animate(from, to)
  }, { immediate: true })

  return display
}
