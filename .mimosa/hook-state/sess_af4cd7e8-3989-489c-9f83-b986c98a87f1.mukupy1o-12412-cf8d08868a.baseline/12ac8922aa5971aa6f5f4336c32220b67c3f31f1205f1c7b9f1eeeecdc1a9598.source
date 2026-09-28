/**
 * test: 读网址（3.6.0）
 *
 * 覆盖 read-adapters（URL 归一 / 直连与 Tavily 的请求与响应）、read-config（开关 / Key 裁决 /
 * 复用搜索 Key）、executeReadUrl（直连优先 + 自动兜底第三方）、工具注册与门控。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import './setup.js'
import {
  READ_BACKENDS, DEFAULT_READ_BACKEND, getReadBackend, listReadBackends,
  normalizeUrl, hostOf, directFailHint
} from '../utils/ai/read-adapters.js'
import {
  READ_KEYS, isReadEnabled, setReadEnabled, getReadBackendId, setReadBackend,
  getOwnReadKey, setOwnReadKey, hasOwnReadKey, resolveReadConfig,
  isReadUrlAvailable, readStatusText
} from '../utils/ai/read-config.js'
import { setOwnSearchKey } from '../utils/ai/search-config.js'
import { executeReadUrl, resolveFallback, READ_URL_TOOL } from '../utils/ai/tools/read-url.js'
import { TOOL_DEFINITIONS, QUERY_TOOLS, CONFIRM_TOOLS, needsConfirmation } from '../utils/ai/tools/index.js'
import { getTruncateLimit } from '../utils/ai/tools/call-utils.js'

const LONG_BODY = '听力要每天练 30 分钟，风雨无阻，这是唯一能在短期提分的板块。'.repeat(8)
const PAGE_HTML = `<!doctype html><html><head><title>六级备考</title>
<meta property="og:title" content="六级备考计划"></head>
<body><nav>导航</nav><article><p>${LONG_BODY}</p><p>选词填空直接放弃。</p></article>
<script>var a=1</script><footer>版权</footer></body></html>`

let originalRequest = null

beforeEach(() => {
  global.uni.clearStorageSync?.()
  originalRequest = global.uni.request
})

afterEach(() => {
  if (originalRequest) global.uni.request = originalRequest
})

describe('URL 归一', () => {
  it('缺协议自动补 https', () => {
    const r = normalizeUrl('example.com/a?b=1')
    expect(r.ok).toBe(true)
    expect(r.url).toBe('https://example.com/a?b=1')
  })

  it('中文句子里带出来的网址：去掉尾部标点', () => {
    const r = normalizeUrl('https://example.com/post。')
    expect(r.ok).toBe(true)
    expect(r.url).toBe('https://example.com/post')
  })

  it('拒绝非 http(s) 与空值', () => {
    expect(normalizeUrl('').ok).toBe(false)
    expect(normalizeUrl('   ').ok).toBe(false)
    expect(normalizeUrl('file:///etc/passwd').ok).toBe(false)
    expect(normalizeUrl('javascript:alert(1)').ok).toBe(false)
  })

  it('hostOf 取域名，失败返回空串', () => {
    expect(hostOf('https://www.example.com/a')).toBe('www.example.com')
    expect(hostOf('不是网址')).toBe('')
  })
})

describe('URL 归一：网址与中文粘连（反馈 2026-09-15）', () => {
  it('网址后面直接跟中文：截到中文为止（用户原话是「https://www.deepseek.com/阅读这个网址」）', () => {
    const r = normalizeUrl('https://www.deepseek.com/阅读这个网址')
    expect(r.ok).toBe(true)
    expect(r.url).toBe('https://www.deepseek.com/')
    expect(r.dropped).toBe('阅读这个网址')
  })

  it('网址前面有中文：从 http(s):// 起算，不拼进域名', () => {
    const r = normalizeUrl('读一下 https://example.com/post 这篇')
    expect(r.ok).toBe(true)
    expect(r.url).toBe('https://example.com/post')
    expect(r.dropped).toBe('这篇')
  })

  it('句尾半角标点也去掉', () => {
    expect(normalizeUrl('https://example.com/a,').url).toBe('https://example.com/a')
    expect(normalizeUrl('https://example.com/a.').url).toBe('https://example.com/a')
  })

  it('全中文不再被拼成网址', () => {
    expect(normalizeUrl('不是网址').ok).toBe(false)
  })

  it('直连失败的原因提示按平台给：App 端不提跨域', () => {
    expect(directFailHint('app')).toContain('App 端')
    expect(directFailHint('app')).not.toContain('跨域')
    expect(directFailHint('h5')).toContain('跨域')
  })
})

describe('读网址后端注册表', () => {
  it('默认直连，未知 id 回落默认', () => {
    expect(DEFAULT_READ_BACKEND).toBe('direct')
    expect(getReadBackend('nope').id).toBe('direct')
    expect(getReadBackend('tavily').id).toBe('tavily')
  })

  it('每个后端都实现三件套，且直连免 Key', () => {
    for (const b of listReadBackends()) {
      expect(typeof b.name).toBe('string')
      expect(typeof b.buildRequest).toBe('function')
      expect(typeof b.parseResponse).toBe('function')
    }
    expect(READ_BACKENDS.direct.needsKey).toBe(false)
    expect(READ_BACKENDS.tavily.needsKey).toBe(true)
  })

  it('直连请求：GET + text + 浏览器 UA', () => {
    const req = READ_BACKENDS.direct.buildRequest('https://example.com/a')
    expect(req.method).toBe('GET')
    expect(req.dataType).toBe('text')
    expect(req.url).toBe('https://example.com/a')
    expect(String(req.header['User-Agent'])).toContain('Mozilla')
  })

  it('直连解析：正文优先取 article，丢掉导航与脚本', () => {
    const parsed = READ_BACKENDS.direct.parseResponse({ statusCode: 200, data: PAGE_HTML })
    expect(parsed.ok).toBe(true)
    expect(parsed.text).toContain('听力要每天练 30 分钟')
    expect(parsed.text).toContain('六级备考计划')
    expect(parsed.text).not.toContain('导航')
    expect(parsed.text).not.toContain('var a=1')
    expect(parsed.detail.title).toBe('六级备考计划')
  })

  it('直连解析：非 2xx 直接失败，403 有专门提示', () => {
    const e500 = READ_BACKENDS.direct.parseResponse({ statusCode: 500, data: '' })
    expect(e500.ok).toBe(false)
    const e403 = READ_BACKENDS.direct.parseResponse({ statusCode: 403, data: '' })
    expect(e403.text).toContain('拒绝抓取')
  })

  it('Tavily 请求：POST + Bearer + urls 数组', () => {
    const req = READ_BACKENDS.tavily.buildRequest('https://example.com/a', 'tvly-1')
    expect(req.method).toBe('POST')
    expect(req.header.Authorization).toBe('Bearer tvly-1')
    expect(req.data.urls).toEqual(['https://example.com/a'])
    expect(req.data.extract_depth).toBe('basic')
  })

  it('Tavily 解析：取 results[0].raw_content', () => {
    const parsed = READ_BACKENDS.tavily.parseResponse({
      statusCode: 200,
      data: { results: [{ url: 'https://example.com/a', raw_content: '正文第一段\n正文第二段' }] }
    })
    expect(parsed.ok).toBe(true)
    expect(parsed.text).toContain('正文第一段')
    expect(parsed.text).toContain('https://example.com/a')
  })

  it('Tavily 解析：failed_results 与 HTTP 错误都给得出人话', () => {
    const failed = READ_BACKENDS.tavily.parseResponse({
      statusCode: 200,
      data: { results: [], failed_results: [{ url: 'x', error: 'blocked' }] }
    })
    expect(failed.ok).toBe(false)
    expect(failed.text).toContain('blocked')
    const bad = READ_BACKENDS.tavily.parseResponse({ statusCode: 401, data: { detail: 'invalid key' } })
    expect(bad.ok).toBe(false)
    expect(bad.text).toContain('invalid key')
  })
})

describe('读网址配置裁决', () => {
  it('默认开启，直连后端免 Key 可用', () => {
    expect(isReadEnabled()).toBe(true)
    const cfg = resolveReadConfig()
    expect(cfg.available).toBe(true)
    expect(cfg.backendId).toBe('direct')
    expect(readStatusText()).toBe('直连抓取（免 Key）')
  })

  it('关掉开关一律不可用', () => {
    setReadEnabled(false)
    expect(isReadEnabled()).toBe(false)
    expect(isReadUrlAvailable()).toBe(false)
    expect(readStatusText()).toBe('已关闭')
  })

  it('Tavily 后端无 Key 不可用，填了独立 Key 可用', () => {
    setReadBackend('tavily')
    let cfg = resolveReadConfig()
    expect(cfg.available).toBe(false)
    expect(cfg.reason).toBe('no_key')
    expect(readStatusText()).toContain('未配置 Key')

    setOwnReadKey('tvly-own')
    expect(hasOwnReadKey()).toBe(true)
    expect(getOwnReadKey()).toBe('tvly-own')
    cfg = resolveReadConfig()
    expect(cfg.available).toBe(true)
    expect(cfg.source).toBe('own')
    expect(readStatusText()).toContain('独立 Key')
  })

  it('Tavily 后端只有搜索 Key 时复用搜索的 Key', () => {
    setReadBackend('tavily')
    setOwnSearchKey('tvly-from-search')
    const cfg = resolveReadConfig()
    expect(cfg.available).toBe(true)
    expect(cfg.source).toBe('search')
    expect(cfg.key).toBe('tvly-from-search')
    expect(readStatusText()).toContain('复用搜索')
  })

  it('未知后端 id 回落直连', () => {
    global.uni.setStorageSync(READ_KEYS.backend, 'nope')
    expect(getReadBackendId()).toBe('direct')
  })
})

describe('executeReadUrl', () => {
  it('关掉后直接拒绝，不发请求', async () => {
    setReadEnabled(false)
    let called = false
    global.uni.request = () => { called = true }
    const r = await executeReadUrl('https://example.com')
    expect(r.ok).toBe(false)
    expect(r.text).toContain('已关闭')
    expect(called).toBe(false)
  })

  it('网址不合法直接拒绝', async () => {
    const r = await executeReadUrl('随便写点什么')
    expect(r.ok).toBe(false)
  })

  it('直连成功：一次请求搞定，不碰第三方', async () => {
    const urls = []
    global.uni.request = (opts) => {
      urls.push(opts.url)
      opts.success({ statusCode: 200, data: PAGE_HTML })
    }
    const r = await executeReadUrl('https://example.com/post')
    expect(r.ok).toBe(true)
    expect(r.text).toContain('听力要每天练 30 分钟')
    expect(urls).toEqual(['https://example.com/post'])
  })

  it('成功结果补上域名，卡片能显示读了哪个站（3.6.2）', async () => {
    global.uni.request = (opts) => opts.success({ statusCode: 200, data: PAGE_HTML })
    const r = await executeReadUrl('https://www.example.com/post')
    expect(r.ok).toBe(true)
    expect(r.detail.host).toBe('www.example.com')
    expect(r.detail.url).toBe('https://www.example.com/post')
  })

  it('网址后粘连中文时截断，并在结果里说明实际读了哪个网址（3.6.2）', async () => {
    const seen = []
    global.uni.request = (opts) => { seen.push(opts.url); opts.success({ statusCode: 200, data: PAGE_HTML }) }
    const r = await executeReadUrl('https://www.example.com/post看这个')
    expect(r.ok).toBe(true)
    expect(seen).toEqual(['https://www.example.com/post'])
    expect(r.text).toContain('网址后面的文字没有当网址用')
  })

  it('直连失败且没有第三方 Key：如实报错', async () => {
    global.uni.request = (opts) => opts.success({ statusCode: 403, data: '' })
    const r = await executeReadUrl('https://example.com/post')
    expect(r.ok).toBe(false)
    expect(r.text).toContain('拒绝抓取')
  })

  it('直连失败但手上有搜索的 Tavily Key：自动换第三方重试一次', async () => {
    setOwnSearchKey('tvly-search')
    const seen = []
    global.uni.request = (opts) => {
      seen.push(opts.url)
      if (opts.method === 'POST') {
        opts.success({ statusCode: 200, data: { results: [{ url: 'https://example.com/post', raw_content: '第三方读到的正文' }] } })
        return
      }
      opts.success({ statusCode: 403, data: '' })
    }
    const r = await executeReadUrl('https://example.com/post')
    expect(r.ok).toBe(true)
    expect(r.text).toContain('第三方读到的正文')
    expect(seen).toEqual(['https://example.com/post', 'https://api.tavily.com/extract'])
  })

  it('两个后端都失败时，两条原因都带上', async () => {
    setOwnSearchKey('tvly-search')
    global.uni.request = (opts) => {
      if (opts.method === 'POST') { opts.success({ statusCode: 500, data: { detail: '服务挂了' } }); return }
      opts.success({ statusCode: 403, data: '' })
    }
    const r = await executeReadUrl('https://example.com/post')
    expect(r.ok).toBe(false)
    expect(r.text).toContain('拒绝抓取')
    expect(r.text).toContain('服务挂了')
  })

  it('当前后端就是 Tavily 时不再兜底重试（避免同样失败跑两遍）', async () => {
    setReadBackend('tavily')
    setOwnReadKey('tvly-own')
    let count = 0
    global.uni.request = (opts) => { count++; opts.success({ statusCode: 500, data: { detail: 'x' } }) }
    const r = await executeReadUrl('https://example.com/post')
    expect(r.ok).toBe(false)
    expect(count).toBe(1)
  })

  it('Tavily 后端缺 Key 时给出设置路径', async () => {
    setReadBackend('tavily')
    const r = await executeReadUrl('https://example.com/post')
    expect(r.ok).toBe(false)
    expect(r.text).toContain('读网址')
  })

  it('resolveFallback：没有 Key 时返回 null', () => {
    expect(resolveFallback('')).toBe(null)
    expect(resolveFallback('tvly-x').backend.id).toBe('tavily')
  })
})

describe('工具注册与门控', () => {
  it('read_url 进了 TOOL_DEFINITIONS 与 QUERY_TOOLS，且不需要确认', () => {
    const def = TOOL_DEFINITIONS.find(t => t.name === 'read_url')
    expect(def).toBeTruthy()
    expect(def.parameters.required).toEqual(['url'])
    expect(QUERY_TOOLS.has('read_url')).toBe(true)
    expect(CONFIRM_TOOLS.has('read_url')).toBe(false)
    expect(needsConfirmation('read_url', { url: 'https://a.com' })).toBe(false)
  })

  it('read_url 的返回截断上限与抓取上限一致（8000）', () => {
    expect(getTruncateLimit('read_url')).toBe(8000)
  })

  it('工具描述里写清了「用户发网址就调它」', () => {
    expect(READ_URL_TOOL.description).toContain('网址')
  })
})