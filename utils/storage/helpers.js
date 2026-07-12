/**
 * 内部工具函数 — 各子模块共享
 * 这些函数不对外暴露，仅供 storage/ 内部模块使用
 */

/** 读取原始列表（含已删除），仅内部使用 */
export function getRawList(key) {
  const raw = uni.getStorageSync(key)
  if (!raw) return []
  try {
    return JSON.parse(raw)
  } catch {
    return []
  }
}

/** 从时间戳提取 YYYY-MM */
export function getMonthFromDate(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** 从日期字符串提取 YYYY-MM（容错版）
 *  合法输入：YYYY-MM-DD / YYYY-MM / YYYY/MM/DD / ISO 带时间
 *  非法输入（"今天"/"昨天"/空串/乱码）→ fallback 到当前月，避免存到错误 key
 */
export function getMonthFromDateStr(dateStr) {
  if (typeof dateStr === 'string' && dateStr) {
    const m = dateStr.trim().match(/^(\d{4})[-/](\d{1,2})/)
    if (m) {
      const y = parseInt(m[1])
      const mo = parseInt(m[2])
      if (mo >= 1 && mo <= 12) {
        return `${y}-${String(mo).padStart(2, '0')}`
      }
    }
  }
  // fallback：当前月
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
