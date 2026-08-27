/**
 * utils/image.js — 图片压缩与多模态工具
 *
 * 功能：
 *  - chooseAndCompress: 选择图片 → 压缩 → 返回 base64
 *  - compressImage: Canvas 压缩（H5）/ uni.compressImage（App）
 *  - buildVisionMessage: 构建多模态消息格式
 *  - 目标：≤ 1MB / ≤ 1024px，适配主流 vision 模型限制
 *  - 支持平台：H5、App、微信小程序
 */
import { logger } from './logger.js'

/** 压缩配置 */
const MAX_SIZE = 1024
const MAX_FILE_SIZE = 1024 * 1024
const QUALITY = 80

/** 判断当前是否为 H5 环境 */
function isH5() {
  // #ifdef H5
  return true
  // #endif
  // #ifndef H5
  return false
  // #endif
}

/**
 * 选择图片并压缩为 base64
 * @returns {Promise<{base64:string, width:number, height:number, size:number}|null>}
 */
export function chooseAndCompress() {
  return new Promise((resolve) => {
    uni.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const path = res.tempFilePaths?.[0]
        if (!path) { resolve(null); return }
        // 全部走压缩流程，避免本地路径（blob: / file: / temp）被当作 URL 传给 AI
        compressImage(path).then(resolve).catch(() => resolve(null))
      },
      fail: (err) => {
        logger.warn('chooseImage failed', err)
        resolve(null)
      }
    })
  })
}

/**
 * 压缩图片到适配 vision 模型的尺寸
 */
function compressImage(path) {
  if (isH5()) return compressWithCanvas(path)
  return compressWithUni(path)
}

/**
 * H5 Canvas 压缩
 */
function compressWithCanvas(path) {
  return new Promise((resolve) => {
    // #ifdef H5
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      const needsResize = width > MAX_SIZE || height > MAX_SIZE
      if (needsResize) {
        const ratio = Math.min(MAX_SIZE / width, MAX_SIZE / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(null); img.src = ''; return }
      ctx.drawImage(img, 0, 0, width, height)
      // 释放 Image 对象内存
      img.src = ''

      // 渐进降质：从配置质量开始，每降10级试一次
      let base64 = ''
      for (let q = QUALITY; q >= 40; q -= 10) {
        base64 = canvas.toDataURL('image/jpeg', q / 100)
        if (base64.length * 0.75 <= MAX_FILE_SIZE || q <= 40) break
      }

      // 跳过不必要的 Blob 转换——已拿到 base64，直接用 length 估大小
      const estSize = Math.round(base64.length * 0.75)
      canvas.width = 0; canvas.height = 0 // 释放 Canvas 内存
      resolve({ base64, width, height, size: estSize })
    }
    img.onerror = () => { img.src = ''; resolve(null) }
    img.src = path
    // #endif
    // #ifndef H5
    resolve(null)
    // #endif
  })
}

/**
 * App/小程序 uni.compressImage → 转 base64
 */
function compressWithUni(path) {
  return new Promise((resolve) => {
    // #ifdef APP-PLUS
    uni.compressImage({
      src: path,
      quality: QUALITY,
      compressedWidth: MAX_SIZE,
      success: (res) => {
        const compressedPath = res.tempFilePath
        plus.io.resolveLocalFileSystemURL(compressedPath, (entry) => {
          entry.file((file) => {
            const reader = new plus.io.FileReader()
            reader.onloadend = (e) => {
              resolve({
                base64: e.target.result,
                width: res.width || 0,
                height: res.height || 0,
                size: file.size || 0
              })
            }
            reader.readAsDataURL(file)
          })
        }, () => resolve(null))
      },
      fail: () => resolve(null)
    })
    // #endif
    // #ifdef MP-WEIXIN
    uni.compressImage({
      src: path,
      quality: QUALITY,
      compressedWidth: MAX_SIZE,
      success: (res) => {
        const fs = wx.getFileSystemManager()
        fs.readFile({
          filePath: res.tempFilePath,
          encoding: 'base64',
          success: (readRes) => {
            resolve({
              base64: `data:image/jpeg;base64,${readRes.data}`,
              width: res.width || 0,
              height: res.height || 0,
              size: readRes.data ? Math.round(readRes.data.length * 0.75) : 0
            })
          },
          fail: () => resolve(null)
        })
      },
      fail: () => resolve(null)
    })
    // #endif
  })
}

/**
 * 构建多模态消息格式
 * @param {string} text - 用户输入的文本
 * @param {object} image - 图片数据 { base64, width, height }
 * @param {string} providerId - AI 厂商 ID
 * @returns {string|array} 单模态返回 string，多模态返回 content array
 */
export function buildVisionMessage(text, image, providerId) {
  if (!image || !image.base64) return text

  // 安全校验：只接受 data: URL，拒绝本地路径（blob:/file:/temp:/http://localhost 等）
  const url = image.base64
  if (!url.startsWith('data:')) {
    logger.warn(`[Vision] 忽略非 base64 的图片 URL: ${url.substring(0, 50)}...`)
    return text
  }

  // OpenAI vision 格式：{ type: 'image_url', image_url: { url: 'data:...' } }
  // 智谱/DeepSeek/通义均兼容此格式
  return [
    { type: 'text', text: text || '请识别并分析此图中的聊天记录，提取关键信息' },
    {
      type: 'image_url',
      image_url: {
        url,
        detail: (image.width || 0) > 1024 ? 'high' : 'auto'
      }
    }
  ]
}

