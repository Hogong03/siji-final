/**
 * utils/files/index.js — 读文件统一入口（3.6.0）
 *
 * UI 只需要调 readPickedFile(pick)，平台差异、类型判定、截断、解析后端都在下面这层里。
 * 文本类走本地直读（零配置、三端一致）；二进制文档走解析后端（见 doc-parse.js）。
 */
import { logger } from '@/utils/logger.js'
import { classifyFile, checkSize, formatBytes, baseNameOf, extOf } from './file-types.js'
import { readLocalText } from './local-io.js'
import { cleanFileText, looksBinary, truncateFileText, countLines } from './file-text.js'
import { parseDocument } from './doc-parse.js'

export * from './file-types.js'
export * from './file-text.js'
export { readLocalText, readLocalBase64 } from './local-io.js'
export { pickOneFile, toPick, APP_PICK_HINT } from './picker.js'
export { isAndroidRuntime, pickFileViaAndroid, safeFileName, uploadRelPath, toNativePath, copyContentUriToSandbox, UPLOAD_DIR, REQ_PICK_FILE } from './android-picker.js'
export { parseDocument, resolveDocConfig, docStatusText, isDocParseAvailable, setDocBackend, getDocBackendId, setOwnDocKey, hasOwnDocKey, listDocBackends, DOC_BACKENDS, DOC_KEYS } from './doc-parse.js'

/** 不支持的格式给什么建议（统一文案，别在各页面各写一遍） */
export function unsupportedHint(kind) {
  if (kind === 'image') return '图片请点左侧图片按钮，走识别通道'
  return '这个格式暂时读不了：可以截图后发给我识别，或者粘贴文字内容'
}

/**
 * 读一个用户选中的文件，加工成可以喂给模型的正文
 * @param {{ path?: string, file?: any, name?: string, size?: number, mime?: string }} pick
 * @returns {Promise<{ ok: boolean, kind: string, name: string, sizeText: string, text?: string, lines?: number, truncated?: boolean, reason?: string }>}
 */
export function readPickedFile(pick) {
  const p = pick || {}
  const name = p.name || baseNameOf(p.path) || '未命名文件'
  const kind = classifyFile(name, p.mime)
  const sizeText = p.size ? formatBytes(p.size) : ''
  const base = { kind: kind, name: name, sizeText: sizeText }

  if (kind === 'image') {
    return Promise.resolve(Object.assign({ ok: false, reason: unsupportedHint('image') }, base))
  }
  if (kind === 'unsupported') {
    return Promise.resolve(Object.assign({ ok: false, reason: unsupportedHint('unsupported') }, base))
  }
  const sizeCheck = checkSize(p.size)
  if (!sizeCheck.ok) {
    return Promise.resolve(Object.assign({ ok: false, reason: sizeCheck.reason }, base))
  }

  // Android 选文件时 Java 侧顺手读好的文本（拷贝失败也能读进来，见 android-picker.js）
  if (kind === 'text' && typeof p.inlineText === 'string' && p.inlineText) {
    const cleaned = cleanFileText(p.inlineText)
    if (!cleaned) return Promise.resolve(Object.assign({ ok: false, reason: '这个文件是空的' }, base))
    if (looksBinary(cleaned)) {
      return Promise.resolve(Object.assign({ ok: false, reason: '这不是文本文件（可能是改了后缀的二进制文件）' }, base))
    }
    return Promise.resolve(finish(cleaned, base))
  }

  if (kind === 'document') {
    return parseDocument(p).then((r) => {
      if (!r.ok) return Object.assign({ ok: false, reason: r.reason }, base)
      return finish(r.text, base)
    })
  }

  return readLocalText(p).then((raw) => {
    if (raw === null || raw === undefined) {
      return Object.assign({ ok: false, reason: '读不到这个文件（App 端请从应用目录选，或用 H5 端）' }, base)
    }
    const cleaned = cleanFileText(raw)
    if (!cleaned) return Object.assign({ ok: false, reason: '这个文件是空的' }, base)
    if (looksBinary(cleaned)) {
      return Object.assign({ ok: false, reason: '这不是文本文件（可能是改了后缀的二进制文件）' }, base)
    }
    return finish(cleaned, base)
  }).catch((e) => {
    logger.warn('[FileRead] 读取失败', e && e.message)
    return Object.assign({ ok: false, reason: '读取失败：' + ((e && e.message) || '未知错误') }, base)
  })
}

/** 截断 + 统计，统一出口 */
function finish(text, base) {
  const t = truncateFileText(text)
  return Object.assign({}, base, {
    ok: true,
    text: t.text,
    lines: countLines(t.text),
    truncated: t.truncated,
    reason: ''
  })
}

/** 界面展示用的一句话（读成功后的附件条） */
export function fileCardText(result) {
  if (!result) return ''
  if (!result.ok) return result.reason || '读不了这个文件'
  const ext = extOf(result.name)
  const parts = [result.name]
  if (result.sizeText) parts.push(result.sizeText)
  if (result.lines) parts.push(result.lines + ' 行')
  if (result.truncated) parts.push('已截断')
  return parts.join(' · ') + (ext ? '' : '')
}
