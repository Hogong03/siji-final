/**
 * android-picker.js — App 端（Android）系统文件选择 + 读进沙盒（3.7.5；3.7.6 加固）
 *
 * 为什么不用插件：ACTION_GET_CONTENT / ACTION_OPEN_DOCUMENT 是 Android 系统自带的选择器，
 * 用 plus.android 直接调即可 —— 不需要原生插件、不需要存储权限（SAF 只授权用户选中的那一个文件）。
 *
 * 为什么先拷贝进沙盒：系统选择器给的是 content:// URI，plus.io 读不了、uni.uploadFile 也传不了。
 *
 * 3.7.6 加固（真机反馈「文件能看见但提示拷贝失败」）：
 *   1. 绝对路径可能是 file:// URL —— FileOutputStream 只认裸路径，先归一化
 *   2. 拷贝改成三级兜底：字节数组流拷贝 → FileChannel.transferFrom → 文本直读兜底
 *      （content:// 的流未必支持 getChannel，字节数组这条路依赖最少）
 *   3. 拷完验一次（文件存在且字节数 > 0），0 字节当失败处理
 *   4. 文本类文件无论拷贝成败都附上 inlineText（Java 侧直接读文本，不需要字节数组），
 *      拷贝彻底失败也能把 txt / md / csv 读进来
 *   5. 每条失败路径给不同的原因文案 —— 下次真机再失败，一眼能定位在哪一步
 *
 * 平台差异：
 *   Android 本文件
 *   iOS     无等价物（UIDocumentPickerViewController 需要 delegate，plus.ios 桥不动），走 picker.js 的提示
 */
import { MAX_FILE_BYTES, baseNameOf, classifyFile } from './file-types.js'
import { logger } from '@/utils/logger.js'

/** 请求码：与其它 onActivityResult 使用者区分（当前项目只有这一处） */
export const REQ_PICK_FILE = 10021

/** 沙盒内的落地目录（PRIVATE_DOC 下的子目录） */
export const UPLOAD_DIR = 'upload'

/** 字节拷贝的缓冲大小 */
const COPY_BUFFER = 64 * 1024

/** UI 上给的提示（给没有系统文件选择能力的平台） */
export const ANDROID_UNAVAILABLE_HINT = '系统文件选择在这个平台用不了：可截图发我识别，或把文字粘贴进来'

/**
 * 文件名消毒（纯函数）：路径分隔符、控制字符、非法字符一律换成下划线，并截断到 80 字以内
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
 * 落地用的相对路径（纯函数）：加时间戳前缀避免重名覆盖
 * @param {string} name
 * @param {number} [stamp]
 * @returns {string} 形如 _doc/upload/1789000000000_报告.txt
 */
export function uploadRelPath(name, stamp) {
  return '_doc/' + UPLOAD_DIR + '/' + (Number(stamp) || Date.now()) + '_' + safeFileName(name)
}

/**
 * 归一化成原生可用的绝对路径（纯函数）
 * plus.io.convertLocalFileSystemURL 在不同基座 / 机型上可能给 file:// URL，
 * 而 FileOutputStream 只认裸路径 —— 真机「拷贝失败」的第一嫌疑人
 * @param {string} url
 * @returns {string}
 */
