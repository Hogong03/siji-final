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
 * 3.7.7（真机报「拷贝失败（open-input）」）：打不开流的原因是 Uri 被字符串化了 ——
 *   `String(data.getData())` 得到的不是可用的 URI 字符串，再喂回 openInputStream 必然失败。
 *   改为把 Java 的 Uri **对象**一路传到 openInputStream / openFileDescriptor（不要 String()）。
 *   同时把开流做成三级：openInputStream → openFileDescriptor + FileInputStream(fd) →
 *   openAssetFileDescriptor.createInputStream()；阶段名拆细（get-resolver / open-input /
 *   open-descriptor / open-asset / open-all-failed），下次失败能直接指到哪一步。
 *
 * 3.7.8（真机仍报 open-all-failed）：三种开流全在 resolver 这一层失败，通常不是 provider 拒绝，
 *   而是 plus.android 没导入类 —— 对象方法直接调用会抛，得先 importClass 或用 plus.android.invoke。
 *   现在每个调用都走 invokeSafe（先直接调，失败退 plus.android.invoke），并对 uri / resolver /
 *   data 逐个 importClass；另加 plus.io 兜底（plus.io 在 Android 上能直接解析 content://，
 *   解析得动就由它读文本，完全不碰 ContentResolver）；失败文案带上 URI 原文与阶段，便于一次定位。
 *
 * 3.7.9（真机报 stream-fail:input.read is not a function|channel-fail:input.getChannel is not a function）：
 *   流打开了，但**流对象自己的方法同样没导入** —— read / getChannel 直接调不到。
 *   修法：所有 Java 调用（read / write / flush / close / readLine / getChannel / transferFrom / available）
 *   统一走 invokeSafe；每个实例（输入流、输出流、reader、channel）用前先 importClass；
 *   拿不到 getChannel 时退 java.nio.channels.Channels.newChannel(input) 再 transferFrom。
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

/**
 * 从返回的 Intent 里取 Uri 对象（3.7.7）
 * 多数情况在 data.getData()；少数 provider 把结果放在 ClipData 里
 * @returns {Object|null} Java Uri 对象（**不要转成字符串**）
 */
