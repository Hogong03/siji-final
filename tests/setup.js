/**
 * 全局 mock：uni API
 *
 * 在测试环境中模拟 uni-app 的全局 API
 */

// Storage 模拟
const _storage = {}

global.uni = {
  _storage: _storage,
  getStorageSync(key) {
    return _storage[key] !== undefined ? _storage[key] : ''
  },
  setStorageSync(key, data) {
    _storage[key] = typeof data === 'string' ? data : JSON.stringify(data)
  },
  setStorage({ key, data }) {
    _storage[key] = typeof data === 'string' ? data : JSON.stringify(data)
  },
  removeStorageSync(key) {
    delete _storage[key]
  },
  clearStorageSync() {
    Object.keys(_storage).forEach(k => delete _storage[k])
  },
  getStorageInfoSync() {
    return {
      keys: Object.keys(_storage),
      currentSize: 0,
      limitSize: 10 * 1024 * 1024
    }
  },
  getSystemInfoSync() {
    return { windowWidth: 375, platform: 'devtools', osName: 'web' }
  },
  createCanvasContext() {
    return {
      fillRect() {}, clearRect() {}, beginPath() {}, closePath() {},
      moveTo() {}, lineTo() {}, arc() {}, arcTo() {},
      fill() {}, stroke() {}, draw() {},
      setFillStyle() {}, setStrokeStyle() {}, setLineWidth() {},
      setFontSize() {}, setTextAlign() {}, setTextBaseline() {},
      setLineCap() {}
    }
  },
  navigateTo() {},
  switchTab() {},
  showToast() {},
  showLoading() {},
  hideLoading() {}
}

// 测试辅助：重置 storage
export function resetStorage() {
  Object.keys(_storage).forEach(k => delete _storage[k])
}
