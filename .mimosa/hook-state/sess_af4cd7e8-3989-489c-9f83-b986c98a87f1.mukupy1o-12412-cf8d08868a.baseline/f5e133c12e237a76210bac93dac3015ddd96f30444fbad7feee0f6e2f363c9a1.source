/**
 * search-adapters.js — 联网搜索后端适配器（3.5.18）
 *
 * 背景：web_search 原来硬绑智谱 —— 聊天模型一换成 DeepSeek / Qwen 就没有联网能力。
 * 现在搜索能力独立成「搜索后端」，与聊天厂商完全解耦：聊天用哪个模型都能配搜索。
 *
 * 每个后端只提供三样东西：元信息 + buildRequest(query, key) + parseResponse(res)。
 * 请求统一走 uni.request（H5 / App / 小程序三端通用），不依赖 fetch。
 *
 * 新增后端：往 SEARCH_BACKENDS 加一条即可，其余代码零改动。
 *
 * 验证状态：
 *   - zhipu：线上已用（原 web_search 实现，行为不变）
 *   - tavily：按官方文档实现请求体与响应结构，本地单测覆盖解析，线上需真机跑一次
 */

/** 默认后端 */
export const DEFAULT_SEARCH_BACKEND = 'zhipu'

const ZHIPU_ENDPOINT = 'https://open.bigmodel.cn/api/paas/v4/web_search'
const TAVILY_ENDPOINT = 'https://api.tavily.com/search'

/** 智谱 Web Search（search_pro 高级引擎） */
const zhipuBackend = {
  id: 'zhipu',
  name: '智谱 Web Search',
  desc: 'search_pro 引擎，中文时效性好，可与智谱 AI Key 共用',
  /** 可复用同名 AI 厂商 Key；为空表示必须单独配 */
  providerId: 'zhipu',
  keyLabel: '智谱 API Key',
  keyPlaceholder: 'xxxxxxxxxxxxxxxx.xxxxxxxx',
  docs: 'https://open.bigmodel.cn/',
  endpoint: ZHIPU_ENDPOINT,
  buildRequest(query, apiKey) {
    return {
      url: ZHIPU_ENDPOINT,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      data: {
        search_query: query,
        search_engine: 'search_pro',
        search_intent: false, // Agent 已决定搜索，跳过意图识别直接执行
        count: 5,
        content_size: 'medium'
      },
      timeout: 20000
    }
  },
  parseResponse(res) {
    if (!(res.statusCode === 200 && res.data && Array.isArray(res.data.search_result))) {
      const msg = (res.data && res.data.error && res.data.error.message) || ('HTTP ' + res.statusCode)
      return { ok: false, text: '联网搜索失败：' + msg, detail: null }
    }
    const results = res.data.search_result
    if (results.length === 0) {
      return { ok: true, text: '联网搜索未返回结果，请尝试更换关键词', detail: [] }
    }
    const lines = results.map((r, i) => {
      const media = r.media ? '（' + r.media + '）' : ''
      const content = String(r.content || '').substring(0, 200)
      return (i + 1) + '. ' + (r.title || '无标题') + media + '\n' + content + '\n链接：' + (r.link || '无')
    })
    return { ok: true, text: '搜索结果：\n' + lines.join('\n\n'), detail: results }
  }
}

/** Tavily Search（与 AI 厂商无关的独立搜索服务） */
const tavilyBackend = {
  id: 'tavily',
  name: 'Tavily Search',
  desc: '独立搜索服务，需单独申请 Key，海外内容覆盖更好',
  providerId: '',
  keyLabel: 'Tavily API Key',
  keyPlaceholder: 'tvly-xxxxxxxxxxxxxxxx',
  docs: 'https://tavily.com/',
  endpoint: TAVILY_ENDPOINT,
  buildRequest(query, apiKey) {
    return {
      url: TAVILY_ENDPOINT,
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: {
        api_key: apiKey,
        query: query,
        search_depth: 'basic',
        max_results: 5,
        include_answer: false
      },
      timeout: 20000
    }
  },
  parseResponse(res) {
    if (!(res.statusCode === 200 && res.data && Array.isArray(res.data.results))) {
      const msg = (res.data && (res.data.detail || res.data.error)) || ('HTTP ' + res.statusCode)
      return { ok: false, text: '联网搜索失败：' + msg, detail: null }
    }
    const results = res.data.results
    if (results.length === 0) {
      return { ok: true, text: '联网搜索未返回结果，请尝试更换关键词', detail: [] }
    }
    const lines = results.map((r, i) => {
      const content = String(r.content || '').substring(0, 200)
      return (i + 1) + '. ' + (r.title || '无标题') + '\n' + content + '\n链接：' + (r.url || '无')
    })
    return { ok: true, text: '搜索结果：\n' + lines.join('\n\n'), detail: results }
  }
}

/** 后端注册表 */
export const SEARCH_BACKENDS = {
  zhipu: zhipuBackend,
  tavily: tavilyBackend
}

/** 取后端（未知 id 回落默认后端） */
export function getSearchBackend(id) {
  return SEARCH_BACKENDS[id] || SEARCH_BACKENDS[DEFAULT_SEARCH_BACKEND]
}

/** 后端选择列表（界面用） */
export function listSearchBackends() {
  return Object.keys(SEARCH_BACKENDS).map(id => SEARCH_BACKENDS[id])
}