function pickUriFrom(data) {
  try {
    const uri = data.getData()
    if (uri) return uri
  } catch (e) { /* 落到 ClipData */ }
  try {
    const clip = data.getClipData()
    if (clip && clip.getItemAt(0)) return clip.getItemAt(0).getUri()
  } catch (e) { /* 都没有 */ }
  return null
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

/** importClass 的安全包装（类名不存在时不抛） */
function importSafe(name) {
  try { return plus.android.importClass(name) } catch (e) { return null }
}

/**
 * 调 Java 对象方法：先直接调，抛错再退 plus.android.invoke（未导入类时直接调会抛）
 * 3.7.8：真机 open-all-failed 的元凶多半在这里 —— 直接调用拿不到方法
 * @returns {*} 调用结果，两条都不行返回 undefined
 */
function invokeSafe(obj, method, ...args) {
  if (!obj) return undefined
  try {
    if (typeof obj[method] === 'function') return obj[method].apply(obj, args)
  } catch (e) { /* 落到 invoke */ }
  try {
    if (plus.android.invoke) return plus.android.invoke(obj, method, ...args)
  } catch (e) { /* 两条都不行 */ }
  return undefined
}

/**
 * 导入实例对象的类（3.7.9）：流对象的方法也要导入才调得动
 * @returns {Object} 原对象，便于链式使用
 */
function importInstance(obj) {
  try { if (obj && plus.android.importClass) plus.android.importClass(obj) } catch (e) { /* 导入失败不致命 */ }
  return obj
}

/** Uri / resolver 的可读文本（只用于诊断文案，失败给空串） */
function uriDebugText(uri) {
  try {
    const t = plus.android.invoke ? plus.android.invoke(uri, 'toString') : String(uri)
    return String(t || '')
  } catch (e) {
    return ''
  }
}

/** 异常信息取字符串（plus 的异常对象未必有 message） */
function errText(e) {
  return String((e && (e.message || e.msg)) || e || 'unknown')
}

/**
 * 打开 content:// 的输入流（三级）
 * 1) openInputStream：最省事，多数 provider 支持
 * 2) openFileDescriptor + FileInputStream(fd)：部分 ROM / provider 只给文件描述符
 * 3) openAssetFileDescriptor().createInputStream()：少见的第三种实现
 * @param {Object} uri Java 的 Uri 对象（**不要传字符串**）
 * @returns {{ input: Object|null, closer: Object|null, stage: string }}
 */
function openContentStream(uri) {
  const attempts = []
  // 3.7.8：先把类导进来 —— 没导入时对象方法直接调用一律抛，三种开流会一起失败
  importSafe('android.content.ContentResolver')
  importSafe('android.net.Uri')
  try { plus.android.importClass(uri) } catch (e) { /* 实例类导入失败不致命 */ }

  const main = invokeSafe(plus.android.runtimeMainActivity(), 'getContentResolver') ||
    (() => { try { return plus.android.runtimeMainActivity().getContentResolver() } catch (e) { return null } })()
  const resolver = main
  if (!resolver) return { input: null, closer: null, stage: 'get-resolver' }
  try { plus.android.importClass(resolver) } catch (e) { /* 同上 */ }

  // 1) openInputStream
  const s1 = invokeSafe(resolver, 'openInputStream', uri)
  if (s1) return { input: s1, closer: null, stage: 'open-input' }
  attempts.push('openInputStream')

  // 2) openFileDescriptor + FileInputStream(fd)
  const pfd = invokeSafe(resolver, 'openFileDescriptor', uri, 'r')
  if (pfd) {
    const fd = invokeSafe(pfd, 'getFileDescriptor')
    const FileInputStream = importSafe('java.io.FileInputStream')
    if (fd && FileInputStream) {
      try {
        const s2 = new FileInputStream(fd)
        if (s2) return { input: s2, closer: pfd, stage: 'open-descriptor' }
      } catch (e) { /* 继续 */ }
    }
  }
  attempts.push('openFileDescriptor')

  // 3) openAssetFileDescriptor().createInputStream()
  const afd = invokeSafe(resolver, 'openAssetFileDescriptor', uri, 'r')
  if (afd) {
    const s3 = invokeSafe(afd, 'createInputStream')
    if (s3) return { input: s3, closer: afd, stage: 'open-asset' }
  }
  attempts.push('openAssetFileDescriptor')

  return { input: null, closer: null, stage: 'open-all-failed:' + attempts.join('/') + ':' + uriDebugText(uri) }
}

/** 安静关闭（输入流与描述符都要关，关不掉也不能抛） */
function closeQuiet(opened) {
  if (!opened) return
  invokeSafe(opened.input, 'close')
  invokeSafe(opened.closer, 'close')
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
  importInstance(input)
  const FileOutputStream = importSafe('java.io.FileOutputStream')
  if (!FileOutputStream) throw new Error('no-FileOutputStream')
  const out = importInstance(new FileOutputStream(absPath))
  const buffer = newByteBuffer(COPY_BUFFER)
  if (!buffer) {
    // 没有 byte[] 就只能靠 channel（策略二）
    invokeSafe(out, 'close')
    throw new Error('no-byte-buffer')
  }
  let len = 0
  let total = 0
  while ((len = Number(invokeSafe(input, 'read', buffer, 0, COPY_BUFFER))) > 0) {
    invokeSafe(out, 'write', buffer, 0, len)
    total += len
    if (total > MAX_FILE_BYTES * 2) break
  }
  invokeSafe(out, 'flush')
  invokeSafe(out, 'close')
  return total
}

/**
 * 策略二：FileChannel.transferFrom（Java 侧整块搬，不经 JS）
 * @returns {number} 写入字节数；失败抛异常
 */
function copyViaChannel(input, absPath) {
  importInstance(input)
  const FileOutputStream = importSafe('java.io.FileOutputStream')
  if (!FileOutputStream) throw new Error('no-FileOutputStream')
  const Channels = importSafe('java.nio.channels.Channels')

  // 输入 channel：优先 getChannel；拿不到就用 Channels.newChannel(流)（3.7.9）
  let inChannel = invokeSafe(input, 'getChannel')
  if (!inChannel && Channels && Channels.newChannel) inChannel = Channels.newChannel(input)
  if (!inChannel) throw new Error('no-input-channel')

  const out = importInstance(new FileOutputStream(absPath))
  let outChannel = invokeSafe(out, 'getChannel')
  if (!outChannel && Channels && Channels.newChannel) outChannel = Channels.newChannel(out)
  if (!outChannel) throw new Error('no-output-channel')

  const avail = Number(invokeSafe(input, 'available')) || 0
  const count = avail > 0 ? avail : MAX_FILE_BYTES
  const moved = Number(invokeSafe(outChannel, 'transferFrom', inChannel, 0, count)) || 0
  invokeSafe(outChannel, 'close')
  invokeSafe(out, 'close')
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
    importInstance(input)
    const BufferedReader = importSafe('java.io.BufferedReader')
    const InputStreamReader = importSafe('java.io.InputStreamReader')
    if (!BufferedReader || !InputStreamReader) return null
    const reader = importInstance(new BufferedReader(new InputStreamReader(input, 'UTF-8')))
    const lines = []
    let line = null
    let guard = 0
    while ((line = invokeSafe(reader, 'readLine')) != null && guard < 40000) {
      lines.push(String(line))
      guard++
      if (lines.join('\n').length > 200000) break
    }
    invokeSafe(reader, 'close')
    return lines.join('\n')
  } catch (e) {
    return null
  }
}

