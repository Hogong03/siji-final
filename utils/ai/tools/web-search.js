/**
 * web-search.js — 联网搜索工具（3.5.18：厂商无关）
 *
 * 3.5.18 之前：硬绑智谱 —— 非智谱聊天厂商直接过滤掉这个工具，换模型就断网。
 * 3.5.18 之后：搜索后端独立配置（utils/ai/search-adapters.js + search-config.js），
 * 聊天模型与搜索后端互不影响；本文件只负责工具声明 + 一次 HTTP 调用。
 *
 * 注册情况：WEB_SEARCH_TOOL 在 TOOL_DEFINITIONS 与 QUERY_TOOLS（只读，自动执行）。
 * 注入门控在 agent-transport.js 的 buildToolList：仅当 search-config 裁决为可用时才注入。
 * 执行走 agent-loop.js 的独立网络分支，不走 store。
 */
import { resolveSearchConfig } from '../search-config.js'

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

/**
 * 执行联网搜索
 * @param {string} query - 搜索关键词
 * @param {string} [overrideKey] - 覆盖 Key（单测用；缺省走 search-config 裁决）
 * @returns {Promise<{ok:boolean, text:string, detail:Array|null}>}
 */
export function executeWebSearch(query, overrideKey) {
  const cfg = resolveSearchConfig()
  const backend = cfg.backend

  // 用户关掉了开关就一律不搜：overrideKey 只能补 Key，不能绕过开关
  if (cfg.reason === 'disabled') {
    return Promise.resolve({ ok: false, text: '联网搜索已关闭，可在「设置 → AI 配置 → 联网搜索」里开启', detail: null })
  }

  const apiKey = overrideKey || cfg.key
  if (!apiKey) {
    return Promise.resolve({ ok: false, text: '联网搜索未配置 Key，可在「设置 → AI 配置 → 联网搜索」里填写', detail: null })
  }

  const searchQuery = String(query || '').trim().substring(0, 70)
  if (!searchQuery) {
    return Promise.resolve({ ok: false, text: '搜索关键词为空', detail: null })
  }

  let req
  try {
    req = backend.buildRequest(searchQuery, apiKey)
  } catch (e) {
    return Promise.resolve({ ok: false, text: '联网搜索请求构建失败：' + (e && e.message ? e.message : e), detail: null })
  }

  return new Promise((resolve) => {
    uni.request({
      url: req.url,
      method: req.method,
      header: req.header,
      data: req.data,
      timeout: req.timeout || 20000,
      success(res) {
        try {
          resolve(backend.parseResponse(res))
        } catch (e) {
          resolve({ ok: false, text: '联网搜索响应解析失败：' + (e && e.message ? e.message : e), detail: null })
        }
      },
      fail(err) {
        resolve({ ok: false, text: backend.name + ' 请求失败：' + ((err && err.errMsg) || '网络错误'), detail: null })
      }
    })
  })
}