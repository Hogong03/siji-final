/**
 * read-adapters.js — 读网址的后端适配器（3.6.0）
 *
 * 与 search-adapters 同一套套路：每个后端只提供元信息 + buildRequest(url, key) + parseResponse(res)，
 * 请求统一走 uni.request（三端通用，不依赖 fetch）。
 *
 * 两个后端的分工（实测结论）：
 *   - direct（默认）：直接 GET 目标页再本地转文本。零配置、零成本、不依赖第三方可达性；
 *     App 端无跨域限制可用，H5 端受浏览器同源策略拦截（对方站点不会给 CORS 头）。
 *   - tavily：第三方阅读服务，能抓 JS 渲染页与常见反爬站点，需要 Key（可与搜索共用）。
 *
 * 验证状态：
 *   - direct：本地单测覆盖解析；App 端行为待真机跑一次
 *   - tavily：请求/响应结构照官方文档实现（POST /extract，Authorization: Bearer，
 *     返回 results[].raw_content），已核对该端点可达；**线上尚未用真实 Key 跑过**
 */
import { htmlToText, MAX_READ_CHARS } from './html-text.js'

/** 默认后端：直连（零配置，最流畅） */
export const DEFAULT_READ_BACKEND = 'direct'

const TAVILY_EXTRACT = 'https://api.tavily.com/extract'

/**
 * 网址里不该出现的字符：空白（半角 / 全角）与中日韩文字、全角标点。
 * 用户习惯把话直接粘在网址上（「https://www.deepseek.com/阅读这个网址」），
 * 不截断就会整串当路径去请求 —— 抓回来 404 或直接请求失败（反馈 2026-09-15）。
 */