/**
 * plus.io 兜底：Android 上 plus.io 能直接解析 content://（不经 ContentResolver）
 * 解析得动就由它读文本 —— 二进制仍需拷贝，但文本类这条路最稳
 * @param {string} uriText
 * @returns {Promise<string|null>}
 */
function readUriTextByPlusIo(uriText) {
  return new Promise((resolve) => {
    if (!uriText) { resolve(null); return }
    try {
      plus.io.resolveLocalFileSystemURL(uriText, (entry) => {
        entry.file((f) => {
          try {
            const fr = new plus.io.FileReader()
            fr.onloadend = (e) => resolve(e && e.target ? String(e.target.result || '') : null)
            fr.onerror = () => resolve(null)
            fr.readAsText(f)
          } catch (e2) {
            resolve(null)
          }
        }, () => resolve(null))
      }, () => resolve(null))
    } catch (e) {
      resolve(null)
    }
  })
}
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
    let absPath = ''
    try {
      absPath = toNativePath(plus.io.convertLocalFileSystemURL(relPath))
    } catch (e) { /* 下面统一判空 */ }
    if (!absPath) {
      resolve({ ok: false, bytes: 0, text: null, stage: 'resolve-path' })
      return
    }

    let bytes = 0
    let stage = ''
    let firstOpenStage = ''

    // 策略一：字节数组流拷贝（依赖最少）
    const o1 = openContentStream(uri)
    firstOpenStage = o1.stage
    if (o1.input) {
      try {
        bytes = copyViaStream(o1.input, absPath)
        stage = 'stream'
      } catch (e1) {
        stage = 'stream-fail:' + errText(e1)
      } finally {
        closeQuiet(o1)
      }
    }

    // 策略二：FileChannel（重新开一次流）
    if (!(bytes > 0)) {
      const o2 = openContentStream(uri)
      if (o2.input) {
        try {
          bytes = copyViaChannel(o2.input, absPath)
          stage = (stage ? stage + '|' : '') + 'channel'
        } catch (e2) {
          stage = (stage ? stage + '|' : '') + 'channel-fail:' + errText(e2)
        } finally {
          closeQuiet(o2)
        }
      }
    }

    // 文本兜底：无论拷贝成没成，文本类文件都留一份 inlineText
    let text = null
    if (opts.wantsText) {
      const o3 = openContentStream(uri)
      if (o3.input) {
        try { text = readUriAsText(o3.input) } catch (e) { /* 文本兜底失败不影响结论 */ }
        closeQuiet(o3)
      }
    }

    if (!stage) stage = 'open-failed:' + firstOpenStage

    verifySandboxFile(relPath).then(async (size) => {
      let ok = size > 0
      // 开流全败时的最后一条路：plus.io 直接解析 content://（Android 支持），能读就读文本
      if (!ok && opts.wantsText && !text) {
        const viaIo = await readUriTextByPlusIo(opts.uriText)
        if (viaIo) {
          text = viaIo
          ok = false   // 没拷进沙盒，但正文拿到了 —— 上层按 inlineText 走
          stage = 'plusio-text-only'
        }
      }
      resolve({ ok: ok, bytes: ok ? size : bytes, text: text, stage: stage, verified: size, openStage: firstOpenStage })
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
          // 3.7.7：Uri 必须是 Java 对象 —— String() 出来的字符串喂回 openInputStream 必然失败
          const uri = pickUriFrom(data)
          if (!uri) { done({ ok: false, reason: '没拿到选中的文件' }); return }
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
            const uriText = uriDebugText(uri)
            copyContentUriToSandbox(uri, rel, { wantsText: kind === 'text', uriText: uriText }).then((cp) => {
              const base = {
                name: name,
                size: meta.size || cp.bytes,
                mime: meta.mime,
                path: rel,
                absPath: plus.io.convertLocalFileSystemURL(rel),
                inlineText: cp.text || ''
              }
              if (cp.ok) { done({ ok: true, pick: base }); return }
              // 拷贝没成：文本类还有 inlineText 兜底（含 plus.io 直读那条路）
              if (kind === 'text' && cp.text) {
                logger.warn('[FilePick] 拷贝失败但读到文本，走 inlineText', cp.stage)
                done({ ok: true, pick: Object.assign(base, { path: '', absPath: '', inlineText: cp.text }) })
                return
              }
              logger.warn('[FilePick] 拷贝失败', cp.stage)
              const openFailed = String(cp.stage || '').indexOf('open-failed') === 0 || String(cp.stage || '').indexOf('open-all-failed') >= 0
              done({
                ok: false,
                reason: openFailed
                  ? '打不开这个文件：' + cp.stage + '。云盘 / 在线文档 / 微信里的文件，先在文件管理器里「保存到手机」再从下载目录选；或截图发我识别'
                  : '拷贝失败（' + cp.stage + '），换一种方式试试'
              })
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