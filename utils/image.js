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
      if (width > MAX_SIZE || height > MAX_SIZE) {
        const ratio = Math.min(MAX_SIZE / width, MAX_SIZE / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(null); return }
      ctx.drawImage(img, 0, 0, width, height)

      let base64 = ''
      for (let q = QUALITY; q >= 40; q -= 10) {
        base64 = canvas.toDataURL('image/jpeg', q / 100)
        if (base64.length * 0.75 <= MAX_FILE_SIZE || q <= 40) break
      }

      canvas.toBlob((blob) => {
        resolve({
          base64,
          width,
          height,
          size: blob ? blob.size : Math.round(base64.length * 0.75)
        })
      }, 'image/jpeg', 0.7)
    }
    img.onerror = () => resolve(null)
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

  // OpenAI vision 格式：{ type: 'image_url', image_url: { url: 'data:...' } }
  // 智谱/DeepSeek/通义均兼容此格式
  return [
    { type: 'text', text: text || '请识别并分析此图中的聊天记录，提取关键信息' },
    {
      type: 'image_url',
      image_url: {
        url: image.base64,
        detail: (image.width || 0) > 1024 ? 'high' : 'auto'
      }
    }
  ]
}
