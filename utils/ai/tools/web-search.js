/**
 * web-search.js — 联网搜索工具（D2 独立模块）
 *
 * 智谱 Web Search API：POST https://open.bigmodel.cn/api/paas/v4/web_search
 * - 官方确认：search_pro 高级引擎，多引擎协作，返回标题/摘要/链接/站点
 * - 仅智谱厂商可用（复用智谱 API Key）
 *
 * 设计：WEB_SEARCH_TOOL 已入 TOOL_DEFINITIONS 全局注册表（保证工具一致性），
 * 但 agent-loop.js 的 buildToolList 按厂商门控：非智谱厂商过滤掉该工具，
 * 避免其他厂商模型误调用。执行走 agent-loop 的独立网络分支（不走 store）。
 */

const WEB_SEARCH_ENDPOINT = 'https://open.bigmodel.cn/api/paas/v4/web_search'

/** 工具定义（OpenAI function calling 格式） */
export const WEB_SEARCH_TOOL = {
  name: 'web_search',
  description: '联网搜索最新信息（新闻、实时事件、政策、时效性知识等）。仅当用户询问实时/最新信息或本地数据无法回答时使用，日常闲聊不要调用。',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索关键词，不超过 70 个字符，尽量精简准确'
      }
    },
    required: ['query']
  }
}

/** 该厂商是否启用联网搜索（目前仅智谱） */
export function isWebSearchEnabled(providerId) {
  return providerId === 'zhipu'
}

/**
 * 执行联网搜索
 * @param {string} query - 搜索关键词
 * @param {string} apiKey - 智谱 API Key
 * @returns {Promise<{ ok:boolean, text:string, detail:Array|null }>}
 */
export function executeWebSearch(query, apiKey) {
  if (!apiKey) {
    return Promise.resolve({ ok: false, text: '联网搜索需要智谱 API Key，当前未配置' })
  }
  const searchQuery = String(query || '').trim().substring(0, 70)
  if (!searchQuery) {
    return Promise.resolve({ ok: false, text: '搜索关键词为空' })
  }
  return new Promise((resolve) => {
    uni.request({
      url: WEB_SEARCH_ENDPOINT,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      data: {
        search_query: searchQuery,
        search_engine: 'search_pro',
        search_intent: false, // Agent 已决定搜索，跳过意图识别直接执行
        count: 5,
        content_size: 'medium'
      },
      timeout: 20000,
      success(res) {
        if (res.statusCode === 200 && res.data && Array.isArray(res.data.search_result)) {
          const results = res.data.search_result
          if (results.length === 0) {
            resolve({ ok: true, text: '联网搜索未返回结果，请尝试更换关键词', detail: [] })
            return
          }
          const lines = results.map((r, i) => {
            const title = r.title || '无标题'
            const content = (r.content || '').substring(0, 200)
            const media = r.media ? `（${r.media}）` : ''
            return `${i + 1}. ${title}${media}\n${content}\n链接：${r.link || '无'}`
          })
          resolve({ ok: true, text: `搜索结果：\n${lines.join('\n\n')}`, detail: results })
        } else {
          const msg = (res.data && (res.data.error && res.data.error.message)) || `HTTP ${res.statusCode}`
          resolve({ ok: false, text: `联网搜索失败：${msg}` })
        }
      },
      fail(err) {
        resolve({ ok: false, text: `联网搜索失败：${err.errMsg || '网络错误'}` })
      }
    })
  })
}