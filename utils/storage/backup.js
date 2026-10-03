/**
 * 自动本地备份（App 端专属）
 *
 * 职责：
 *  - App 端每天启动时把 exportBackup 的全量 JSON 静默写到 _doc/siji-backup/，删旧留新（保留 3 份）
 *  - 设置页（pages/settings/sub/data.vue）提供开关 / 立即备份 / 备份列表 / 点选恢复
 *
 * 边界（v1）：
 *  - 备份内容 = exportBackup 全量存储快照（记录/账单/计划/记忆/画像/对话等，不含 API Key 与应用锁）
 *  - 日记照片文件本身不进备份（v1）
 *  - 纯函数部分（文件名 / 24h 判定 / 保留筛选 / 文件名转时间）可单测：tests/backup.test.js
 */

import { exportBackupJson, importBackup } from './export.js'

/** 开关存储键：'1' 开（默认）/ '0' 关 */
export const AUTO_BACKUP_SWITCH_KEY = 'siji_auto_backup'
/** 上次自动备份时间存储键（毫秒时间戳字符串） */
export const AUTO_BACKUP_LAST_KEY = 'siji_last_auto_backup'

/** 备份目录（应用私有文档目录下） */
const BACKUP_DIR = 'siji-backup'
/** 保留份数 */
const KEEP_COUNT = 3
/** 默认自动备份间隔：24 小时 */
export const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000

/** 备份文件名格式：siji-backup-YYYYMMDD-HHmmss.json */
const BACKUP_NAME_RE = /^siji-backup-\d{8}-\d{6}\.json$/

// ==================== 纯函数（可单测） ====================

/**
 * 生成备份文件名 siji-backup-YYYYMMDD-HHmmss.json
 * @param {Date} date
 * @returns {string}
 */
export function buildBackupFileName(date) {
  const d = date instanceof Date ? date : new Date()
  const pad = n => String(n).padStart(2, '0')
  const stamp = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
    '-' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds())
  return 'siji-backup-' + stamp + '.json'
}

/**
 * 是否应该自动备份：从没备过 / 距上次已超过间隔
 * @param {number|string} lastAt 上次备份毫秒时间戳（空值视为从未备份）
 * @param {number} now 当前毫秒时间戳
 * @param {number} [intervalMs] 间隔，默认 24h
 * @returns {boolean}
 */
export function shouldAutoBackup(lastAt, now, intervalMs = AUTO_BACKUP_INTERVAL_MS) {
  const last = Number(lastAt)
  if (!Number.isFinite(last) || last <= 0) return true
  const span = Number(now) - last
  if (!Number.isFinite(span)) return true
  return span >= intervalMs
}

/**
 * 从备份文件名列表里挑出应删除的旧文件（按文件名时间戳升序，留最新 keep 份）
 * 只认 siji-backup-*.json，目录里的其他文件不参与也不删除
 * @param {string[]} names
 * @param {number} [keep] 保留份数，默认 3
 * @returns {string[]} 应删除的文件名数组（升序，最旧的在前）
 */
export function pickKeepLatest(names, keep = KEEP_COUNT) {
  const n = Number(keep)
  const keepCount = Number.isFinite(n) && n >= 0 ? n : KEEP_COUNT
  const backups = (Array.isArray(names) ? names : [])
    .filter(name => typeof name === 'string' && BACKUP_NAME_RE.test(name))
    .sort()
  const deleteCount = backups.length - keepCount
  if (deleteCount <= 0) return []
  return backups.slice(0, deleteCount)
}

/**
 * 备份文件名 → 毫秒时间戳（解析失败返回 0）
 * @param {string} name
 * @returns {number}
 */
export function fileNameToTime(name) {
  const m = /^siji-backup-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.json$/.exec(String(name || ''))
  if (!m) return 0
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime()
}

// ==================== 运行环境 ====================

/**
 * App 运行时判定（plus.io 可用）
 * 写法兼容三端编译与 vitest：#ifdef 裁剪分支，typeof 守卫防 Node 下 ReferenceError
 */
function isAppRuntime() {
  // #ifdef APP-PLUS
  try {
    return typeof plus !== 'undefined' && !!(plus && plus.io)
  } catch (e) {
    return false
  }
  // #endif
  // #ifndef APP-PLUS
  return false
  // #endif
}

/** 开关是否打开（默认开：只有显式存 '0' 才算关） */
export function isAutoBackupEnabled() {
  const v = uni.getStorageSync(AUTO_BACKUP_SWITCH_KEY)
  return v !== '0'
}

// ==================== App 文件层（plus.io） ====================

/** 拿备份目录（不存在则创建） */
function getBackupDir() {
  return new Promise((resolve, reject) => {
    plus.io.requestFileSystem(plus.io.PRIVATE_DOC, (fs) => {
      fs.root.getDirectory(BACKUP_DIR, { create: true }, resolve, (e) => reject(new Error('打开备份目录失败')))
    }, () => reject(new Error('打开私有文档目录失败')))
  })
}

/** 在目录里写文件（覆盖同名） */
function writeBackupFile(dirEntry, name, text) {
  return new Promise((resolve, reject) => {
    dirEntry.getFile(name, { create: true }, (fileEntry) => {
      fileEntry.createWriter((writer) => {
        writer.onwrite = () => resolve(name)
        writer.onerror = () => reject(new Error('写入备份文件失败'))
        writer.write(text)
      }, () => reject(new Error('创建写入器失败')))
    }, () => reject(new Error('创建备份文件失败')))
  })
}