const URL_STOP_RE = /[\s\u200b-\u200f\u3000-\u303f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/

/**
 * 网址规整：从第一个 http(s):// 起算、截掉粘连的中文与空白、去尾部标点，非 http/https 直接拒绝
 * @param {string} input
 * @returns {{ok: boolean, url?: string, dropped?: string, reason?: string}} dropped 是被截掉的尾巴
 */
export function normalizeUrl(input) {
  let s = String(input === null || input === undefined ? '' : input).trim()
  if (!s) return { ok: false, reason: '没有给网址' }

  // 从网址本身起算：左边粘了话（「读一下 https://a.com」）不该被拼进域名
  const head = /https?:\/\//i.exec(s)
  if (head) {
    s = s.slice(head.index)
  } else if (/^[a-z][a-z0-9+.\-]*:/i.test(s)) {
    return { ok: false, reason: '只支持 http / https 开头的网址' }
  } else {
    s = 'https://' + s
  }

  // 右边粘了话就截断：原始空白与中文不会是网址的一部分
  const stop = s.search(URL_STOP_RE)
  let dropped = ''
  if (stop >= 0) {
    dropped = s.slice(stop).trim()
    s = s.slice(0, stop)
  }
  s = s.replace(/[）)\]】}>，。、；：！？"'”’,.!;]+$/, '')
  if (!/^https?:\/\/[^\s/?#]+/i.test(s)) return { ok: false, reason: '网址格式不对' }
  // 域名一定带「.」：挡住「https://随便写点什么」这种把普通文字硬拼成网址的输入
  const host = hostOf(s).split(':')[0]
  if (host.indexOf('.') < 0) return { ok: false, reason: '网址格式不对' }
  return { ok: true, url: s, dropped: dropped }
}

/**
 * 直连抓取失败的原因提示 —— 按平台给，别在 App 端说「跨域」
 * H5：对方站点不给 CORS 头，浏览器同源策略拦截是主因
 * App / 小程序：没有跨域这回事，多为目标站点超时、拒绝抓取或证书问题
 * @param {string} platform 'h5' | 其他
 * @returns {string}
 */
export function directFailHint(platform) {
  return platform === 'h5'
    ? '（直连抓取失败，H5 端多为浏览器跨域限制，可换第三方阅读服务）'
    : '（直连抓取失败，App 端多为目标站点超时、拒绝抓取或证书问题，可换第三方阅读服务）'
}

/** 取主机名（展示用） */
export function hostOf(url) {
  const m = /^https?:\/\/([^\s/?#]+)/i.exec(String(url || ''))
  return m && m[1] ? m[1].toLowerCase() : ''
}

/** 直连抓取：uni.request + 本地 HTML 转文本 */
const directBackend = {
  id: 'direct',
  name: '直连抓取',
  desc: '直接请求网页再本地转文本：零配置、零成本，App 端最流畅；H5 端受浏览器跨域限制，抓不到时改用第三方阅读服务',
  providerId: '',
  needsKey: false,
  keyLabel: '',
  keyPlaceholder: '',
  docs: '',
  buildRequest(url) {
    const header = {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
    }
    // #ifndef H5
    // 浏览器禁止脚本改 UA（H5 设了会被忽略甚至告警）；App 与小程序带上浏览器 UA 更容易拿到完整页面
    header['User-Agent'] = 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
    // #endif
    return { url: url, method: 'GET', header, dataType: 'text', timeout: 20000 }
  },
  parseResponse(res) {
    const code = (res && res.statusCode) || 0
    if (code < 200 || code >= 300) {
      return { ok: false, text: '抓取失败：HTTP ' + code + (code === 403 ? '（站点拒绝抓取）' : ''), detail: null }
    }
    const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data || '')
    const parsed = htmlToText(body)
    if (!parsed.ok) {
      return { ok: false, text: '这个页面没抓到正文（可能是纯 JS 渲染的），可以试试第三方阅读服务', detail: null }
    }
    return { ok: true, text: formatReadText(parsed, ''), detail: { title: parsed.title, length: parsed.length, truncated: parsed.truncated } }
  }
}

/** Tavily Extract：第三方阅读服务 */
const tavilyBackend = {
  id: 'tavily',
  name: 'Tavily 阅读',
  desc: '第三方阅读服务，能抓 JS 渲染页与常见反爬站点；需要 Key（可与搜索共用同一个 Tavily Key）',
  providerId: '',
  needsKey: true,
  keyLabel: 'Tavily API Key',
  keyPlaceholder: 'tvly-xxxxxxxxxxxxxxxx',
  docs: 'https://docs.tavily.com/documentation/api-reference/endpoint/extract',
  buildRequest(url, apiKey) {
    return {
      url: TAVILY_EXTRACT,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      data: { urls: [url], extract_depth: 'basic', format: 'markdown' },
      timeout: 30000
    }
  },
  parseResponse(res) {
    const code = (res && res.statusCode) || 0
    const data = res && res.data
    if (code < 200 || code >= 300) {
      const msg = (data && (data.detail || (data.error && data.error.message) || data.message)) || ('HTTP ' + code)
      return { ok: false, text: '阅读失败：' + msg, detail: null }
    }
    const results = (data && Array.isArray(data.results)) ? data.results : []
    if (results.length === 0) {
      const failed = (data && Array.isArray(data.failed_results) && data.failed_results[0]) || null
      const why = failed && (failed.error || failed.reason) ? '（' + (failed.error || failed.reason) + '）' : ''
      return { ok: false, text: '这个网址没读到内容' + why, detail: null }
    }
    const first = results[0] || {}
    const body = String(first.raw_content || first.content || '')
    if (!body.trim()) return { ok: false, text: '这个网址没读到正文', detail: null }
    const parsed = htmlToText(body, { limit: MAX_READ_CHARS })
    const text = parsed.ok ? parsed.text : body
    return {
      ok: true,
      text: formatReadText({ title: '', text: text, truncated: false, length: text.length }, first.url || ''),
      detail: { url: first.url || '', length: text.length }
    }
  }
}

/** 组装 tool_result 正文：标题 + 来源 + 正文（截断在 htmlToText 里做过了） */
export function formatReadText(parsed, url) {
  const head = []
  if (parsed && parsed.title) head.push(parsed.title)
  if (url) head.push(url)
  const text = (parsed && parsed.text) || ''
  return (head.length ? head.join('\n') + '\n\n' : '') + text
}

/** 后端注册表 */
/** 后端列表（设置页渲染用，顺序即注册顺序） */
export function listReadBackends() {
  return Object.keys(READ_BACKENDS).map(id => READ_BACKENDS[id])
}

export const READ_BACKENDS = {
  direct: directBackend,
  tavily: tavilyBackend
}

/** 取后端（未知 id 回落默认） */
export function getReadBackend(id) {
  return READ_BACKENDS[id] || READ_BACKENDS[DEFAULT_READ_BACKEND]
}
