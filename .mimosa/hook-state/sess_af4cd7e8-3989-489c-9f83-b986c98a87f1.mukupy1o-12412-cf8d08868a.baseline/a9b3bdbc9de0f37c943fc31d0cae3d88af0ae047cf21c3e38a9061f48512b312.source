/**
 * file-text.js — 文件正文的清洗、截断与拼装（3.6.0）
 *
 * 纯函数、零依赖、不 import uni。文件读进来之后的所有加工都在这里：
 *   stripBom → looksBinary → cleanFileText → truncateFileText → buildFileContext
 */

/** 单个文件喂给模型的正文上限（字符） */
export const MAX_FILE_CHARS = 8000

/** 去掉 UTF-8 BOM（Windows 记事本导出常见，留着会污染第一行） */
export function stripBom(s) {
  if (!s) return ''
  return String(s).charCodeAt(0) === 0xfeff ? String(s).slice(1) : String(s)
}

/**
 * 看着像二进制吗（改了后缀的 pdf/图片被当文本读时拦住）
 * 判定：出现 NUL 字节，或不可打印控制字符占比超过 5%
 * @param {string} s
 * @returns {boolean}
 */
export function looksBinary(s) {
  if (!s) return false
  const head = String(s).substring(0, 2000)
  if (head.indexOf('\u0000') >= 0) return true
  let bad = 0
  for (let i = 0; i < head.length; i++) {
    const c = head.charCodeAt(i)
    if (c < 32 && c !== 9 && c !== 10 && c !== 13) bad++
    else if (c === 0xfffd) bad++
  }
  return bad / head.length > 0.05
}

/** 统一换行 + 压掉行尾空格 + 连续空行压成一个 */
export function cleanFileText(s) {
  if (!s) return ''
  return stripBom(String(s))
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.replace(/[\t ]+$/, ''))
    .join('\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
}

/**
 * 截断到上限，返回正文与统计
 * @param {string} s
 * @param {number} [limit]
 * @returns {{ text: string, truncated: boolean, length: number, kept: number }}
 */
export function truncateFileText(s, limit) {
  const max = limit || MAX_FILE_CHARS
  const text = s || ''
  if (text.length <= max) {
    return { text: text, truncated: false, length: text.length, kept: text.length }
  }
  // 尽量切在换行处，别把一句话劈开
  const cut = text.lastIndexOf('\n', max)
  const keep = cut > max * 0.6 ? cut : max
  return {
    text: text.substring(0, keep) + '\n\n（文件过长，已截断，共 ' + text.length + ' 字）',
    truncated: true,
    length: text.length,
    kept: keep
  }
}

/** 行数（给「读到多少行」这类提示用） */
export function countLines(s) {
  if (!s) return 0
  return String(s).split('\n').length
}

/**
 * 拼成给模型看的文件块
 * 形如：`[文件 六级真题.pdf · 12.3 KB · 共 420 行]` + 正文
 * @param {{ name: string, size?: number, text: string, truncated?: boolean }} file
 * @returns {string}
 */
export function buildFileContext(file) {
  if (!file || !file.text) return ''
  const head = '[文件 ' + (file.name || '未命名') + ']'
  return head + '\n' + file.text
}

/**
 * 把文件块与用户原话拼成最终发给模型的用户消息
 * 顺序：文件在前、用户话在后（模型先看材料再看要求，实测更稳）
 * @param {string} fileContext
 * @param {string} userText
 * @returns {string}
 */
export function composeFileMessage(fileContext, userText) {
  const text = String(userText || '').trim()
  const ctx = String(fileContext || '').trim()
  if (!ctx) return text
  if (!text) return ctx + '\n\n（请先读一遍上面的文件，再问我想做什么）'
  return ctx + '\n\n---\n' + text
}
