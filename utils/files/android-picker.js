/**
 * android-picker.js — App 端（Android）系统文件选择 + 读进沙盒（3.7.5）
 *
 * 为什么不用插件：ACTION_GET_CONTENT / ACTION_OPEN_DOCUMENT 是 Android 系统自带的选择器，
 * 用 plus.android 直接调即可 —— 不需要原生插件、不需要存储权限（SAF 只授权用户选中的那一个文件）。
 *
 * 为什么先拷贝进沙盒：系统选择器给的是 content:// URI，plus.io 读不了、uni.uploadFile 也传不了。
 * 拷贝用 FileChannel.transferFrom 在 Java 侧完成（一次调用搬完整个文件），
 * 不需要把字节数组搬进 JS —— 这是本文件唯一需要解释的技巧。
 *
 * 平台差异：
 *   Android 本文件：系统选择器 → content:// → 拷贝到 _doc/upload/ → 交回普通沙盒路径，
 *           后续 plus.io 读文本 / 读 base64 / 文档解析上传全部沿用既有代码，零改动
 *   iOS     无等价物（UIDocumentPickerViewController 需要 delegate，plus.ios 桥不动），
 *           仍走 picker.js 里的提示（截图识别 / 粘贴文字，或装原生插件）
 *
 * 验证状态：本地单测用假 plus 覆盖「选 → 拷 → 返回」的编排与取消 / 失败分支；
 *   **真机尚未跑过**（Android 的 onActivityResult 回调与 FileChannel 拷贝必须真机验一次）。
 */
import { MAX_FILE_BYTES, baseNameOf } from './file-types.js'

/** 请求码：与其它 onActivityResult 使用者区分（当前项目只有这一处） */
export const REQ_PICK_FILE = 10021

/** 沙盒内的落地目录（PRIVATE_DOC 下的子目录） */
export const UPLOAD_DIR = 'upload'

/** UI 上给的提示（Android 也能选文件了，这条只给 iOS 之类没有等价能力的平台） */
export const ANDROID_UNAVAILABLE_HINT = '系统文件选择在这个平台用不了：可截图发我识别，或把文字粘贴进来'

/**
 * 文件名消毒（纯函数，可单测）：路径分隔符、控制字符、Windows/Android 非法字符一律换成下划线，
 * 并截断到 80 字以内 —— 用户选来的名字可能带奇怪内容，别直接拼进沙盒路径
 * @param {string} name
 * @returns {string}
 */
export function safeFileName(name) {
  const base = baseNameOf(String(name || '')) || 'file'
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\/\\:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
  const out = cleaned || 'file'
  if (out.length <= 80) return out
  const dot = out.lastIndexOf('.')
  if (dot > 0 && out.length - dot <= 12) {
    return out.slice(0, 80 - (out.length - dot)) + out.slice(dot)
  }
  return out.slice(0, 80)
}

/**
 * 落地用的相对路径（纯函数，可单测）：加时间戳前缀避免重名覆盖
 * @param {string} name 原始文件名
 * @param {number} [stamp] 时间戳
 * @returns {string} 形如 _doc/upload/1789000000000_报告.txt
 */
export function uploadRelPath(name, stamp) {
  return '_doc/' + UPLOAD_DIR + '/' + (Number(stamp) || Date.now()) + '_' + safeFileName(name)
}

/** 当前是不是 Android 真机环境（plus 不可用时一律 false，H5 / 单测安全） */
export function isAndroidRuntime() {
  try {
    if (typeof plus === 'undefined' || !plus.os) return false
    return String(plus.os.name || '').toLowerCase() === 'android'
  } catch (e) {
    return false
  }
}

/** 读 content:// 的显示名 / 大小 / MIME（选不到就留空，不阻断流程） */
function describeUri(uri) {
  const out = { name: '', size: 0, mime: '' }
  try {
    const resolver = plus.android.runtimeMainActivity().getContentResolver()
    try {
      out.mime = String(resolver.getType(uri) || '')
    } catch (e) { /* 拿不到就算了 */ }
    const cursor = resolver.query(uri, null, null, null, null)
    if (cursor && cursor.moveToFirst()) {
      const nameIdx = cursor.getColumnIndex('_display_name')
      const sizeIdx = cursor.getColumnIndex('_size')
      if (nameIdx >= 0) out.name = String(cursor.getString(nameIdx) || '')
      if (sizeIdx >= 0) {
        // getLong 在部分机型返回 Java Long 对象，转字符串再解析最稳
        out.size = Number(String(cursor.getString(sizeIdx) || '0')) || 0
      }
      cursor.close()
    }
  } catch (e) { /* 描述信息是锦上添花，失败不拦 */ }
  return out
}