/** 列目录下的全部条目 */
function readDirEntries(dirEntry) {
  return new Promise((resolve, reject) => {
    const reader = dirEntry.createReader()
    reader.readEntries((entries) => resolve(Array.isArray(entries) ? entries : []), () => reject(new Error('读取备份目录失败')))
  })
}

/** 删除目录里的单个文件（失败不中断流程，静默跳过） */
function removeFile(dirEntry, name) {
  return new Promise((resolve) => {
    dirEntry.getFile(name, { create: false }, (fileEntry) => {
      fileEntry.remove(() => resolve(true), () => resolve(false))
    }, () => resolve(false))
  })
}

// ==================== 对外 API ====================

/**
 * 立即创建一份自动备份（App 端；其他端返回 only-app）
 * @returns {Promise<{ok:boolean, name?:string, deleted?:string[], reason?:string, message?:string}>}
 */
export function createAutoBackup() {
  if (!isAppRuntime()) return Promise.resolve({ ok: false, reason: 'only-app' })
  let json
  try {
    json = exportBackupJson()
  } catch (e) {
    return Promise.resolve({ ok: false, reason: 'export-failed', message: (e && e.message) || String(e) })
  }
  if (!json || json.length < 20) {
    return Promise.resolve({ ok: false, reason: 'export-failed', message: '备份内容为空' })
  }
  const name = buildBackupFileName(new Date())
  return getBackupDir()
    .then(dir => writeBackupFile(dir, name, json))
    .then(() => pruneOldBackups())
    .then(deleted => ({ ok: true, name, deleted }))
    .catch((e) => ({ ok: false, reason: 'write-failed', message: (e && e.message) || String(e) }))
}

/** 写完新备份后清理：删旧留新（保留 KEEP_COUNT 份） */
async function pruneOldBackups() {
  const dir = await getBackupDir()
  const entries = await readDirEntries(dir)
  const names = entries.filter(e => e && e.isFile && BACKUP_NAME_RE.test(e.name)).map(e => e.name)
  const toDelete = pickKeepLatest(names, KEEP_COUNT)
  for (const name of toDelete) {
    await removeFile(dir, name)
  }
  return toDelete
}

/**
 * 列出本机自动备份（App 端；其他端返回 []），按时间新→旧
 * @returns {Promise<Array<{name:string, size:number, time:number}>>}
 */
export async function listAutoBackups() {
  if (!isAppRuntime()) return []
  try {
    const dir = await getBackupDir()
    const entries = await readDirEntries(dir)
    const stats = await Promise.all(entries.filter(e => e && e.isFile).map(entry => new Promise((resolve) => {
      entry.file((f) => {
        resolve({
          name: entry.name,
          size: f && f.size ? f.size : 0,
          time: fileNameToTime(entry.name) || (f && f.lastModifiedDate ? new Date(f.lastModifiedDate).getTime() : 0)
        })
      }, () => resolve({ name: entry.name, size: 0, time: fileNameToTime(entry.name) }))
    })))
    return stats
      .filter(item => BACKUP_NAME_RE.test(item.name))
      .sort((a, b) => b.time - a.time || (a.name < b.name ? 1 : -1))
  } catch (e) {
    return []
  }
}

/**
 * 恢复一份本机自动备份（读文件 → importBackup 合并写入；确认弹窗由页面负责）
 * @param {string} name 备份文件名
 * @returns {Promise<{ok:boolean, total?:number, skipped?:number, reason?:string, message?:string}>}
 */
export function restoreAutoBackup(name) {
  if (!isAppRuntime()) return Promise.resolve({ ok: false, reason: 'only-app' })
  if (!BACKUP_NAME_RE.test(String(name || ''))) {
    return Promise.resolve({ ok: false, reason: 'bad-name', message: '不是有效的备份文件名' })
  }
  return getBackupDir()
    .then(dir => new Promise((resolve, reject) => {
      dir.getFile(name, { create: false }, resolve, () => reject(new Error('备份文件不存在，可能已被清理')))
    }))
    .then(fileEntry => new Promise((resolve, reject) => {
      fileEntry.file((f) => {
        const reader = new plus.io.FileReader()
        reader.onloadend = (e) => resolve(e && e.target ? e.target.result : '')
        reader.onerror = () => reject(new Error('读取备份内容失败'))
        reader.readAsText(f)
      }, () => reject(new Error('读取备份文件失败')))
    }))
    .then((text) => {
      const r = importBackup(text)
      return { ok: true, total: r.total, skipped: r.skipped }
    })
    .catch((e) => ({ ok: false, reason: 'restore-failed', message: (e && e.message) || String(e) }))
}

/**
 * 启动接线（App.vue appReady 调用）：开关开且距上次超过 24h → 静默备份并记录时间
 * 非 App 端 / 未到间隔 / 备份失败都返回 false，不抛错、不打扰用户
 * @returns {Promise<boolean>} 本次是否真的执行了备份
 */
export function runAutoBackup() {
  if (!isAppRuntime()) return Promise.resolve(false)
  if (!isAutoBackupEnabled()) return Promise.resolve(false)
  const last = Number(uni.getStorageSync(AUTO_BACKUP_LAST_KEY)) || 0
  if (!shouldAutoBackup(last, Date.now())) return Promise.resolve(false)
  return createAutoBackup().then((r) => {
    if (r && r.ok) {
      uni.setStorageSync(AUTO_BACKUP_LAST_KEY, String(Date.now()))
      return true
    }
    return false
  })
}
