/**
 * 免责声明页 — 首次启动展示
 * 同意后记录到本地存储，后续不再展示
 * 不同意则退出应用
 */
export function getDisclaimerAccepted() {
  try {
    return uni.getStorageSync('siji_disclaimer_accepted') === '1'
  } catch { return false }
}

export function setDisclaimerAccepted() {
  try {
    uni.setStorageSync('siji_disclaimer_accepted', '1')
  } catch { /* ignore */ }
}