/** 确保 _doc/upload 目录存在 */
function ensureUploadDir() {
  return new Promise((resolve) => {
    try {
      plus.io.requestFileSystem(plus.io.PRIVATE_DOC, (fs) => {
        fs.root.getDirectory(UPLOAD_DIR, { create: true }, () => resolve(true), () => resolve(false))
      }, () => resolve(false))
    } catch (e) {
      resolve(false)
    }
  })
}

/**
 * 把 content:// 的内容拷进沙盒（Java 侧整块搬，不经 JS 字节数组）
 * @param {string} uri
 * @param {string} relPath _doc/upload/xxx
 * @returns {boolean} 是否拷贝成功
 */
export function copyContentUriToSandbox(uri, relPath) {
  try {
    const main = plus.android.runtimeMainActivity()
    const resolver = main.getContentResolver()
    const input = resolver.openInputStream(uri)
    if (!input) return false
    const FileOutputStream = plus.android.importClass('java.io.FileOutputStream')
    const abs = plus.io.convertLocalFileSystemURL(relPath)
    const output = new FileOutputStream(abs)
    const inChannel = input.getChannel()
    const outChannel = output.getChannel()
    const size = Number(input.available()) || MAX_FILE_BYTES
    if (typeof outChannel.transferFrom === 'function') {
      outChannel.transferFrom(inChannel, 0, size)
    } else {
      // 兜底：老实现没有 transferFrom 就逐字节搬（慢，但不至于直接失败）
      const bufferSize = 64 * 1024
      const buffer = plus.android.newObject('[B', bufferSize)
      let read = 0
      while ((read = inChannel.read(buffer)) > 0) {
        outChannel.write(buffer, 0, read)
      }
    }
    outChannel.close()
    inChannel.close()
    input.close()
    output.close()
    return true
  } catch (e) {
    return false
  }
}

/**
 * 调系统文件选择器选一个文件，选完拷进沙盒
 * @returns {Promise<{ ok: boolean, pick?: Object, reason?: string }>}
 *   reason 为空串表示用户主动取消（UI 不提示）
 */
export function pickFileViaAndroid() {
  return new Promise((resolve) => {
    if (!isAndroidRuntime()) {
      resolve({ ok: false, reason: '' })
      return
    }
    let settled = false
    const done = (r) => { if (!settled) { settled = true; resolve(r) } }

    try {
      const main = plus.android.runtimeMainActivity()
      const Intent = plus.android.importClass('android.content.Intent')
      const intent = new Intent(Intent.ACTION_GET_CONTENT)
      intent.addCategory(Intent.CATEGORY_OPENABLE)
      intent.setType('*/*')

      // 结果回调：项目里只有这一处用 onActivityResult，请求码不匹配时原样放过
      main.onActivityResult = (requestCode, resultCode, data) => {
        if (requestCode !== REQ_PICK_FILE) return
        try {
          if (resultCode !== -1) { done({ ok: false, reason: '' }); return }  // -1 = RESULT_OK
          const uri = String(data.getData())
          const meta = describeUri(uri)
          if (meta.size > MAX_FILE_BYTES) {
            done({ ok: false, reason: '文件超过 ' + Math.round(MAX_FILE_BYTES / 1024 / 1024) + 'MB，请先截取需要的部分' })
            return
          }
          const rel = uploadRelPath(meta.name)
          ensureUploadDir().then((dirOk) => {
            if (!dirOk) { done({ ok: false, reason: '应用目录不可写，读不到这个文件' }); return }
            if (!copyContentUriToSandbox(uri, rel)) {
              done({ ok: false, reason: '拷贝文件失败（可能被系统限制），换一种方式试试' })
              return
            }
            done({
              ok: true,
              pick: {
                path: rel,
                absPath: plus.io.convertLocalFileSystemURL(rel),
                name: safeFileName(meta.name),
                size: meta.size,
                mime: meta.mime
              }
            })
          })
        } catch (e) {
          done({ ok: false, reason: '读不到选中的文件：' + ((e && e.message) || e) })
        }
      }

      main.startActivityForResult(intent, REQ_PICK_FILE)
    } catch (e) {
      done({ ok: false, reason: '调不起系统文件选择器：' + ((e && e.message) || e) })
    }
  })
}