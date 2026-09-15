/**
 * test: 联网搜索后端解耦（3.5.18）
 *
 * 覆盖 search-adapters（请求体 / 响应解析）、search-config（开关 / Key 裁决 / 厂商复用），
 * 以及 web-search 工具的实际执行路径。核心回归：换聊天厂商不再丢联网能力。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import './setup.js'
import { encryptKeys } from '../utils/crypto.js'
import { SEARCH_BACKENDS, getSearchBackend, listSearchBackends } from '../utils/ai/search-adapters.js'
import {
  SEARCH_KEYS, isSearchEnabled, setSearchEnabled, getSearchBackendId, setSearchBackend,
  getOwnSearchKey, setOwnSearchKey, hasOwnSearchKey, resolveSearchConfig,
  isWebSearchAvailable, searchStatusText
} from '../utils/ai/search-config.js'
import { executeWebSearch } from '../utils/ai/tools/web-search.js'

const ZHIPU_OK = {
  statusCode: 200,
  data: {
    search_result: [
      { title: '标题一', content: '内容一', link: 'https://a.example', media: '示例站' },
      { title: '标题二', content: '内容二', link: 'https://b.example' }
    ]
  }
}

let originalRequest = null

beforeEach(() => {
  global.uni.clearStorageSync?.()
  originalRequest = global.uni.request
})

afterEach(() => {
  if (originalRequest) global.uni.request = originalRequest
})

describe('搜索后端注册表', () => {
  it('默认后端为智谱，未知 id 回落默认', () => {
    expect(getSearchBackend('nope').id).toBe('zhipu')
    expect(getSearchBackend('tavily').id).toBe('tavily')
  })

  it('每个后端都实现三件套（元信息 / buildRequest / parseResponse）', () => {
    for (const b of listSearchBackends()) {
      expect(typeof b.name).toBe('string')
      expect(typeof b.buildRequest).toBe('function')
      expect(typeof b.parseResponse).toBe('function')
      expect(b.endpoint.startsWith('https://')).toBe(true)
    }
  })

  it('智谱请求：Bearer 鉴权 + search_pro 引擎', () => {
    const req = SEARCH_BACKENDS.zhipu.buildRequest('今天新闻', 'key-1')
    expect(req.header.Authorization).toBe('Bearer key-1')
    expect(req.data.search_query).toBe('今天新闻')
    expect(req.data.search_engine).toBe('search_pro')
  })

  it('Tavily 请求：Key 放请求体（该服务不收 Bearer）', () => {
    const req = SEARCH_BACKENDS.tavily.buildRequest('today news', 'tvly-1')
    expect(req.data.api_key).toBe('tvly-1')
    expect(req.header.Authorization).toBeUndefined()
  })

  it('智谱解析：标题 / 摘要 / 链接 + 来源', () => {
    const out = SEARCH_BACKENDS.zhipu.parseResponse(ZHIPU_OK)
    expect(out.ok).toBe(true)
    expect(out.text).toContain('标题一')
    expect(out.text).toContain('https://a.example')
    expect(out.text).toContain('示例站')
    expect(out.detail).toHaveLength(2)
  })

  it('智谱解析：空结果与 HTTP 错误都不抛异常', () => {
    const empty = SEARCH_BACKENDS.zhipu.parseResponse({ statusCode: 200, data: { search_result: [] } })
    expect(empty.ok).toBe(true)
    expect(empty.text).toContain('未返回结果')

    const bad = SEARCH_BACKENDS.zhipu.parseResponse({ statusCode: 401, data: { error: { message: 'Invalid key' } } })
    expect(bad.ok).toBe(false)
    expect(bad.text).toContain('Invalid key')
  })

  it('Tavily 解析：url 字段映射为链接', () => {
    const out = SEARCH_BACKENDS.tavily.parseResponse({
      statusCode: 200,
      data: { results: [{ title: 'T1', url: 'https://t.example', content: 'C1' }] }
    })
    expect(out.ok).toBe(true)
    expect(out.text).toContain('https://t.example')
  })
})

describe('搜索配置裁决', () => {
  it('缺省视为开启，但没 Key 不可用', () => {
    expect(isSearchEnabled()).toBe(true)
    const cfg = resolveSearchConfig()
    expect(cfg.available).toBe(false)
    expect(cfg.reason).toBe('no_key')
    expect(isWebSearchAvailable()).toBe(false)
  })

  it('独立 Key 加密落盘（存储里读不到明文）', () => {
    setOwnSearchKey('sk-plain-search')
    expect(getOwnSearchKey()).toBe('sk-plain-search')
    expect(hasOwnSearchKey()).toBe(true)
    const stored = String(global.uni.getStorageSync(SEARCH_KEYS.key) || '')
    expect(stored).not.toContain('sk-plain-search')
    expect(resolveSearchConfig().source).toBe('own')
  })

  it('清空独立 Key 后回到不可用', () => {
    setOwnSearchKey('sk-plain-search')
    setOwnSearchKey('')
    expect(hasOwnSearchKey()).toBe(false)
    expect(isWebSearchAvailable()).toBe(false)
  })

  it('复用同名 AI 厂商 Key（智谱用户零配置）', () => {
    global.uni.setStorageSync('siji_provider_keys', encryptKeys({ zhipu: 'sk-zhipu-from-ai' }))
    const cfg = resolveSearchConfig()
    expect(cfg.available).toBe(true)
    expect(cfg.source).toBe('provider')
    expect(cfg.key).toBe('sk-zhipu-from-ai')
  })

  it('DeepSeek 聊天 + 智谱搜索 Key 组合可用（厂商解耦核心）', () => {
    global.uni.setStorageSync('siji_provider_keys', encryptKeys({ deepseek: 'sk-ds', zhipu: 'sk-zhipu' }))
    global.uni.setStorageSync('siji_ai_provider', 'deepseek')
    expect(isWebSearchAvailable()).toBe(true)
  })

  it('开关关闭后一律不可用（即使 Key 齐全）', () => {
    global.uni.setStorageSync('siji_provider_keys', encryptKeys({ zhipu: 'sk-zhipu' }))
    setSearchEnabled(false)
    const cfg = resolveSearchConfig()
    expect(cfg.available).toBe(false)
    expect(cfg.reason).toBe('disabled')
    setSearchEnabled(true)
    expect(isWebSearchAvailable()).toBe(true)
  })

  it('切到无同名厂商的后端时不能复用 AI Key', () => {
    global.uni.setStorageSync('siji_provider_keys', encryptKeys({ zhipu: 'sk-zhipu' }))
    setSearchBackend('tavily')
    expect(getSearchBackendId()).toBe('tavily')
    expect(isWebSearchAvailable()).toBe(false)
    setOwnSearchKey('tvly-own')
    expect(resolveSearchConfig().source).toBe('own')
  })

  it('非法后端 id 回落默认', () => {
    setSearchBackend('nope')
    expect(getSearchBackendId()).toBe('zhipu')
  })

  it('状态文案覆盖三种情形', () => {
    expect(searchStatusText()).toBe('未配置 Key，无法联网')
    setOwnSearchKey('sk-own')
    expect(searchStatusText()).toContain('独立 Key')
    setSearchEnabled(false)
    expect(searchStatusText()).toBe('已关闭')
  })
})

describe('executeWebSearch 执行路径', () => {
  it('无 Key 时给出配置指引且不抛异常', async () => {
    const out = await executeWebSearch('今天有什么新闻')
    expect(out.ok).toBe(false)
    expect(out.text).toContain('联网搜索')
    expect(out.text).toContain('设置')
  })

  it('关闭状态下提示去开启', async () => {
    setSearchEnabled(false)
    const out = await executeWebSearch('今天有什么新闻', 'sk-x')
    expect(out.ok).toBe(false)
    expect(out.text).toContain('已关闭')
  })

  it('空关键词不发请求', async () => {
    let called = false
    global.uni.request = () => { called = true }
    const out = await executeWebSearch('   ', 'sk-x')
    expect(out.ok).toBe(false)
    expect(out.text).toContain('关键词为空')
    expect(called).toBe(false)
  })

  it('成功路径：走配置的后端并回填结果', async () => {
    setOwnSearchKey('sk-own')
    let captured = null
    global.uni.request = (opts) => { captured = opts; opts.success(ZHIPU_OK) }
    const out = await executeWebSearch('今天有什么新闻')
    expect(captured.url).toBe(SEARCH_BACKENDS.zhipu.endpoint)
    expect(captured.data.search_query).toBe('今天有什么新闻')
    expect(out.ok).toBe(true)
    expect(out.text).toContain('标题一')
  })

  it('切后端后请求打到新后端', async () => {
    setOwnSearchKey('sk-own')
    setSearchBackend('tavily')
    let captured = null
    global.uni.request = (opts) => {
      captured = opts
      opts.success({ statusCode: 200, data: { results: [{ title: 'T', url: 'u', content: 'c' }] } })
    }
    const out = await executeWebSearch('news')
    expect(captured.url).toBe(SEARCH_BACKENDS.tavily.endpoint)
    expect(captured.data.api_key).toBe('sk-own')
    expect(out.ok).toBe(true)
  })

  it('网络失败时返回友好错误（不抛异常）', async () => {
    global.uni.request = (opts) => { opts.fail({ errMsg: 'request:fail timeout' }) }
    const out = await executeWebSearch('随便搜点什么', 'sk-x')
    expect(out.ok).toBe(false)
    expect(out.text).toContain('timeout')
  })

  it('关键词超长截断到 70 字', async () => {
    let captured = null
    global.uni.request = (opts) => { captured = opts; opts.success(ZHIPU_OK) }
    await executeWebSearch('啊'.repeat(120), 'sk-x')
    expect(captured.data.search_query.length).toBe(70)
  })
})