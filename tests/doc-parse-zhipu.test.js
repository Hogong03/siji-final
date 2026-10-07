/**
 * doc-parse 后端测试（4.17.0：智谱文件解析接入）
 *
 * 覆盖：zhipu 后端的请求组装（H5 files / App filePath 双形态）、上传响应解析、
 * 正文归一化（纯文本 / {content} JSON）、resolveDocConfig 的自动选用
 * （无独立 Key 时按 zhipu → moonshot 顺序复用厂商 Key）。
 * mock uni.uploadFile / uni.request —— 不发真实网络请求。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { resetStorage } from './setup.js'
import './setup.js'
import {
  DOC_BACKENDS, resolveDocConfig, parseDocument, setDocBackend, setOwnDocKey, getDocBackendId
} from '../utils/files/doc-parse.js'
import { encryptKeys } from '../utils/crypto.js'

beforeEach(() => resetStorage())

describe('zhipu 后端：请求组装', () => {
  it('buildUpload：H5 File 形态（url/formData/header 正确）', () => {
    const req = DOC_BACKENDS.zhipu.buildUpload({ file: { name: 'a.docx' } }, 'zk-test')
    expect(req.url).toBe('https://open.bigmodel.cn/api/paas/v4/files')
    expect(req.formData.purpose).toBe('file-extract')
    expect(req.header.Authorization).toBe('Bearer zk-test')
    expect(req.files[0].name).toBe('file')
  })

  it('buildUpload：App filePath 形态', () => {
    const req = DOC_BACKENDS.zhipu.buildUpload({ absPath: '_doc/upload/a.pdf' }, 'zk-test')
    expect(req.filePath).toBe('_doc/upload/a.pdf')
    expect(req.name).toBe('file')
    expect(req.formData.purpose).toBe('file-extract')
  })

  it('buildContentRequest：GET 正文端点带鉴权', () => {
    const req = DOC_BACKENDS.zhipu.buildContentRequest('file_123', 'zk-test')
    expect(req.url).toBe('https://open.bigmodel.cn/api/paas/v4/files/file_123/content')
    expect(req.method).toBe('GET')
    expect(req.header.Authorization).toBe('Bearer zk-test')
  })

  it('normalizeContent：纯文本直通、{content} JSON 取 content', () => {
    expect(DOC_BACKENDS.zhipu.normalizeContent({ data: '正文内容' })).toBe('正文内容')
    expect(DOC_BACKENDS.zhipu.normalizeContent({ data: '{"content":"提取的正文"}' })).toBe('提取的正文')
    expect(DOC_BACKENDS.zhipu.normalizeContent({ data: { content: '对象形态' } })).toBe('对象形态')
  })
})

describe('resolveDocConfig：自动选用（4.17.0）', () => {
  it('无独立 Key、配了智谱 Key → 自动选 zhipu（不再死守 Moonshot）', () => {
    uni.setStorageSync('siji_provider_keys', encryptKeys({ zhipu: 'zk-key' }))
    const cfg = resolveDocConfig()
    expect(cfg.available).toBe(true)
    expect(cfg.backendId).toBe('zhipu')
    expect(cfg.key).toBe('zk-key')
    expect(cfg.source).toBe('provider')
  })

  it('独立解析 Key 优先于自动选用', () => {
    uni.setStorageSync('siji_provider_keys', encryptKeys({ zhipu: 'zk-key' }))
    setOwnDocKey('own-key')
    const cfg = resolveDocConfig()
    expect(cfg.source).toBe('own')
    expect(cfg.backendId).toBe(getDocBackendId())
  })

  it('没有任何 Key → no_key 不可用', () => {
    const cfg = resolveDocConfig()
    expect(cfg.available).toBe(false)
    expect(cfg.reason).toBe('no_key')
  })
})

describe('parseDocument：zhipu 全链路（mock 上传与取正文）', () => {
  beforeEach(() => {
    // parseDocument 走 resolveDocConfig 取 Key —— 自动选用需要智谱厂商 Key 在位
    uni.setStorageSync('siji_provider_keys', encryptKeys({ zhipu: 'zk-key' }))
  })

  it('上传成功 → 取正文成功，返回解析文本', async () => {
    const calls = { upload: 0, content: 0, del: 0 }
    global.uni.uploadFile = (opts) => {
      calls.upload++
      opts.success({ statusCode: 200, data: JSON.stringify({ id: 'file_abc' }) })
    }
    global.uni.request = (opts) => {
      // 取正文与尽力删云端文件都走 uni.request，按端点分开计数
      if (String(opts.url).endsWith('/content')) calls.content++
      else calls.del++
      opts.success({ statusCode: 200, data: '这是提取出来的正文' })
    }
    const r = await parseDocument({ name: '报告.docx', path: '_doc/upload/x.docx' })
    expect(r.ok).toBe(true)
    expect(r.text).toBe('这是提取出来的正文')
    expect(calls.upload).toBe(1)
    expect(calls.content).toBe(1)
    expect(calls.del).toBe(1)
  })

  it('上传失败（HTTP 401）→ 可读原因', async () => {
    global.uni.uploadFile = (opts) => {
      opts.success({ statusCode: 401, data: JSON.stringify({ error: { message: 'invalid key' } }) })
    }
    const r = await parseDocument({ name: 'a.pdf', path: '_doc/x.pdf' })
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('上传失败')
  })
})