/**
 * 将 base64 图片保存到本地文件系统
 * @param {string} base64 - data:image/...;base64,... 格式
 * @returns {Promise<string|null>} 保存后的本地路径，失败返回 null
 */
export function saveImageToLocal(base64) {
  return new Promise((resolve) => {
    if (!base64 || !base64.startsWith('data:')) { resolve(null); return }

    // 从 data URL 提取 mime 和纯 base64
    const match = base64.match(/^data:(image\/(\w+));base64,(.+)$/)
    if (!match) { resolve(null); return }
    const ext = match[2] === 'jpeg' ? 'jpg' : match[2]
    const pureBase64 = match[3]

    // #ifdef H5
    // H5：转 Blob → 下载链接（浏览器保存）
    try {
      const bytes = atob(pureBase64)
      const arr = new Uint8Array(bytes.length)
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
      const blob = new Blob([arr], { type: `image/${match[2]}` })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `siji_${Date.now()}.${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      resolve(url)
    } catch (e) {
      logger.error('H5 saveImage failed', e)
      resolve(null)
    }
    // #endif

    // #ifdef APP-PLUS
    // App：写文件到 _doc/siji_images/
    try {
      const dir = '_doc/siji_images/'
      const filename = `img_${Date.now()}.${ext}`
      plus.io.resolveLocalFileSystemURL(dir, (dirEntry) => {
        dirEntry.getFile(filename, { create: true }, (fileEntry) => {
          fileEntry.createWriter((writer) => {
            writer.onwriteend = () => resolve(fileEntry.fullPath)
            writer.onerror = () => resolve(null)
            // 写入 base64 数据
            const bytes = atob(pureBase64)
            const arr = new Uint8Array(bytes.length)
            for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
            const blob = new Blob([arr], { type: `image/${match[2]}` })
            writer.write(blob)
          }, () => resolve(null))
        }, () => resolve(null))
      }, () => {
        // 目录不存在，先创建
        plus.io.resolveLocalFileSystemURL('_doc', (docEntry) => {
          docEntry.getDirectory('siji_images', { create: true }, (newDirEntry) => {
            newDirEntry.getFile(filename, { create: true }, (fileEntry) => {
              fileEntry.createWriter((writer) => {
                writer.onwriteend = () => resolve(fileEntry.fullPath)
                writer.onerror = () => resolve(null)
                const bytes = atob(pureBase64)
                const arr = new Uint8Array(bytes.length)
                for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
                const blob = new Blob([arr], { type: `image/${match[2]}` })
                writer.write(blob)
              }, () => resolve(null))
            }, () => resolve(null))
          }, () => resolve(null))
        }, () => resolve(null))
      })
    } catch (e) {
      logger.error('App saveImage failed', e)
      resolve(null)
    }
    // #endif

    // #ifdef MP-WEIXIN
    // 小程序：写文件到本地
    try {
      const fs = wx.getFileSystemManager()
      const filePath = `${wx.env.USER_DATA_PATH}/siji_${Date.now()}.${ext}`
      fs.writeFileSync(filePath, pureBase64, 'base64')
      resolve(filePath)
    } catch (e) {
      logger.error('MP saveImage failed', e)
      resolve(null)
    }
    // #endif

    // #ifndef H5 || APP-PLUS || MP-WEIXIN
    resolve(null)
    // #endif
  })
}

/**
 * 预览图片（全屏查看）
 *
 * App 端加固（真机崩溃防护）：
 *  - `_doc/` / `_file/` 等相对路径 → `plus.io.convertLocalFileSystemURL` 转 file:// 绝对路径
 *  - base64 图片先转存本地文件再预览（超大 base64 直接传给原生层会导致内存暴涨崩溃）
 *  - current 传索引而非 URL 字符串（部分端对非 http URL 解析不稳）
 *
 * @param {string[]} urls - 图片 URL/base64 数组
 * @param {number} [current=0] - 当前索引
 */
export async function previewImage(urls, current = 0) {
  const list = (Array.isArray(urls) ? urls : [urls]).filter(Boolean)
  if (list.length === 0) return

  let normalized = list
  // #ifdef APP-PLUS
  try {
    normalized = (await Promise.all(list.map(async (url) => {
      if (typeof url !== 'string' || !url) return ''
      if (url.startsWith('data:')) {
        // base64 转存本地（_doc/siji_images/），转存失败则不预览（避免崩溃）
        const saved = await saveImageToLocal(url)
        if (!saved) {
          uni.showToast({ title: '图片过大，无法预览', icon: 'none' })
          return ''
        }
        return plus.io.convertLocalFileSystemURL(saved)
      }
      if (url.startsWith('_doc/') || url.startsWith('_file/') || url.startsWith('_www/')) {
        return plus.io.convertLocalFileSystemURL(url)
      }
      return url
    }))).filter(Boolean)
    if (normalized.length === 0) return
  } catch (e) {
    logger.warn('previewImage normalize failed', e)
  }
  // #endif

  uni.previewImage({
    urls: normalized,
    current: Math.min(current, normalized.length - 1),
    fail: (e) => logger.warn('previewImage failed', e)
  })
}
