/**
 * file-types.js — 文件类型判定（3.6.0 读文件用）
 *
 * 纯函数、零依赖、不 import uni。只回答三个问题：
 *   1. 这个文件能不能直接当文本读？
 *   2. 不能的话，是不是需要走文档解析后端（pdf/docx/xlsx 这类二进制）？
 *   3. 大小超没超上限？
 */

/** 直接当文本读的扩展名（补了导出/日志/配置/代码这些常见场景） */
export const TEXT_EXTS = [
  'txt', 'md', 'markdown', 'mdx', 'rst', 'adoc', 'org', 'csv', 'tsv', 'json', 'jsonl', 'ndjson',
  'xml', 'html', 'htm', 'xhtml', 'svg',
  'log', 'ini', 'conf', 'cfg', 'yml', 'yaml', 'toml', 'env', 'properties', 'plist',
  'srt', 'vtt', 'ass', 'ssa', 'tex', 'rtf',
  // 代码 / 配置 / 脚本（用户经常丢代码片段或配置文件进来问）
  'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'vue', 'css', 'scss', 'less', 'sass',
  'py', 'java', 'kt', 'kts', 'c', 'h', 'cpp', 'cc', 'hpp', 'cs', 'go', 'rs', 'rb', 'php',
  'swift', 'sh', 'bash', 'zsh', 'ps1', 'bat', 'cmd', 'sql', 'lua', 'r', 'dart', 'gradle',
  'patch', 'diff', 'http', 'graphql', 'proto', 'gql'
]

/** 需要解析后端的二进制文档 */
export const DOC_EXTS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'epub']

/** 图片：交给已有的图片识别通道，不进本模块 */
export const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic']

/** 单个文件大小上限（字节）：超过就拒绝，避免把上下文挤爆 */
export const MAX_FILE_BYTES = 5 * 1024 * 1024

/** 取小写扩展名，没有则返回空串 */
export function extOf(name) {
  const s = String(name || '')
  const dot = s.lastIndexOf('.')
  if (dot < 0 || dot === s.length - 1) return ''
  return s.slice(dot + 1).toLowerCase()
}

/** 文件名（去目录） */
export function baseNameOf(path) {
  const s = String(path || '')
  const cut = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'))
  return cut >= 0 ? s.slice(cut + 1) : s
}

/**
 * 文件分类
 * @param {string} name 文件名或路径
 * @param {string} [mime] H5 端拿得到 type
 * @returns {'text'|'document'|'image'|'unsupported'}
 */
export function classifyFile(name, mime) {
  const m = String(mime || '').toLowerCase()
  // SVG 是文本（mime 是 image/svg+xml，但内容是 XML，能直接读，别丢给视觉模型）
  if (extOf(name) === 'svg') return 'text'
  if (m.indexOf('image/') === 0) return 'image'
  if (m.indexOf('text/') === 0) return 'text'
  if (m.indexOf('json') >= 0 || m.indexOf('xml') >= 0 || m.indexOf('csv') >= 0) return 'text'
  if (m.indexOf('pdf') >= 0) return 'document'
  const ext = extOf(name)
  if (TEXT_EXTS.indexOf(ext) >= 0) return 'text'
  if (DOC_EXTS.indexOf(ext) >= 0) return 'document'
  if (IMAGE_EXTS.indexOf(ext) >= 0) return 'image'
  return 'unsupported'
}

/**
 * 大小是否可读
 * @param {number} bytes
 * @returns {{ ok: boolean, reason?: string }}
 */
export function checkSize(bytes) {
  const n = Number(bytes) || 0
  if (n <= 0) return { ok: true }
  if (n > MAX_FILE_BYTES) {
    return { ok: false, reason: '文件超过 ' + formatBytes(MAX_FILE_BYTES) + '，请先截取需要的部分' }
  }
  return { ok: true }
}

/** 人类可读的大小 */
export function formatBytes(bytes) {
  const n = Number(bytes) || 0
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
  return (n / 1024 / 1024).toFixed(1) + ' MB'
}

/** 用户可以选的文件后缀（picker 过滤用） */
export function pickerExtensions() {
  return TEXT_EXTS.concat(DOC_EXTS)
}
