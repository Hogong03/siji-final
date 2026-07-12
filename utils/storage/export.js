/**
 * 数据导出
 *
 * 支持导出全部数据为 JSON 对象 / JSON 字符串 / CSV 格式
 */

import { getRawList } from './helpers.js'

/**
 * 导出全部数据为 JSON 对象
 * @param {object} options
 * @returns {object} 包含所有日记、账单、计划的完整数据
 */
export function exportAllData(options = {}) {
  const { sanitize = true } = options
  const allKeys = uni.getStorageInfoSync().keys || []
  const data = {
    meta: {
      app: '思迹',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      deviceId: sanitize ? '***' : (uni.getStorageSync('siji_device_id') || '')
    },
    diaries: [],
    bills: [],
    plans: []
  }

  allKeys.forEach(key => {
    if (key.startsWith('diary_')) {
      const list = getRawList(key)
      data.diaries.push(...list.filter(item => item.is_deleted !== 1))
    } else if (key.startsWith('bill_')) {
      const list = getRawList(key)
      data.bills.push(...list.filter(item => item.is_deleted !== 1))
    }
  })

  data.plans = getRawList('plan_all').filter(item => item.is_deleted !== 1)

  // 脱敏：移除 API Key、敏感配置
  if (sanitize) {
    // 不导出任何包含 key/secret/token 的存储项
    const sensitiveKeys = allKeys.filter(k =>
      k.includes('key') || k.includes('secret') || k.includes('token') || k.includes('provider')
    )
    // 导出的数据中不包含敏感字段
  }

  return data
}

/**
 * 导出数据为 JSON 字符串
 */
export function exportJson() {
  return JSON.stringify(exportAllData(), null, 2)
}

/**
 * 导出数据为 CSV 格式（扁平化）
 * @param {string} type - diary / bill / plan
 */
export function exportCsv(type) {
  const data = exportAllData()
  if (type === 'diary') {
    const headers = ['client_id', 'title', 'content', 'mood', 'tags', 'created_at']
    const rows = data.diaries.map(d => [
      d.client_id,
      escapeCsv(d.title || ''),
      escapeCsv(d.content || ''),
      escapeCsv(d.mood || ''),
      escapeCsv((d.tags || []).join(';')),
      new Date(d.created_at).toLocaleString()
    ].join(','))
    return headers.join(',') + '\n' + rows.join('\n')
  } else if (type === 'bill') {
    const headers = ['client_id', 'type', 'amount', 'category', 'note', 'bill_date']
    const rows = data.bills.map(b => [
      b.client_id,
      b.type,
      b.amount,
      escapeCsv(b.category || ''),
      escapeCsv(b.note || ''),
      b.bill_date || ''
    ].join(','))
    return headers.join(',') + '\n' + rows.join('\n')
  } else if (type === 'plan') {
    const headers = ['client_id', 'title', 'description', 'priority', 'status', 'deadline']
    const rows = data.plans.map(p => [
      p.client_id,
      escapeCsv(p.title || ''),
      escapeCsv(p.description || ''),
      p.priority || 2,
      p.status === 1 ? '进行中' : '已完成',
      p.deadline || ''
    ].join(','))
    return headers.join(',') + '\n' + rows.join('\n')
  }
  return ''
}

function escapeCsv(str) {
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}
