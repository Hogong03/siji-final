/**
 * picker.js — 选一个文件（3.6.0）
 *
 * 平台差异（按官方支持表落地，不猜）：
 *   H5        uni.chooseFile 可用
 *   App       uni.chooseFile 不支持（需原生插件），给能立刻做的两条路，不装死
 *   微信小程序  wx.chooseMessageFile 可用（从聊天记录里选文件）
 *
 * 统一返回 { ok, pick }，pick 直接喂给 readPickedFile()。
 */
import { pickerExtensions, baseNameOf } from './file-types.js'

/** App 端没有系统文件选择器，提示里给的是 App 端真能走通的两条路 */
export const APP_PICK_HINT = 'App 端系统文件选择需原生插件：可截图发我识别，或把文字粘贴进来'

/** 能不能直接交给 FileReader（H5 的 chooseFile 返回的可能是原始 File） */
function fileLikeOf(x) {
  try {
    if (!x || typeof x !== 'object') return null
    if (typeof Blob === 'undefined') return null
    return (x instanceof Blob) ? x : null
  } catch (e) {
    return null
  }
}

/**
 * 三端 tempFile 形状不同，统一成 { path, name, size, mime, file }
 * @param {Object} tempFile chooseFile / chooseMessageFile 的 tempFiles[0]
 * @param {Array} [tempFilePaths] 兜底路径数组
 */
export function toPick(tempFile, tempFilePaths) {
  const f = tempFile || {}
  const path = f.path || f.tempFilePath || (tempFilePaths && tempFilePaths[0]) || ''
  return {
    path: path,
    name: f.name || baseNameOf(path) || '',
    size: Number(f.size) || 0,
    mime: f.type || f.mimeType || '',
    file: fileLikeOf(f)
  }
}

/** 官方示例给的是带点的后缀（['.zip','.txt']），这里统一加上点 */
function extWithDot() {
  return pickerExtensions().map(e => (e.charAt(0) === '.' ? e : '.' + e))
}

/** H5：uni.chooseFile */
function pickH5() {
  return new Promise((resolve) => {
    if (typeof uni === 'undefined' || typeof uni.chooseFile !== 'function') {
      resolve({ ok: false, reason: '当前环境不支持选择文件' })
      return
    }
    uni.chooseFile({
      count: 1,
      type: 'all',
      extension: extWithDot(),
      success(res) {
        const f = (res && res.tempFiles && res.tempFiles[0]) || null
        if (!f) { resolve({ ok: false, reason: '没有选中文件' }); return }
        resolve({ ok: true, pick: toPick(f, res && res.tempFilePaths) })
      },
      fail() { resolve({ ok: false, reason: '' }) }
    })
  })
}

/** 微信小程序：只能从聊天记录里转发文件 */
function pickMp() {
  return new Promise((resolve) => {
    if (typeof wx === 'undefined' || typeof wx.chooseMessageFile !== 'function') {
      resolve({ ok: false, reason: '当前小程序不支持选文件' })
      return
    }
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      success(res) {
        const f = (res && res.tempFiles && res.tempFiles[0]) || null
        if (!f) { resolve({ ok: false, reason: '没有选中文件' }); return }
        resolve({ ok: true, pick: toPick(f, null) })
      },
      fail() { resolve({ ok: false, reason: '' }) }
    })
  })
}

/**
 * 选一个文件
 * @returns {Promise<{ ok: boolean, pick?: Object, reason?: string }>}
 *   reason 为空串表示用户主动取消，UI 不用提示
 */
export function pickOneFile() {
  // #ifdef H5
  return pickH5()
  // #endif
  // #ifdef MP-WEIXIN
  return pickMp()
  // #endif
  // #ifndef H5 || MP-WEIXIN
  return Promise.resolve({ ok: false, reason: APP_PICK_HINT })
  // #endif
}