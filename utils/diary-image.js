/**
 * utils/diary-image.js — 记录照片统一入口（4.11.0）
 *
 * 选图 → 按平台持久化 → 返回可存路径。平台代码收在这里，页面只调 pickDiaryImages。
 * 三端落盘策略：
 *  - App：拷贝到 _doc/diary-img/（plus.io 读写，重启不丢）；写入用与 utils/image.js
 *    saveImageToLocal 同一套已验证原语（resolveLocalFileSystemURL → FileReader.readAsDataURL
 *    → createWriter.write），不引入未验证的 copyTo 通道
 *  - 微信小程序：拷贝到 USER_DATA_PATH/diary-img/（fs.copyFile，失败退 read+write）
 *  - H5：canvas 压缩成长边 <=1280 的 dataURL 直接存（H5 无文件系统，dataURL 即路径）
 * base64/dataURL 在 App/MP 端禁止持久化 —— 这两端落盘的都是二进制文件。
 */
import { previewImage as previewImages } from './image.js'

export const MAX_DIARY_IMAGES = 9

/** H5 压缩目标：长边上限 px */
const H5_MAX_EDGE = 1280
const H5_QUALITY = 0.8

/**
 * 选图并持久化（对齐 store/executors/diary.js 的 normalizeImages 口径：字符串数组，<=9 张）
 * @param {number} alreadyCount 已有照片数
 * @returns {Promise<string[]>} 本轮新增的可存路径数组；用户取消/失败返回 []
 */
export function pickDiaryImages(alreadyCount) {
  const existing = Math.max(0, Math.floor(Number(alreadyCount) || 0))
  const remaining = MAX_DIARY_IMAGES - existing
  if (remaining <= 0) {
    uni.showToast({ title: `最多 ${MAX_DIARY_IMAGES} 张`, icon: 'none' })
    return Promise.resolve([])
  }
  return new Promise((resolve) => {
    uni.chooseImage({
      count: remaining,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const paths = (res && res.tempFilePaths ? res.tempFilePaths : []).filter(Boolean)
        if (paths.length === 0) { resolve([]); return }
        Promise.all(paths.map((p, i) => persistOne(p, i))).then((kept) => {
          resolve(kept.filter(Boolean))
        })
      },
      fail: (err) => {
        const msg = err && err.errMsg ? String(err.errMsg) : ''
        if (msg.indexOf('cancel') < 0) {
          uni.showToast({ title: '选择图片失败', icon: 'none' })
        }
        resolve([])
      }
    })
  })
}

/** 预览（统一走 utils/image.js 的 App 加固版：_doc/ 转 file:// 、base64 转存，防真机崩溃） */
export function previewDiaryImages(urls, current) {
  previewImages(urls, current)
}

/** 单张持久化：按平台分流，失败返回 null（调用方 filter 掉） */
function persistOne(tempPath, idx) {
  return persistH5(tempPath)
    .then((r) => { if (r !== SKIP) return r; return persistApp(tempPath, idx) })
    .then((r) => { if (r !== SKIP) return r; return persistMP(tempPath, idx) })
    .then((r) => (r === SKIP ? null : r))
    .catch(() => null)
}

/** 哨兵：本平台不处理，交给下一个分支 */
const SKIP = '__skip__'

