/**
 * html-text.js — 网页 HTML 转纯文本（3.6.0 读网址用）
 *
 * 纯函数、零依赖、不 import uni。小程序端没有 DOMParser，只能用正则剥标签，
 * 所以这一层刻意不碰 DOM API，保证三端行为一致。
 *
 * 只做一件事：把一坨 HTML 变成能读的正文（标题 + 文字），并截到上下文能承受的长度。
 */

/** 正文长度上限（字符）。超过就截断并标记，避免把几百 KB 导航栏灌进上下文 */
export const MAX_READ_CHARS = 8000

/** 整块丢掉：脚本、样式、内联图标、模板、iframe、head */
const DROP_BLOCKS = /<(script|style|noscript|svg|template|iframe|head)\b[^>]*>[\s\S]*?<\/\1>/gi

/** 块级边界转成换行，段落不会粘成一行 */
const BLOCK_BOUNDARY = /<\/?(p|div|br|li|ul|ol|dl|dt|dd|h[1-6]|tr|td|th|table|section|article|header|footer|nav|aside|blockquote|pre|figure|figcaption|hr|form)\b[^>]*>/gi

/** 剩下的任何标签 */
const ANY_TAG = /<[^>]*>/g

/** HTML 注释与条件注释 */
const COMMENT = /<!--[\s\S]*?-->/g

/** 常见命名实体（只收高频的，其余走数字实体与丢弃） */
const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', hellip: '…',
  mdash: '—', ndash: '–', middot: '·', copy: '©', reg: '®',
  trade: '™', deg: '°', times: '×', divide: '÷', laquo: '«', raquo: '»'
}

/**
 * 解码 HTML 实体：命名实体 + 十进制（&#39;）+ 十六进制（&#x27;）
 * @param {string} s
 * @returns {string}
 */
export function decodeEntities(s) {
  if (!s) return ''
  return String(s).replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]{1,31});/g, (m, body) => {
    if (body.charAt(0) === '#') {
      const isHex = body.charAt(1) === 'x' || body.charAt(1) === 'X'
      const code = parseInt(isHex ? body.slice(2) : body.slice(1), isHex ? 16 : 10)
      if (!isFinite(code) || code <= 0 || code > 0x10ffff) return ' '
      try {
        return String.fromCodePoint(code)
      } catch (e) {
        return ' '
      }
    }
    const hit = NAMED[body]
    return hit === undefined ? ' ' : hit
  })
}

/**
 * 取标题：优先 og:title，其次 <title>
 * @param {string} html
 * @returns {string}
 */
export function extractTitle(html) {
  if (!html) return ''
  const clean = (s) => decodeEntities(s).replace(/\s+/g, ' ').trim()
  const og = /<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i.exec(html)
  if (og && og[1]) return clean(og[1]).substring(0, 120)
  const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  return t && t[1] ? clean(t[1]).substring(0, 120) : ''
}

/**
 * 压掉多余空白：行内空格归一、行尾去空、连续空行压成一个
 * @param {string} s
 * @returns {string}
 */
export function normalizeText(s) {
  if (!s) return ''
  return String(s)
    .replace(/\r\n?/g, '\n')
    .replace(/[\t\u00a0\u3000 ]+/g, ' ')
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * 判断一段文本是不是 HTML（用来兜住返回 JSON/纯文本的接口）
 * @param {string} s
 * @returns {boolean}
 */
export function isHtmlLike(s) {
  if (!s || typeof s !== 'string') return false
  return /<\s*(html|body|div|p|a|span|head|meta)\b/i.test(s.substring(0, 2000))
}

/**
 * HTML 转纯文本
 * @param {string} html 原始 HTML（或已经是纯文本）
 * @param {Object} [opts]
 * @param {number} [opts.limit] 截断上限，默认 MAX_READ_CHARS
 * @returns {{ ok: boolean, title: string, text: string, truncated: boolean, length: number, reason?: string }}
 */
export function htmlToText(html, opts = {}) {
  const limit = opts.limit || MAX_READ_CHARS
  if (html === null || html === undefined || html === '') {
    return { ok: false, title: '', text: '', truncated: false, length: 0, reason: 'empty' }
  }
  const raw = String(html)
  // 不是 HTML 就当纯文本处理（有些接口直接吐 text/plain 或 JSON）
  if (!isHtmlLike(raw)) {
    const text = normalizeText(decodeEntities(raw))
    return finish('', text, limit)
  }
  const title = extractTitle(raw)
  let body = raw
    .replace(COMMENT, ' ')
    .replace(DROP_BLOCKS, ' ')
  // 正文优先：有 <article>/<main> 就只用它，避免导航与页脚混进来
  const main = /<(article|main)\b[^>]*>([\s\S]*?)<\/\1>/i.exec(body)
  if (main && main[2] && main[2].length > 200) body = main[2]
  body = body
    .replace(BLOCK_BOUNDARY, '\n')
    .replace(ANY_TAG, ' ')
  const text = normalizeText(decodeEntities(body))
  return finish(title, text, limit)
}

/** 截断并组装返回值（超长时在结尾留一句说明，便于模型知道还有下文） */
function finish(title, text, limit) {
  const length = text.length
  if (length === 0) {
    return { ok: false, title: title, text: '', truncated: false, length: 0, reason: 'no_content' }
  }
  if (length <= limit) {
    return { ok: true, title: title, text: text, truncated: false, length: length }
  }
  return {
    ok: true,
    title: title,
    text: text.substring(0, limit) + '\n\n（正文过长，已截断，共 ' + length + ' 字）',
    truncated: true,
    length: length
  }
}
