/**
 * local-io.js — 本地文件读取（3.6.0）
 *
 * 三端各一条路，全部收在这一个文件里，调用方不用管平台：
 *   H5  ：FileReader（优先用 picker 给的 File 对象，其次 fetch blob URL）
 *   App ：plus.io.resolveLocalFileSystemURL + plus.io.FileReader（与 utils/image.js 同一套）
 *   小程序：wx.getFileSystemManager().readFile
 *
 * 读取失败一律 resolve(null) 风格：不抛异常、不卡 UI，由调用方给用户文案。
 */
import { logger } from '@/utils/logger.js'

/** H5：读出文本 */
function readH5Text(input) {
  // #ifdef H5
  return new Promise((resolve) => {
    const file = input && input.file
    if (file && typeof FileReader !== 'undefined') {
      try {
        const fr = new FileReader()
        fr.onload = () => resolve(typeof fr.result === 'string' ? fr.result : '')
        fr.onerror = () => resolve(null)
        fr.readAsText(file)
        return
      } catch (e) {
        // file 不是 Blob（App / 小程序传进来的普通对象）→ 落到 URL 分支
      }
    }
    const path = input && input.path
    if (!path || typeof fetch !== 'function') { resolve(null); return }
    fetch(path)
      .then(r => r.text())
      .then(t => resolve(t))
      .catch(() => resolve(null))
  })
  // #endif
  // #ifndef H5
  return Promise.resolve(null)
  // #endif
}

/** H5：读出 base64（不含 data: 前缀） */
function readH5Base64(input) {
  // #ifdef H5
  return new Promise((resolve) => {
    const file = input && input.file
    if (!file || typeof FileReader === 'undefined') { resolve(null); return }
    try {
      const fr = new FileReader()
      fr.onload = () => {
        const r = String(fr.result || '')
        const comma = r.indexOf(',')
        resolve(comma >= 0 ? r.slice(comma + 1) : r)
      }
      fr.onerror = () => resolve(null)
      fr.readAsDataURL(file)
    } catch (e) {
      resolve(null)
    }
  })
  // #endif
  // #ifndef H5
  return Promise.resolve(null)
  // #endif
}

/** App：plus.io 读文本 */
function readAppText(path) {
  // #ifdef APP-PLUS
  return new Promise((resolve) => {
    if (!path || typeof plus === 'undefined' || !plus.io) { resolve(null); return }
    plus.io.resolveLocalFileSystemURL(path, (entry) => {
      entry.file((f) => {
        const fr = new plus.io.FileReader()
        fr.onloadend = (e) => resolve(e && e.target ? e.target.result : null)
        fr.onerror = () => resolve(null)
        fr.readAsText(f)
      }, () => resolve(null))
    }, () => resolve(null))
  })
  // #endif
  // #ifndef APP-PLUS
  return Promise.resolve(null)
  // #endif
}

/** App：plus.io 读 base64 */
function readAppBase64(path) {
  // #ifdef APP-PLUS
  return new Promise((resolve) => {
    if (!path || typeof plus === 'undefined' || !plus.io) { resolve(null); return }
    plus.io.resolveLocalFileSystemURL(path, (entry) => {
      entry.file((f) => {
        const fr = new plus.io.FileReader()
        fr.onloadend = (e) => {
          const r = e && e.target ? String(e.target.result || '') : ''
          const comma = r.indexOf(',')
          resolve(comma >= 0 ? r.slice(comma + 1) : r)
        }
        fr.onerror = () => resolve(null)
        fr.readAsDataURL(f)
      }, () => resolve(null))
    }, () => resolve(null))
  })
  // #endif
  // #ifndef APP-PLUS
  return Promise.resolve(null)
  // #endif
}

/** 小程序：FileSystemManager 读文本 */
function readMpText(path) {
  // #ifdef MP
  return new Promise((resolve) => {
    if (!path) { resolve(null); return }
    try {
      const fsm = uni.getFileSystemManager()
      fsm.readFile({
        filePath: path,
        encoding: 'utf8',
        success: (res) => resolve(res.data),
        fail: () => resolve(null)
      })
    } catch (e) {
      resolve(null)
    }
  })
  // #endif
  // #ifndef MP
  return Promise.resolve(null)
  // #endif
}

/** 小程序：FileSystemManager 读 base64 */
function readMpBase64(path) {
  // #ifdef MP
  return new Promise((resolve) => {
    if (!path) { resolve(null); return }
    try {
      const fsm = uni.getFileSystemManager()
      fsm.readFile({
        filePath: path,
        encoding: 'base64',
        success: (res) => resolve(res.data),
        fail: () => resolve(null)
      })
    } catch (e) {
      resolve(null)
    }
  })
  // #endif
  // #ifndef MP
  return Promise.resolve(null)
  // #endif
}

/**
 * 读本地文件为文本
 * @param {{ path?: string, file?: any }} input picker 返回的 tempFilePaths / tempFiles
 * @returns {Promise<string|null>} 失败返回 null
 */
export function readLocalText(input) {
  const path = input && input.path
  return readH5Text(input)
    .then(t => (t === null || t === undefined) ? readAppText(path) : t)
    .then(t => (t === null || t === undefined) ? readMpText(path) : t)
    .catch((e) => {
      logger.warn('[FileIO] 读文本失败', e && e.message)
      return null
    })
}

/**
 * 读本地文件为 base64（文档解析后端上传用）
 * @param {{ path?: string, file?: any }} input
 * @returns {Promise<string|null>}
 */
export function readLocalBase64(input) {
  const path = input && input.path
  return readH5Base64(input)
    .then(t => (t === null || t === undefined) ? readAppBase64(path) : t)
    .then(t => (t === null || t === undefined) ? readMpBase64(path) : t)
    .catch(() => null)
}
