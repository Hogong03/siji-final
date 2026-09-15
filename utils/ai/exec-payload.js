/**
 * exec-payload.js — 执行卡片的负载压缩（3.6.2）
 *
 * 背景：读网页 / 联网搜索的工具结果是给模型看的，本来不该跟着会话一起存。
 * agent 路径会把它同时写进 actionCard / execResult / execResults 三处
 * （见 utils/ai/autoExecutor.js），一次搜索 5 篇正文约 7KB，落盘放大成三份，
 * 导出的开发者反馈里也整段是网页正文（反馈 2026-09-15：一条搜索结果撑出 5.8KB 的导出）。
 *
 * 卡片只需要摘要：搜索留条数与标题、读网页留域名与字数。
 * 纯函数、不依赖 uni，可直接单测（tests/exec-payload.test.js）。
 */

/** 卡片上最多念几条搜索结果标题 */
export const EXEC_TITLE_LIMIT = 3

/** 需要压缩负载的工具（其余工具原样返回，卡片照旧渲染） */
const HEAVY_TOOLS = { web_search: true, read_url: true }

/**
 * 这条工具结果的负载要不要压缩
 * @param {string} name 工具名
 * @returns {boolean}
 */
export function isHeavyTool(name) {
  return !!HEAVY_TOOLS[name]
}

/**
 * 压缩工具结果的 detail
 * @param {string} name 工具名
 * @param {*} detail 原始负载
 * @returns {*} web_search → { type, count, results[{title, link}] }；read_url → { type, url, host, title, length, truncated }；其余原样返回
 */
export function compactExecDetail(name, detail) {
  if (name === 'web_search') {
    const list = Array.isArray(detail) ? detail : []
    return {
      type: 'web_search',
      count: list.length,
      results: list.slice(0, EXEC_TITLE_LIMIT).map(r => ({
        title: (r && r.title) || '',
        link: (r && r.link) || ''
      }))
    }
  }
  if (name === 'read_url') {
    const d = detail || {}
    return {
      type: 'read_url',
      url: d.url || '',
      host: d.host || '',
      title: d.title || '',
      length: d.length || 0,
      truncated: !!d.truncated
    }
  }
  return detail
}

/**
 * 这张卡片上那一行文案（搜索 / 读网页没有跳转可点，只给摘要）
 * @param {Object} detail 压缩后的负载
 * @returns {string} 不认识的类型返回空串（调用方据此决定要不要走这个分支）
 */
export function execCardText(detail) {
  if (!detail || typeof detail !== 'object') return ''
  if (detail.type === 'web_search') {
    return (detail.count || 0) > 0 ? `已联网搜索 · ${detail.count} 条结果` : '已联网搜索 · 没有结果'
  }
  if (detail.type === 'read_url') {
    const len = (detail.length || 0) > 0 ? `（${detail.length} 字${detail.truncated ? '，已截断' : ''}）` : ''
    return detail.host ? `已读取网页 · ${detail.host}${len}` : '已读取网页'
  }
  return ''
}