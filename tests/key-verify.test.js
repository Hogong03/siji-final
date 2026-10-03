/**
 * key-verify 测试（免 Key 引导流）
 *
 * mock global.uni.request，锁死：
 *  - 200 → ok，且请求打到厂商 endpoint、带 Bearer 鉴权与最小 body（max_tokens:1 + ping）
 *  - 401 → 「Key 无效或未生效」
 *  - 404 → 「模型名不可用」
 *  - fail（网络）→ 「网络不通，稍后再试」
 *  - 空 Key 不发请求；四家控制台地址齐全
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { resetStorage } from './setup.js'
import './setup.js'
import { verifyProviderKey, PROVIDER_CONSOLE_URLS } from '../utils/ai/key-verify.js'

let originalRequest = null

beforeEach(() => {
  resetStorage()
  originalRequest = global.uni.request
})

afterEach(() => {
  if (originalRequest) global.uni.request = originalRequest
})

describe('verifyProviderKey', () => {
  it('200 返回 ok，请求打到厂商 endpoint、带 Bearer 鉴权与最小 body', async () => {
    let captured = null
    global.uni.request = (opts) => {
      captured = opts
      opts.success({ statusCode: 200, data: { choices: [{ message: { content: 'p' } }] } })
    }
    const r = await verifyProviderKey('deepseek', 'sk-test-123')
    expect(r.ok).toBe(true)
    expect(r.message).toContain('通过')
    expect(captured.url).toBe('https://api.deepseek.com/v1/chat/completions')
    expect(captured.method).toBe('POST')
    expect(captured.header.Authorization).toBe('Bearer sk-test-123')
    expect(captured.data.model).toBe('deepseek-v4-flash')
    expect(captured.data.max_tokens).toBe(1)
    expect(captured.data.stream).toBe(false)
    expect(captured.data.messages[0]).toEqual({ role: 'user', content: 'ping' })
  })

  it('401 翻译为「Key 无效或未生效」（智谱 endpoint 同样走 Bearer）', async () => {
    let captured = null
    global.uni.request = (opts) => {
      captured = opts
      opts.success({ statusCode: 401, data: { error: { code: '100.010', message: 'Authentication Fails' } } })
    }
    const r = await verifyProviderKey('zhipu', 'bad.key')
    expect(r.ok).toBe(false)
    expect(r.message).toContain('Key 无效或未生效')
    expect(captured.url).toBe('https://open.bigmodel.cn/api/paas/v4/chat/completions')
  })

  it('404 翻译为「模型名不可用」', async () => {
    global.uni.request = (opts) => {
      opts.success({ statusCode: 404, data: {} })
    }
    const r = await verifyProviderKey('deepseek', 'sk-x')
    expect(r.ok).toBe(false)
    expect(r.message).toContain('模型名不可用')
  })

  it('网络错误（fail）翻译为「网络不通，稍后再试」', async () => {
    global.uni.request = (opts) => {
      opts.fail({ errMsg: 'request:fail timeout' })
    }
    const r = await verifyProviderKey('qwen', 'sk-x')
    expect(r.ok).toBe(false)
    expect(r.message).toBe('网络不通，稍后再试')
  })

  it('空 Key 不发请求直接返回', async () => {
    let called = false
    global.uni.request = () => { called = true }
    const r = await verifyProviderKey('deepseek', '   ')
    expect(r.ok).toBe(false)
    expect(called).toBe(false)
    expect(r.message).toContain('请先输入 Key')
  })

  it('四家控制台地址齐全（key-guide 页「打开申请页」依赖）', () => {
    expect(PROVIDER_CONSOLE_URLS.deepseek).toContain('platform.deepseek.com')
    expect(PROVIDER_CONSOLE_URLS.zhipu).toContain('open.bigmodel.cn')
    expect(PROVIDER_CONSOLE_URLS.qwen).toContain('bailian.console.aliyun.com')
    expect(PROVIDER_CONSOLE_URLS.moonshot).toContain('platform.moonshot.cn')
  })
})
