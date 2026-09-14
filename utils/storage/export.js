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
// ==================== 全量备份 / 恢复（W1 数据安全） ====================

/** 备份排除项：敏感或可重建数据，不进入备份文件 */
const BACKUP_EXCLUDE_KEYS = new Set([
  'siji_provider_keys',      // 厂商 API Key（加密存储，仍应排除）
  'siji_api_key',            // 旧版明文 Key
  'siji_index',              // 搜索索引，可重建
  'siji_device_id',          // 设备标识
  'siji_export_json',        // 导出产物自身
  'siji_pin',                // 应用锁（设备安全，跨机不迁移）
  'siji_pin_fail',
  'siji_pin_lock_until',
  'siji_offline_cache',      // 运行时队列，恢复旧值可能误发
  'siji_offline_queue',
  'siji_error_queue',
  'siji_debug',
  'siji_reminders_triggered'
])

/** 判断 key 是否属于业务数据（可备份） */
function isBackupKey(key) {
  if (!key || typeof key !== 'string') return false
  if (key.startsWith('diary_') || key.startsWith('bill_')) return true
  if (key === 'plan_all') return true
  if (!key.startsWith('siji_')) return false
  if (key.startsWith('siji_export_')) return false // 导出产物
  return !BACKUP_EXCLUDE_KEYS.has(key)
}

/** 备份域：chat=聊天记录（体积大头），ai=AI 认知，life=生活数据与设置（兜底） */
const CHAT_KEYS = new Set([
  'siji_conversations', 'siji_conv_tags', 'siji_active_conversation', 'siji_chat_draft'
])
const AI_KEYS = new Set([
  'siji_long_term_memory', 'siji_monthly_memory', 'siji_structured_memory',
  'siji_my_profile', 'siji_agents', 'siji_active_agent', 'siji_memory_enabled'
])

/** 判断存储键属于哪个备份域 */
function sectionOfKey(key) {
  if (CHAT_KEYS.has(key)) return 'chat'
  if (AI_KEYS.has(key)) return 'ai'
  return 'life'
}

/** 收集指定备份域的 storage 快照（section 为空则全量） */
function collectBackupStorage(section) {
  const allKeys = uni.getStorageInfoSync().keys || []
  const storage = {}
  allKeys.forEach(key => {
    if (!isBackupKey(key)) return
    if (section && sectionOfKey(key) !== section) return
    storage[key] = uni.getStorageSync(key)
  })
  return storage
}

/**
 * 备份：导出业务存储键快照（含记忆/画像/对话/关系/Agent 等）
 * @param {object} options { version, section } version 应用版本号；section=life|ai|chat 分域导出（防剪贴板超限）
 * @returns {object} { meta, storage }
 */
export function exportBackup(options = {}) {
  const section = options.section || ''
  const storage = collectBackupStorage(section || null)
  return {
    meta: {
      app: '思迹',
      backupVersion: 1,
      exportedAt: Date.now(),
      version: options.version || '',
      section: section || 'all',
      note: '不含 API Key 与应用锁；恢复后需重新配置厂商 Key'
    },
    storage
  }
}

/** 备份 → JSON 字符串（options.section 可指定 life/ai/chat 分域） */
export function exportBackupJson(options = {}) {
  return JSON.stringify(exportBackup(options))
}

/** 校验备份 JSON 结构，返回解析结果 */
export function parseBackup(jsonText) {
  if (typeof jsonText !== 'string' || !jsonText.trim()) {
    throw new Error('备份内容为空')
  }
  let data
  try {
    data = JSON.parse(jsonText)
  } catch {
    throw new Error('不是有效的 JSON，请检查粘贴内容是否完整')
  }
  if (!data || data.meta?.app !== '思迹') {
    throw new Error('不是思迹的备份文件')
  }
  if (!data.storage || typeof data.storage !== 'object' || Array.isArray(data.storage)) {
    throw new Error('备份文件缺少数据内容')
  }
  return data
}

/**
 * 恢复备份：将备份 storage 写回（调用方负责先清空旧数据与确认）
 * @param {string|object} jsonTextOrData 备份 JSON 或已解析对象
 * @returns {object} { total, skipped } 写入统计
 */
export function importBackup(jsonTextOrData) {
  const data = typeof jsonTextOrData === 'string'
    ? parseBackup(jsonTextOrData)
    : jsonTextOrData
  if (!data.storage) throw new Error('备份文件缺少数据内容')

  let total = 0
  let skipped = 0
  Object.entries(data.storage).forEach(([key, value]) => {
    if (!isBackupKey(key)) {
      skipped++
      return
    }
    uni.setStorageSync(key, value)
    total++
  })
  return { total, skipped }
}
