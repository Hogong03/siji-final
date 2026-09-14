/**
 * backup-file.js — 备份文件的跨端落盘/复制
 *
 * 平台策略（与 dev-feedback 的保存逻辑一致）：
 *   - App：写文件到 _doc/backup/（应用私有目录，可在开发者工具/文件管理中取出）
 *   - H5：Blob 触发浏览器下载
 *   - 小程序：无文件系统外发能力，提示用复制
 */

/** 生成备份文件名 siji-backup-YYYYMMDD-HHmmss.json */
export function buildBackupFileName(now = new Date()) {
  const pad = n => String(n).padStart(2, '0')
  const stamp = now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) +
    '-' + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds())
  return 'siji-backup-' + stamp + '.json'
}

/** App 端写入 _doc/backup/ 并返回完整路径 */
function writeAppFile(text, name) {
  return new Promise((resolve, reject) => {
    if (!plus || !plus.io) {
      reject(new Error('当前环境不支持文件写入'))
      return
    }
    plus.io.requestFileSystem(plus.io.PRIVATE_DOC, (fs) => {
      fs.root.getDirectory('backup', { create: true }, (dir) => {
        dir.getFile(name, { create: true }, (fileEntry) => {
          fileEntry.createWriter((writer) => {
            writer.onwrite = () => resolve(fileEntry.fullPath)
            writer.onerror = () => reject(new Error('写入失败'))
            writer.write(text)
          }, (e) => reject(e))
        }, (e) => reject(e))
      }, (e) => reject(e))
    }, (e) => reject(e))
  })
}

/**
 * 保存备份文本到文件（App/H5），小程序环境返回 false（提示用复制）
 * @returns {Promise<{ ok: boolean, path?: string, message?: string }>}
 */
export function saveBackupToFile(text, name) {
  const fileName = name || buildBackupFileName()
  // #ifdef APP-PLUS
  return writeAppFile(text, fileName).then(path => ({ ok: true, path }))
  // #endif
  // #ifdef H5
  try {
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    return Promise.resolve({ ok: true, path: fileName })
  } catch (e) {
    return Promise.resolve({ ok: false, message: '浏览器下载失败，请改用复制' })
  }
  // #endif
  // #ifndef APP-PLUS || H5
  return Promise.resolve({ ok: false, message: '当前平台请使用复制备份' })
  // #endif
}