export function toNativePath(url) {
  let p = String(url || '').trim()
  if (/^file:\/\//i.test(p)) p = p.replace(/^file:\/\//i, '')
  if (/^\/\//.test(p)) p = p.replace(/^\/+/, '/')
  return p
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

/** 建一个 Java byte[] 缓冲（两条路都不行就返回 null，让上层换策略） */
function newByteBuffer(size) {
  try {
    const buf = plus.android.newObject('[B', size)
    if (buf) return buf
  } catch (e) { /* 换下一种 */ }
  try {
    const Array = plus.android.importClass('java.lang.reflect.Array')
    const Byte = plus.android.importClass('java.lang.Byte')
    return Array.newInstance(Byte.TYPE, size)
  } catch (e) { /* 都不行 */ }
  return null
}

/**
 * 策略一：字节数组流拷贝（依赖最少，content:// 的流都支持 read/write）
 * @returns {number} 写入字节数；失败抛异常
 */
function copyViaStream(input, absPath) {
  const FileOutputStream = plus.android.importClass('java.io.FileOutputStream')
  const out = new FileOutputStream(absPath)
  const buffer = newByteBuffer(COPY_BUFFER)
  if (!buffer) {
    // 没有 byte[] 就只能靠 transferFrom（策略二）
    out.close()
    throw new Error('no-byte-buffer')
  }
  let len = 0
  let total = 0
  while ((len = input.read(buffer, 0, COPY_BUFFER)) > 0) {
    out.write(buffer, 0, len)
    total += len
    if (total > MAX_FILE_BYTES * 2) break
  }
  out.flush()
  out.close()
  return total
}

/**
 * 策略二：FileChannel.transferFrom（Java 侧整块搬，不经 JS）
 * @returns {number} 写入字节数；失败抛异常
 */
function copyViaChannel(input, absPath) {
  const FileOutputStream = plus.android.importClass('java.io.FileOutputStream')
  const inChannel = input.getChannel()
  const out = new FileOutputStream(absPath)
  const outChannel = out.getChannel()
  const avail = Number(input.available()) || 0
  const count = avail > 0 ? avail : MAX_FILE_BYTES
  const moved = Number(outChannel.transferFrom(inChannel, 0, count)) || 0
  outChannel.close()
  out.close()
  if (moved <= 0 && avail > 0) throw new Error('transfer-copied-nothing')
  return moved
}

/**
 * 策略三：文本直读（不需要字节数组，也不需要 channel）
 * 只对文本类文件有意义，作为兜底 —— 拷不进去也至少能把 txt / md / csv 读进来
 * @returns {string|null}
 */
function readUriAsText(input) {
  try {
    const BufferedReader = plus.android.importClass('java.io.BufferedReader')
    const InputStreamReader = plus.android.importClass('java.io.InputStreamReader')
    const reader = new BufferedReader(new InputStreamReader(input, 'UTF-8'))
    const lines = []
    let line = null
    let guard = 0
    while ((line = reader.readLine()) !== null && guard < 40000) {
      lines.push(String(line))
      guard++
      if (lines.join('\n').length > 200000) break
    }
    reader.close()
    return lines.join('\n')
  } catch (e) {
    return null
  }
}

/** 拷完确认文件真的落地且非空 */
function verifySandboxFile(relPath) {
  return new Promise((resolve) => {
    try {
      plus.io.resolveLocalFileSystemURL(relPath, (entry) => {
        entry.file((f) => resolve(Number(f.size) || 0), () => resolve(-1))
      }, () => resolve(-1))
    } catch (e) {
      resolve(-1)
    }
  })
}

/**
 * 把 content:// 的内容拷进沙盒（多策略）
 * @param {string} uri
 * @param {string} relPath _doc/upload/xxx
 * @param {Object} [opts] { wantsText: boolean }
 * @returns {Promise<{ ok: boolean, bytes: number, text: string|null, stage: string }>}
 */
export function copyContentUriToSandbox(uri, relPath, opts = {}) {
  return new Promise((resolve) => {
    let input = null
    try {
      input = plus.android.runtimeMainActivity().getContentResolver().openInputStream(uri)
    } catch (e) {
      resolve({ ok: false, bytes: 0, text: null, stage: 'open-input' })
      return
    }
    if (!input) {
      resolve({ ok: false, bytes: 0, text: null, stage: 'open-input' })
      return
    }

    const absPath = toNativePath(plus.io.convertLocalFileSystemURL(relPath))
    if (!absPath) {
      resolve({ ok: false, bytes: 0, text: null, stage: 'resolve-path' })
      return
    }

    let bytes = 0
    let stage = ''
    // 策略一：字节数组流拷贝
    try {
      bytes = copyViaStream(input, absPath)
      stage = 'stream'
    } catch (e1) {
      stage = 'stream-fail:' + ((e1 && e1.message) || e1)
      // 策略二：FileChannel（重开一次流，策略一可能已经读掉一部分）
      try {
        if (input && input.close) input.close()
        input = plus.android.runtimeMainActivity().getContentResolver().openInputStream(uri)
        bytes = copyViaChannel(input, absPath)
        stage = 'channel'
      } catch (e2) {
        stage = stage + '|channel-fail:' + ((e2 && e2.message) || e2)
      }
    }

    // 文本兜底：无论拷贝成没成，文本类文件都留一份 inlineText
    let text = null
    if (opts.wantsText) {
      try {
        if (input && input.close) input.close()
        input = plus.android.runtimeMainActivity().getContentResolver().openInputStream(uri)
        text = readUriAsText(input)
        if (text !== null) stage = stage || 'text-only'
      } catch (e) { /* 文本兜底失败不影响结论 */ }
    }
    try { if (input && input.close) input.close() } catch (e) { /* ignore */ }

    verifySandboxFile(relPath).then((size) => {
      const ok = size > 0
      resolve({ ok: ok, bytes: ok ? size : bytes, text: text, stage: stage, verified: size })
    })
  })
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
          const name = safeFileName(meta.name)
          const kind = classifyFile(name, meta.mime)
          const rel = uploadRelPath(meta.name)
          ensureUploadDir().then((dirOk) => {
            if (!dirOk) { done({ ok: false, reason: '应用目录不可写（_doc/upload 建不出来）' }); return }
            copyContentUriToSandbox(uri, rel, { wantsText: kind === 'text' }).then((cp) => {
              const base = {
                name: name,
                size: meta.size || cp.bytes,
                mime: meta.mime,
                path: rel,
                absPath: plus.io.convertLocalFileSystemURL(rel),
                inlineText: cp.text || ''
              }
              if (cp.ok) { done({ ok: true, pick: base }); return }
              // 拷贝没成：文本类还有 inlineText 兜底
              if (kind === 'text' && cp.text) {
                logger.warn('[FilePick] 拷贝失败但读到文本，走 inlineText', cp.stage)
                done({ ok: true, pick: Object.assign(base, { path: '', absPath: '', inlineText: cp.text }) })
                return
              }
              logger.warn('[FilePick] 拷贝失败', cp.stage)
              done({ ok: false, reason: '拷贝失败（' + cp.stage + '），换一种方式试试' })
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