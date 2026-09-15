/**
 * read-url.js — 读网址工具（3.6.0）
 *
 * 注册情况：READ_URL_TOOL 在 TOOL_DEFINITIONS 与 QUERY_TOOLS（只读，自动执行）。
 * 注入门控在 agent-transport.js 的 buildToolList（只看 read-config 裁决，与聊天厂商无关）。
 * 执行走 agent-loop.js 的独立网络分支，不走 store。
 *
 * 抓取策略：按配置的后端抓；直连失败（H5 跨域、站点拒绝、纯 JS 页面）时，
 * 只要手上有 Tavily Key（独立阅读 Key → 搜索用的 Tavily Key），自动换第三方阅读重试一次，
 * 用户不用自己去设置里切后端。
 */
import { resolveReadConfig, isReadEnabled, getOwnReadKey } from '../read-config.js'
import { normalizeUrl, READ_BACKENDS, hostOf, directFailHint } from '../read-adapters.js'
import { getOwnSearchKey } from '../search-config.js'

/** 工具定义（OpenAI function calling 格式） */
export const READ_URL_TOOL = {
  name: 'read_url',
  description: '读取一个网页的正文内容。用户发来网址、转发文章、要你总结或分析某个页面时调用。只读，不改任何数据。',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: '要读的完整网址，以 http:// 或 https:// 开头'
      }
    },
    required: ['url']
  }
}

/** 当前平台标识（直连失败的原因提示按平台分叉，3.6.2） */
function currentPlatform() {
  let platform = 'app'
  // #ifdef H5
  platform = 'h5'
  // #endif
  return platform
}

/** 发一次请求并解析（uni.request 三端通用） */
function requestOnce(backend, url, key) {
  return new Promise((resolve) => {
    uni.request(Object.assign(backend.buildRequest(url, key), {
      success: (res) => resolve(backend.parseResponse(res)),
      fail: (err) => {
        const msg = (err && err.errMsg) || '网络异常'
        const hint = backend.id === 'direct' ? directFailHint(currentPlatform()) : ''
        resolve({ ok: false, text: '抓取失败：' + msg + hint, detail: null })
      }
    }))
  })
}

/**
 * 成功结果补上域名与截断说明：
 *   - host 供执行卡片显示「已读取网页 · 域名」
 *   - 网址后面粘了话时明确告诉模型截到哪儿了，别让它以为整串都读过了
 */
function withUrlMeta(res, url, dropped) {
  const detail = Object.assign({}, res.detail || {}, { url: url, host: hostOf(url) })
  const text = dropped ? '（网址后面的文字没有当网址用，实际读取：' + url + '）\n\n' + res.text : res.text
  return { ok: true, text: text, detail: detail }
}

/**
 * 直连失败时的兜底后端：有 Tavily Key 才兜
 * @param {string} [overrideKey] 单测注入
 * @returns {{ backend: Object, key: string }|null}
 */
export function resolveFallback(overrideKey) {
  const key = overrideKey || getOwnReadKey() || getOwnSearchKey()
  if (!key) return null
  return { backend: READ_BACKENDS.tavily, key: key }
}

/**
 * 读一个网址
 * @param {string} rawUrl
 * @param {string} [overrideKey] 覆盖 Key（单测用）
 * @returns {Promise<{ok:boolean, text:string, detail:Object|null}>}
 */
export async function executeReadUrl(rawUrl, overrideKey) {
  if (!isReadEnabled()) {
    return { ok: false, text: '读网址功能已关闭（设置 → AI 配置 → 读网址）', detail: null }
  }
  const norm = normalizeUrl(rawUrl)
  if (!norm.ok) return { ok: false, text: norm.reason, detail: null }
  const url = norm.url

  const cfg = resolveReadConfig()
  const first = cfg.backend
  const firstKey = overrideKey || cfg.key
  if (first.needsKey && !firstKey) {
    return { ok: false, text: '当前阅读后端需要 Key（设置 → AI 配置 → 读网址）', detail: null }
  }

  const res = await requestOnce(first, url, firstKey)
  if (res.ok) return withUrlMeta(res, url, norm.dropped)

  // 直连失败才兜底：同一个后端不重试第二遍
  if (first.id === 'tavily') return res
  const fallback = resolveFallback(overrideKey)
  if (!fallback) return res

  const retry = await requestOnce(fallback.backend, url, fallback.key)
  if (retry.ok) return withUrlMeta(retry, url, norm.dropped)
  return { ok: false, text: res.text + '；换第三方阅读也没成功：' + retry.text, detail: null }
}
