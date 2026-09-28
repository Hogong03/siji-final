/**
 * 安全导航工具 — navigateBack 的 fail 回调统一 fallback
 *
 * uni-app 中 navigateBack 在没有上一页时静默失败，
 * 此函数在 fail 时 fallback 到 switchTab(首页) 或 reLaunch
 */

/**
 * 安全返回上一页，无历史时 fallback 到首页
 * @param {Object} opts - { delta: 1, fallback?: '/pages/chat/index' }
 */
export function safeNavigateBack(opts = {}) {
  const { delta = 1, fallback = '/pages/chat/index' } = opts
  uni.navigateBack({
    delta,
    fail: () => {
      // 先尝试 switchTab（首页是 tabbar 页）
      uni.switchTab({
        url: fallback,
        fail: () => {
          // 终极兜底：reLaunch
          uni.reLaunch({ url: fallback })
        }
      })
    }
  })
}