// ─── H5：canvas 压缩成 dataURL ───
function persistH5(path) {
  return new Promise((resolve) => {
    // #ifdef H5
    const img = new Image()
    img.onload = () => {
      let width = img.width
      let height = img.height
      if (width > H5_MAX_EDGE || height > H5_MAX_EDGE) {
        const ratio = Math.min(H5_MAX_EDGE / width, H5_MAX_EDGE / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(null); return }
      ctx.drawImage(img, 0, 0, width, height)
      const dataURL = canvas.toDataURL('image/jpeg', H5_QUALITY)
      canvas.width = 0
      canvas.height = 0
      img.src = ''
      resolve(dataURL || null)
    }
    img.onerror = () => { img.src = ''; resolve(null) }
    img.src = path
    // #endif
    // #ifndef H5
    resolve(SKIP)
    // #endif
  })
}

// ─── App：读临时文件 → 写 _doc/diary-img/ ───
const APP_DIR = '_doc/diary-img/'

function persistApp(tempPath, idx) {
  return new Promise((resolve) => {
    // #ifdef APP-PLUS
    try {
      readTempAsDataURL(tempPath).then((dataURL) => {
        if (!dataURL) { resolve(null); return }
        writeDataURLToDoc(dataURL, idx).then(resolve)
      })
    } catch (e) {
      resolve(null)
    }
    // #endif
    // #ifndef APP-PLUS
    resolve(SKIP)
    // #endif
  })
}

/** 读临时文件为 dataURL（plus.io 原语，与 utils/image.js compressWithUni 同款） */
function readTempAsDataURL(path) {
  return new Promise((resolve) => {
    plus.io.resolveLocalFileSystemURL(path, (entry) => {
      entry.file((file) => {
        const reader = new plus.io.FileReader()
        reader.onloadend = (e) => resolve(e.target.result || null)
        reader.onerror = () => resolve(null)
        reader.readAsDataURL(file)
      }, () => resolve(null))
    }, () => resolve(null))
  })
}

/** 把 dataURL 写进 _doc/diary-img/，返回 fullPath（形如 _doc/diary-img/dimg_xxx.jpg） */
function writeDataURLToDoc(dataURL, idx) {
  return new Promise((resolve) => {
    const m = String(dataURL || '').match(/^data:image\/(\w+);base64,(.+)$/)
    if (!m) { resolve(null); return }
    const ext = m[1] === 'jpeg' ? 'jpg' : m[1]
    const pure = m[2]
    const filename = `dimg_${Date.now()}_${idx}_${Math.floor(Math.random() * 1000)}.${ext}`
    const writeInto = (dirEntry) => {
      dirEntry.getFile(filename, { create: true }, (fileEntry) => {
        fileEntry.createWriter((writer) => {
          writer.onwriteend = () => resolve(fileEntry.fullPath || (APP_DIR + filename))
          writer.onerror = () => resolve(null)
          const bytes = atob(pure)
          const arr = new Uint8Array(bytes.length)
          for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
          writer.write(new Blob([arr], { type: `image/${m[1]}` }))
        }, () => resolve(null))
      }, () => resolve(null))
    }
    plus.io.resolveLocalFileSystemURL(APP_DIR, writeInto, () => {
      // 目录不存在：先建目录再写
      plus.io.resolveLocalFileSystemURL('_doc', (docEntry) => {
        docEntry.getDirectory('diary-img', { create: true }, writeInto, () => resolve(null))
      }, () => resolve(null))
    })
  })
}

// ─── 微信小程序：拷贝进 USER_DATA_PATH ───
function persistMP(tempPath, idx) {
  return new Promise((resolve) => {
    // #ifdef MP-WEIXIN
    try {
      const fs = wx.getFileSystemManager()
      const dir = `${wx.env.USER_DATA_PATH}/diary-img`
      const extMatch = /\.(\w+)$/.exec(String(tempPath))
      const filename = `${dir}/dimg_${Date.now()}_${idx}.${extMatch ? extMatch[1] : 'jpg'}`
      try { fs.mkdirSync(dir, true) } catch (e) { /* 已存在抛错，忽略 */ }
      fs.copyFile({
        srcPath: tempPath,
        destPath: filename,
        success: () => resolve(filename),
        fail: () => {
          // copyFile 失败退 read+write（标准 wx API，覆盖跨目录拷不动的情况）
          try {
            const b64 = fs.readFileSync(tempPath, 'base64')
            fs.writeFileSync(filename, b64, 'base64')
            resolve(filename)
          } catch (e) {
            resolve(null)
          }
        }
      })
    } catch (e) {
      resolve(null)
    }
    // #endif
    // #ifndef MP-WEIXIN
    resolve(SKIP)
    // #endif
  })
}
