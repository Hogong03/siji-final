/**
 * 防抖与节流工具
 */

/**
 * 防抖 — 延迟执行，每次调用重置计时器
 * @param {Function} fn - 要执行的函数
 * @param {number} delay - 延迟毫秒
 * @returns {Function} 防抖后的函数（带 .cancel() 方法）
 */
export function debounce(fn, delay = 300) {
  let timer = null
  const debounced = function (...args) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      fn.apply(this, args)
      timer = null
    }, delay)
  }
  debounced.cancel = function () {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }
  return debounced
}

/**
 * 节流 — 固定频率执行，期间多余调用被丢弃
 * @param {Function} fn - 要执行的函数
 * @param {number} interval - 间隔毫秒
 * @returns {Function} 节流后的函数（带 .cancel() 方法）
 */
export function throttle(fn, interval = 200) {
  let lastTime = 0
  let timer = null
  const throttled = function (...args) {
    const now = Date.now()
    const remaining = interval - (now - lastTime)
    if (remaining <= 0) {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      lastTime = now
      fn.apply(this, args)
    } else if (!timer) {
      timer = setTimeout(() => {
        lastTime = Date.now()
        timer = null
        fn.apply(this, args)
      }, remaining)
    }
  }
  throttled.cancel = function () {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    lastTime = 0
  }
  return throttled
}
